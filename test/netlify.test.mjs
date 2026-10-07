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

test('Netlify check-ins load only nearby rows, pulses are per place and player, and deletes persist', async t => {
  const database = new NetlifyDB({ logger: () => {} });
  const connectionString = await database.start();
  const pool = new pg.Pool({ connectionString, max: 1 });
  t.after(async () => { await pool.end(); await database.stop(); });
  await database.applyMigrations('netlify/database/migrations');
  const { readPulse } = await import('../storage.mjs');
  const queries = [];
  const spy = { async connect() {
    const client = await pool.connect();
    return { release: () => client.release(), query: (sql, params) => { queries.push(sql); return client.query(sql, params); } };
  } };
  const player = () => {
    let cookie = '';
    return async (path, input) => {
      const request = new Request('https://city.example/api/' + path, {
        method: input ? 'POST' : 'GET', headers: { Cookie: cookie, ...(input ? { 'Content-Type': 'application/json' } : {}) },
        ...(input ? { body: JSON.stringify({ requestId: randomUUID(), ...input }) } : {}),
      });
      const response = await handlePersistentRequest(spy, request);
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      return { status: response.status, data: await response.json() };
    };
  };
  const ada = player(), ben = player();
  await ada('state'); await ben('state');
  assert.equal((await ada('action', { type: 'create', name: 'Ada', career: 'musician', origin: 0 })).status, 200);
  assert.equal((await ben('action', { type: 'create', name: 'Ben', career: 'actor', origin: 0 })).status, 200);
  queries.length = 0;
  const seen = (await ada('state')).data;
  assert.equal(seen.state.name, 'Ada');
  assert.ok(seen.players.some(p => p.name === 'Ben' && p.online), 'other players come from their public cards');
  assert.ok(!seen.players.some(p => 'blocks' in p), 'block lists stay private');
  assert.ok(queries.some(sql => sql.includes('pg_advisory_xact_lock_shared')), 'check-ins share the city lock');
  assert.ok(!queries.some(sql => /^SELECT \* FROM celebrity\.\w+$/.test(sql)), 'check-ins never load whole tables');
  const pulse = async keys => (await (await readPulse(pool, 'https://city.example/api/pulse' + (keys ? '?keys=' + keys : ''))).json()).at;
  const adaId = seen.playerId, benId = (await ben('state')).data.playerId;
  const before = await pulse('p:' + benId);
  await ada('action', { type: 'travel', location: 'studio' });
  assert.ok(await pulse('p:' + adaId) > 0, 'an action wakes the player');
  assert.ok(await pulse(`room:home:${adaId}`) > 0, 'and the room they left');
  assert.equal(await pulse('p:' + benId), before, 'but not people elsewhere');
  assert.ok(await pulse() > 0, 'older pages still get the city-wide pulse');
  assert.equal((await readPulse(pool, 'https://city.example/api/pulse?keys=bad%20key')).status, 400);
  assert.equal((await ben('auth', { type: 'logout', deleteGuest: true })).status, 200);
  assert.equal(Number((await pool.query('SELECT count(*) FROM celebrity.players WHERE id = $1', [benId])).rows[0].count), 0, 'deleted guests are removed from Postgres');
  assert.equal(Number((await pool.query('SELECT count(*) FROM celebrity.profiles WHERE id = $1', [benId])).rows[0].count), 0, 'with their public card');
  assert.ok(!(await ada('state')).data.players.some(p => p.name === 'Ben'));
});
