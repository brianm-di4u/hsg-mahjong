# Bathhouse Mahjong: mechanics test campaign (2026-10-31)

## Why
Players reported four kinds of problems:
- tiles that seem free but are blocked, or the reverse;
- matches and hints that seem wrong, or a board that becomes unwinnable;
- undo, shuffle, score and saves misbehaving;
- on phones, a text selection that suddenly covers parts of the screen.

The existing suite (64 tests) mostly followed happy paths. This campaign tests every rule, action and input on all
7 layouts, both renderers and both viewports, fixes what failed, and leaves a regression test for each fix.

## What was built
| File | Kind | What it checks |
|---|---|---|
| `tests/10-mechanics.test.mjs` | Node | Geometry against an independent reference on 14,000 random boards (2,000 per layout); all 42×42 match keys; 1,000 deals per layout; plan repair under about 27,000 random player moves; solver on fresh and mid-game boards (dead boards proven); 2,100 shuffles. Runs in about 13 s. |
| `tests/11-statefuzz.test.mjs` | Browser | Seeded random walks: about 9,000 steps over click, match, hint, shuffle, undo, redo, the clock, pause and save/load, on 2D and 3D. A shadow model checks score, combo, Row bonus, undo/redo exactness, status, winnability and saves after every step. Also Continue after a real reload, stats rules, the dead-board warning and the timer. |
| `tests/12-interaction.test.mjs` | Browser | Picking for every exposed tile on 7 layouts × 3 cameras plus 2D, at both viewports, zoomed and with a lifted selection; real pointer taps, drags, deal-in and shuffle-flip timing, undo mid-flight; overlays, pause, the stuck and win delays; every key; keyboard reach over every open tile; text selection and long-press menus. |
| `tools/engine-load.mjs` | Tool | Loads the engine block from `index.html` into Node; shared by `check-layouts.mjs` and test 10. |

New test hooks: `act('advance' | 'tileAt' | 'screenCenter' | 'cursor')`, plus `getState().winnable`, `practice`, `paused` and `deepSearch` (MECHANICS §10).

## Coverage matrix
| Function | Layouts | 2D | 3D (Classic / Tilted / Top-down) | Desktop | Mobile | Test |
|---|---|---|---|---|---|---|
| Free / blocked rule | 7 | engine | engine | — | — | 10 |
| Match keys (42 faces) | — | engine | engine | — | — | 10 |
| Deal composition, determinism, solvable | 7 | engine | engine | — | — | 10, 02 |
| Plan repair and hints | 7 | ✓ | ✓ | ✓ | — | 10, 11 |
| Solver, dead-board proof and worker | 7 | ✓ | — | ✓ | — | 10, 11 |
| Shuffle and dead geometry | 7 | ✓ | ✓ | ✓ | — | 10, 11, 03 |
| Score, combo, Row bonus, win bonus | 7 | ✓ | 3 layouts | ✓ | — | 11, 03 |
| Undo / redo (match and shuffle) | 7 | ✓ | 3 layouts | ✓ | — | 11, 03 |
| Save, Continue, corrupt save | 2 | ✓ | ✓ | ✓ | — | 11, 04 |
| Stats: streaks, daily, practice, best time | 2 | ✓ | — | ✓ | — | 11, 04 |
| Timer | 1 | ✓ | — | ✓ | — | 11 |
| Picking (exposed tiles, seams, zoom, lift) | 7 | ✓ | ✓ ✓ ✓ | ✓ | ✓ | 12 |
| Taps during deal-in, flip and flight | 1 | — | ✓ | ✓ | — | 12 |
| Overlays, pause, stuck and win delays | 1 | — | ✓ | ✓ | — | 12, 11 |
| Every key, repeat, Ctrl combos, cursor reach | 7 | — | ✓ | ✓ | — | 12, 06 |
| Text selection and long-press menu | 1 | — | ✓ | ✓ | ✓ | 12 |
| Renderer switch mid-animation | 1 | ✓ | ✓ | ✓ | — | 12, 09 |

## Defect log
| # | Report | Symptom | Root cause | Fix | Test |
|---|---|---|---|---|---|
| 1 | Mobile selection | A long press or double tap selects HUD and status text; a tap elsewhere is needed to clear it | No `user-select`, `-webkit-touch-callout` or `contextmenu` guard anywhere | Selection, callout and tap flash off for the page (inputs excepted); `contextmenu`, `selectstart` and `dragstart` prevented on the game screen; any selection cleared on a new game or Continue; `touch-action: manipulation` on the game screen | 12 "mobile: long press…" |
| 2 | Hints / unwinnable | After a few unlucky moves, following hints still ends stuck (13–16 of 40 games per layout in the probe) | The player's own moves made the board unwinnable. Nothing told them; the plan repair gave up early, the solver missed 15–45% of solvable boards, and the hint quietly fell back to "any free pair" | Set-based plan repair; a new solver (dead-board test, DFS, pairing search) that solves every fresh deal and proves dead boards, with deep proofs in a Web Worker; the status line says the board can't be cleared and how many moves to undo | 10 solver, 11 dead board |
| 3 | Hints | A save or test state could hint a pair that no longer matches | A loaded plan was never re-checked; hints only tested that both tiles were free | Plans are validated on load (otherwise re-planned) | 11 fuzz (save/load) |
| 4 | Free / blocked | With the Tilted camera, a tap near a free tile's lower edge reported "Blocked" | The ray missed the free tile's slightly inset hit box and hit the tile behind it | A tap on a blocked tile within 4 px (mouse) or 9 px (touch) of a free tile takes the free one | 12 picking |
| 5 | Free / blocked | A tap during the 3D deal-in or the shuffle flip shook "Blocked" on, or selected, a face not yet shown | Taps were accepted while upper layers were still dropping in, or old faces were still on screen | Board taps wait for the deal-in and the flip | 12 real pointer |
| 6 | Undo | After undoing during a match flight, the restored tiles kept flying away and could not be tapped for about 0.6 s | Undo left the flight animation running | Undo drops the flights of the restored tiles | 12 real pointer |
| 7 | Score | Undo refunded every hint penalty taken since the move | Undo restored the absolute score from before the move | History keeps each match's own points; undo subtracts them, so penalties stay paid | 11 fuzz |
| 8 | Score | Redo could score a match differently from the original | Redo re-ran the match with the current clock (combo recomputed) | Redo replays the recorded points, combo and Row bonus | 11 fuzz |
| 9 | Shuffle | Undo and redo of a shuffle inflated the shuffle count and charged −50 again | Undo never decremented the count; redo incremented it and charged again | Undo and redo of a shuffle swap faces only: no refund, no charge, the count is unchanged | 11 fuzz |
| 10 | Shuffle | After one "cannot rearrange" shuffle, the next game's stuck dialog had Shuffle disabled and the wrong text | Reset only in `undo()` | Reset on new game, load, undo, redo and a successful shuffle | 12 overlays |
| 11 | Undo | Redo refused on a stuck board, even when the next redo was a shuffle | Redo required status `playing` | Redo of a shuffle works when stuck | 11 fuzz |
| 12 | Stats | Abandoning a stuck game kept the win streak | Streak reset checked only status `playing` | Any game in progress with a match (playing or stuck) resets it | 11 stats |
| 13 | Stats | Replaying a finished Daily Puzzle counted as played and won and raised the win streak | No guard | Replays are practice: nothing counts, and the status line and win card say so | 11 stats |
| 14 | Stats | Finishing an older daily later broke the daily streak | `daily.last` moved backwards | `last` only moves forward | 11 stats |
| 15 | Stats | An older stats save without `daily.done` threw at the next daily win | Shallow merge | Deep merge of defaults | 11 stats |
| 16 | Save | A corrupt save could leave a broken game behind | Globals were assigned before validation | `loadState` validates everything first, then assigns | 11 continue |
| 17 | Timer | About 1 s of phantom time at the start of a game or after Continue | `lastTick` kept from before | Reset on new game, Continue and `setState` | 11 timer |
| 18 | Input | Keys during the 0.9 s before the win card (for example N) skipped the win screen | Game keys were live after the win | Game keys are ignored once won | 12 overlays |
| 19 | Input | Holding H or S repeated hints or shuffles (−15 or −50 each) | Key auto-repeat was not filtered | Repeats ignored except for arrows | 12 keyboard |
| 20 | Input | Ctrl+Shift+Z undid | The key was lower-cased | Ctrl+Shift+Z redoes | 12 keyboard |
| 21 | Input | N (or New game in the pause menu) silently abandoned a game and its streak | No confirmation | "Abandon this game?" once a match has been made | 11 stats |
| 22 | Input | A drag that ended on a tile selected it when not zoomed | The 8 px threshold applied only to panning | Any drag over 8 px is not a tap | 12 real pointer |
| 23 | Input | Moves went through while paused (hooks, timers) | `selectTile`, `hint`, `doMatch`, `shuffle`, `undo` and `redo` ignored `paused` | All moves check pause and open dialogs | 11 fuzz, 12 overlays |
| 24 | Crash | Switching to flat tiles during a 3D match flight threw every frame (watchdog, context loss) | 3D flights have no 2D target, but 2D drew them | Renderer switches drop running effects; 2D skips a flight without a target | 12 overlays |
| 25 | Crash | A failed deal would throw | `deal()` returning null was unchecked | Retry on derived seeds | 10 deals |
| 26 | Zoom | Zoom could centre the selection off screen in 3D | Fixed 1.8× maths, but 3D zooms by 1.35–1.8× | Centre after the zoom using the real projection | 12 picking (zoomed) |

Checked and found correct: the free rule (14,000 reference boards, no mismatch), every match key including any flower ↔ any flower and any season ↔ any season, deal composition and solvability, shuffle (keeps faces, solvable), combo and score floor, the Row bonus and its undo, the time bonus, and keyboard reach on every layout.

## Decisions taken with the owner
- Undo keeps hint and shuffle penalties paid (it was refunding them).
- New game asks first, but only once a match has been made.
- "Undo restores the selection" in AC10 was clarified to "undo clears the selection".

## Results
- **Full run:** `node shared/test-harness/run.mjs . --milestone mechanics --slow` (in the monorepo: `games/mahjong`) passed **85/85**.
  - It covers the 64 original runs plus the new files 10–12, at desktop and mobile, with 0 console errors and 0 external requests.
  - Screenshots are in `screenshots/mechanics/`.
- **Node checks:** `tests/10-mechanics` passes in about 13 s; `node tools/check-layouts.mjs 30` gives 7/7 layouts valid.
  - Deals replayed: 30/30 per layout.
  - Independent solver: **20/20 per layout** (before: 11–17/20).
- **Hints after unlucky play:**
  - Before: following hints after random opening moves ended stuck in 6–16 of 40 games per layout, and the game never said why.
  - Every one of those boards was **already provably dead before the first hint**: the game rules are fine, but the game was silent.
  - Now: hints from a winnable board stay winnable (11 fuzz, about 9,000 steps), and dead boards are named with an undo count.
- **Seam taps (Tilted camera, desktop, tolerance off):** 4 taps inside a free tile hit a blocked tile. With the fix: 0, on all 7 layouts × 3 cameras at both viewports.

## Not covered
- No real iOS or Android device was available. The selection fix was verified in headless Chromium with CDP touch (long press, double tap, press-and-drag) and by computed styles. iOS Safari's callout behaviour is covered by `-webkit-touch-callout: none`, but was not seen on a device.
- 3D runs on SwiftShader in the harness. Timing-dependent checks (deal-in, flip) freeze the animation clock instead of racing it.
