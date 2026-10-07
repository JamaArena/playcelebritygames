// Live channel over WebSockets for long-running servers (local, Docker, Fly.io, Render).
// Each browser subscribes to its room and itself; when an action touches those, the server sends
// a one-line "changed" nudge and the browser fetches its own authorised state. Nudges carry no
// player data. Serverless hosts (Netlify, Vercel) have no /api/ws, so browsers fall back to polling.
import { createHash } from 'node:crypto';

const KEY = /^(room|p):[\w:-]{1,80}$/;
export function createLive({ authenticate, maxSockets = 20000 }) {
  const subscribers = new Map(), pulses = new Map(), clients = new Set();
  let cityPulse = 0;
  function upgrade(req, socket) {
    const fail = code => { socket.end(`HTTP/1.1 ${code}\r\nConnection: close\r\n\r\n`); };
    try {
      const url = new URL(req.url, 'http://' + req.headers.host), origin = req.headers.origin, key = req.headers['sec-websocket-key'];
      if (url.pathname !== '/api/ws' || String(req.headers.upgrade).toLowerCase() !== 'websocket' || !key) return fail('404 Not Found');
      if (origin && new URL(origin).host !== req.headers.host) return fail('403 Forbidden');
      if (clients.size >= maxSockets) return fail('503 Service Unavailable');
      Promise.resolve(authenticate(req.headers.cookie)).then(playerId => {
        if (!playerId) return fail('401 Unauthorized');
        const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
        socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
        socket.setNoDelay(true);
        attach(socket, playerId);
      }, () => fail('500 Internal Server Error'));
    } catch { fail('400 Bad Request'); }
  }
  function attach(socket, playerId) {
    const client = { socket, playerId, keys: new Set(), alive: true };
    clients.add(client);
    let buffer = Buffer.alloc(0);
    const drop = () => { if (!clients.delete(client)) return; for (const key of client.keys) unsubscribe(client, key); socket.destroy(); };
    socket.on('error', drop); socket.on('close', drop);
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > 8192) return drop();
      for (let frame; (frame = readFrame(buffer));) {
        buffer = buffer.subarray(frame.size);
        if (frame.opcode === 8) return drop();
        if (frame.opcode === 9) socket.write(Buffer.concat([Buffer.from([0x8a, frame.payload.length]), frame.payload]));
        if (frame.opcode === 10) client.alive = true;
        if (frame.opcode === 1) onMessage(client, frame.payload.toString('utf8'));
      }
    });
  }
  // A browser may follow up to three keys: any room, and only its own player key.
  function onMessage(client, text) {
    let keys;
    try { keys = JSON.parse(text).keys; } catch { return; }
    if (!Array.isArray(keys) || keys.length > 3 || keys.some(key => typeof key !== 'string' || !KEY.test(key) || (key.startsWith('p:') && key !== 'p:' + client.playerId))) return;
    for (const key of client.keys) if (!keys.includes(key)) unsubscribe(client, key);
    for (const key of keys) { client.keys.add(key); if (!subscribers.has(key)) subscribers.set(key, new Set()); subscribers.get(key).add(client); }
  }
  function unsubscribe(client, key) {
    client.keys.delete(key);
    const set = subscribers.get(key); if (!set) return;
    set.delete(client); if (!set.size) subscribers.delete(key);
  }
  // Nudge everyone following any of these keys, once each.
  function publish(keys) {
    const at = Date.now(), nudged = new Set();
    cityPulse = at;
    for (const key of keys) {
      pulses.set(key, at);
      for (const client of subscribers.get(key) || []) {
        if (nudged.has(client)) continue;
        nudged.add(client); client.socket.write(textFrame('{"type":"changed"}'));
      }
    }
    if (pulses.size > 50_000) for (const [key, when] of pulses) if (at - when > 10 * 60_000) pulses.delete(key);
  }
  // Polling fallback for browsers that cannot open a socket.
  function pulse(keys) {
    if (!keys.length) return cityPulse;
    return Math.max(0, ...keys.map(key => pulses.get(key) || 0));
  }
  // Ping every 30s so proxies keep the line open; drop sockets that stopped answering.
  const timer = setInterval(() => {
    for (const client of clients) {
      if (!client.alive) { client.socket.destroy(); continue; }
      client.alive = false; client.socket.write(Buffer.from([0x89, 0]));
    }
  }, 30_000);
  timer.unref();
  return { upgrade, publish, pulse, get size() { return clients.size; }, close() { clearInterval(timer); for (const client of clients) client.socket.destroy(); } };
}
function readFrame(buffer) {
  if (buffer.length < 2) return null;
  const opcode = buffer[0] & 15, masked = buffer[1] & 128;
  let length = buffer[1] & 127, offset = 2;
  if (length === 126) { if (buffer.length < 4) return null; length = buffer.readUInt16BE(2); offset = 4; }
  else if (length === 127) return { opcode: 8, size: buffer.length, payload: Buffer.alloc(0) };
  const mask = masked ? 4 : 0;
  if (buffer.length < offset + mask + length) return null;
  const payload = Buffer.from(buffer.subarray(offset + mask, offset + mask + length));
  if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= buffer[offset + (i & 3)];
  return { opcode, payload, size: offset + mask + length };
}
function textFrame(text) {
  const body = Buffer.from(text);
  return Buffer.concat([Buffer.from(body.length < 126 ? [0x81, body.length] : [0x81, 126, body.length >> 8, body.length & 255]), body]);
}
export const pulseKeysFrom = url => String(new URL(url, 'http://x').searchParams.get('keys') || '').split(',').filter(key => KEY.test(key)).slice(0, 3);
