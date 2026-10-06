import { DatabaseSync } from 'node:sqlite';
import { schema, createGameService } from './service.mjs';

const tables = {
  players: ['id'], requests: ['player_id', 'request_id'], messages: ['id'],
  reports: ['id'], seasons: ['id'], agreements: ['id'], battles: ['id'],
};
const numeric = new Set(['created', 'at', 'starts', 'ends', 'settled']);

// A Postgres transaction owns the entire small city while the existing SQL rules
// run against a request-local working copy. Only changed rows are written back.
// This preserves multi-player atomicity without persisting any Lambda files.
export async function handlePersistentRequest(pool, request) {
  const client = await pool.connect();
  const working = new DatabaseSync(':memory:');
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '8s'");
    await client.query("SET LOCAL statement_timeout = '12s'");
    await client.query('SELECT pg_advisory_xact_lock(173204, 1)');
    working.exec(schema);
    const previous = {};
    for (const table of Object.keys(tables)) {
      const { rows } = await client.query(`SELECT * FROM celebrity.${table}`);
      previous[table] = new Map();
      for (const raw of rows) {
        const row = Object.fromEntries(Object.entries(raw).map(([key, value]) =>
          [key, numeric.has(key) || (table === 'seasons' && key === 'id') ? Number(value) : value]));
        const columns = Object.keys(row);
        working.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...Object.values(row));
        previous[table].set(keyFor(table, row), JSON.stringify(row));
      }
    }
    const response = await createGameService(working, { secureCookies: true })(request);
    if (response.status >= 500) throw new Error('Game request failed before persistence.');
    let changed = false;
    for (const [table, keys] of Object.entries(tables)) {
      for (const row of working.prepare(`SELECT * FROM ${table}`).all()) {
        if (previous[table].get(keyFor(table, row)) === JSON.stringify(row)) continue;
        changed = true;
        const columns = Object.keys(row), updates = columns.filter(column => !keys.includes(column));
        await client.query(`INSERT INTO celebrity.${table} (${columns.join(',')}) VALUES (${columns.map((_, i) => '$' + (i + 1)).join(',')}) ON CONFLICT (${keys.join(',')}) ${updates.length ? 'DO UPDATE SET ' + updates.map(column => `${column}=EXCLUDED.${column}`).join(',') : 'DO NOTHING'}`, Object.values(row));
      }
    }
    // Successful actions bump the pulse so other players refresh promptly; state polls do not.
    if (changed && request.method === 'POST' && response.status < 400) await client.query('UPDATE celebrity.pulse SET at = $1 WHERE id = 1', [Date.now()]);
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    // Do not leak database URLs, SQL or session material to players or logs.
    console.error('Persistent game request failed:', error.code || error.name);
    return Response.json({ error: 'Your city could not save this request. Please retry.' },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '2' } });
  } finally {
    working.close();
    client.release();
  }
}
function keyFor(table, row) { return JSON.stringify(tables[table].map(key => row[key])); }
