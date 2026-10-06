# Netlify deployment

The repository deploys the full game: `public/` is the website, `netlify/functions/game.mts` serves `/api/state`, `/api/action` and `/api/pulse`, and Netlify Database persists the city in Postgres. The Node 24 runtime is required. `netlify.toml` specifies the build and publish settings.

## Deploy from GitHub

Connect `JamaArena/playcelebritygames` to your Netlify project with `main` as the production branch. Pull requests get deploy previews. The repository configuration overrides the UI build command and publish directory. Deploy the branch to test, then publish the tested deploy or deploy your production branch.

Installing `@netlify/database` enables automatic database provisioning. Netlify applies the migrations in `netlify/database/migrations/` in order before the deploy goes live: `0001` creates the city tables, `0002` adds the live-update pulse and `0003` adds battles. No credentials belong in GitHub or browser code. Database availability and usage depend on the account's Netlify plan and credit limits.

Deploy previews use an isolated database branch. Characters created in a preview do not become production characters. Local SQLite characters also remain local; this change does not upload local saves, cookies or chat history.

## Local verification

Install Node 24 and run `pnpm install --frozen-lockfile`, `pnpm test`, and `pnpm check`. Use `pnpm exec netlify dev` for the Netlify functions and database emulator. `node server.mjs` remains a standalone local SQLite mode and needs no dependencies.

For CLI deployment, authenticate with `pnpm exec netlify login`, link with `pnpm exec netlify link --git-remote-url https://github.com/JamaArena/playcelebritygames`, and test a draft with `pnpm exec netlify deploy`. Use `--prod` only when publishing the tested version. Git builds are preferred because they run database provisioning and migrations as part of the deploy lifecycle.

## Durability and concurrency

Each function acquires a transaction-scoped Postgres advisory lock for the city, reads its relational tables into a request-local in-memory SQL working copy, resolves the same rules as standalone mode, and writes only changed rows back. Commit succeeds before any success response or new session cookie is returned. Failures roll back; retries keep the existing idempotency keys. The working copy is never a persistent Lambda file. Rewards, collaborations, sessions and seasonal cutoff settlement therefore survive cold starts and redeploys.

This is designed for a small first-playable city. Requests serialize through one city lock and read the current city tables; large populations require direct per-player Postgres queries, narrower locks, pagination and retention. Browsers poll full state every 20 seconds as a heartbeat and poll `/api/pulse` (a single-row read with no city lock) every 5 seconds, fetching full state as soon as another player's action bumps it. Nothing polls while the tab is hidden; returning to the tab refreshes immediately. Each open tab makes roughly 900 requests an hour, so watch Netlify usage as players grow. The standalone Node server pushes the same signal over `/api/live`. Database and function usage accrue against Netlify's limits. Add account recovery, moderation operations and public-service rate limits before a broad launch.

## Check after deployment

Confirm `/api/state` returns JSON and a Secure, HttpOnly session cookie. Confirm `/api/pulse` returns `{"at":...}`. Create a character, walk to a venue, start an activity, and reload: name, location, trip, charges and activity should persist. Verify a separate browser gets a separate character. The initial unavailable screen indicates an API/database problem, rather than a successful game deployment. Inspect Netlify's deploy log for provisioning/migration errors and function logs for storage error codes.
