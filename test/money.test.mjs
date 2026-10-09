import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter, act, reconcile } from '../game.mjs';
import { CAREERS, MONEY, FOODS, VENUE_ACTS, priceOf, wearPrice, jobPay, bestMode } from '../public/content.js';
const T = 1_000_000;
const make = (career = 'football', origin = 0) => createCharacter({ name: 'Nkem', career, origin, adult: true }, T);
const arrive = s => { if (s.trip) { s.location = s.trip.to; s.trip = null; } };
function work(s, rng = () => 0) {
  s.location = CAREERS[s.career].location;
  act(s, { type: 'start', kind: 'produce', title: 'Payday' }, T + 1, rng);
  const id = s.active.id;
  while (s.active.beat < s.active.totalBeats) act(s, { type: 'decision', activityId: id, beat: s.active.beat, choice: 0 }, s.active.readyAt, rng);
  act(s, { type: 'finish', activityId: id }, s.active.readyAt, rng);
  return s.results[0];
}

test('new players start with naira; older saves get a balance that grows with their fame and keep their phone', () => {
  assert.equal(make('musician', 0).money, MONEY.start[0]);
  assert.equal(make('musician', 1).money, MONEY.start[1]);
  const old = make('musician');old.version = 3;delete old.money;delete old.phones;old.fame = 4000;old.phone = 'smart';
  reconcile(old, T);
  assert.equal(old.money, MONEY.start[0] + 40_000);assert.deepEqual(old.phones, ['basic', 'smart']);assert.equal(old.version, 4);
});

test('work pays by tier, quality and result, and the pay is on the result', () => {
  assert.ok(jobPay(0, 80, 'Win') > jobPay(0, 80, 'Loss'), 'a win pays more than a loss');
  assert.ok(jobPay(0, 90) > jobPay(0, 40), 'great quality pays more');
  assert.ok(jobPay(2, 50) > jobPay(1, 50) && jobPay(1, 50) > jobPay(0, 50), 'higher tiers pay more');
  assert.equal(jobPay(3, 50, null, 'trial'), 0, 'trials are unpaid');
  const s = make('musician'), before = s.money, r = work(s);
  assert.ok(r.pay > 0);assert.equal(r.pay, jobPay(0, r.quality));assert.equal(s.money, before + r.pay);
  assert.equal(s.moneyLog[0].delta, r.pay);assert.match(s.moneyLog[0].reason, /Pay/);
});

test('fares: public transport costs naira, walking and your own ride are free, and the fastest choice skips fares you cannot afford', () => {
  const s = make();
  act(s, { type: 'travel', location: 'tech', mode: 'danfo' }, T);
  assert.equal(s.money, MONEY.start[0] - MONEY.fares.danfo);assert.match(s.moneyLog[0].reason, /Danfo/);
  arrive(s);s.money = 100;
  assert.throws(() => act(s, { type: 'travel', location: 'mall', mode: 'okada' }, T + 1), /fare is ₦800/);
  assert.equal(bestMode(s, T + 1), 'walk', 'too broke for a fare: walk');
  act(s, { type: 'travel', location: 'mall', mode: 'walk' }, T + 1);assert.equal(s.money, 100);arrive(s);
  s.ride = 'hatchback';act(s, { type: 'travel', location: 'tech', mode: 'own' }, T + 2);assert.equal(s.money, 100, 'your own car is free to drive');
});

test('shopping costs naira while fame still unlocks; you get a clear "can\'t afford" message', () => {
  const s = make();s.location = 'plaza';
  assert.throws(() => act(s, { type: 'buy', item: 'gamingConsole' }, T), /400 fame/, 'fame still unlocks');
  s.fame = 500;s.money = 1000;
  assert.throws(() => act(s, { type: 'buy', item: 'gamingConsole' }, T), /You need ₦42,000 for that\. You have ₦1,000\./);
  s.money = 70_000;act(s, { type: 'buy', item: 'gamingConsole' }, T);assert.equal(s.money, 70_000 - priceOf('gamingConsole'));assert.equal(s.fame, 500, 'fame is never spent');
  act(s, { type: 'claimWear', item: 'hoodie' }, T);assert.equal(s.money, 70_000 - priceOf('gamingConsole') - wearPrice('hoodie'));
  s.phone = 'smart';const left = s.money;act(s, { type: 'order', kind: 'groceries' }, T);assert.equal(s.money, left - MONEY.groceries - MONEY.delivery);
});

test('food and outings cost money; groceries prepay home cooking; the everyday meal stays free', () => {
  const s = make();s.needs.hunger = 10;
  act(s, { type: 'recover', need: 'hunger', food: 'jollof' }, T);assert.equal(s.money, MONEY.start[0] - FOODS.jollof.price);act(s, { type: 'cancel' }, T);
  s.groceries = 1;const m = s.money;act(s, { type: 'recover', need: 'hunger', food: 'jollof' }, T);assert.equal(s.money, m, 'groceries cover the ingredients');act(s, { type: 'cancel' }, T);
  act(s, { type: 'recover', need: 'hunger' }, T);assert.equal(s.money, m, 'the everyday meal is free');act(s, { type: 'cancel' }, T);
  s.location = 'market';act(s, { type: 'venueAct', act: 'bukka' }, T);assert.equal(s.money, m - VENUE_ACTS.bukka.cost);act(s, { type: 'cancel' }, T);
  s.money = 0;assert.throws(() => act(s, { type: 'venueAct', act: 'bukka' }, T), /You need ₦1,500/);
  s.location = 'mall';assert.throws(() => act(s, { type: 'restyle', hair: 'afro', hairColor: 'black' }, T), /You need ₦3,000/);
});

test('paid venue acts and manager gigs pay naira', () => {
  const s = make('musician');s.location = 'nightclub';
  act(s, { type: 'venueAct', act: 'djSet' }, T);reconcile(s, s.recovery.endsAt + 1);
  assert.equal(s.money, MONEY.start[0] + VENUE_ACTS.djSet.pay);
  const f = make('football');f.location = 'nightclub';act(f, { type: 'venueAct', act: 'djSet' }, T);reconcile(f, f.recovery.endsAt + 1);
  assert.equal(f.money, MONEY.start[0], 'only musicians get paid for a DJ set');
  s.gig = { id: 'g', act: 'dance', until: T + 600_000, bonus: 20, pay: 5000 };s.money = 10_000;
  act(s, { type: 'venueAct', act: 'dance' }, T + 1);reconcile(s, s.recovery.endsAt + 1);
  assert.equal(s.money, 10_000 - VENUE_ACTS.dance.cost + 5000);
});

test('a new player can afford food, fares and small items from a few jobs; bigger things take saving', () => {
  const s = make('vlogger');s.money = 0;for (let i = 0; i < 4; i++) { work(s, () => .3);s.charges = 10;s.needs.energy = s.needs.hunger = 80; }
  const earned = s.money;
  assert.ok(earned >= FOODS.jollof.price * 3 + MONEY.fares.danfo * 4 + priceOf('chair'), `four jobs (${earned}) cover meals, fares and a chair`);
  assert.ok(earned < priceOf('gamingConsole'), 'a games console takes saving');
});
