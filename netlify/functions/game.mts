import { getDatabase } from '@netlify/database';
import type { Config } from '@netlify/functions';
import { handlePersistentRequest } from '../../storage.mjs';

export default async function handler(request: Request) {
  const path = new URL(request.url).pathname;
  if (!['/api/state', '/api/action'].includes(path)) return Response.json({ error: 'Endpoint not found.' }, { status: 404 });
  if ((path === '/api/state' && request.method !== 'GET') ||
      (path === '/api/action' && request.method !== 'POST'))
    return new Response(null, { status: 405 });
  if (Number(request.headers.get('content-length') || 0) > 16384)
    return Response.json({ error: 'Request too large.' }, { status: 413 });
  try {
    return await handlePersistentRequest(getDatabase().pool, request);
  } catch {
    return Response.json({ error: 'The city database is not available. Please try again.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
export const config: Config = { path: ['/api/state', '/api/action'] };
