import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { schema, createGameService } from '../service.mjs';
import { ARENA, MONEY } from '../public/content.js';
import { addFame, raceFame, createCharacter, reconcile } from '../game.mjs';

test('the Award Arena crowns daily career, field and all-time winners and shows each player only their awards', async () => {
  const db = new DatabaseSync(':memory:');db.exec(schema);
  const handle = createGameService(db);
  const player = () => {
    let cookie = '';
    return async (input) => {
      const response = await handle(new Request('https://city.example/api/' + (input ? 'action' : 'state'), {
        method: input ? 'POST' : 'GET', headers: { cookie, ...(input ? { 'Content-Type': 'application/json' } : {}) },
        ...(input ? { body: JSON.stringify({ requestId: randomUUID(), ...input }) } : {}),
      }));
      const set = response.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
      return response.json();
    };
  };
  const ada = player(), ben = player(), cy = player();
  await ada(); await ben(); await cy();
  const adaId = (await ada({ type: 'create', name: 'Ada', career: 'football', origin: 0 })).playerId;
  await ben({ type: 'create', name: 'Ben', career: 'football', origin: 0 });
  const cyId = (await cy({ type: 'create', name: 'Cy', career: 'developer', origin: 0 })).playerId;
  // Ada had the best day; Cy is the most famous ever. Then a new day's ceremony runs.
  const yesterday = ARENA.day(Date.now()) - 1;
  db.prepare("UPDATE profiles SET data = json_set(data, '$.race', json(CASE id WHEN ? THEN ? ELSE ? END)), fame = CASE id WHEN ? THEN 50000 ELSE 1000 END")
    .run(adaId, JSON.stringify({ day: yesterday, fame: 900 }), JSON.stringify({ day: yesterday, fame: 100 }), cyId);
  db.exec('DELETE FROM arena');
  const view = await ada();
  assert.equal(view.arena.career.key, 'football');
  assert.equal(view.arena.career.list[0].name, 'Ada', 'most fame gained wins the career award');
  assert.equal(view.arena.family.key, 'sport');
  assert.equal(view.arena.goat[0].name, 'Cy', 'the all-time title goes to the most famous');
  assert.ok(!('tech' in (view.arena.family || {})) && view.arena.career.key !== 'developer', 'only your own awards are sent');
  assert.ok(view.state.awards.some(a => a.name.includes(ARENA.career.football.name)), 'the winner gets the award');
  assert.ok(view.state.money >= MONEY.start[0] + ARENA.cash.career + ARENA.cash.family, 'winners get prize money');
  assert.equal(raceFame(view.state, Date.now()), 0, 'prize fame does not count towards the next race');
  const techView = await cy();
  assert.equal(techView.arena.family.key, 'tech');
  assert.ok(techView.state.awards.some(a => a.name.includes(ARENA.goat.name)));
  const awards = view.state.awards.length;
  assert.equal((await ada()).state.awards.length, awards, 'one ceremony a day');
});

// One shared client for these tests.
function client(handle) {
  let cookie = '';
  return async (input) => {
    const response = await handle(new Request('https://city.example/api/' + (input ? 'action' : 'state'), {
      method: input ? 'POST' : 'GET', headers: { cookie, ...(input ? { 'Content-Type': 'application/json' } : {}) },
      ...(input ? { body: JSON.stringify({ requestId: randomUUID(), ...input }) } : {}),
    }));
    const set = response.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    return response.json();
  };
}

test('each day is a fresh race: only fame earned since the last ceremony counts, and only players who earned it then qualify', async () => {
  const db = new DatabaseSync(':memory:'); db.exec(schema);
  const handle = createGameService(db), today = ARENA.day(Date.now());
  const [dee, eve, fay] = [client(handle), client(handle), client(handle)];
  await dee(); await eve(); await fay();
  const ids = {};
  for (const [who, name] of [[dee, 'Dee'], [eve, 'Eve'], [fay, 'Fay']]) ids[name] = (await who({ type: 'create', name, career: 'musician', origin: 0 })).playerId;
  // Dee earned a lot two days ago and nothing since; Eve earned a little yesterday; Fay earned today (counts tomorrow).
  const race = { Dee: { day: today - 2, fame: 5000 }, Eve: { day: today - 1, fame: 40 }, Fay: { day: today, fame: 70 } };
  for (const [name, r] of Object.entries(race)) db.prepare("UPDATE profiles SET data = json_set(data, '$.race', json(?)), fame = ? WHERE id = ?").run(JSON.stringify(r), r.fame, ids[name]);
  db.exec('DELETE FROM arena');
  const view = await eve();
  assert.deepEqual(view.arena.career.list.map(p => p.name), ['Eve'], 'stale fame from before the last ceremony does not count');
  assert.equal(view.arena.career.list[0].trend, 40);
  assert.equal(view.arena.goat[0].name, 'Dee', 'the all-time award stays on total fame');
});

test('the live race shows your fame earned since the last ceremony against the leaders', async () => {
  const db = new DatabaseSync(':memory:'); db.exec(schema);
  const handle = createGameService(db);
  const [gus, hal] = [client(handle), client(handle)];
  await gus(); await hal();
  await gus({ type: 'create', name: 'Gus', career: 'tennis', origin: 0 });
  await hal({ type: 'create', name: 'Hal', career: 'football', origin: 0 });
  const quest = await gus({ type: 'emote', emote: Object.keys((await import('../public/content.js')).EMOTES)[0] });
  assert.ok(quest.arena.race.mine > 0, 'quest fame earned today shows in your race');
  assert.equal(quest.arena.race.since, ARENA.start(ARENA.day(Date.now())));
  assert.deepEqual(quest.arena.race.career.map(p => p.name), ['Gus'], 'career leaders today');
  const hview = await hal();
  assert.equal(hview.arena.race.mine, 0);
  assert.deepEqual(hview.arena.race.family.map(p => p.name), ['Gus'], 'field leaders across all sports');
});

test('the race counter keeps every point however busy you are, and resets at midnight', () => {
  const now = ARENA.start(ARENA.day(Date.now())) + 3_600_000, s = createCharacter({ name: 'Ike', career: 'developer', origin: 0 }, now);
  reconcile(s, now);
  for (let i = 0; i < 200; i++) addFame(s, 5, 'Work', now + i);
  assert.equal(s.fameLog.length, 60, 'the ledger is capped');
  assert.equal(raceFame(s, now + 1000), 1000, 'the race is not');
  addFame(s, 300, 'Award', now, false);
  assert.equal(raceFame(s, now + 1000), 1000, 'arena prizes do not count towards the race');
  assert.equal(raceFame(s, now + 86_400_000), 0, 'a new day is a new race');
  addFame(s, 7, 'Work', now + 86_400_000);
  assert.equal(raceFame(s, now + 86_400_000), 7);
  addFame(s, 9, 'Season award', now);
  assert.equal(s.race.fame, 7, 'fame stamped before the current race does not reopen an old one');
  assert.equal(s.fame, 1316, 'your total is kept');
});
