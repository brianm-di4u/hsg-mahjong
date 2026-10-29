# Bathhouse Mahjong: core mechanics

The technical foundation, synthesized from the samples in `SAMPLES.md` (ideas only; all code is original).

## 1. Geometry
- **Half-tile grid.** A tile at `(x, y, z)` covers cells `x..x+2`, `y..y+2` on layer `z`. Half steps let rows
  sit half a tile apart (bricks, domes, tower legs).
- **Layouts** are built in code by small helpers (`rect`, `row`, `one`) and stored as `[[x, y, z], ...]`.
  Every shipped layout has exactly 144 positions; the engine accepts any even count up to 144.
- **Validation** (run in the test suite and in `tools/check-layouts.mjs`): no two tiles overlap on a layer,
  no duplicates, even count, every raised tile rests on at least one tile below.
- **Neighbour lists** are precomputed once per layout (`buildGeometry`): `top[i]` (layer above, overlapping),
  `below[i]`, `left[i]` and `right[i]` (same layer, `dx = ∓2`, `|dy| < 2`).

## 2. Rules engine
- **Free tile:** present, nothing present in `top[i]`, and either no present `left[i]` or no present `right[i]`.
- **Match:** two different free tiles with the same match key. `matchKey(f)` is the face for the 34
  standard faces; all four Flowers share one key, all four Seasons another.
- **Faces** (42): 0–8 Springs 1–9, 9–17 Bathhouses 1–9, 18–26 Lakes 1–9, 27–30 Mountains
  (H, N, W, S), 31–33 Dragons (Red Tile, Green Tile, White Stone), 34–37 Flowers, 38–41 Seasons.
  The set is 34 × 4 + 4 + 4 = 144.
- **Deal (guaranteed solvable): reverse construction.**
  1. Start with every position "present". Repeatedly pick a random free position `a`, then a random free
     partner `b` (preferring one that is not `a`'s left/right neighbour so openings aren't trivial). Remove both
     and record `[a, b]`. If fewer than two positions are free before the board is empty, restart the walk
     (up to 400 walks; the 5 layouts never needed more than a few in testing).
  2. Shuffle the 72 face pairs and paste pair *k* onto removal step *k*.
  3. Replaying the steps in order clears the board, so every deal has a solution: the **plan**.
- **Plan maintenance (hints that keep the game winnable).** Removing tiles never blocks a tile, so freeness
  is monotonic. Therefore:
  - if the player removes a pair that is a plan step, the rest of the plan is still valid;
  - if the player removes `a, b` from two different plan steps `(a, c)` and `(b, d)` of the same key, the
    plan is repaired to `(c, d)` at the later step and **re-validated by simulation**;
  - if validation fails, a bounded DFS solver (`solve`, safe-move collapse + memo + node budget) searches for a
    new plan; if it gives up, the plan is `null` and hints fall back to "any free pair".
  - The hint is always the first plan step whose two tiles are both free now.
- **Stuck:** no free matching pair. The player can **Shuffle** (rerun reverse construction on the remaining
  positions with the remaining faces regrouped into matching pairs, so the shuffled board is solvable too),
  **Undo**, or start a new game. If the remaining geometry has no solvable arrangement (for example two tiles
  stacked on each other), Shuffle reports it and only Undo/New remain.
- **Win:** all tiles removed.

## 3. State model (one serializable object)
```js
S = {
  v: 1,
  layoutId: 'pyramid', seed: 12345, daily: null | '2026-10-28',
  faces: [42 ids by position], present: [bool by position],
  plan: [[a, b], ...] | null,            // current known solution
  history: [ {t:'m', a, b, score, combo, ms} | {t:'s', faces:[...], plan, score} ],
  redo: [...],
  selected: -1, cursor: -1,
  score: 0, combo: 0, lastMatchMs: -1e9,
  elapsedMs: 0, hints: 0, shuffles: 0, undos: 0,
  status: 'playing' | 'won' | 'stuck' | 'dead',
  rowDone: false,                         // Bathhouse Row toast shown
}
```
Settings and stats are separate objects (`SETTINGS`, `STATS`). `history` entries are enough to undo exactly;
`redo` is cleared by any new move.

## 4. Timing and loop
- **Event-driven rendering.** `requestAnimationFrame` runs only while something is animating (tile flights,
  steam particles, hint pulse, toasts) or the board is dirty. An idle board costs nothing.
- **Timer:** `elapsedMs` advances from `performance.now()` deltas while the game scene is visible, the game is
  `playing`, not paused, and the tab is visible. A 250 ms `setInterval` updates the HUD clock.
- **Animations** are time-based (`t = (now - start) / duration`), so they are frame-rate independent.
  `prefers-reduced-motion` or the Motion setting set to "Reduced" swaps flights and particles for a 120 ms fade.
- `isIdle()` is true when no animation is in flight and no toast is entering or leaving.

## 5. Input
- **Pointer** (mouse, pen, touch through Pointer Events): hit-test the topmost tile under the point in reverse
  draw order (face rect plus the visible side). Tap a free tile to select; tap a matching free tile to match; tap
  the selected tile again to deselect; tap a blocked tile to get a short shake + "Blocked" status. Drag pans when
  zoomed (movement > 8 px means pan, not tap).
- **Keyboard:** arrow keys move a focus cursor to the nearest visible tile in that direction (topmost per
  footprint); `Enter`/`Space` select; `H` hint, `S` shuffle, `U` or `Ctrl+Z` undo, `R` or `Ctrl+Y` redo,
  `F` toggle free-tile highlight, `Z` zoom, `P` pause, `N` new game, `Esc` back/menu, `?` help. Toolbar buttons are
  real `<button>`s in Tab order.
- **Announcements:** a polite `aria-live` region speaks selections, matches, hints and stuck/win states.

## 6. Rendering
- **One `<canvas>`** for the table and tiles, sized to CSS pixels × `devicePixelRatio`. UI (HUD, toolbar,
  overlays) is DOM for accessibility and crisp text.
- **Layers, in order:** cached table background → tiles sorted by `z`, then `x + y`, then `x` (this painter's order
  makes each tile's right and bottom side faces hide correctly behind later neighbours) → hint/cursor/selection
  rings → particles (steam) → flying tiles.
- **Tile look:** face rect `W × H` (H = 1.3 W); each layer is offset up-left by `d = 0.12 W` so side faces show on the
  right and bottom (cream body, red-tile edge band). A soft shadow under each tile gives depth. Blocked tiles get
  a dark veil when "Highlight free tiles" is on.
- **Face cache:** each of the 42 faces (plus the tile back) is drawn once per tile size into an offscreen canvas
  with vector code, then blitted with `drawImage`. The cache is rebuilt on resize or theme change.
- **Fit:** compute the layout's pixel bounds for a trial `W`, then scale to fit the board area; zoom (mobile)
  multiplies the scale by 1.8 and pans with drag, clamped to the board.

## 7. AI
None for solitaire. The solver (hint/plan) is the only search: depth-first, safe-move collapse (a key whose
remaining tiles are all free and even in number is removed without branching), memo on the presence bitset,
moves ordered by height and how many tiles they unblock. Budgets: 6,000 nodes in the background after a failed plan repair, 20,000 when the player asks for a hint, 25,000 in the test checks.

## 8. RNG
`mulberry32` (public-domain algorithm) seeded from a 32-bit integer. Daily seeds are `fnv1a("BHM-" + YYYY-MM-DD)`.
The deal, shuffles and win-fact choice draw from the game RNG, so a seed reproduces a whole game.
Cosmetic randomness (steam wobble) uses `Math.random` and never touches game state.

## 9. Save format (`localStorage`, all wrapped in try/catch)
| Key | Contents |
|---|---|
| `bhm.settings.v1` | `{sound, volume, motion:'auto'|'full'|'reduced', theme:'auto'|'light'|'dark', highlightFree, showTimer, captions}` |
| `bhm.stats.v1` | `{played, won, streak, bestStreak, layouts:{id:{played, won, bestMs, bestScore}}, daily:{last, streak, best, done:{date:ms}}}` |
| `bhm.game.v1` | the state object `S` for "Continue" (saved after every move and every 5 s of play) |
If storage throws or is missing, the game keeps everything in memory and says "Stats won't be saved" once in Settings.

## 10. `window.__game` hooks
| Hook | Behaviour |
|---|---|
| `seed(n)` | set the seed used by the next `newGame()` without `seed` |
| `getState()` | `{scene, layoutId, seed, daily, tilesLeft, total, freeCount, pairsAvailable, selected, score, combo, elapsedMs, hints, shuffles, undos, status, historyLen, redoLen, planValid, rowDone, settings, tiles:[{i,x,y,z,f,key,present,free}]}` |
| `setState(s)` | accept a full `S` (as saved) and redraw; returns `true` |
| `isIdle()` | no animation or toast transition running |
| `scene(name)` | `'title' | 'layouts' | 'game' | 'help' | 'tiles' | 'stats' | 'settings' | 'win' | 'stuck' | 'pause'` |
| `newGame({layout, seed, daily, date})` | start a game; returns summary |
| `act(name, ...args)` | `'click', i` (as a tap), `'match', a, b`, `'hint'`, `'shuffle'`, `'undo'`, `'redo'`, `'solveStep'` (play the plan's next pair), `'solveTo', n` (play plan pairs until `n` tiles remain), `'key', k` (simulate a key), `'stuck'` (force a stuck board for tests), `'verifyDeals', layout, count` (count solvable deals by replaying their construction plan), `'tileCenter', i` (CSS px center for pointer tests), `'zoom', on`, `'animAt', ms|'now'|null` (freeze the animation clock for mid-effect screenshots), `'composition', layout, seed` (face counts of a deal), `'solverCheck', layout, n`, `'contrast'`, `'faceMeta'` |
| `pause()` / `resume()` | pause/resume the timer (also shows the pause overlay) |
