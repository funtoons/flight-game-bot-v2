# Langit Biru — Three Jobs, One Sortie

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/funtoons/flight-game-bot-v2/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/funtoons/flight-game-bot-v2/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A complete little flight game for the [make.fun "Make the best flight game" bounty](https://make.fun/bounty/best-flight-game-20261126-0057). Fly the prop plane **Elang Laut** across the Merpati archipelago on one sortie with **three different jobs**: thread 6 golden rings, drop a cargo crate on the yellow field, then land on runway 09 before the clock runs out — before the fuel runs out.

## How to play

Serve `game/` with any static server (or `node serve.ts`, then open http://localhost:8080) and fly in desktop Chrome. No network, no build step, no files outside `game/`.

| Control | Action |
| --- | --- |
| ↑ / ↓ | Pitch (climb / dive) |
| ← / → | Bank and turn |
| W / S | Throttle up / down |
| Mouse drag | Steer |
| SPACE | Drop the cargo (in the drop phase) |
| C | Swap chase / cockpit camera |
| Enter / click | Start flying |
| P | Pause |
| R | Restart |
| M | Mute |

## The mission — three jobs, one sortie

- **Job 1 — 6 golden rings** weave across the islands, each worth 150 points. The next ring is always marked, with a bearing arrow when it is off-screen.
- **Job 2 — cargo drop**: fly low and slow over the yellow field west of the runway and press SPACE. A crate on the inner circle pays 300, on the field 200, near it 100. Drop high or fast and the wind carries it wide.
- **Job 3 — timed landing on runway 09**: the clock gives you 150 seconds from the drop. Arrive slow, level and lined up. A clean landing pays 500 plus fuel and time bonuses; a hard touchdown bends the hull (−150) and a crash ends the sortie.
- **Fuel drains** with the throttle, and slow flight sinks — a dry tank means a glide, and the sea is not a runway.
- **HUD**: altitude, speed, heading and vertical speed up top, a compass tape, a three-job tracker, ring pips and score; below, lit instruments — airspeed, altimeter, attitude ball, compass, fuel, throttle and hull. Press C for the cockpit: the same instruments on the panel, the runway and the next ring through the windshield.

## Files

- `game/index.html` — the page, nothing but a canvas
- `game/src/config.js` — tuning, ring course, drop zone, runway, start
- `game/src/world.js` — the archipelago, relief terrain height, ridges, clouds, trees, town
- `game/src/physics.js` — the flight model, the three phases, cargo drop and landing/crash rules
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesised engine, wind, chimes (WebAudio, no files)
- `game/src/render.js` — the pseudo-3D view, shaded terrain, plane, HUD and overlays
- `game/src/cockpit.js` — the cockpit view: panel, lit instruments, windshield
- `game/src/main.js` — game loop and state machine
- `game/src/shots.js` — deterministic screenshot staging (`?shot=cover|cockpit|drop|landing&seed=1`)
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — four real renders of the game: low approach to runway 09, cockpit view on ring 3, the cargo drop, final approach

## License

MIT — see [LICENSE](LICENSE).
