import test from 'node:test';
import assert from 'node:assert/strict';

test('gym crowd: people move between machines, never share one, and leave the one you asked for', async () => {
  let t = 0; const realPerformance = globalThis.performance;
  Object.defineProperty(globalThis, 'performance', { value: { now: () => t * 1000 }, configurable: true });
  try {
    const { World } = await import('../public/world.js'); const w = Object.create(World.prototype); w.location = 'gym'; w.state = {}; w.say = () => {};
    let clashes = 0, changes = 0; const last = new Map(); let promised = null, broken = false;
    for (let i = 0; i < 12_000; i++) {
      t += .05; w.gymCrowdStep();
      const using = w.gymCrowd.filter(c => !c.path.length && c.machine).map(c => c.machine.key); if (new Set(using).size !== using.length) clashes++;
      for (const c of w.gymCrowd) { const k = c.machine?.key; if (last.get(c) !== k) { changes++; last.set(c, k); } }
      if (i === 2000) { promised = w.gymCrowd[0].machine.key; assert.equal(w.occupant({ key: promised }), w.gymCrowd[0]); w.evict(0, 'Sure'); }
      if (i > 2000 && i < 2200 && w.gymCrowd.some(c => c.machine?.key === promised)) broken = true;
    }
    assert.equal(clashes, 0, 'two people never use one machine'); assert.ok(changes > 20, 'people move between machines'); assert.equal(broken, false, 'the machine you asked for stays free');
  } finally { Object.defineProperty(globalThis, 'performance', { value: realPerformance, configurable: true }); }
});
