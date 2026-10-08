import type { Config } from '@netlify/functions';
import { cloudRequest } from '../../vercel-storage.mjs';

// The game's API on Netlify Functions. Storage is any Postgres database given by DATABASE_URL
// (for example Neon); tables are created on first use by the same code the Vercel build uses.
export default async function handler(request: Request) {
  const path = new URL(request.url).pathname;
  if (path === '/api/pulse' && request.method === 'GET') return cloudRequest(request);
  if (!['/api/state', '/api/action', '/api/auth'].includes(path)) return Response.json({ error: 'Endpoint not found.' }, { status: 404 });
  if ((path === '/api/state' && request.method !== 'GET') ||
      ((path === '/api/action' || path === '/api/auth') && request.method !== 'POST'))
    return new Response(null, { status: 405 });
  if (Number(request.headers.get('content-length') || 0) > 16384)
    return Response.json({ error: 'Request too large.' }, { status: 413 });
  return cloudRequest(request);
}
export const config: Config = { path: ['/api/state', '/api/action', '/api/pulse', '/api/auth'] };
