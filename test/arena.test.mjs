import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { schema, createGameService } from '../service.mjs';
import { ARENA } from '../public/content.js';

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
  db.prepare("UPDATE profiles SET trend = CASE id WHEN ? THEN 900 ELSE 100 END, fame = CASE id WHEN ? THEN 50000 ELSE 1000 END").run(adaId, cyId);
  db.exec('DELETE FROM arena');
  const view = await ada();
  assert.equal(view.arena.career.key, 'football');
  assert.equal(view.arena.career.list[0].name, 'Ada', 'most fame gained wins the career award');
  assert.equal(view.arena.family.key, 'sport');
  assert.equal(view.arena.goat[0].name, 'Cy', 'the all-time title goes to the most famous');
  assert.ok(!('tech' in (view.arena.family || {})) && view.arena.career.key !== 'developer', 'only your own awards are sent');
  assert.ok(view.state.awards.some(a => a.name.includes(ARENA.career.football.name)), 'the winner gets the award');
  const techView = await cy();
  assert.equal(techView.arena.family.key, 'tech');
  assert.ok(techView.state.awards.some(a => a.name.includes(ARENA.goat.name)));
  const awards = view.state.awards.length;
  assert.equal((await ada()).state.awards.length, awards, 'one ceremony a day');
});
