import test from 'node:test';
import assert from 'node:assert/strict';

test('city traffic: cars never drive into each other and never gridlock', async () => {
  let t = 0; const realPerformance = globalThis.performance;
  Object.defineProperty(globalThis, 'performance', { value: { now: () => t * 1000 }, configurable: true });
  try {
    const { World } = await import('../public/world.js'); const w = {}, at = c => c.axis === 'x' ? [c.pos, c.lane] : [c.lane, c.pos], still = new Map();
    let gap = Infinity, crossings = 0, longest = 0;
    for (let i = 0; i < 12_000; i++) { // ten minutes at 20 frames a second
      t += .05; World.prototype.trafficStep.call(w);
      for (const c of w.traffic) { const n = c.v < .2 ? (still.get(c) || 0) + 1 : 0; still.set(c, n); longest = Math.max(longest, n * .05); }
      for (const a of w.traffic) for (const b of w.traffic) { if (a === b) continue; const [ax, az] = at(a), [bx, bz] = at(b);
        if (a.axis === b.axis && a.lane === b.lane) gap = Math.min(gap, Math.abs(a.pos - b.pos));
        else if (a.axis !== b.axis && Math.abs(ax - bx) < 1.1 && Math.abs(az - bz) < 1.1) crossings++; }
    }
    assert.ok(gap > 2.5, `cars keep their distance in a lane (closest ${gap.toFixed(2)})`);
    assert.equal(crossings, 0, 'no two cars meet in a junction');
    assert.ok(longest < 20, `nobody waits forever (longest stop ${longest.toFixed(1)}s)`);
  } finally { Object.defineProperty(globalThis, 'performance', { value: realPerformance, configurable: true }); }
});
