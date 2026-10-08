import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { schema, createGameService, relatedQueries, roomOf } from './service.mjs';
import { ARENA } from './public/content.js';

const tables = {
  players: ['id'], requests: ['player_id', 'request_id'], messages: ['id'],
  reports: ['id'], seasons: ['id'], agreements: ['id'], battles: ['id'],
  accounts: ['player_id'], codes: ['email'], sessions: ['token_hash'], active_devices: ['player_id'],
  profiles: ['id'], arena: ['day'],
};
const numeric = new Set(['created', 'at', 'starts', 'ends', 'settled', 'fame', 'trend', 'seen']);

// Actions (and anything unusual) lock the whole small city while the existing SQL rules run against a
// request-local working copy. Plain state check-ins only load the player's own rows plus the capped
// lookups their update needs, and many of them run side by side. Only changed rows are written back.
export async function handlePersistentRequest(pool, request, options = {}) {
  const client = await pool.connect();
  let working = null;
  try {
    let fast = request.method === 'GET' && new URL(request.url).pathname === '/api/state', previous;
    for (;;) {
      working?.close();
      working = new DatabaseSync(':memory:');
      working.exec(schema);
      previous = Object.fromEntries(Object.keys(tables).map(table => [table, new Map()]));
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '8s'");
      await client.query("SET LOCAL statement_timeout = '12s'");
      if (fast) {
        if (await loadPlayerScope(client, working, previous, request)) break;
        await client.query('ROLLBACK');
        fast = false;
        continue;
      }
      await client.query('SELECT pg_advisory_xact_lock(173204, 1)');
      // One round trip for the whole city: each table comes back as a JSON array.
      const { rows: [all] } = await client.query(`SELECT ${Object.keys(tables).map(table => `(SELECT COALESCE(json_agg(t), '[]') FROM celebrity.${table} t) AS ${table}`).join(', ')}`);
      for (const table of Object.keys(tables)) for (const raw of all[table]) addRow(working, previous, table, raw);
      break;
    }
    const response = await createGameService(working, { secureCookies: true, ...options, fast })(request);
    if (response.status >= 500) throw new Error('Game request failed before persistence.');
    let changed = false;
    const pulses = new Set();
    for (const [table, keys] of Object.entries(tables)) {
      const seen = new Set();
      for (const row of working.prepare(`SELECT * FROM ${table}`).all()) {
        const key = keyFor(table, row), before = previous[table].get(key);
        seen.add(key);
        if (before === JSON.stringify(row)) continue;
        changed = true;
        pulseKeys(table, row, before && JSON.parse(before), pulses);
        const columns = Object.keys(row), updates = columns.filter(column => !keys.includes(column));
        await client.query(`INSERT INTO celebrity.${table} (${columns.join(',')}) VALUES (${columns.map((_, i) => '$' + (i + 1)).join(',')}) ON CONFLICT (${keys.join(',')}) ${updates.length ? 'DO UPDATE SET ' + updates.map(column => `${column}=EXCLUDED.${column}`).join(',') : 'DO NOTHING'}`, Object.values(row));
      }
      // Rows the game removed (a deleted guest, a used code, a signed-out session) are removed here too.
      for (const [key, before] of previous[table]) {
        if (seen.has(key)) continue;
        changed = true;
        const row = JSON.parse(before);
        pulseKeys(table, row, null, pulses);
        await client.query(`DELETE FROM celebrity.${table} WHERE ${keys.map((column, i) => `${column}=$${i + 1}`).join(' AND ')}`, keys.map(column => row[column]));
      }
    }
    // Successful actions bump the pulse of each place and player they touched, so only the people
    // affected refresh promptly; state polls do not. The city-wide pulse remains for older pages.
    if (changed && request.method === 'POST' && response.status < 400) {
      const at = Date.now();
      await client.query('UPDATE celebrity.pulse SET at = $1 WHERE id = 1', [at]);
      if (pulses.size) {
        await client.query('INSERT INTO celebrity.pulses (key, at) SELECT unnest($1::text[]), $2 ON CONFLICT (key) DO UPDATE SET at = EXCLUDED.at', [[...pulses], at]);
        // Long-running servers LISTEN for this and nudge their WebSocket subscribers (sent on commit).
        await client.query('SELECT pg_notify($1, $2)', ['celebrity_pulse', [...pulses].join(',').slice(0, 7900)]);
      }
    }
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    // Do not leak database URLs, SQL or session material to players or logs.
    console.error('Persistent game request failed:', error.code || error.name);
    return Response.json({ error: 'Your city could not save this request. Please retry.' },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '2' } });
  } finally {
    working?.close();
    client.release();
  }
}

// GET /api/pulse: the newest change for up to three keys (the player's room and the player),
// or the city-wide pulse when no keys are given.
export async function readPulse(pool, url) {
  const keys = String(new URL(url).searchParams.get('keys') || '').split(',').filter(Boolean);
  if (keys.length > 3 || keys.some(key => !/^(room|p):[\w:-]{1,80}$/.test(key)))
    return Response.json({ error: 'Invalid pulse keys.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  const { rows } = keys.length
    ? await pool.query('SELECT COALESCE(MAX(at), 0) AS at FROM celebrity.pulses WHERE key = ANY($1)', [keys])
    : await pool.query('SELECT at FROM celebrity.pulse WHERE id = 1');
  return Response.json({ at: Number(rows[0]?.at || 0) }, { headers: { 'Cache-Control': 'no-store' } });
}

// Loads only what one player's state check-in reads. Returns false (and the caller locks and loads
// the whole city instead) for new visitors, players mid-battle and season changeovers.
async function loadPlayerScope(client, working, previous, request) {
  const token = String(request.headers.get('cookie') || '').match(/(?:^|;\s*)celebrity=([a-f0-9]{64})/)?.[1];
  if (!token) return false;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const one = async (sql, args) => (await client.query(sql, args)).rows;
  // Check-ins share the city lock (actions take it alone); each player's own check-ins queue up.
  await client.query('SELECT pg_advisory_xact_lock_shared(173204, 1)');
  const sessions = await one('SELECT * FROM celebrity.sessions WHERE token_hash = $1', [tokenHash]);
  const playerId = (await one('SELECT id FROM celebrity.players WHERE token_hash = $1', [tokenHash]))[0]?.id || sessions[0]?.player_id;
  if (!playerId) return false;
  await client.query('SELECT pg_advisory_xact_lock(173205, hashtext($1))', [playerId]);
  const [player] = await one('SELECT * FROM celebrity.players WHERE id = $1', [playerId]);
  const state = player && JSON.parse(player.state);
  if (!state || state.battle) return false;
  const now = Date.now(), [season] = await one('SELECT * FROM celebrity.seasons ORDER BY id DESC LIMIT 1', []);
  if (!season || now >= Number(season.ends)) return false;
  const add = (table, rows) => rows.forEach(row => addRow(working, previous, table, row));
  // A ceremony is due: the full path holds it (it needs every player's card).
  const [arena] = await one('SELECT * FROM celebrity.arena ORDER BY day DESC LIMIT 1', []);
  if (!arena || Number(arena.day) < ARENA.day(now)) return false;
  add('arena', [arena]);
  add('players', [player]);
  add('sessions', sessions);
  add('seasons', [season]);
  add('accounts', await one('SELECT * FROM celebrity.accounts WHERE player_id = $1', [playerId]));
  add('active_devices', await one('SELECT * FROM celebrity.active_devices WHERE player_id = $1', [playerId]));
  const others = [state.spouse?.id, state.visiting].filter(id => id && id !== playerId);
  if (others.length) add('players', await one('SELECT * FROM celebrity.players WHERE id = ANY($1)', [others]));
  const q = relatedQueries(playerId, state, now), pg = ([sql, args]) => one(toPg(sql), args);
  for (const query of q.profiles) add('profiles', await pg(query));
  const messages = await pg(q.messages), battles = await pg(q.battles);
  add('messages', messages);
  add('battles', battles);
  add('agreements', await pg(q.agreements));
  // Names shown beside messages and battles.
  const named = [...new Set([...messages.map(m => m.sender), ...battles.flatMap(b => JSON.parse(b.state).teams.flat())])];
  if (named.length) add('profiles', await one('SELECT * FROM celebrity.profiles WHERE id = ANY($1)', [named]));
  return true;
}
function toPg(sql) {
  let n = 0;
  return sql.replace(/\?/g, () => '$' + ++n).replace(/\bFROM (\w+)/g, 'FROM celebrity.$1');
}
function addRow(working, previous, table, raw) {
  const row = Object.fromEntries(Object.entries(raw).map(([key, value]) =>
    [key, value !== null && (numeric.has(key) || (table === 'seasons' && key === 'id')) ? Number(value) : value]));
  const key = keyFor(table, row);
  if (previous[table].has(key)) return;
  const columns = Object.keys(row);
  working.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...Object.values(row));
  previous[table].set(key, JSON.stringify(row));
}
// Which pulses a changed row wakes: the rooms a player left or entered, the player, message
// recipients (or the room), and everyone in a battle or agreement.
function pulseKeys(table, row, before, pulses) {
  const room = (id, json) => { try { const s = JSON.parse(json); if (s) pulses.add('room:' + roomOf(id, s)); } catch {} };
  if (table === 'players') { pulses.add('p:' + row.id); room(row.id, row.state); if (before) room(before.id, before.state); }
  if (table === 'messages') pulses.add(row.recipient ? 'p:' + row.recipient : 'room:' + row.location);
  if (table === 'battles' || table === 'agreements') {
    try {
      const value = JSON.parse(row.state);
      for (const id of value.teams?.flat() || value.participants || []) pulses.add('p:' + id);
      if (value.location) pulses.add('room:' + value.location);
    } catch {}
  }
}
function keyFor(table, row) { return JSON.stringify(tables[table].map(key => row[key])); }
