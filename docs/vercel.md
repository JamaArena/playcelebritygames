# Vercel deployment

Connect this repository to Vercel and deploy with Node.js 24.x. The committed
vercel.json bundles the HTTP server, browser assets and Postgres schema.
Set DATABASE_URL (or POSTGRES_URL) using a connected Postgres integration.
The first API request creates missing tables transactionally; existing saves
are preserved. Vercel never writes a SQLite file. Local startup still uses SQLite.
Browser updates use the existing five-second polling fallback on Vercel.

Configure RESEND_API_KEY and EMAIL_FROM for real email verification. Without
these, the existing game uses its displayed demo code 123456; do not use this
demo authentication for private or sensitive player accounts.

Local SQLite saves are not migrated. Each separate database is a separate city.
The existing request-wide database lock suits a small playable demo rather than
a large multiplayer service.
