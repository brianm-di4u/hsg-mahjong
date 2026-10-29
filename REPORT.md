# Bathhouse Mahjong: report

**Status: done (wave 1).**
- The final run (`node shared/test-harness/run.mjs games/mahjong --milestone final`) passes **39/39 tests** at desktop (1280×800) and mobile (390×844 @2×).
- No console errors and no external requests.
- All 76 screenshots in `screenshots/final/` were inspected. They were reviewed in contact sheets of 4–8 images, and individual full-size images were checked where needed.
- Nothing has been committed.

## What was built
A mahjong-solitaire game in one hand-written file, `index.html`: about 2,100 lines, 156 KB, no build step.

- **144-tile custom set, all drawn in code.** Every tile has a corner index (1–9, H/N/W/S, R/G, a hollow frame or 1–4) plus a suit shape, so color is never the only cue.

  | Group | Tiles | Corner shape |
  |---|---|---|
  | Springs 1–9 | steaming pools, counted like dots | ● |
  | Bathhouses 1–9 | the eight Row bathhouses north to south, plus the 1936 Administration Building | ■ |
  | Lakes & Fish 1–9 | bass over lake water | ◆ |
  | Mountains (the winds) | Hot Springs, North, West and Sugarloaf | ▲ |
  | Dragons | Red Tile, Green Tile (Maurice), White Stone (novaculite) | ⬢ |
  | Flowers | magnolia, dogwood, redbud, sweetgum | ✿ |
  | Seasons | Garvan tulips, summer lake, autumn slopes, winter steam | ✦ |

  The Quapaw-inspired chevron tile back appears in the shuffle flip.
- **Five original 144-tile layouts:** Classic Pyramid (a four-level stepped pyramid), Mountain Tower, Arlington Towers, Bathhouse Row and Ouachita Islands. Each has a sourced caption.
- **Rules engine.**
  - Deals are guaranteed solvable: they are built backwards from the empty geometry, and each deal keeps its solution as a plan.
  - Shuffle uses the same backward construction, so a shuffled board can still be solved.
  - Hints come from the maintained plan, which is repaired after every move. A bounded DFS solver is the fallback.
  - Unlimited undo and redo.
  - Stuck detection with a recovery dialog.
  - Timer, score, combos, and a one-time "Bathhouse Row complete" +100 toast.
- **Modes and saves.**
  - Classic mode with a random seed, and a Daily Puzzle seeded by date with a rotating layout.
  - Continue after reload.
  - Stats in `localStorage`: totals, streaks, per-layout bests and the daily streak. Everything still works with storage disabled.
- **Presentation.**
  - 3D stacked tiles with cached sprites and a free-tile veil that can be toggled.
  - Selection lift, a pulsing dashed hint ring and a shake on blocked tiles.
  - Matched tiles fly up and fade in puffs of steam; winning sets off a steam burst.
  - Synthesized WebAudio sounds.
  - Light theme and a "Neon Night" dark theme, both automatic and manual, plus a reduced-motion mode.
  - Win screen with a "Did you know?" fact from the trivia bank, from 123 confirmed Places & Landmarks and Nature & Lakes items with sensitive topics filtered out.
- **Screens:** title (Bathhouse Row skyline drawn with the tile art), layout picker with previews, How to Play, Tile Guide (all 42 faces), Stats, Settings, Pause (hides the board), Stuck and Win.
- **Input.**
  - Mouse, touch, and Zoom (1.8×) with drag-to-pan.
  - Full keyboard play: arrow-key cursor, Enter, and H/S/U/R/F/Z/P/N/Esc.
  - A live region announces game events.

## Acceptance criteria (PRD §13)
| AC | Status | Evidence |
|---|---|---|
| AC1 layouts valid (144, no overlap, supported) | met | `02-rules`, `tools/check-layouts.mjs` |
| AC2 deal composition | met | `02-rules` |
| AC3 every deal solvable (100 per layout) | met | `02-rules` (500/500 replay to empty) |
| AC4 blocked tiles can't be selected | met | `03-play`, `03-blocked` |
| AC5 match / non-match behaviour | met | `03-play`, `03-selected`, `03-matched` |
| AC6 flowers and seasons match in group | met | `02-rules` |
| AC7 seed determinism | met | `02-rules` |
| AC8 stuck detection and dialog | met | `03-stuck` |
| AC9 shuffle keeps faces and is solvable | met | `03-play`, `03-shuffled` |
| AC10 undo/redo exact | met | `03-play`, `03-undo` |
| AC11 hints clear the board | met | `03-play` (72 hints in a row clear Bathhouse Row) |
| AC12 win overlay with sourced fact | met | `03-win` |
| AC13 scoring | met | `03-play` (10, combo 25, hint −15, win bonus); Row +100 in `03-row-toast` |
| AC14 daily puzzle | met | `04-modes`, `04-daily` |
| AC15 stats persist | met | `04-modes`, `04-stats` |
| AC16 continue after reload | met | `04-modes`, `04-continue` |
| AC17 no storage | met | `04-modes`, `04-nostorage` |
| AC18 title | met | `01-title` |
| AC19 layout picker | met | `01-layouts` |
| AC20 3D depth | met | `02-layout-*` (visual) |
| AC21 index + shape on every tile; tile guide | met | `01-tile-guide*` |
| AC22 free-tile highlight toggle | met | `05-highlight-on/off` (pixel mean differs) |
| AC23 steam effect and sound | met (sound not listened to) | `03-steam` mid-animation frame; audio code runs without errors in every match |
| AC24 status line shows tile name + fact | met | `03-selected` |
| AC25 help, stats, settings, pause | met | `01-*` |
| AC26 dark theme | met | `05-dark-*` |
| AC27 reduced motion | met | `05-reduced` (settles in < 600 ms) |
| AC28 sound settings; no audio before a gesture | partial | settings tested. The AudioContext is created only on the first user action (by construction), but no test asserts it |
| AC29 keyboard-only play | met | `06-input`, `06-keyboard` |
| AC30 touch play, zoom, pan | met | `06-input`, `06-pointer`, `06-zoom` |
| AC31 44 px targets, no overflow | met | `01-screens` (all visible buttons measured at mobile) |
| AC32 contrast ≥ 4.5:1 | met | `07-quality` and `05-themes`: 52 pairs per theme, lowest 5.64 |
| AC33 live region | met | `06-input` |
| AC34 no console errors / external requests | met | every test |
| AC35 ≥ 55 fps, deal < 50 ms | met | 60.4–61.5 fps animating; deal 0.4 ms |
| AC36 ≤ 2 MB, hooks < 2 s | met | 156 KB; hooks ready in 47–57 ms |

## Test results
- `--milestone final`: **39/39 passed**. There are 7 test files: screens, rules, play, modes, themes, input and quality.
- `tools/check-layouts.mjs 100` (Node, runs the engine extracted from `index.html`) also passes: 5 layouts, 100/100 deals each, no layout errors.
- The milestone runs m1–m4 are kept in `screenshots/` for history. `screenshots/index.html` is the gallery regenerated by the final run.
- The defect log in `DEV-PLAN.md` lists 15 defects. 14 are fixed and 1 is mitigated (small tiles on phones).

## Performance
| Metric | Desktop | Mobile |
|---|---|---|
| `window.__game` ready | 47 ms | 55 ms |
| rAF during match animation | 60.7 fps | 60.4 fps |
| JS heap | 9.5 MB | 9.5 MB |
| Deal generation | 0.4 ms | 0.4 ms |
| File size | 156 KB (about 27 KB of it is the inlined fact list) | — |

An idle board draws nothing: rendering only happens when something changes or animates. Tile faces are drawn once per size into cached sprites.

## Known gaps
- **The traditional 4-player mahjong mode (stretch goal) was not built.** The time went into polishing the solitaire core. It would fit best as a separate game or a later wave.
- **Small tiles on portrait phones for wide layouts.**
  - Bathhouse Row is 16 tiles wide, which gives tiles about 22 px wide on a 390 px phone. Arlington Towers gives about 26 px.
  - A one-time toast suggests Zoom or landscape, and Zoom (1.8×, drag to pan) is tested.
  - The Classic Pyramid and Islands layouts fit at about 33 px.
  - The board also leaves vertical space unused in portrait.
- **The independent solver** finds a solution within its 25,000-node budget for about 60–100% of fresh deals, depending on the layout.
  - Hints do not depend on it: the plan built with the deal is repaired after each move and re-checked by simulation, and the solver runs only when a repair fails.
  - If both fail, the hint falls back to "any free pair", which might not keep the board winnable. This was never seen in testing: 72 hints in a row cleared the board.
- **Audio was not listened to** (headless tests). It is synthesized with WebAudio and runs without errors.
- Pinch-to-zoom is not implemented; there is a toggle plus drag instead.
- Arlington Towers' five-level tower stacks look busy at small sizes. The Bathhouse Row silhouette reads less clearly than the Mountain Tower one.
- The redbud and sweetgum tiles have no sourced fact. Their tooltips are plain descriptions, and the research notes call those colors unsourced.
- The Quapaw dome and tile colors are guesses. The help screen says so.
- Out of scope, as the PRD lists: era tile sets, the Lost Landmarks round, the DeSoto helmet tile and the 143° wild tile.

## Harness requests
1. **Mid-animation screenshots.** `t.shot` always waits for `isIdle()`, so a frame in the middle of an effect can't be captured without a game-side hook. I added `act('animAt', ms)`, which freezes the animation clock. A `t.shot(name, { wait: false })` option would make this generic.
2. **Touch drag helper.** Under `hasTouch`, `page.mouse` drags did not reach the game as panning pointer events. A `t.touchDrag(from, to)` helper, or documenting CDP touch dispatch, would help other games. My test dispatches `PointerEvent`s with `pointerType: 'touch'` instead.
3. **Contact sheets for review.** Inspecting 76 screenshots one at a time is slow. A small `gallery.mjs --sheets` mode would speed up visual review: a grid of 4–8 labelled screenshots per PNG. I used a scratch version of this.
4. **Windows note.** A shell whose working directory is inside `screenshots/<milestone>/` locks the folder (`EBUSY` on delete). The runner overwrites files, so this is harmless, but it is worth a line in `LESSONS.md`.

## Files
- `index.html`: the game.
- `MECHANICS.md`, `PRD.md`, `DEV-PLAN.md` (with the test matrix and defect log), `SAMPLES.md`, `research/town-content.md`: the design and planning docs.
- `tests/*.test.mjs`: 7 test files.
- `tools/check-layouts.mjs`: validates layouts and deals in Node.
- `tools/extract-facts.mjs`: rebuilds the inlined fact list from `research/trivia-bank.json`.
- `reference-samples/` is empty. No third-party code was downloaded or copied.
