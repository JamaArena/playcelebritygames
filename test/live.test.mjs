import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

async function scenario(t, extraEnv = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'celebrity-live-'));
  const server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '0', DATA_DIR: dir, VERCEL: '', DATABASE_URL: '', POSTGRES_URL: '', ...extraEnv } });
  t.after(async () => { const exited = new Promise(resolve => server.once('exit', resolve)); server.kill(); await exited; try { rmSync(dir, { recursive: true, force: true }); } catch {} });
  const base = await new Promise((resolve, reject) => {
    server.stdout.on('data', chunk => { const m = String(chunk).match(/http:\/\/[\d.]+:\d+/); if (m) resolve(m[0]); });
    server.on('exit', () => reject(new Error('server exited')));
  });
  const player = async name => {
    let cookie = '';
    const call = async (endpoint, input) => {
      const response = await fetch(base + '/api/' + endpoint, { method: input ? 'POST' : 'GET', headers: { cookie, ...(input ? { 'Content-Type': 'application/json' } : {}) }, ...(input ? { body: JSON.stringify({ requestId: randomUUID(), ...input }) } : {}) });
      const set = response.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
      return response.json();
    };
    await call('state');
    const created = await call('action', { type: 'create', name, career: 'actor', origin: 0 });
    return { call, id: created.playerId, state: created.state, get cookie() { return cookie; } };
  };
  const ada = await player('Ada'), ben = await player('Ben');
  const connect = (who, keys) => new Promise((resolve, reject) => {
    const ws = new WebSocket(base.replace('http', 'ws') + '/api/ws', { headers: { cookie: who.cookie } });
    ws.nudges = 0; ws.onmessage = () => ws.nudges++;
    ws.onopen = () => { ws.send(JSON.stringify({ keys })); resolve(ws); };
    ws.onerror = reject;
  });
  const adaLive = await connect(ada, [`room:home:${ada.id}`, `p:${ada.id}`]);
  const benLive = await connect(ben, [`p:${ben.id}`, `p:${ada.id}`]); // someone else's key is refused
  t.after(() => { adaLive.close(); benLive.close(); });
  await new Promise(resolve => setTimeout(resolve, 100));
  const { x, z } = ada.state.position3d || { x: 0, z: 1 };
  await ada.call('action', { type: 'move', x, z });
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(adaLive.nudges, 1, 'the player is nudged once');
  assert.equal(benLive.nudges, 0, 'others elsewhere are not, even if they ask for someone else');
  const pulse = await (await fetch(`${base}/api/pulse?keys=p:${ada.id}`)).json();
  assert.ok(pulse.at > 0, 'the polling fallback sees the same change');
  const anonymous = await new Promise(resolve => { const ws = new WebSocket(base.replace('http', 'ws') + '/api/ws'); ws.onopen = () => resolve('open'); ws.onerror = () => resolve('refused'); });
  assert.equal(anonymous, 'refused', 'sockets need a player cookie');
}
test('live WebSockets nudge only the room and players an action touched', t => scenario(t));
test('with Postgres, servers hear about changes through LISTEN/NOTIFY', async t => {
  const { NetlifyDB } = await import('@netlify/database-dev');
  const database = new NetlifyDB({ logger: () => {} });
  const connectionString = await database.start();
  t.after(() => database.stop());
  await scenario(t, { DATABASE_URL: connectionString });
});
