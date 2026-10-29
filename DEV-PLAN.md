# Bathhouse Mahjong: development plan

Single hand-written file `games/mahjong/index.html` (shipped at about 2,100 lines and 156 KB, so no `src/` or inliner was needed).
Helper scripts live in `games/mahjong/tools/` (Node, run from the repo root). Tests live in `games/mahjong/tests/`.

## Milestones

### M1: Foundation
- [x] Layout DSL, five layouts, validation, neighbour lists, freeness (prototyped in Node first)
- [x] Reverse-construction deal, pair list, match keys, solver, reshuffle
- [x] `index.html` skeleton: tokens, HUD/toolbar DOM, canvas sizing with DPR, scene manager
- [x] Board renderer: table background, 3D tiles with depth offset, placeholder faces (index + suit shape)
- [x] `window.__game` hooks: `seed`, `getState`, `setState`, `isIdle`, `scene`, `newGame`, `act`
- [x] `tools/check-layouts.mjs` (extracts the engine block from `index.html` and validates in Node)
- [x] Tests: `02-rules` (layouts, composition, determinism); screenshots `m1/*`

### M2: Core loop
- [x] Pointer selection, hit-testing, match/removal, blocked feedback
- [x] Plan maintenance, hint, undo/redo, stuck detection, shuffle, win detection
- [x] Timer, score, combo
- [x] Tests: `03-play`; screenshots of select, hint, match, stuck, win

### M3: Full content
- [x] All 42 face drawings (Springs, Bathhouses, Lakes & Fish, Mountains, Dragons, Flowers, Seasons) and the tile back
- [x] Tile info (names and facts), status line, Bathhouse Row toast, captions
- [x] Win fact from the inlined trivia subset (`tools/extract-facts.mjs`)
- [x] Title (skyline + steam), Layouts (previews), Help, Tile Guide, Stats, Settings, Pause, Stuck, Win overlays
- [x] Daily puzzle, stats, continue/save
- [x] Tests: `01-screens`, `04-modes`

### M4: Polish, audio, accessibility
- [x] Match flight + steam puffs, hint pulse, select lift, shake on blocked, win steam burst, toasts
- [x] WebAudio sounds; settings for sound/volume
- [x] Keyboard cursor, live region, focus management in overlays
- [x] Dark theme, reduced motion, free-tile highlight, zoom + pan on touch
- [x] Tests: `05-themes`, `06-input`

### M5: Optimization and release
- [x] Face cache per size, idle-free loop, measure fps/memory/size/load
- [x] Tests: `07-quality`; full matrix with `--milestone final`; REPORT.md

## `window.__game` hook spec
| Hook | Args | Returns |
|---|---|---|
| `seed(n)` | integer | `n` |
| `getState()` | — | see MECHANICS §10 (JSON) |
| `setState(s)` | saved state object | `true` |
| `isIdle()` | — | boolean |
| `scene(name)` | `title, layouts, game, help, tiles, stats, settings, pause, stuck, win` | name |
| `newGame(opts)` | `{layout?, seed?, daily?: bool, date?: 'YYYY-MM-DD'}` | `{layoutId, seed, tiles}` |
| `act('click', i)` | position index | `{selected, removed}` |
| `act('match', a, b)` | two indices | boolean (matched) |
| `act('hint')` / `act('shuffle')` / `act('undo')` / `act('redo')` | — | result object |
| `act('solveStep')` | — | the pair played or `null` |
| `act('solveTo', n)` | tiles to leave | tiles left |
| `act('key', key, mods?)` | key name | — |
| `act('stuck')` | — | forces a stuck arrangement of the remaining tiles (test only) |
| `act('verifyDeals', layout, count)` | — | `{ok, total, ms}` replaying each deal's construction plan |
| `act('solverCheck', layout, count)` | — | `{solved, total}` using the independent DFS solver |
| `act('tileCenter', i)` | — | `{x, y}` CSS pixels |
| `act('zoom', on)` | boolean | zoom state |
| `act('contrast')` | — | list of `{name, ratio}` for UI and tile index colors |
| `act('animAt', ms)` | ms after the latest animation start, `'now'`, or `null` to release | freezes the animation clock so `t.shot` can capture a mid-effect frame |
| `act('composition', layout, seed)` | — | face counts (42) of that deal |
| `pause()` / `resume()` | — | — |

## Test matrix
Every test runs at desktop (1280×800) and mobile (390×844 @2×) unless noted. Screenshot names are per viewport
under `screenshots/<milestone>/<viewport>/`.

| AC | Test file → test | Screenshot(s) |
|---|---|---|
| AC1 | `02-rules` → layouts are valid | `02-layout-pyramid` … `02-layout-islands` |
| AC2 | `02-rules` → deal composition | — |
| AC3 | `02-rules` → 100 deals per layout solvable (desktop only) | — |
| AC4 | `03-play` → blocked tile cannot be selected | `03-blocked` |
| AC5 | `03-play` → select and match | `03-selected`, `03-matched` |
| AC6 | `02-rules` → flowers and seasons match within group | — |
| AC7 | `02-rules` → determinism | — |
| AC8 | `03-play` → stuck overlay | `03-stuck` |
| AC9 | `03-play` → shuffle keeps faces and solvability | `03-shuffled` |
| AC10 | `03-play` → undo / redo | `03-undo` |
| AC11 | `03-play` → hints clear the board | `03-hint` |
| AC12 | `03-play` → win overlay with fact | `03-win` |
| AC13 | `03-play` → scoring | — |
| AC14 | `04-modes` → daily | `04-daily` |
| AC15 | `04-modes` → stats persist | `04-stats` |
| AC16 | `04-modes` → continue after reload | `04-continue` |
| AC17 | `04-modes` → no storage | `04-nostorage` |
| AC18 | `01-screens` → title | `01-title` |
| AC19 | `01-screens` → layouts | `01-layouts` |
| AC20 | `02-rules` → layout screenshots | `02-layout-*` |
| AC21 | `01-screens` → tile guide | `01-tile-guide`, `01-tile-guide-bottom` |
| AC22 | `05-themes` → free highlight on/off | `05-highlight-on`, `05-highlight-off` |
| AC23 | `03-play` → steam effect mid-animation | `03-steam` |
| AC24 | `03-play` → status line | `03-selected` |
| AC25 | `01-screens` → help, stats, settings, pause | `01-help`, `01-stats`, `01-settings`, `01-pause` |
| AC26 | `05-themes` → dark theme (colorScheme dark) | `05-dark-title`, `05-dark-game` |
| AC27 | `05-themes` → reduced motion | `05-reduced` |
| AC28 | `05-themes` → sound settings | — |
| AC29 | `06-input` → keyboard play | `06-keyboard` |
| AC30 | `06-input` → pointer/touch play and zoom | `06-pointer`, `06-zoom` |
| AC31 | `01-screens` → checkLayout and 44 px targets on every screen | (all of 01) |
| AC32 | `07-quality` → contrast | — |
| AC33 | `06-input` → live region | — |
| AC34 | every test (runner fails on console errors and external requests) | — |
| AC35 | `07-quality` → fps and deal timing | `07-fps` |
| AC36 | `07-quality` → size and load time | — |

## Defect log
| # | Milestone | Found in | Defect | Fix | Status |
|---|---|---|---|---|---|
| D1 | M1 (Node prototype) | layout check | Arlington had 162 tiles; deal ran out of pairs and threw | trimmed the block's upper course; deal now rejects >144 positions | fixed |
| D2 | M1 (Node prototype) | layout check | Bathhouse Row and Islands had overlapping tiles | re-laid both layouts; validation added to the test suite | fixed |
| D3 | M1 (Node prototype) | solver | plain DFS solved only ~60% of deals within budget | safe-move collapse + memo; hints use the maintained plan first, solver only as a fallback | fixed |
| D4 | M1 | `02-layout-pyramid` (desktop) | captions on counted suits ("6 SPRINGS") overlapped the pool and fish art | captions only on named tiles (Bathhouses, honors, flowers, seasons) | fixed |
| D5 | M1 | `02-layout-*` | stacked layers hard to tell apart | layer offset raised from 0.12 W to 0.14 W; blocked tiles veiled by default | fixed |
| D6 | M1 | `01-title` (both) | title block pinned to the top with a large empty area below | title block grows and centers its content under the skyline | fixed |
| D7 | M2 | `03-stuck` test | stuck-board helper failed on Ouachita Islands (more free tiles than distinct kinds) | test uses the pyramid at 90 tiles; helper reports failure instead of faking | fixed |
| D8 | M2 | `03-win` | score table listed "Hints used 72" as if it were points | penalties folded into the first row; counts moved to a muted line under the total | fixed |
| D9 | M3 | `05-dark-game` | pressed toggles used the neon-red accent in dark mode and read as an error | new `--pressed` token (green in light mode, gold in dark mode), contrast-checked | fixed |
| D10 | M3 | `06-pointer` (mobile) | synthetic `setPointerCapture` threw a page error; the pan check used mouse events under touch emulation | capture wrapped in try/catch; test drives pointer events both ways | fixed |
| D11 | M3 | `06-zoom` | a hint while zoomed could point at tiles off-screen | hint pans the zoomed view to the pair | fixed |
| D12 | M4 | `06-keyboard` | keyboard cursor and hint ring were both dashed blue | cursor is now a solid dark-and-white double ring | fixed |
| D13 | M4 | `03-row-toast` | toast test seed cleared the Bathhouse suit on the final pair, hidden behind the win screen | test searches seeds for an early Row finish | fixed |
| D14 | M5 | `03-row-toast` (mobile) | multi-line toast used a pill radius and became an oval | toast uses the large radius | fixed |
| D15 | M5 | `02-layout-row` (mobile) | Bathhouse Row and Arlington tiles are about 22–26 px wide on a 390 px phone | one-time toast points at Zoom or landscape; zoom (1.8×) is tested | mitigated (see REPORT gaps) |
