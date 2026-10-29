# Bathhouse Mahjong: visual plan (campaign v3)

## Where we start
- Baseline run `--milestone visual-before`: 44/44 tests pass. All 80 screenshots were inspected as contact sheets, with key shots opened full size.
- The independent review (`screenshots/visual-before/REVIEW.md`) compared our screenshots with 16 benchmark shots of Microsoft Mahjong, Vita Mahjong, Mahjong Journey, Mahjong Dimensions, Mahjong Worlds, Mahjong Realms, KMahjongg and GNOME Mahjongg.

| Category | Ours | Best benchmark |
|---|---|---|
| Art | 6 (faces 8, bodies 4, backgrounds 4) | 9 Journey |
| Lighting and depth | 4 | 9 Worlds |
| Animation and feel | 3 | 9 Journey |
| UI | 4 | 8 |
| Typography | 5 | 7 |
| Readability | 5 | 9 Vita |
| Mobile | 2 | 9 Vita |
| Authenticity | 6 (content 9, visuals 4) | 8 Journey |

The review's top gaps:
1. Phone tiles are tiny.
2. Blocked tiles turn into grey concrete.
3. The tile bodies have no real thickness.
4. Selection, hint and match are hard to see.
5. The backgrounds are generic wallpaper.
6. The HUD and toolbar look like an unstyled web form.
7. Medium gaps: no win celebration, a Tuscan-looking title, layout shapes that don't read, and a weak dark theme.

## Direction: real 3D tiles inside the existing 2D game (three.js), with the 2D renderer kept as the fallback
- **Why 3D.** Thickness, layered resin edges, soft shadows and clear depth between layers are the biggest gaps, and they are exactly what a lit 3D tile gives for free. Mahjong Worlds and Dimensions show the ceiling.
- **Why not a free 3D camera.** Readability wins in this genre: Vita and Microsoft keep a near-top-down view. We use a fixed camera tilted 25° from vertical and turned 9° from the south-east. Faces stay upright and readable, and the visible south and east sides show the resin stripes. Because higher stacks can only hide the bottom-right strip of a lower tile, the index in the top-left corner always stays visible. A "Top-down" camera setting gives the flattest view.
- **What stays the same.** Rules, deals, saves, hooks, the tile faces (the painted art plus vector fallback, through the same `drawFace()`), the 2D renderer (Settings → Tiles: Flat, `?gl=0`, or no WebGL), and every test hook.

### Renderer (`board3d.js`, three.js r169 vendored in `vendor/`)
- One `InstancedMesh` holds all 144 tiles: a rounded box with smooth normals, about 1,000 triangles. That makes 2 draw calls plus 1 for shadows.
- The material is MeshPhysical with clearcoat. A shader patch draws:
  - the painted face from a 2048² canvas atlas on top (the same `drawFace()`, with CPU-built mipmaps)
  - the tile back underneath
  - resin bands on the sides, with a fine bright seam between layers, per tile set
  - per-tile dimming for blocked tiles, and selection, hint and hover glow
- Lighting:
  - a studio environment (PMREM) for the glossy rims
  - a key light from the north-west with a PCF soft shadow map
  - a hemisphere fill and a cool south-east fill
  - neutral tone mapping
- The 2D canvas stays on top as the input surface and the overlay. It draws the crisp selection ring, the dashed hint ring (a shape cue, not just colour), the keyboard cursor, steam, gold sparks and score pops.
- Picking is a ray against each tile's rest box. `tileCenter`, keyboard navigation, pan and zoom all use the projected positions.

### Feel
- **Deal-in:** tiles drop in layer by layer.
- **Selection:** the tile lifts, glows gold and gets a crisp ring.
- **Hint:** a pulse and bob, plus a dashed animated ring.
- **Match:** both tiles rise, slide together and clack, then lift away into a burst of steam, gold sparks and "+10 / Combo ×n".
- **Shuffle:** every tile flips in a diagonal wave, showing its back.
- **Blocked tiles** ease between dim and lit.
- **Win:** a steam and spark burst and a stronger win card (planned).
- **Reduced motion:** short fades only.

### Mobile
- Two new portrait-first 144-tile layouts, eight tiles wide, following the benchmarks' approach of tall, narrow phone layouts:
  - **Tufa Terraces**
  - **Display Springs**
- The layout picker marks them "Fits phones". Wide layouts keep Zoom, which now dollies the 3D camera.
- On phones the camera is flatter (pitch 19°).

### Setting (authenticity)
- The backdrop becomes a painted view of Bathhouse Row: the eight bathhouses in true north-to-south order, Hot Springs Mountain and the tower behind, with day and Neon Night versions. It is painted by Codex from public-domain HABS and NPS photographs plus a sourced facade fact file (`research/bathhouse-row-facades.md`).
- The table becomes a marble slab with a brass edge, after the Fordyce's marble, and receives the tile shadows.
- A new title painting replaces the Tuscan-looking hero.

### UI
- A restyled HUD and toolbar: a deco brass frame and icon buttons with clear primary and secondary weight.
- The "Free" toggle stops looking like the main action.
- The status line becomes a slim caption strip.
- Larger HUD labels.

## Asset list
| Asset | Source | Size budget |
|---|---|---|
| `vendor/three.min.js` (r169, MIT) | npm `three@0.169.0`, wrapped by `tools/vendor-three.mjs` | 670 KB (≈170 KB gzip) |
| `board3d.js` | hand-written | 25 KB |
| Bathhouse Row backdrop, day and night | Codex image generation, referenced to public-domain HABS photos | ≤ 300 KB each (WebP) |
| Title painting (Row and mountain) | Codex | ≤ 300 KB |
| Marble slab texture | Codex or procedural | ≤ 150 KB |
| `assets/art-data.js` (face art as data URIs, loaded only under `file://`, where image files would taint the WebGL texture) | `tools/build-art-data.mjs` from `assets/*.webp` | ≈ 2 MB, never fetched over http |

Blender is reserved for a reference massing render of the Row, if the painted backdrop needs a layout guide. Tile bodies are procedural in three.js, so no GLB is needed.

## Research additions
`research/bathhouse-row-facades.md` collects, per building: stories, roof form, relative height and frontage, materials and signature features, what stands behind the Row, and Fordyce interior notes. It cites NPS, LOC HABS and EOA sources, with public-domain reference photos in `benchmarks/ref/` (git-ignored).

## Performance plan
- **Rendering:** render on demand, as before. Nothing draws while idle, and the shadow map only updates when a tile moves.
- **Load:** one instanced mesh, one 2048² atlas (about 21 MB of GPU memory with mipmaps), and pixel ratio capped at 2. The title paints before the game initialises WebGL.
- **Targets:** 60 fps on a mid laptop and 30+ on phones during match, shuffle and deal. The real GPU is measured with a separate Playwright run using GPU flags, because the harness runs SwiftShader, a software rasteriser.
- **Fallback:** if WebGL is missing or the context is lost, the game switches to the 2D renderer. Settings → Tiles: Flat lets players choose it on weak devices.
- **Download:** the http total stays within the old budgets plus three.js (index ≤ 2 MB, assets ≤ 3.5 MB, vendor 0.7 MB).

## Test plan
- **Existing suites:** 01–08 keep passing in 3D mode, using projected tile centres, the pick path and isIdle covering deal, fade and shuffle.
- **New `09-render3d`:**
  - 3D is active, with a WebGL2 renderer, 3 or fewer draw calls and a non-blank board
  - `?gl=0` and Tiles: Flat fall back to 2D
  - context-loss fallback
  - mid-animation shots of the deal, match, shuffle and hint (`animAt`)
  - the Top-down camera
  - portrait layouts give tiles at least 40 px wide on a 390 px phone
  - every layout fits without overflow at both viewports
  - the dark theme
- **Layouts:** `tools/check-layouts.mjs` covers the two new layouts (validity and 100 solvable deals each).
- **file://:** a scripted check loads `index.html` from `file://` and confirms 3D renders with painted faces and no console errors.
- **Review:** every milestone's screenshots are inspected (sheets plus full-size details), and the adversarial reviewer is re-run against the benchmarks.
