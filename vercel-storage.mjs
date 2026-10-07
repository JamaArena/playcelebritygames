import pg from 'pg';
import { readFileSync } from 'node:fs';
import { handlePersistentRequest, readPulse } from './storage.mjs';
import { resendSender } from './email.mjs';

const migrations = [
  new URL('./netlify/database/migrations/0001_celebrity-city/migration.sql', import.meta.url),
  new URL('./netlify/database/migrations/0002_live-pulse/migration.sql', import.meta.url),
  new URL('./netlify/database/migrations/0003_battles/migration.sql', import.meta.url),
  new URL('./netlify/database/migrations/0004_accounts/migration.sql', import.meta.url),
  new URL('./netlify/database/migrations/0005_active-device/migration.sql', import.meta.url),
  new URL('./netlify/database/migrations/0006_profiles-pulses/migration.sql', import.meta.url),
];
let pool, ready;
async function database() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) throw new Error('Database not configured');
  pool ||= new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 8000, idleTimeoutMillis: 10000 });
  ready ||= initialize(pool).catch(error => { ready = null; throw error; });
  await ready;
  return pool;
}
export async function initialize(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '8s'");
    await client.query('SELECT pg_advisory_xact_lock(173204, 2)');
    for (const file of migrations) {
      const sql = readFileSync(file, 'utf8').replace(/CREATE TABLE /g, 'CREATE TABLE IF NOT EXISTS ')
        .replace('INSERT INTO celebrity.pulse VALUES(1,0);', 'INSERT INTO celebrity.pulse VALUES(1,0) ON CONFLICT (id) DO NOTHING;');
      await client.query(sql);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}
export async function cloudRequest(request) {
  const pathname = new URL(request.url).pathname;
  if (pathname === '/api/live') return new Response(null, { status: 204 });
  try {
    const db = await database();
    if (pathname === '/api/pulse' && request.method === 'GET') {
      return await readPulse(db, request.url);
    }
    return await handlePersistentRequest(db, request, {
      sendEmail: resendSender(process.env.RESEND_API_KEY, process.env.EMAIL_FROM),
    });
  } catch (error) {
    console.error('Cloud database unavailable:', error.code || error.name);
    return Response.json({ error: 'The city database is not available. Please try again.' },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '2' } });
  }
}
