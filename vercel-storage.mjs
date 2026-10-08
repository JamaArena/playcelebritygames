import pg from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { handlePersistentRequest, readPulse } from './storage.mjs';
import { resendSender } from './email.mjs';

// Migrations sit beside this file locally and on Vercel; bundled Netlify functions find them
// from the working directory instead (they are included via netlify.toml).
const MIGRATIONS = ['0001_celebrity-city', '0002_live-pulse', '0003_battles', '0004_accounts', '0005_active-device', '0006_profiles-pulses', '0007_award-arena'];
const migrationSql = name => {
  const rel = `netlify/database/migrations/${name}/migration.sql`;
  let here = null;
  try { here = fileURLToPath(new URL('./' + rel, import.meta.url)); } catch {}
  for (const file of [here, path.join(process.cwd(), rel), path.join(process.env.LAMBDA_TASK_ROOT || '/var/task', rel)].filter(Boolean))
    if (existsSync(file)) return readFileSync(file, 'utf8');
  throw new Error('Missing migration ' + name);
};
let pool, ready;
async function database() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) throw new Error('Database not configured');
  pool ||= new pg.Pool({ connectionString, max: Number(process.env.PG_POOL_MAX || 3), connectionTimeoutMillis: 8000, idleTimeoutMillis: 10000 });
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
    for (const name of MIGRATIONS) {
      const sql = migrationSql(name).replace(/CREATE TABLE /g, 'CREATE TABLE IF NOT EXISTS ')
        .replace('INSERT INTO celebrity.pulse VALUES(1,0);', 'INSERT INTO celebrity.pulse VALUES(1,0) ON CONFLICT (id) DO NOTHING;');
      await client.query(sql);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}
// For long-running servers: who a cookie belongs to, and a LISTEN connection for live nudges.
export async function playerForCookie(cookie) {
  const token = String(cookie || '').match(/(?:^|;\s*)celebrity=([a-f0-9]{64})/)?.[1];
  if (!token) return null;
  const db = await database(), tokenHash = createHash('sha256').update(token).digest('hex');
  const { rows } = await db.query('SELECT id FROM celebrity.players WHERE token_hash = $1 UNION ALL SELECT player_id FROM celebrity.sessions WHERE token_hash = $1 LIMIT 1', [tokenHash]);
  return rows[0]?.id || null;
}
export async function listenPulses(onKeys) {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  await database();
  const connect = async () => {
    const client = new pg.Client({ connectionString });
    client.on('notification', message => onKeys(String(message.payload || '').split(',').filter(Boolean)));
    client.on('error', () => { client.end().catch(() => {}); setTimeout(() => connect().catch(() => {}), 3000); });
    await client.connect();
    await client.query('LISTEN celebrity_pulse');
  };
  await connect();
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
