import test from 'node:test';
import assert from 'node:assert/strict';
import { NetlifyDB } from '@netlify/database-dev';
import pg from 'pg';
import { initialize, cloudRequest } from '../vercel-storage.mjs';
import { handlePersistentRequest } from '../storage.mjs';

test('Vercel initializes a fresh Postgres database and preserves saves on cold initialization', async t => {
  const database = new NetlifyDB({ logger: () => {} });
  const connectionString = await database.start();
  const pool = new pg.Pool({ connectionString, max: 1 });
  t.after(async () => { await pool.end(); await database.stop(); });
  await initialize(pool);
  const created = await handlePersistentRequest(pool, new Request('https://city.example/api/action', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'create', name: 'Vercel River', career: 'musician', origin: 0, requestId: 'vercel-create' }),
  }));
  assert.equal(created.status, 200);
  const cookie = created.headers.get('set-cookie').split(';')[0];
  const before = await pool.query('SELECT at FROM celebrity.pulse WHERE id=1');
  await initialize(pool);
  assert.deepEqual((await pool.query('SELECT at FROM celebrity.pulse WHERE id=1')).rows, before.rows);
  const loaded = await handlePersistentRequest(pool, new Request('https://city.example/api/state', { headers: { Cookie: cookie } }));
  assert.equal((await loaded.json()).state.name, 'Vercel River');
  assert.equal((await pool.query("SELECT count(*) FROM celebrity.players")).rows[0].count, '1');
});

test('Vercel disables instance-local live streams and fails clearly without a database', async () => {
  assert.equal((await cloudRequest(new Request('https://city.example/api/live'))).status, 204);
  const previous = [process.env.DATABASE_URL, process.env.POSTGRES_URL];
  delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
  try {
    const result = await cloudRequest(new Request('https://city.example/api/state'));
    assert.equal(result.status, 503);
    assert.equal(result.headers.get('cache-control'), 'no-store');
  } finally {
    for (const [i, key] of ['DATABASE_URL', 'POSTGRES_URL'].entries()) {
      if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i];
    }
  }
});
