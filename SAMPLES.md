# Code-sample survey: mahjong solitaire

Surveyed 2026-10-28 with WebSearch and WebFetch (repository pages and raw files read online).
**No sample code was downloaded and none was copied into the game.** Everything in `index.html` is
written from scratch. The samples were read for ideas only, so `reference-samples/` is empty.
Mahjong solitaire's rules (remove free matching pairs; a tile is free when it has nothing on top and
an open left or right side) are a traditional public-domain game and are not taken from any sample.

| # | Project | URL | License | Version read | Verdict |
|---|---|---|---|---|---|
| 1 | **Mah** (ffalt) | https://github.com/ffalt/mah | MIT | `main` branch as of 2026-10-28 (1,746 commits; no tagged release shown) | Ideas adapted (allowed license, but no code copied) |
| 2 | **mahjong-solitaire** (ScriptRaccoon) | https://github.com/scriptraccoon/mahjong-solitaire | MIT | `master` branch as of 2026-10-28 (41 commits) | Ideas only; shows what to avoid |
| 3 | "I built mine backwards" (juju.games write-up, DEV Community) | https://dev.to/dev_nash/most-free-mahjong-games-can-deal-you-a-board-you-cant-finish-i-built-mine-backwards-1cia | No license stated for the code | Article as published | **Reference only** (no license) |
| 4 | **KMahjongg** (KDE) `gamedata.cpp` | https://lxr.kde.org/source/games/kmahjongg/src/gamedata.cpp | GPL-2.0-or-later | KDE LXR index of 2024-04-21 | **Reference only** (GPL) |
| 5 | **mass:werk Mahjong** (N. Landsteiner) | https://masswerk.at/mahjong/ | All rights reserved | Live site, 2005 | **Reference only** (proprietary); UX notes only |

## 1. Mah (ffalt), MIT
- **What it does well:** an Angular + TypeScript + SVG game with 84 layouts, a seeded layout generator,
  daily challenges, light/dark tile sets, optional 3D tiles and shadows, keyboard shortcuts for every
  action and screen-reader announcements. Its `SolvableBoardBuilder` (`src/app/model/builder/solvable.ts`)
  builds a solvable board by repeatedly taking two random *free* stones from the full layout, marking them
  picked and giving them a matching pair. It retries the whole walk up to 2,000 times, optionally
  constrained to a min/max count of simultaneously free stones (a "breadth" difficulty knob), then falls
  back to alternative group orders, and only as a last resort to a random (possibly unsolvable) board.
  `stone.ts` reduces freeness to one predicate: blocked if any `top` neighbour is still present, or if
  both a `left` and a `right` neighbour are present.
- **What it does badly (for us):** a large framework app (Angular, workers, many modules), so nothing
  is single-file friendly. Precomputed neighbour lists come from a separate mapping step that is not
  visible in the stone code. The random-board fallback can silently hand out an unsolvable deal.
- **Ideas we take:** precompute `top`, `left`, `right` neighbour lists per position once per layout;
  the blocked predicate; whole-walk retry instead of backtracking; seeded RNG with shareable seeds;
  the "breadth" knob as a future difficulty setting.

## 2. mahjong-solitaire (ScriptRaccoon), MIT
- **What it does well:** small plain HTML/CSS/JS with modular files (`coordinates.js`,
  `createTiles.js`, `images.js`); simple rules text; a live demo.
- **What it does badly:** deals are a plain shuffle with no solvability guarantee ("no moves left,
  gameover"); no undo; the hint flashes only one tile of a random pair; DOM + jQuery animation per tile.
- **Ideas we take:** a hint should show *both* tiles of the pair; a stuck board needs a real recovery
  path (shuffle/undo), not just a game-over line.

## 3. juju.games "built backwards" article (no license, reference only)
- **What it does well:** explains the reverse-construction idea clearly. Build a removal order on the
  *empty geometry* (pick two geometrically free slots, remove, repeat), then paste shuffled face pairs onto
  that order. Replaying the order clears the board, so a solution exists before the first move. It notes
  that a solvable deal is not unlosable, and that Shuffle should rerun the same construction on the
  remaining positions so a reshuffled board is solvable too.
- **What it does badly:** greedy walk with only 60 retries and a fallback that pairs adjacent positions
  (possibly unsolvable); no backtracking or difficulty control.
- **Ideas we take (concept, not code):** reverse construction for both the deal and the shuffle; treat
  "stuck" as a recoverable state with a message and buttons, not a game-over screen.

## 4. KMahjongg `gamedata.cpp` (GPL, reference only)
- **What it does well:** keeps per-position dependency records (`lhs_dep`, `rhs_dep` neighbours in the
  same band, `turn_dep` tiles above, `place_dep` tiles below) so freeness updates are cheap. Its
  generator draws two candidate positions and keeps the higher one, which spreads pairs across layers,
  and it rejects pairing two positions that are horizontally adjacent (pairs side by side are trivial).
- **What it does badly:** forward placement with no backtracking and a draw cap; bug reports
  (KDE 314219, Launchpad 181152) describe unsolvable games despite "generate solvable games", and odd
  tile counts produce leftovers. GPL, so nothing can be copied.
- **Ideas we take (concept, not code):** reject side-by-side pairs and same-stack pairs in the deal so
  the opening is not trivial; validate that every layout has an even tile count and that every raised
  tile is supported.

## 5. mass:werk Mahjong (proprietary, reference only)
- **What it does well:** a long-lived browser game with 144 tiles, several tile sets and layouts, and a
  clear one-line rule ("no tile on top and it can slide out to the left or right").
- **What it does badly:** "Reshuffle" redistributes tiles randomly, so it can produce another dead board.
- **Ideas we take:** the plain-language rule wording for the help screen (rewritten in our own words).

## Side-by-side: what becomes the foundation

| Concern | Choice | From |
|---|---|---|
| Geometry | Half-tile grid `(x, y, z)`; each tile covers 2×2 cells | common to 1, 3, 4 |
| Freeness | Precomputed `top` / `left` / `right` lists; free = no top present && (no left present \|\| no right present) | 1 (predicate), 4 (precomputed deps) |
| Deal | Reverse construction on empty geometry, whole-walk retry, reject side-by-side pairs early in the walk, any even tile count | 3 (concept), 1 (retry), 4 (adjacency rule) |
| Shuffle | Rerun reverse construction on remaining positions with remaining pairs, so a shuffled board is still solvable | 3 |
| Hint | Both tiles of a pair, chosen by a small bounded solver so hints keep the board winnable | 2 (what not to do) + own solver |
| Stuck | Recoverable state with Shuffle / Undo / New buttons | 2, 3 |
| Rendering | Our own Canvas 2D with cached face bitmaps (none of the samples is Canvas-based) | own |
| Accessibility | Keyboard for every action, live-region announcements | 1 (feature list) |
