# Live server (WebSockets)

Netlify and Vercel run the game as short-lived functions, so browsers there ask `/api/pulse` every 10 seconds whether anything near them changed. A long-running server can push those changes instead, the moment they happen, with no polling.

## How it works

- Each browser opens one WebSocket to `/api/ws` (it needs the player's session cookie) and follows two keys: its current room (`room:plaza`, `room:home:<id>`) and itself (`p:<id>`).
- When an action touches a room or a player, everyone following that key gets a one-line `{"type":"changed"}` nudge and fetches their own state. Nudges carry no player data.
- With Postgres, every saved action also runs `pg_notify('celebrity_pulse', keys)`. Each server `LISTEN`s, so several servers behind a load balancer can share one database and still nudge the right people.
- If a socket can't open (an older proxy, or a serverless host), the browser quietly falls back to polling.

## Run it

```sh
docker build -t celebrity-games .
docker run -p 8080:8080 -e DATABASE_URL=postgres://... -e RESEND_API_KEY=... -e EMAIL_FROM=... celebrity-games
```

Without `DATABASE_URL`, `node server.mjs` uses a local SQLite file and still serves live WebSockets.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Tables are created on first start. |
| `PG_POOL_MAX` | Database connections per server (default 3; around 10 suits a busy server). |
| `HOST`, `PORT` | Listen address (the Docker image uses `0.0.0.0:8080`). |
| `SECURE_COOKIE` | `1` behind HTTPS (set in the Docker image). |
| `RESEND_API_KEY`, `EMAIL_FROM` | Sign-in email codes. |

On Fly.io: `fly launch` (it detects the Dockerfile), then `fly secrets set DATABASE_URL=...`. On Render: create a Web Service from this repository with the Docker runtime and add the same environment variables. Both bill for running servers and databases, so the account owner sets them up.
