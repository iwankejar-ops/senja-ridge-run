# Senja Ridge Run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/iwankejar-ops/senja-ridge-run/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/iwankejar-ops/senja-ridge-run/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A sunset valley flight game, made for the [make.fun "Make the best flight game" bounty](https://make.fun/bounty/best-flight-game-20261126-0057).

Fly a little prop plane down a golden river valley at dusk. Thread all
eight glowing rings, watch your fuel, then bring her home onto the
runway for the landing bonus. One valley, one sunset, no two runs the
same — the rings sit where they sit, but the wind is yours to fight.

## Play

Open `game/index.html` in a desktop browser (or serve the `game/`
folder with any static server). No build step, no network requests,
no libraries — plain canvas 2D and WebAudio.

- **← → or A / D** — bank left and right
- **↑ ↓ or W / S** — pitch up and down
- **Shift** — throttle up, **Ctrl** — throttle down
- **Mouse** — steer too
- **P** — pause, **M** — sound on/off, **R** — restart
- **Enter** — take off, and fly again after a landing or a crash

The HUD shows airspeed, altitude and vertical speed, a compass with
your heading, an artificial horizon, fuel, rings passed and score.
Fly through a ring's centre to score; land gently on the runway after
the last ring for +500 plus a fuel bonus. Hit the ridge or ditch in
the river and the run is over.

## Files

- `game/index.html` — the page; loads the game as ES modules
- `game/src/main.js` — game state, flight model, ring course, landing and crashing
- `game/src/render.js` — sunset sky, valley terrain, rings, chase-view plane, HUD
- `game/src/world.js` — the seeded river valley: river, ridges, runway, trees
- `game/src/config.js` — every tuning number in one place
- `game/src/input.js` — keyboard and mouse controls
- `game/src/audio.js` — engine hum, ring chimes and landing fanfare (WebAudio, no files)
- `game/src/random.js` — seeded random and noise for the valley
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — three real renders of the game in a browser (flight, title, landing)
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

## Build the hand-in locally

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` runs on Node 22.18 or later, standard library only.

## License

MIT — see [LICENSE](LICENSE).
