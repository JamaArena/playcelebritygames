import test from 'node:test';
import assert from 'node:assert/strict';
import { NetlifyDB } from '@netlify/database-dev';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { handlePersistentRequest } from '../storage.mjs';

test('Netlify Postgres persists cold requests, serializes retries and rolls back failed saves', async t => {
  const database = new NetlifyDB({ logger: () => {} });
  const connectionString = await database.start();
  // The embedded Postgres emulator has one underlying database connection.
  const pool = new pg.Pool({ connectionString, max: 1 });
  t.after(async () => { await pool.end(); await database.stop(); });
  await database.applyMigrations('netlify/database/migrations');
  let cookie = '';
  const call = async (input, options = {}) => {
    const request = new Request('https://city.example/api/' + (input ? 'action' : 'state'), {
      method: input ? 'POST' : 'GET', headers: { Cookie: cookie, ...(input ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      ...(input ? { body: JSON.stringify({ requestId: randomUUID(), ...input }) } : {}),
    });
    const response = await handlePersistentRequest(options.pool || pool, request);
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) { assert.match(setCookie, /HttpOnly; SameSite=Strict/); assert.match(setCookie, /; Secure/); cookie = setCookie.split(';')[0]; }
    return { status: response.status, data: await response.json() };
  };
  assert.equal((await call()).data.state, null);
  assert.equal((await call({ type: 'create', name: 'Cloud River', career: 'musician', origin: 0 })).status, 200);
  const saved = (await call()).data;
  assert.equal(saved.state.name, 'Cloud River');
  await call({ type: 'travel', location: 'studio' });
  // Walking takes minutes: fast-forward the trip in the database.
  await pool.query("UPDATE celebrity.players SET state = jsonb_set(state::jsonb, '{trip,arrives}', '0')::text WHERE state::jsonb->'trip' IS NOT NULL AND state::jsonb->>'trip' <> 'null'");
  const requestId = randomUUID();
  const retries = await Promise.all(Array.from({ length: 3 }, () => call({ type: 'start', kind: 'practice', skill: 'songwriting', requestId })));
  assert.ok(retries.every(result => result.status === 200));
  assert.equal((await call()).data.state.charges, 9, 'concurrent retries spend one charge');
  assert.equal((await call({ type: 'cancel' }, { headers: { Origin: 'https://other.example' } })).status, 400);
  await call({ type: 'cancel' });
  const failingPool = { async connect() {
    const client = await pool.connect();
    return { release: () => client.release(), query: (sql, params) => {
      if (sql.startsWith('INSERT INTO celebrity.players')) throw Object.assign(new Error('Injected save failure'), { code: 'TEST_FAILURE' });
      return client.query(sql, params);
    } };
  } };
  const failedId = randomUUID();
  assert.equal((await call({ type: 'travel', location: 'plaza', requestId: failedId }, { pool: failingPool })).status, 503);
  assert.equal((await call()).data.state.location, 'studio', 'a failed save changes nothing');
  assert.equal((await call({ type: 'travel', location: 'plaza', requestId: failedId })).status, 200);
  assert.equal((await call()).data.state.trip.to, 'plaza', 'the retried trip starts once');
  const pulse = async () => Number((await pool.query('SELECT at FROM celebrity.pulse WHERE id = 1')).rows[0].at);
  const afterAction = await pulse();
  assert.ok(afterAction > 0, 'successful actions bump the live pulse');
  await call();
  assert.equal(await pulse(), afterAction, 'state polling does not bump the pulse');
  const count = await pool.query('SELECT count(*) FROM celebrity.players');
  assert.equal(Number(count.rows[0].count), 1);
});
