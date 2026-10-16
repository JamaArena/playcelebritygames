import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createCharacter, act, reconcile, lifeEvents, questProgress, lossCap, grantAward, feel, refreshWants, checkAspiration, ACTIVE_GAP_MS } from '../game.mjs';
import { createGameService } from '../service.mjs';
import { BALANCE, MOODLETS, moodOf, socialOdds, INTERACTIONS, MONEY, BILLS, billFor, sponsorPrice, priceOf, PAINTS, TRAITS, STARTER_OUTFITS, WANTS, WANT, ASPIRATIONS, ASPIRATION_REWARDS, bestMode, perksFor, relTier, CAREERS, HOME_SPOTS, canPlace } from '../public/content.js';

const T = 1_000_000;
const make = (career = 'musician', extra = {}) => createCharacter({ name: 'Nkem', career, origin: 0, adult: true, ...extra }, T);

test('A2: an award earned again is listed once with a count, and old duplicate awards fold together', () => {
  const s = make(); s.fame = 30_000;
  for (let i = 0; i < 4; i++) { s.nextEventAt = 0; s.prompt = null; lifeEvents(s, T + i, () => { const keys = ['magazineCover']; return 0.999; }); }
  grantAward(s, 'Cover star', s.career, T); grantAward(s, 'Cover star', s.career, T + 1);
  assert.equal(s.awards.filter(a => a.name === 'Cover star').length, 1);
  assert.equal(s.awards.find(a => a.name === 'Cover star').count, 2);
  const old = make(); old.version = 4; old.awards = [1, 2, 3, 4].map(i => ({ id: 'x' + i, name: 'Cover star', career: 'musician', at: T + i }));
  reconcile(old, T + 10);
  assert.equal(old.awards.length, 1); assert.equal(old.awards[0].count, 4); assert.equal(old.version, 5);
});

test('A4: trips default to the quickest free way; fares are only paid when you choose public transport, and the log says so', () => {
  const s = make(); s.money = 50_000; s.ride = 'hatchback';
  assert.equal(bestMode(s, 0), 'hatchback', 'your own car, even when an okada would be quicker in a go-slow');
  act(s, { type: 'travel', location: 'tech' }, T);
  assert.equal(s.money, 50_000, 'no fare taken'); assert.match(s.events[0].message, /free/);
  s.location = 'tech'; s.trip = null;
  act(s, { type: 'travel', location: 'plaza', mode: 'danfo' }, T + 1);
  assert.equal(s.money, 50_000 - MONEY.fares.danfo); assert.match(s.events[0].message, /₦300 fare/); assert.match(s.events[0].message, /\d+s ·/, 'short trips show seconds');
});

test('A5: a scandal costs at most about three recent jobs of fame, not a share of all your fame', () => {
  const s = make(); s.fame = 60_000; s.outputs = [{ fame: 65 }, { fame: 60 }, { fame: 70 }];
  assert.equal(lossCap(s), 195);
  s.location = 'home'; s.nextEventAt = 0;
  // Force the scandal: only the scandal is eligible when everything else is filtered by the roll.
  const before = s.fame; let seen = false;
  for (let i = 0; i < 60 && !seen; i++) { s.nextEventAt = 0; s.prompt = null; s.fame = before; lifeEvents(s, T + i, () => i / 60); if (s.lifeEvent.kind === 'scandal') { seen = true; assert.equal(s.fame, before - 195); } }
  assert.ok(seen, 'a scandal was drawn');
});

test('A6: saves touched by someone else (passive) never get life events, decay or a fresh online time', () => {
  const s = make(); s.lastSeen = T; s.nextEventAt = T; const needs = { ...s.needs };
  reconcile(s, T + 30_000, { passive: true });
  assert.equal(s.lastSeen, T, 'still offline'); assert.deepEqual(s.needs, needs); assert.equal(s.lifeEvent, undefined);
  reconcile(s, T + 60_000, { passive: true }); reconcile(s, T + 90_000, { passive: true });
  assert.equal(s.lifeEvent, undefined, 'a chain of other players’ requests does not keep you “active”');
  reconcile(s, T + 60_000 + ACTIVE_GAP_MS * 3); assert.equal(s.lifeEvent, undefined, 'returning after a gap: no catch-up events');
});

test('A8: the lucky break only mentions your post if you have posted', () => {
  const s = make(); s.fame = 1000; s.location = 'plaza'; s.nextEventAt = 0;
  lifeEvents(s, T, () => 0); assert.equal(s.lifeEvent.kind, 'luckyBreak'); assert.match(s.lifeEvent.text, /radio/);
  s.posts = [{ body: 'hi' }]; s.nextEventAt = 0; lifeEvents(s, T + 1, () => 0); assert.match(s.lifeEvent.text, /latest post/);
});

test('B1/B2: social interactions move friendship and romance, have odds from mood, fame and the relationship, and NPCs remember you', () => {
  const s = make(); s.location = 'studio';
  assert.throws(() => act(s, { type: 'socialize', target: 'npc:kai', kind: 'chat' }, T), /isn’t here/);
  act(s, { type: 'socialize', target: 'npc:nova', kind: 'chat' }, T, () => 0);
  assert.equal(s.rel['npc:nova'].f, INTERACTIONS.chat.f); assert.equal(s.lastSocial.ok, true);
  assert.throws(() => act(s, { type: 'socialize', target: 'npc:nova', kind: 'joke' }, T + 1000), /needs a second/);
  act(s, { type: 'socialize', target: 'npc:nova', kind: 'insult' }, T + 10_000, () => .99);
  assert.equal(s.lastSocial.ok, false); assert.ok(moodOf(s, T + 10_000).list.some(m => m.kind === 'embarrassed'), 'a mean move that falls flat is embarrassing');
  assert.throws(() => act(s, { type: 'socialize', target: 'npc:nova', kind: 'kiss' }, T + 20_000), /romance 40\+/);
  // Odds: a close friend in a good mood beats a stranger in a bad mood.
  const happy = make(), sad = make(); sad.needs = Object.fromEntries(Object.keys(sad.needs).map(k => [k, 10]));
  assert.ok(socialOdds(happy, 'joke', { f: 60 }, T) > socialOdds(sad, 'joke', { f: 0 }, T));
  assert.ok(socialOdds(make('musician', { traits: ['charmer'] }), 'flirt', {}, T) > socialOdds(make(), 'flirt', {}, T), 'charmers flirt better');
  // Talking to a named NPC again: they greet you as a friend.
  s.rel['npc:nova'].f = 50; s.rel['npc:nova'].n = 5;
  act(s, { type: 'talk', npc: 'nova' }, T + 100_000);
  assert.match(s.lastTalk.line, /Nkem/); assert.equal(relTier(s.rel['npc:nova']), 'Good friend');
  // Regulars remember too: a friend of 30+ loves seeing you.
  s.location = 'plaza'; s.rel['reg:plaza:2'] = { f: 40, r: 0, n: 3, last: 0 };
  act(s, { type: 'chatRegular', npc: 'plaza:2' }, T + 200_000); assert.equal(s.lastChat.kind, 'love');
  assert.throws(() => act(s, { type: 'socialize', target: 'reg:plaza:2', kind: 'flirt' }, T + 300_000), /well enough for romance/);
});

test('B3: solo romance with an NPC: crush, date, partner, proposal and marriage', () => {
  const s = make(); s.location = 'studio'; let t = T;
  const rel = () => s.rel['npc:nova'];
  act(s, { type: 'socialize', target: 'npc:nova', kind: 'chat' }, t, () => 0);
  assert.throws(() => act(s, { type: 'goOnDate', npc: 'npc:nova' }, t += 10_000), /romance to 30/);
  for (const kind of ['flirt', 'flirt', 'flirt', 'sweetTalk']) act(s, { type: 'socialize', target: 'npc:nova', kind }, t += 400_000, () => 0);
  assert.ok(rel().r >= 30, `romance ${rel().r}`);
  act(s, { type: 'goOnDate', npc: 'npc:nova' }, t += 10_000); reconcile(s, s.recovery.endsAt + 1, { passive: true });
  assert.ok(moodOf(s, t + 100_000).list.some(m => m.kind === 'flirty'));
  rel().r = 60; rel().f = 40;
  act(s, { type: 'socialize', target: 'npc:nova', kind: 'askPartner' }, t += 400_000, () => 0);
  assert.equal(s.partner.id, 'npc:nova');
  rel().r = 85; rel().f = 60;
  act(s, { type: 'socialize', target: 'npc:nova', kind: 'propose' }, t += 400_000, () => 0);
  assert.equal(s.spouse.id, 'npc:nova'); assert.equal(s.spouse.npc, true); assert.equal(s.partner, null);
  assert.ok(s.awards.some(a => a.name === 'Married')); assert.equal(perksFor(s).social >= 15, true, 'a city spouse keeps loneliness away');
});

test('B4: moodlets are timed, add to mood, pick the mood gem’s emotion, and nudge work odds', () => {
  const s = make(); s.lastSeen = T;
  const base = moodOf(s, T).value;
  feel(s, 'inspired', T); assert.equal(moodOf(s, T).emotion, 'inspired'); assert.equal(moodOf(s, T).value, base + MOODLETS.inspired.mood);
  assert.equal(moodOf(s, T + MOODLETS.inspired.ms + 1).emotion, null, 'it wears off');
  // Work odds: the same choice is better when inspired than when embarrassed.
  const odds = mood => { const w = make(); w.location = 'studio'; w.moodlets = []; if (mood) feel(w, mood, T); act(w, { type: 'start', kind: 'produce' }, T, () => .5); return import('../game.mjs').then(g => g.view(w, w.active.readyAt).active.choices[0].probability); };
  return Promise.all([odds('inspired'), odds('embarrassed')]).then(([up, down]) => assert.ok(up > down, `${up} > ${down}`));
});

test('B5: needs drain about five times faster, so a 20-minute session needs care', () => {
  assert.ok(BALANCE.decay.hunger >= 50 && BALANCE.decay.bladder >= 60);
  const s = make(); s.lastSeen = T; s.nextEventAt = Infinity;
  for (let t = T + 45_000; t <= T + 20 * 60_000; t += 45_000) reconcile(s, t);
  assert.ok(s.needs.bladder < 60 && s.needs.hunger < 65, JSON.stringify(s.needs));
  assert.ok(Object.values(s.needs).every(v => v > 5), 'but nothing hits rock bottom in 20 minutes');
});

test('B7: bills by home every real day, paid from your wallet; unpaid bills switch off the power', () => {
  const s = make(); s.lastSeen = T; s.money = 10_000;
  assert.equal(s.billsDue, T + BILLS.everyMs);
  const bill = billFor(s); s.lastSeen = T + BILLS.everyMs - 1000; reconcile(s, T + BILLS.everyMs);
  assert.equal(s.money, 10_000 - bill); assert.equal(s.unpaid, 0);
  s.money = 1000; s.lastSeen = s.billsDue - 1000; reconcile(s, s.billsDue);
  assert.equal(s.money, 0); assert.ok(s.unpaid > 0);
  s.location = 'home'; s.inventory.gamingConsole = { level: 1 }; s.furniture.push({ id: 'g', item: 'gamingConsole', x: 0, z: -1 });
  assert.throws(() => act(s, { type: 'useItem', item: 'gamingConsole' }, s.lastSeen + 1), /bills/);
  s.money = 50_000; act(s, { type: 'payBills' }, s.lastSeen + 2); assert.equal(s.unpaid, 0);
  act(s, { type: 'useItem', item: 'gamingConsole' }, s.lastSeen + 3); assert.equal(s.recovery.item, 'gamingConsole');
  assert.ok(MONEY.rent.mansion > MONEY.rent.studioFlat);
});

test('B7: homes and premium rides cost naira on top of the fame gate; existing owners keep theirs', () => {
  const s = make(); s.fame = 10_000; s.location = 'plaza'; s.money = 100_000;
  assert.throws(() => act(s, { type: 'claim', item: 'duplex' }, T), /You need ₦400,000/);
  s.money = 500_000; act(s, { type: 'claim', item: 'duplex' }, T); assert.equal(s.home, 'duplex'); assert.equal(s.money, 100_000);
  act(s, { type: 'claim', item: 'bicycle' }, T); assert.equal(s.money, 100_000, 'starter sponsorships stay free');
  assert.equal(sponsorPrice('scooter'), 0);
  const owner = make(); owner.vip = { coupe: { at: 1 } }; owner.location = 'plaza'; act(owner, { type: 'useVip', item: 'coupe' }, T); assert.equal(owner.ride, 'coupe');
});

test('B8: build mode lite: rotate, sell back for half, and paint walls and floors', () => {
  const s = make(); s.location = 'plaza'; s.money = 100_000; s.fame = 1000;
  act(s, { type: 'buy', item: 'chair' }, T); s.location = 'home';
  let x, z;for (let i = -8; i <= 8 && x === undefined; i++) for (let j = -8; j <= 8; j++) if (canPlace(s.furniture, null, i / 2, j / 2, s.home)) { x = i / 2; z = j / 2; break; }act(s, { type: 'place', item: 'chair', x, z }, T); const id = s.furniture[0].id;
  act(s, { type: 'rotate', id }, T); act(s, { type: 'rotate', id }, T); assert.equal(s.furniture[0].rot, 2);
  const before = s.money; act(s, { type: 'sell', item: 'chair', id }, T);
  assert.equal(s.money, before + Math.round(priceOf('chair') * .5 / 50) * 50); assert.equal(s.inventory.chair, undefined); assert.equal(s.furniture.length, 0);
  act(s, { type: 'paint', wall: 2, floor: 1 }, T); assert.deepEqual(s.homeStyle, { wall: PAINTS.walls[2], floor: PAINTS.floors[1] }); assert.equal(s.money, before + Math.round(priceOf('chair') * .5 / 50) * 50 - MONEY.paint);
});

test('B9: the creator sets two traits, a starting outfit and a life goal; older characters pick traits once', () => {
  const s = make('musician', { traits: ['foodie', 'charmer', 'loner'], outfit: 'sporty', aspiration: 'butterfly' });
  assert.deepEqual(s.traits, ['foodie', 'charmer']); assert.equal(s.wear.top, 'tracksuitTop'); assert.ok(s.closet.tracksuitTop); assert.equal(s.aspiration.key, 'butterfly');
  assert.equal(perksFor(s).hunger, -10, 'foodies get hungry faster');
  const old = make(); old.traits = [];
  assert.throws(() => act(old, { type: 'pickTraits', traits: ['foodie'] }, T), /Pick 2/);
  act(old, { type: 'pickTraits', traits: ['ambitious', 'creative'] }, T); assert.throws(() => act(old, { type: 'pickTraits', traits: ['foodie', 'loner'] }, T), /already set/);
  assert.equal(Object.keys(TRAITS).length, 8); assert.ok(Object.keys(STARTER_OUTFITS).length >= 4);
});

test('B10: aspirations pay once per stage; wants appear, get fulfilled and are replaced', () => {
  const s = make(); s.fame = 6000;
  act(s, { type: 'pickAspiration', key: 'superstar' }, T);
  assert.equal(s.aspiration.stage, 2); const fame = s.fame;
  act(s, { type: 'pickAspiration', key: 'bigBoss' }, T); act(s, { type: 'pickAspiration', key: 'superstar' }, T);
  assert.equal(s.fame, fame, 'switching back does not pay twice');
  assert.equal(s.fameLog.filter(e => /Aspiration/.test(e.reason)).length, 2);
  s.lastSeen = T; reconcile(s, T + 1000); assert.equal(s.wants.length, WANT.count);
  s.wants = [{ id: 'w', key: 'music', at: T, until: T + WANT.ms }];
  const before = s.fame; questProgress(s, { type: 'listenMusic' }, T + 2000);
  assert.equal(s.fame, before + WANT.fame); assert.equal(s.wants.length, WANT.count); assert.ok(!s.wants.some(w => w.id === 'w'));
});

test('service: social moves with another player update both sides; logging out marks you offline at once', async () => {
  const db = new DatabaseSync(':memory:'), handle = createGameService(db, { fast: true });
  const client = () => { let cookie = ''; return async (input, path = input ? '/api/action' : '/api/state') => {
    const r = await handle(new Request('http://x' + path, { method: input ? 'POST' : 'GET', headers: { ...(input ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, ...(input ? { body: JSON.stringify(path === '/api/auth' ? input : { requestId: randomUUID(), ...input }) } : {}) }));
    const c = r.headers.get('set-cookie'); if (c) cookie = c.split(';')[0]; return { status: r.status, data: await r.json() }; }; };
  const a = client(), b = client();
  const aId = (await a({ type: 'create', name: 'Ade', career: 'musician' })).data.playerId, bId = (await b({ type: 'create', name: 'Bisi', career: 'actor' })).data.playerId;
  const edit = (id, fn) => { const s = JSON.parse(db.prepare('SELECT state FROM players WHERE id=?').get(id).state); fn(s); db.prepare('UPDATE players SET state=? WHERE id=?').run(JSON.stringify(s), id); };
  for (const id of [aId, bId]) edit(id, s => { s.location = 'plaza'; s.trip = null; });
  await a(); await b();
  const r = await a({ type: 'socialize', target: bId, kind: 'chat' }); assert.equal(r.status, 200, JSON.stringify(r.data));
  const df = r.data.state.rel[bId].f; assert.equal((await b()).data.state.rel[aId].f, df, 'both remember');
  assert.equal((await a({ type: 'socialize', target: bId, kind: 'flirt' })).status, 400, 'no romance unless they are open to it');
  await a({ type: 'signup', username: 'ade_test', password: 'password-123', adult: true }, '/api/auth');
  await a({ type: 'logout' }, '/api/auth');
  const seen = JSON.parse(db.prepare('SELECT state FROM players WHERE id=?').get(aId).state).lastSeen;
  assert.ok(Date.now() - seen > 100_000, 'shown offline straight away');
});
