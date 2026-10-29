# Bathhouse Mahjong: visual report (campaign v3)

**Status:** done. The game now plays on real 3D tiles in front of a painted, sourced Bathhouse Row, with a 2D fallback. Nothing is committed.

Plan: `VISUAL-PLAN.md`. Reviews: `screenshots/visual-before/REVIEW.md`, `screenshots/m2/REVIEW.md`, `screenshots/m3/REVIEW.md` and `screenshots/visual-final/REVIEW.md`. Before/after sheets: `screenshots/visual-final/before-after/` (35 sheets). Gallery: `screenshots/index.html`. Screenshots are git-ignored, so all of these exist only on the machine that ran them.

## What changed

### Direction: 3D tiles inside the existing 2D game
- **Renderer.** `board3d.js` draws the board with three.js r169, vendored as `vendor/three.min.js` (npm, MIT; see `SAMPLES.md`).
- **What stayed the same.** Rules, deals, saves, the test hooks and the painted tile faces are unchanged.
- **Fallback.** The old 2D canvas renderer remains, used when there is no WebGL, when WebGL is software-only, when the slow-frame watchdog trips, under Settings → Tiles: Flat, or with `?gl=0`.

### Tiles
- **One draw call.** All 144 tiles are one `InstancedMesh` of rounded resin bodies, 1 × 1.3 × 0.56 world units.
- **Faces.** They come from a 2048² atlas painted by the same `drawFace()` the 2D sprites use, with a CPU-built mip chain.
- **Material.** A shader patch on `MeshPhysicalMaterial` (with clearcoat) draws the face, the tile back, and the tile set's layered sides: ivory face layers over a deep jade back.
- **Per-tile state.** Each tile carries a blocked-tile dim, plus a selection glow and a hint glow.

### Camera
- **Classic (default)** is an oblique orthographic projection, like a printed or 2D board.
  - Stacks offset up and to the left, and the south and east sides show.
  - The board is square, with no keystone, and every free face is fully visible.
  - Lighting and shadows are still real 3D.
- **Tilted** is a 13° perspective lens. **Top-down** is the same lens looking almost straight down.

### Light and table
- **Lighting:**
  - a studio environment (PMREM) for the glossy rims
  - a low key light from the north-west with soft PCF shadows, redrawn only when tiles move
  - hemisphere and cool fill lights
  - neutral tone mapping
- **Table:** a dark verde marble slab with a brass rim, trimmed to the board.

### Backdrop and title
- **Backdrop.** A painted view of Bathhouse Row from across Central Avenue, in day and Neon Night versions (`assets/backdrop-day.webp`, `backdrop-night.webp`).
  - It shows the eight bathhouses in true north-to-south order: Superior, Hale, Maurice, Fordyce, Quapaw, Ozark, Buckstaff, Lamar.
  - It includes the eagle gate piers between the Maurice and the Fordyce, the five-globe lamp posts and the magnolia promenade, with the Mountain Tower small on the ridge at the left.
  - The paintings were made with Codex image generation, then corrected twice against public-domain 1984 HABS photographs and measured drawings:
    - The Quapaw dome is now an ochre chevron with turquoise diamonds.
    - The Fordyce shows its lozenge brick, marquee and end pavilions.
    - The Ozark has its stepped twin towers and the Buckstaff its Doric colonnade.
    - The fronts meet the sidewalk through hedges, with no raised terrace.
    - There are no palms.
- **Title.** A full-bleed painting of the Fordyce (with its eagle piers), the Quapaw and the Ozark. The menu sits on a teal-and-brass card with gold primary buttons.

### Feel
- **Deal-in:** tiles drop in layer by layer. It starts after the first 3D frame, so a shader compile can't swallow it.
- **Selection:** a lift and a thick gold ring.
- **Hint:** both tiles lift, with a solid turquoise ring and a spreading ripple, in both renderers. The hint is never dashed and never the selection colour.
- **Match:**
  - The pair rises, slides together and clacks.
  - At the clack come a column of steam (taller for combos), gold sparks and a "+10 / Combo ×n" pop.
  - The pair then lifts away.
- **Shuffle:** a diagonal wave of 360° flips that shows the old faces, the jade backs, then the new faces.
- **Blocked tiles** ease in and out of dim.
- **Win:**
  - the slab clears away to reveal the Row
  - a burst of sparks and a "Board cleared!" title
  - the score counts up on the card
- **Reduced motion:** short fades only, with no deal, flip, steam or pops (tested in both renderers).

### Phones
- **Layouts.** Two new portrait-first 144-tile layouts, each 8 tiles wide: **Tufa Terraces** and **Display Springs**.
  - Both have sourced captions and solvable deals (100 of 100 per layout).
  - A portrait phone starts on Tufa Terraces (about 39 CSS px per tile).
  - The layout picker lists the two phone layouts first and tags them "Fits phones".
- **Zoom.**
  - On a phone it also fills the height (about 61 CSS px tiles on Classic Pyramid).
  - Gold edge chevrons show where more of the board lies.
  - Pinch-to-zoom works: spread two fingers to zoom in, pinch to zoom out.
- **Layout picker.** Thumbnails are small renders of the real 3D board over the backdrop.

### UI
- **HUD and toolbar:** a teal-and-brass HUD with stat chips, a dock of icon tool buttons with a gold primary Hint, and indicator dots on the toggles.
- **Status line:** an italic serif caption strip.
- **Overlays:** brass-edged panels, and a win header with ✦ ornaments.
- **New settings:**
  - **Tiles:** Auto, 3D or Flat.
  - **Camera:** Classic, Tilted or Top-down.

### `file://`
- **The problem.** Image files are cross-origin there, so drawing them into the atlas would taint it, and WebGL refuses tainted textures.
- **The fix.** The tile art also ships as data URIs in `assets/art-data.js` (`tools/build-art-data.mjs`). The game loads that file only under `file://`.
- **The check.** `tools/check-file-url.mjs` confirms 3D renders under `file://` with 35 art images, 0 console errors and 0 non-file requests.

## Review scores (independent adversarial reviewer)

| Category | Before | m2 | m3 | Final | Best benchmark |
|---|---|---|---|---|---|
| Art (faces / bodies / backgrounds) | 6 (8/4/4) | 7 (8/6/8) | 8 (8/7/9) | **8** (8/7/9) | 9 Mahjong Journey |
| Lighting and depth | 4 | 7 | 8 | **8** | 9 Mahjong Worlds |
| Animation and feel (from stills) | 3 | 6 | 7 | **7** | 9 Mahjong Journey |
| UI | 4 | 6 | 7 | **7** | 8 Microsoft / Journey |
| Typography | 5 | 6 | 7 | **7** | 7 Realms / GNOME |
| Readability | 5 | 6 | 7 | **8** | 9 Vita Mahjong |
| Mobile (portrait) | 2 | 4 | 5 | **7** | 9 Vita Mahjong |
| Authenticity of setting | 6 | 8 | 9 | **9** | 8 Journey (beaten) |

Benchmarks: 16 store and project screenshots of Microsoft Mahjong, Vita Mahjong, Mahjong Journey, Mahjong Dimensions, Mahjong Worlds, Mahjong Realms, KMahjongg and GNOME Mahjongg (`benchmarks/SOURCES.md`, git-ignored, review only).

After m3, the reviewer named two Major gaps: the phone default view and the sheared default camera. They were addressed with the portrait default, height-filling zoom and the Classic oblique camera.

**The final review (`screenshots/visual-final/REVIEW.md`) found no remaining Major gap.**
- **Phone:** a portrait phone opens on about 40 CSS px tiles that fill about 89% of the play area, and Zoom fills the height at about 73 CSS px.
- **Desktop:** the Classic board is square to the pixel, and tower faces are visible.

It named the remaining gaps as Medium or Minor; they are listed under Known gaps.

## Tests
`node shared/test-harness/run.mjs games/mahjong --milestone visual-final`. 3D is forced with `?gl=1`, because the harness Chromium has only SwiftShader, where Tiles: Auto rightly chooses flat tiles. Every test checks for zero console errors and zero external requests.

| File | What it covers | Result |
|---|---|---|
| 01-screens | title, menus, 7 layout cards, HUD, pause, 44 px targets | pass |
| 02-rules | 7 layouts valid; 100/100 solvable deals each; composition; layout shots | pass |
| 03-play | select, blocked, match, steam, combo, hint, undo/redo, Row toast, stuck and shuffle, win | pass |
| 04-modes | daily, stats, continue after reload, no storage | pass |
| 05-themes | free-tile highlight, Neon Night, reduced motion (2D wall clock + 3D animation list), sound | pass |
| 06-input | keyboard-only play, pointer and touch with zoom and pan, **pinch zoom** | pass |
| 07-quality | contrast (55 pairs, lowest 5.69:1), load, size, fps, heap, deal time | pass |
| 08-art | all 39 assets decode; the game asks only for packed assets; `art-data.js` is not loaded over http; tile sets persist; `?art=0` fallback | pass |
| **09-render3d (new)** | WebGL2 instanced draw; `?gl=0`; Tiles setting; **watchdog** falls back on slow frames; **context loss** falls back; mid-animation deal, match and shuffle; every layout fits on screen; phone tiles ≥ 38 px; phone default and phone zoom; the three cameras; Neon Night 3D | pass |

**Final complete run:** 63/64 at both viewports, with 0 console errors and 0 external requests in every test. The full log is in `screenshots/visual-final/run-full.log`.
- **The one failure** was a test assumption: on a fast run the first match also fell inside the 4-second combo window, so the combo count was ×2 where the test expected ×1.
- **The fix:** the check now verifies the rule itself (the combo goes up by one, and the pair scores 10 + 5 × combo). The re-run of `03-play` passed 10/10.
- **`report.json`** holds only the last partial re-run, because the harness overwrites it (see harness request 4).

Node tools:
- `tools/check-layouts.mjs 30`: 7 layouts, 0 errors, 30/30 deals each.
- `tools/check-file-url.mjs`: OK.
- `tools/perf-gpu.mjs`: see below.

Test fixes made along the way (none of them change rules):
- Long hint and solve loops now run inside the page.
- The quick-combo pair runs in one page call.
- The live region and post-shuffle shots wait for the condition rather than a fixed delay.
- The deal-time check uses the 95th percentile, because on a machine shared by many sessions single deals stalled to 148 ms while p95 was 2 ms.

## Performance
Measured with `tools/perf-gpu.mjs`, which runs headless Chromium on the real GPU (an RTX 5060 via D3D11). The machine was also running other sessions' Playwright, Blender and Codex jobs.

| Scene | Desktop 1280×800 (Arlington) | Mobile 390×844 @3x (Terraces) | Mobile, CPU throttled ×4 |
|---|---|---|---|
| Deal-in | 52 fps (one 150 ms first-frame hitch) | 60 fps | 29 fps |
| Hint pulse | 60 | 60 | 32 |
| Match | 60 | 58 | 32 |
| Shuffle | 60 | 57 | 25 |

- **Load:** 0.3–0.5 s to the game hooks over http. The title paints first; the 3D renderer compiles its shaders and uploads the atlas on the title screen while it sits idle.
- **Memory:** JS heap 9.5 MB.
- **GPU work:** 2–4 draw calls per frame. The face atlas takes about 21 MB of GPU memory with mipmaps, and pixel ratio is capped at 2. An idle board draws nothing (render on demand, as before).
- **Download over http:**

  | Part | Size |
  |---|---|
  | `index.html` | 196 KB |
  | `board3d.js` | 30 KB |
  | `vendor/three.min.js` | 670 KB (about 170 KB gzip) |
  | `assets/` | 39 WebP files, 3.0 MB |
  | **Total** | **≈ 3.5 MB** |

  `assets/art-data.js` (1.9 MB) loads only under `file://`.
- **Low-end devices:** Tiles: Auto chooses flat tiles on software WebGL (SwiftShader, llvmpipe, Basic Render). A watchdog also switches when 30 animated frames after the deal average slower than about 17 fps; the choice is remembered (`bhm.gl.slow`) and announced with a toast. On a lost WebGL context the game switches to flat tiles with the state untouched. Both cases are tested.
- **Harness budgets:** the 2D renderer still measures about 60 fps animating, 9.5 MB heap and 0.2–0.5 s load (`07-quality`).

## Known gaps
These are ranked as the final review ranked them. None is Major.

**Medium**
- **The win moment is still a cream card.** The reviewer calls it borderline Major against Journey and Dimensions. The table clears to show the Row, sparks burst and the score counts up, but there is no postcard frame, no day-to-night crossfade, and the backdrop gets a milky haze.
- **The steam is small and grey on the dark slab.** The plume is canvas puffs, not a warm additive column.
- **Sparse layouts leave large empty slab areas** (Arlington, Mountain Tower), and the slab covers the centre of the painting during play. The fix is a slab fitted to each layout's footprint.
- **Dialogs and the picker page are still cream web cards** with brass edges, and the phone picker thumbnails are narrow slivers.

**Minor**
- Under Classic, the top edge of each row hides the captions of the row behind it, as in a 2D board.
- The status strip is always on screen.
- In dark mode, a tile that is both selected and hinted washes out.
- The tile backs are sage rather than jade.
- Tilted still shears on one side.
- Display Springs would make a cleaner phone default than Tufa Terraces.
- Top-down leaves no right margin.
- The Quapaw's striped awnings are missing from the title.

**Other gaps**
- **Bathhouse Row layout shape.** It still reads as a wall with three stacks rather than eight rooflines. Changing its positions would corrupt saved "Continue" games on that layout, so it needs a new layout id plus a save migration. Left for a follow-up.
- **Wide layouts on phones.** Pyramid, Row, Arlington and Tower are about 24–32 CSS px per tile in portrait. The phone default (Terraces) and Zoom (about 61 px, filling the height) work around this, but the wide layouts cannot be rotated without changing the left/right freeness rule.
- **Win and steam.** The win is still a card; a postcard frame or a day-to-night crossfade would go further. The steam column is bigger but still canvas puffs, not volumetric.
- **Dialogs** (help, settings, stats, stuck) are the earlier cream panels with brass edges, not fully in the dock's teal language.
- **Audio** is unchanged and still has not been listened to by a person (it is generated with WebAudio).
- **Real phones were not tested.** Performance on a real phone GPU is unmeasured; the phone numbers come from desktop Chromium with phone emulation and CPU throttling.
- **The 3D renderer was never seen in the harness at full speed.** Harness screenshots of 3D come from SwiftShader at about 0.5–1 s per frame, so animation timing was judged from frozen-clock stills plus the GPU fps tool.

## New research (with sources)
`research/bathhouse-row-facades.md` (new). Its main sources:
- HABS AR-28 and AR-28-A to I (Library of Congress, 1984): measured west elevations and the site plan with the street silhouette
- the 1985 NRHP/NHL nomination
- NPS pages
- eight public-domain 1984 HABS colour photographs by Jack E. Boucher (in `benchmarks/ref/`, git-ignored)

It gives, for each building:
- stories, measured frontage and height, roof form, materials and signature features
- the gaps between buildings and the total length of the Row (about 1,165 ft)
- the highest point: the Quapaw lantern, about 58–60 ft
- what stands behind and around the Row
- the bearing to the Mountain Tower: about 2,500 ft away to the east-northeast, behind the north half of the Row
- Fordyce interior details, with disputed items marked

### Worth adding to the shared `research/`
1. **Row order confirmed by the HABS site plan:** Superior, Hale, Maurice, Fordyce, Quapaw, Ozark, Buckstaff, Lamar, then the Admin Building. This settles the "[UNVERIFIED] confirm against an NPS map" note in `visual-style-guide.md`.
2. **Measured frontages and heights** (HABS elevations, ±1–2 ft), and the Quapaw lantern as the highest point.
3. **Corrections to `visual-style-guide.md` recipes:**
   - The Fordyce roof is two low hipped end pavilions with a flat centre.
   - The Hale's bell gable sits low, on the one-storey porch.
   - The Quapaw dome is ochre/tan chevron with an ochre band and blue diamonds, not "brilliantly coloured" blue and yellow.
4. **Conflicts to flag:**
   - The Admin Building faces Reserve Ave (south), not Central.
   - Admin Building date: 1936 vs 1938.
   - Hale remodel: 1919 (NRHP) vs 1914.
   - Brick colours: Buckstaff and Fordyce are "cream" in the NRHP but tan or golden in the 1984 photos.
5. **Street furniture:** the five-globe green cast-iron lamp posts and the single row of magnolias, about 25 ft apart (NRHP; HABS).

## Shared-data requests
- Add the facade table and corrections above to `research/visual-style-guide.md` and `research/bathhouse-row-and-springs.md`.
- `LESSONS.md`, painted-art section:
  - Under `file://`, image files taint WebGL textures; ship data URIs for anything uploaded to the GPU.
  - Python edit scripts can mangle CSS escapes such as `\2726`.

## Harness requests
1. **A GPU mode.** Chromium flags (`--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`) work headless on this machine and give the real GPU. Without them every WebGL game renders at about 1–2 fps in SwiftShader, which stretches 3D test runs to 40+ minutes and makes timing-sensitive assertions flaky.
2. **A configurable `t.shot` idle timeout.** 5 s is too short for software-rendered 3D animations; tests now wait explicitly.
3. **Built-in before/after sheets.** Like `sheets.mjs --compare visual-before`; `tools/before-after.mjs` does this locally.
4. **Keep `report.json` from partial runs.** Re-running one `--file` overwrites the milestone's `report.json`; merging per file would keep a complete record.
