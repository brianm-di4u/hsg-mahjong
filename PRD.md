# Bathhouse Mahjong: product requirements

## 1. Vision and pillars
A calm, handsome mahjong-solitaire game set on Bathhouse Row. Each tile is a little piece of Hot Springs,
Arkansas (springs, bathhouses, lakes, mountains and flowers) and every board is a local silhouette.

1. **Always winnable.** Every deal and every shuffle is generated backwards from a solution. Hints keep you on a winnable path.
2. **Legible first.** Every tile has a big index numeral or letter plus a colorblind-safe suit shape. Art never hides the index.
3. **Tactile and steamy.** Tiles have real depth and a satisfying click. Matched pairs lift away in puffs of steam.
4. **Local and true.** Tile names and tooltips, layout captions and the win-screen fact all come from the sourced research corpus.

## 2. Target players
- Casual puzzle players on laptops and phones who know mahjong solitaire, or who learn it in one screen.
- Visitors and residents curious about Hot Springs; history buffs who like "did you know" moments.
- Keyboard-only and low-vision players (scalable text, high contrast, no color-only cues).

## 3. Modes
| Mode | Description |
|---|---|
| **Classic** | Choose one of five layouts; a random seed each game. |
| **Daily Puzzle** | One date-seeded deal per day on a layout that rotates daily; the daily streak is tracked. |
| **Continue** | Resume the last unfinished game (saved automatically). |

Out of scope for v1: the 4-player traditional mahjong mode (stretch goal; see §15).

## 4. Rules (complete)
1. The board starts with 144 tiles stacked in a layout.
2. A tile is **free** when no tile lies on top of it (even partly) and its left side or its right side is open (no tile on the same layer touching that side).
3. Select two free tiles that **match** to remove them. Tiles match when they are the same suit and number, the same mountain or the same dragon. **Any Flower matches any Flower; any Season matches any Season.**
4. Clear all 144 tiles to win.
5. If no free pairs remain you are **stuck**: shuffle the remaining tiles (they are rearranged in a solvable order, with a score penalty), undo, or start again.
6. **Undo** is unlimited and steps back one match or shuffle, restoring the score. **Redo** replays undone steps until you make a new move.
7. **Hint** highlights a pair that keeps the board winnable, if one is known; otherwise any free pair.

### Scoring
| Event | Points |
|---|---|
| Match | +10 |
| Combo (a match within 4 s of the previous one) | +5 × combo level, capped at +25 |
| Clearing all 36 Bathhouse tiles | +100 one time ("Bathhouse Row complete") |
| Hint | −15 |
| Shuffle | −50 |
| Win | +500, plus +1 per second under 10:00 |
The score never goes below 0. Undo restores the score from before the undone move.

## 5. Hot Springs content map
| Where | Content | Source (see `research/town-content.md`) |
|---|---|---|
| Springs suit 1–9 | steam-spring pools; facts on 143°F, 4,400-year water, tufa, algae, 47 springs | GLM thermal springs |
| Bathhouses suit 1–9 | the eight bathhouses north→south plus the 1936 Administration Building | VSG, BRS |
| Lakes & Fish suit 1–9 | fish counts over lake water; Ouachita, Hamilton, Catherine, DeGray facts | GLM lakes, FW |
| Winds | Hot Springs, North, West and Sugarloaf mountains (no elevations) | GLM mountains |
| Dragons | Red Tile, Green Tile (Maurice), White Stone (novaculite) | VSG, GLM |
| Flowers | magnolia, dogwood, redbud, sweetgum | FW, VSG |
| Seasons | spring tulips, summer lake, autumn slopes, winter lights | CEF, FW |
| Layouts | Classic Pyramid, Mountain Tower, Arlington Towers, Bathhouse Row, Ouachita Islands, each with a caption | GLM, VSG |
| Win screen | one random fact from `trivia-bank.json` (Places & Landmarks, Nature & Lakes; confirmed only) | TB |
| Event toast | "Bathhouse Row complete! The Lamar finished the Row in 1923." | BRS |
| Title | "Valley of Vapors" subtitle; Bathhouse Row skyline with steam | GLM, VSG |

## 6. Screens and UX flow
```
Title ─┬─ Continue ───────────────┐
       ├─ Daily Puzzle ───────────┤
       ├─ Play → Layouts ─────────┼─→ Game ─┬─ Pause ─→ Game / Title
       ├─ How to Play (Help)      │         ├─ Stuck ─→ Shuffle / Undo / New
       ├─ Tile Guide              │         └─ Win ───→ Play again / Layouts / Title
       ├─ Stats                   │
       └─ Settings ───────────────┘ (Settings and Help also open from the game menu)
```
- **Title:** game name, "Valley of Vapors" subtitle, skyline art with rising steam, a fan of sample tiles, buttons.
- **Layouts:** five cards, each a mini top-down preview of the layout, name, caption, best time and wins.
- **Game:** a top HUD (Menu, layout name or daily date, timer, score, tiles left, moves available) and a bottom
  toolbar (Hint, Shuffle, Undo, Redo, Free-highlight toggle, Zoom on touch screens, Pause). A status line shows
  the name and fact of the selected or hovered tile.
- **Pause:** hides the board (no peeking while the clock is stopped).
- **Stuck:** "No more matches" with Shuffle (−50), Undo, New game.
- **Win:** a steam burst, "Board cleared!", score breakdown, time, best time, a Hot Springs fact card, buttons.
- **Help:** rules in plain words, scoring, controls (mouse, touch, keys), a link to the Tile Guide.
- **Tile Guide:** every tile drawn at full size with its name, grouped by suit, with the suit shape legend.
- **Stats:** totals, streaks, per-layout table, daily streak, reset button (with confirm).
- **Settings:** Sound on/off, Volume, Motion (Auto/Full/Reduced), Theme (Auto/Light/Dark), Highlight free tiles,
  Show timer, Tile captions (names on tiles when there is room).

## 7. Art direction
- **Palettes** (copied from `shared/design/tokens.css`): light UI = default light theme (gilded-spa);
  table = thermal-water pool `#1F5F6B → #174A54`; dark UI and table = deco-neon midnight `#14121F` with gold
  `#D4AF37` and neon blue `#4FC3FF` accents; suits use thermal-water (Springs), gilded-spa (Bathhouses),
  lake-life (Lakes), ouachita-forest (Mountains).
- **Painted art (v2):** the set follows the boutique designer-acrylic sets in `Sample Images/`. Original
  hand-painted motifs were generated with Codex image generation and packed to `assets/*.webp`
  (`art-src/art.json`, `node shared/test-harness/art-pack.mjs games/mahjong`). They are composited into the
  cached tile sprites, so frame cost is unchanged. Every face keeps its vector art as a fallback, used when an
  image is missing or with `?art=0`.
- **Tiles:** glossy white acrylic face with a bevelled rim and a soft highlight. Thick sides show layered colour
  stripes, set by the **tile set**: Palm (mint/lime, bamboo back), Ribbon (coral/green, floral back) or
  Peacock (teal/gold, peacock back, the default in Neon Night). Rounded corners; a soft cast shadow; layers
  offset up-left so stacks read as 3D. The table is a painted cloth that matches the tile set.
- **Index and shapes (colorblind-safe):** top-left index in a bold serif (1–9, H/N/W/S, R/G/blank frame, 1–4),
  and under it a suit shape: Springs **circle**, Bathhouses **square**, Lakes **diamond**, Mountains **triangle**,
  Dragons **hexagon**, Flowers **flower**, Seasons **four-point star**. Shapes differ in outline, not only color.
- **Recipes** follow `research/visual-style-guide.md` (bathhouse silhouettes, Motif 2 chevron tile back,
  Motif 7 steam, Motif 10 roof strip). Tile backs: Quapaw-inspired chevron mosaic (colors are guesses, labeled
  "inspired by").
- **Dark mode ("Neon Night"):** midnight table, gold-rimmed tiles, neon-blue hint glow.

## 8. Audio direction
All WebAudio synthesis, no files. Soft, woody, bathhouse-calm.
- Select: a short filtered-noise "click" plus a high sine tick. Match: two clacks and a breathy steam "hiss".
- Blocked tile: a low muted thud. Hint: a two-note chime. Shuffle: a rattle of small clicks.
- Combo: the match chime rises a step per combo level (pentatonic). Win: a gentle pentatonic arpeggio with a long hiss.
- Sound defaults on and starts only after the first user gesture (autoplay rules). Volume and mute in Settings.

## 9. Accessibility
- Full keyboard play (see MECHANICS §5); every control is a `<button>` with a visible focus ring.
- Text contrast ≥ 4.5:1 in both themes (UI tokens are pre-checked; tile index colors are checked in tests).
- Colorblind-safe: suit shape + index on every tile; selection uses a thick outline and lift, not only color;
  the hint uses a pulsing dashed ring.
- `prefers-reduced-motion` respected (plus a manual Motion setting).
- Text uses `rem` and scales with the browser font size; the canvas index numerals scale with the tile size.
- Screen readers: the canvas has a role and label; a live region announces selections, matches, hints, stuck and win.

## 10. Mobile and touch
- Portrait phones (390 × 844) and landscape tablets/desktops. Toolbar buttons are ≥ 44 × 44 px.
- Tap to select. Zoom toggle (1.8×) with drag-to-pan for small tiles. No hover-only information.
- No horizontal page scroll; the board always fits the space between HUD and toolbar.

## 11. Performance budgets
- 60 fps during animations on a mid-range laptop; zero work when idle.
- `index.html` ≤ 2 MB; `assets/` ≤ 3.5 MB. Interactive in ≤ 2 s (target < 300 ms after load).
- Deal generation < 50 ms per layout; hint < 50 ms typical.

## 12. Save / load
Settings, stats and the current game in `localStorage` (keys in MECHANICS §9), all wrapped in try/catch.
The game works fully without storage.

## 13. Acceptance criteria
**Rules and deals**
1. AC1: Each of the five layouts has exactly 144 positions, no overlaps, no floating tiles.
2. AC2: A deal contains 4 of each of the 34 standard faces, plus 4 distinct Flowers and 4 distinct Seasons.
3. AC3: Every generated deal is solvable: 100 seeded deals per layout replay to an empty board.
4. AC4: Only free tiles can be selected; clicking a blocked tile does not select it and shows "Blocked".
5. AC5: Two free tiles with the same match key are removed; non-matching tiles are not (the second becomes the selection).
6. AC6: Any Flower matches any Flower and any Season matches any Season.
7. AC7: The same seed and layout produce the same deal.
8. AC8: The game detects the stuck state and shows the Stuck overlay with Shuffle, Undo and New.
9. AC9: Shuffle produces a solvable arrangement of the remaining tiles with the same multiset of faces.
10. AC10: Undo restores tiles, score and selection exactly; repeated undo back to the start works; redo replays.
11. AC11: Hint highlights two free matching tiles; following hints repeatedly from the start clears the board.
12. AC12: Clearing the last pair shows the Win overlay with score, time and a Hot Springs fact from the trivia bank.
13. AC13: Score follows §4 (match, combo, hint, shuffle, win bonus, Bathhouse Row bonus).

**Modes, saves, stats**
14. AC14: Daily Puzzle: the same date gives the same layout and deal; different dates give different deals.
15. AC15: Stats (played, won, best time, streaks, daily) persist in `localStorage` and survive reload.
16. AC16: An unfinished game can be continued after reload with the same board, score and time.
17. AC17: The game works with `localStorage` unavailable (no errors).

**UI and presentation**
18. AC18: The title screen shows the name, subtitle, art and all menu buttons at both viewports.
19. AC19: The layout picker shows all five layouts with previews and captions.
20. AC20: Tiles are drawn in 3D with visible depth; stacked layers are distinguishable in screenshots.
21. AC21: Every tile shows an index glyph and a suit shape; the Tile Guide shows all 42 faces with names.
22. AC22: The free-tile highlight toggle dims blocked tiles when on and not when off.
23. AC23: Matches play a steam-puff effect (particles visible mid-animation) and a sound.
24. AC24: The status line shows the selected tile's name and fact.
25. AC25: Help, Stats, Settings and Pause screens open and close.
26. AC26: Dark theme (auto from `prefers-color-scheme` or manual) restyles UI and table.
27. AC27: Reduced motion replaces flights and particles with short fades.
28. AC28: Sound and volume settings work; no audio starts before a user gesture.

**Input and accessibility**
29. AC29: Keyboard only: arrows move a visible cursor; Enter selects; H/S/U/R/F/P/Esc work.
30. AC30: Touch: tapping tiles selects and matches at mobile size; zoom and pan work.
31. AC31: All toolbar and menu buttons are ≥ 44 px tall at the mobile viewport, on-screen, with no horizontal overflow.
32. AC32: Text contrast ≥ 4.5:1 for UI text and tile index glyphs in both themes.
33. AC33: A live region announces selections, matches, hints, stuck and win.

**Performance and quality**
34. AC34: No console errors and no external requests in any test. (Same-origin `assets/` loads are allowed.)
35. AC35: ≥ 55 fps measured during a match animation at desktop; deal generation < 50 ms.
36. AC36: `index.html` ≤ 2 MB; `window.__game` appears in < 2 s.

## 14. Risks
- Small tiles on phones: mitigated by zoom, large index glyphs and captions off by default on small tiles.
- Custom tile art could confuse traditional players: the Tile Guide and the index/shape system fix this.

## 15. Out of scope (v1)
- Traditional 4-player mahjong against AI (stretch goal; only if the core is polished, likely a later wave).
- Era tile sets (frontier wood grain, Deco, "vacant Row"), the Lost Landmarks bonus round, the DeSoto helmet tile, the 143° wild tile.
- Layout editor, online leaderboards, multiplayer, music tracks.
- Pinch-zoom gestures (a zoom toggle plus drag is provided instead).
