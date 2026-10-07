# Celebrity Games

A playable browser life simulation set in Palm City, implemented from the supplied **Celebrity Life Game Mechanics Specification**, dated 6 October 2026.

Create a character, explore six locations, recover daily needs, train skills, play career decisions, publish credited outputs, grow an audience, join affiliations, and improve your home. The city uses a small, dependency-free orthographic 3D renderer with an open neighbourhood of six lots, cutaway interiors, a local day/night sky, camera rotation, click-to-walk movement and obstacle routing.

## Deploy on Netlify

The full game supports Netlify Functions and Netlify Database (Postgres). Connect this repository, deploy the implementation branch, and use the committed `netlify.toml` settings. Database provisioning and migrations run automatically. See [docs/netlify.md](docs/netlify.md) for deployment, verification and operating limits.

## Live server

For many players at once, run the Docker image on a long-running host (Fly.io, Render) with Postgres. Browsers then get changes pushed over WebSockets instead of polling. See [docs/live-server.md](docs/live-server.md).

## Run locally

Install Node.js **24 or newer**, then run:

```sh
node server.mjs
```

Open **http://127.0.0.1:3000**. No npm install, build step, external assets or paid services are required. `npm start` also works when npm is installed. The server binds to loopback by default.

```sh
node --test
```

Tests cover core mechanics and a real HTTP server with an isolated temporary SQLite database. Timers advance through test fixtures; the actual server has no accelerated clock or reward bypass.

## Playing

- Choose one of 15 careers and two starting origins. Football offers outfield positions; music offers vocals or instrument technique. Adult entertainment contains only abstract project decisions and requires an adult character.
- **City** is one open neighbourhood: your apartment, sports arena, studio, creator quarter, technology workspace and Palm plaza sit on lots around the lagoon. Tap a pin or a neighbouring lot to head there; **Explore city** zooms out to the whole map. Select an object to open its pie menu, then choose an interaction to walk over and start it. Arrow keys and WASD also move the character. The bottom-left panel shows your mood plumbob and labelled needs; tap a need to recover it.
- **Career** starts practice, fixtures, productions, live music performances, trials, NPC collaborations, and product builds or launches. Every start previews requirements and rewards. Activities pause at decisions without a response deadline.
- **My home** shows your inventory, equipment, upgrade previews and furniture placement. Buy groceries, gear, clothing and furniture at the plaza shop.
- **Social** contains local chat, player contacts, direct messages, blocks, reports, home invitations and accepted collaboration agreements. A second browser profile creates a second player on the same running server.
- **Profile** shows outputs, permanent milestones, season rules and awards.

Normal production has three beats over two real minutes of commentary; sports use six over five minutes. Practice lasts 10 seconds. Needs recovery and equipment upgrades also use real timers. Commentary waits at every decision; already-started practice, recovery, upgrades and charge refills reconcile offline.

## Persistence and rules

SQLite stores characters, activity decisions, session hashes, messages, reports, agreements, seasons and idempotency keys under `data/celebrity.sqlite`. Back up the database and its WAL consistently. Keep the browser's session cookie to return to your character. Session cookies are HttpOnly and SameSite Strict; bearer tokens are hashed at rest.

All clocks, random outcomes, charge debits, learning, purchases and reward settlement run on the server. Transactions serialize starts and shared settlements. Each write carries an idempotency key; a retry cannot debit or settle again. Reconnecting preserves the activity ID, chosen actions and outcomes. Career changes preserve skills, possessions, fame and the shared charge bar. There are no coins: items, upgrades and sponsorships unlock with fame.

Confirmed PRD rules include 10 charges, one refill every 36 minutes, football's four skills, shooting capped at 10, distance-sensitive shooting, origins and the arithmetic-then-geometric effort curve. Suggested rates and content are centralized in `public/content.js`. Skill thresholds are 35, 70, 105, 140, 280, 560, 1,120, 2,240 and 4,480. Practice gives 7 points; a relevant decision gives 5 even on failure. Equipment grants quality bonuses, never learning levels.

The shared activity engine supplies career-specific narratives and skill mappings. Football uses separate block, accuracy and save draws. Tennis stores standard points, deuce, advantage, games, sets and tiebreaks; background rallies settle the rest of its best-of-three match. Wrestling uses stamina and conditional pin attempts. Founder and Web3 builds create unreleased products; launch is a separate charged activity. Fictional operations use abstract exposure, never real exploit instructions.

## Scope and operating limits

This is a first playable implementation, not a production MMO service. See [docs/implementation.md](docs/implementation.md) for the requirements mapping and remaining content work.

- Players belong to this server and browser session. There is no email/password login, cross-device recovery, account deletion interface; cloud hosting is supported through Netlify.
- Other players appear in the same location through four-second polling. This is not authoritative real-time movement synchronization. NPCs support solo play.
- All 15 careers are playable, with deeper sport-specific rules for football, tennis and wrestling. Creator, acting and technology scenes use stylized contextual panels; additional career-specific animation, full leagues/tournaments, tours and sponsorship catalogues remain expansion work.
- Seasonal awards compare eligible characters on this server only. The first season starts when the server first runs, lasts 28 days, and publishes its cutoff and weights in Profile. Awards require at least one qualifying seasonal output and 100 audience. Eligibility tiers lock on first qualification. Reports are persisted for manual operator review; there is no moderation dashboard yet.
- Furniture placement uses a fixed safe grid rather than a full interior editor. Clothing has one equip slot. Food is consumable; the other initial catalogue items have one ownership record each.
- Scale, rate limiting, account recovery, retention policies, moderation operations and multi-server coordination need further work before exposing a public service. The server currently queries all local players; event and output histories grow with play.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `HOST` | `127.0.0.1` | Listening interface |
| `DATA_DIR` | `./data` | SQLite storage directory |
| `SECURE_COOKIE` | unset | Set to `1` behind HTTPS so session cookies use Secure |

For a hosted installation, terminate HTTPS at a reverse proxy, preserve the Host header, persist the data directory, set Secure cookies, and configure a public-service security and moderation policy. Netlify deployment uses the committed configuration and a separate cloud database; local saves are not uploaded.

## Project layout

```text
server.mjs             HTTP, SQLite, sessions, social play and seasons
game.mjs               Authoritative character and activity rules
public/content.js      Career definitions, balance, items and walkability
public/world.js        3D projection, meshes, camera and movement routing
public/app.js          UI, decisions, dialogs and polling
public/style.css       Responsive interface and reduced motion
test/                  Rules and HTTP integration tests
docs/implementation.md Requirements mapping and limitations
```
