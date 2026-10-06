# Implementation notes

The attached PRD was treated as a game requirements source, rather than as instructions granting additional permissions. The implementation uses its confirmed rules and configurable suggested defaults. No engine, hosting platform, monetization or release commitment was inferred from the document.

## Requirements mapping

| PRD area | Implementation | Verification |
| --- | --- | --- |
| Character and world | Persistent name, appearance, career, origin, outfield position, music technique; six 3D scenes, visible walking, safe destinations and object actions | Creation and browser walkthrough; server move validation |
| Needs | Six need meters, active heartbeat decay, minimum energy/hunger, timed recovery, food completion debit, offline reconciliation | Need preconditions, cancellation and offline tests |
| Activity engine | Saved activity IDs, commentary deadlines, contextual decisions, stored outcomes, continued failures, output settlement and abandonment | Failed-choice, reconnect, early-decision and retry tests |
| Career charges | One shared capacity-10 bar, 36-minute interval, preserved partial refill, no extra charge for decisions | Exact interval, capacity, repeat-spend and zero-charge tests |
| Learning | 7-point practices, 5-point decisions, arithmetic/geometric thresholds, carryover, event deduplication, cap at 10 | PRD worked examples and cap tests |
| Origins and discovery | Independent and connected starts, focus level bonus, three-completion discovery, quality-60 trials, practice retry, expiring offers | Origin, discovery and contract tests |
| Football | Four skills, outfield selection, distance/angle/pressure/fatigue accuracy, separate defender/save draws, target passes, directional dribbles, defensive choices, simulated opposition | Accuracy worked example, skill mapping and no-extra-charge tests |
| Music | Street/prodigy origins, technique choice, composition/take/mix decisions, automatic credited release, live crowd engagement | Origin, production, poor-decision and publication tests |
| Other sports | Basketball shots/drives/passes and team score; wrestling stamina and conditional pin; tennis standard scoring and seeded background rallies | Tennis deuce, set, tiebreak and best-of-three tests |
| Creators and acting | Career-specific beat text, relevant skill maps, recorded outputs, streamer stability/engagement, abstract adult contracts | All-career definition and resolver tests |
| Technology | Fictional projects, developer client outputs, separate founder/Web3 build and launch, unique launch, abstract operation exposure and stop option | Product lifecycle and risk tests |
| Audience and reputation | Quality/reach/saturation, win multiplier, engagement, active audience, persistent tiers, contract reputation and source histories | Once-only settlement and milestone tests |
| Awards | Audience milestone entitlements and 28-day server-local editions; locked eligibility tier, cutoff before mutation, normalized scoring and tie breaks | Real HTTP seasonal settlement retry test |
| Possessions | Atomic purchases, consumable food, equipped gear/clothes, safe furnishing grid, timed cost/benefit preview, offline equipment upgrades | Purchase idempotency and upgrade tests |
| Social | Visible local players, local/direct chat, unilateral follow/friend list, block/report, expiring home invitations and restricted visitors | Real HTTP block, invitation and visitor tests |
| Collaborations | Explicit accepted complementary money/audience shares, transactional starts, participant learning, waiting decisions, one shared credited result, host cancellation; NPC solo alternative | Two-player HTTP start, duplicate-choice and shared settlement tests |

## Design choices and remaining work

The city is a software-rendered orthographic 3D environment, using world-space cuboids and a rotatable camera. This keeps the game self-contained without external assets or an engine install. Decisions use schematic sports fields and contextual studio/project panels. Character walking is interpolated with obstacle routing; visits display the host's placed furniture.

All career origins beyond football and music, venue payouts, need rates, discovery thresholds, award scoring and item catalogues remain configurable PRD proposals. Affiliation offers alternate among fictional organizations; transfer acceptance requires the current three-delivery exit condition and keeps the character's history.

Some systems intentionally have a smaller content catalogue than the long-term PRD describes. Basketball currently uses compressed decision possessions, not a complete rulebook simulation. There are no full club seasons, sports trophy competitions, ranking ladders, music tours, sponsorship catalogues, investor funding rounds, fan-choice votes, decorative award placement, romance or family systems. The developer career's audience is profile reach expressed as users; clients do not create an owned product. These are not presented as completed systems in the UI.

Real-player collaborations currently require the same primary career and each participant plays a complete sequence; NPC collaborations allow a cross-career credit. A participant's choices grant only that participant learning. Shared output quality is the mean of all decision scores, with one output-level reward and complementary shares. Real collaborations have no automatic timeout or NPC substitution. Pending agreements can be withdrawn; running ones can be cancelled by the host. Contract deductions apply to each recipient's accepted share. Equipment production bonuses and specialized fixture simulations do not stack onto shared output quality in this initial edition.

Friend lists are unilateral contacts, not mutually approved friendships. Direct messages require the sender to have added the recipient and always respect recipient blocks. Home entry still requires the host's explicit invitation. A full profile browser and mutual friendship requests are future additions.

The server is authoritative for timers and reward mutation, but sessions are guest sessions. Cookie loss loses access to that character unless an operator recovers it from a backup. Needs count only short online heartbeat intervals, avoiding offline decay; a server gap over twenty seconds is treated as offline. Other players' movement is polled rather than synchronized continuously. Browser clocks are used only to display the server's remaining duration.

Seasonal metrics are frozen by settling the expired edition before any post-cutoff action. Eligible tier and baseline active audience are recorded on the server. Offline empty editions are skipped without rewards. Reports remain in SQLite for operator inspection; no automatic sanctions or report-based reputation changes occur.

## Validation commands

```sh
node --test
node --check server.mjs
node --check game.mjs
node --check public/app.js
node --check public/world.js
```

HTTP tests launch a dedicated server on an ephemeral port and a temporary database. They exercise cookie sessions, cross-origin rejection, exactly-once purchases, restricted home visits, blocked chat, accepted collaboration starts, persisted decisions, shared rewards and one-time seasonal awards. Test-only fixture edits advance deadlines in that isolated database. There is no debug timer or reward endpoint in the application.
