# Bathhouse Mahjong: town content

Everything Hot Springs-specific that appears in the game, with the corpus file it comes from.
All facts are copied from `research/` (which carries the original web sources). No new research was
done. Hex colors are the corpus estimates from `shared/design/tokens.css` and
`research/visual-style-guide.md`; none is an official or measured color.

Short keys used below:
- **VSG** = `research/visual-style-guide.md`
- **BRS** = `research/bathhouse-row-and-springs.md`
- **GLM** = `research/geography-lakes-mountains.md`
- **FW** = `research/fish-and-wildlife.md`
- **CEF** = `research/culture-events-food.md`
- **DL** = `research/downtown-and-landmarks.md`
- **TB** = `research/trivia-bank.json`

## 1. Tile set (144 tiles)

The structure is the traditional public-domain mahjong set: three numbered suits 1–9 ×4, four winds ×4,
three dragons ×4, four flowers ×1 and four seasons ×1. Only the art and names are re-themed.

### Suit A: Springs (1–9, "dots")
Each tile shows *n* steam-spring pools in the traditional dot arrangement: a concentric pool with
tufa-gray rim, blue-green algae ring and white steam wisps (VSG Icon 1 "Steam spring"; Motif 7 "Steam curls").
Colors: pool `#1F5F6B`, algae `#2A9D8F`, emerald `#2F8F5B`, tufa `#9A968C`/rim `#C8C3B6` (VSG P2).
Corner mark: **circle**.

| n | Tooltip fact | Source |
|---|---|---|
| 1 | The springs average about 143°F. | GLM → Temperature (NPS Display Spring) |
| 2 | The Display Spring behind the Maurice is one of the few open-air springs. | GLM → Named springs (NPS) |
| 3 | Most of the water fell as rain about 4,400 years ago. | GLM → Age of the water (USGS PP 1044-C) |
| 4 | Dunbar and Hunter (1804–05) counted four principal springs and two lesser ones. | GLM → Count (EOA Hunter-Dunbar) |
| 5 | The springs flow over 700,000 gallons a day (NPS figure; other sources say more). | GLM → Flow rate (conflict kept as hedge) |
| 6 | By 1901 all the springs were walled and covered. | GLM → Count (NPS History & Culture) |
| 7 | Tufa forms when thermal water evaporates and leaves carbonate behind. | GLM → Tufa, algae and steam (NPS tufa) |
| 8 | A blue-green alga, *Phormidium treleasei*, grows where spring water meets light and air. | GLM → Tufa, algae and steam (EoA) |
| 9 | The park is centered on 47 thermal springs (one source says 43 still flow). | GLM → Count (conflict kept as hedge) |

### Suit B: Bathhouses (1–9, "characters")
The eight bathhouses of Bathhouse Row plus the 1936 Administration Building, numbered **north to south**
(Superior is northernmost, Lamar southernmost; the Administration Building sits at the Reserve Street
end) (VSG → Skyline recipe and row order; GLM → Named springs puts the Admin Building jug fountain on
Reserve St.). Each facade follows the VSG drawing recipe. Corner mark: **square**.
Colors: cream brick `#E6D7B5`, stucco `#F3EFE6`, red tile `#A9432C`/shadow `#7E2F1F`, Maurice green `#4E7D5B`,
copper `#B87333`, brass `#C9A23F`, iron `#1F2A24` (VSG building hexes).

| n | Building | Art (VSG recipe) | Tooltip fact | Source |
|---|---|---|---|---|
| 1 | Superior (1916) | Flat parapet, brick pilasters, green paterae frieze | Northernmost on the Row; today a brewery that brews with thermal water. | VSG → Superior |
| 2 | Hale (1892) | Big red hip roof, double-curved parapet, bell gable | The oldest surviving bathhouse (NPS lists 1892). | VSG → Hale |
| 3 | Maurice (1912) | White stucco, green tile cap, colored tile insets, arched sun-parlor windows | Visible roof sections are covered in green tile. | VSG → Maurice |
| 4 | Fordyce (1915) | Cream body, lozenge brick upper stories, low red hip roof, arched marquee | Cost $212,749.55 with fixtures; now the park visitor center. | VSG → Fordyce |
| 5 | Quapaw (1922) | Chevron-mosaic half dome, copper cupola, finials | Its chevron-tiled dome is the tallest on the Row. | VSG → Quapaw |
| 6 | Ozark (1922) | Low block between twin three-tiered towers with red caps | Twin towers with three-tiered setbacks flank the entrance. | VSG → Ozark |
| 7 | Buckstaff (1912) | Cream block, six engaged columns (seven bays), paterae row | Seven bays of engaged columns; still operating as a bathhouse. | VSG → Buckstaff |
| 8 | Lamar (1923) | Plain two-story stucco box with tile-capped parapet | Southernmost; its 1923 completion finished the Row. | VSG → Lamar; BRS row table |
| 9 | Administration Building (1936) | Red hip roof, broken arched pediment, iron balcony, fountain basin | It faces the street because its predecessor kept being mistaken for a bathhouse. | VSG → NPS Administration Building |

The Quapaw's entrance cartouche is **not** drawn (sensitivity note in VSG → Icon catalog).
No bathhouse street numbers are printed (game-hooks §2 gaps).

### Suit C: Lakes & Fish (1–9, "bamboo")
Each tile shows *n* fish (a generic largemouth-bass silhouette, VSG Icon 37, olive `#4F6B35`, belly `#E6DDB0`)
over lake-blue water bands (`#1E4E79`, lake-life palette, VSG P8). Corner mark: **diamond**.

| n | Tooltip fact | Source |
|---|---|---|
| 1 | Lake Ouachita has about 200 islands. | GLM → Lake Ouachita |
| 2 | Lake Hamilton (7,200 acres) formed in 1932 behind Carpenter Dam. | GLM → Lakes master table |
| 3 | Lake Catherine's Remmel Dam was built in 1924. | GLM → Lakes master table |
| 4 | Bald eagles winter at DeGray Lake. | GLM → DeGray Lake |
| 5 | The three Ouachita River lakes form a chain: Ouachita, Hamilton, Catherine. | GLM → Lakes master table |
| 6 | Striped bass are stocked in Lake Ouachita every year. | FW → Species table (USACE minutes 2021) |
| 7 | Rainbow trout are stocked below Carpenter Dam, about November to March. | FW → Species table |
| 8 | Hot Springs Creek runs under Bathhouse Row and empties into Lake Hamilton. | GLM → Hot Springs Creek |
| 9 | Blakely Mountain Dam (built 1948–1953) created Lake Ouachita. | GLM → Lakes master table |

### Winds: the four mountains
Ridge silhouettes with novaculite-white ridgelines on pine-green slopes (VSG per-game hooks; Icon 25;
P1 `ouachita-forest`: `#1F3324`, `#2F4A2C`, `#5C7A3A`, novaculite `#EDEAE2`). **No elevations are printed**
(game-hooks §2 gap). Index letters H / N / W / S. Corner mark: **triangle**.

| Tile | Tooltip fact | Source |
|---|---|---|
| H, Hot Springs Mountain | The springs emerge at its base; the 216-ft tower on top opened June 3, 1983. | GLM → Count; Mountains and terrain |
| N, North Mountain | Home of the Goat Rock overlook trail. | GLM → Trails |
| W, West Mountain | Music Mountain, the park's highest point, is in the West Mountain section. | GLM → Mountains (NPS 1,405 ft vs 1,418 ft conflict, so no number shown) |
| S, Sugarloaf Mountain | Holds about 90 acres of old-growth forest. | FW → Plants and forests |

### Dragons
Corner mark: **hexagon**. Index letters R / G and a hollow frame for White (the traditional blank dragon).

| Tile | Art | Tooltip fact | Source |
|---|---|---|---|
| Red Tile | Spanish barrel-tile roof strip, `#A9432C` / `#7E2F1F` (Motif 10) | Red clay tile roofs top most of Bathhouse Row. | VSG → Row-wide facts |
| Green Tile | Maurice green tile `#4E7D5B` with a colored inset square | The Maurice's visible roof sections are green tile. | VSG → Maurice |
| White Stone | Novaculite whetstone `#EDEAE2`, rose `#C99A92` (Icon 24) | Novaculite forms the ridges on both sides of the valley and was sold as "Arkansas" and "Washita" whetstones. | GLM → Recharge, faults and geology; VSG Icon 24 |

### Flowers (any flower matches any flower)
Corner mark: **flower**. Index 1–4.

| # | Tile | Tooltip | Source |
|---|---|---|---|
| 1 | Magnolia | The Magnolia Promenade was laid out in the 1890s with double rows of magnolias. | FW → Plants and forests; VSG → Landscape |
| 2 | Dogwood | Two North Mountain trails are named Upper and Lower Dogwood. | GLM → Trails |
| 3 | Redbud | A spring bloom of the Ouachitas (art only; no sourced fact). Redbud pink `#B5568F`. | VSG P8 |
| 4 | Sweetgum | Fall color in the hills (art only; no sourced fact). Sweetgum orange `#C8501F`. | VSG P8 |

The research notes call redbud, dogwood and sweetgum colors and timing unsourced visual notes, so those
tiles make no claims beyond names and the Dogwood trail names.

### Seasons (any season matches any season)
Corner mark: **four-point star**. Index 1–4.

| # | Tile | Tooltip | Source |
|---|---|---|---|
| 1 | Spring | Garvan Woodland Gardens shows 150,000+ Dutch tulips (2017 figure). | CEF → Events calendar |
| 2 | Summer | Lake days on Lake Hamilton, 7,200 acres. | GLM → Lakes master table |
| 3 | Autumn | Oak and hickory cover the park's northern slopes, pine the southern. | FW → Plants and forests |
| 4 | Winter | Garvan Holiday Lights: about 4 million bulbs in 2014, later 4.5–5 million. | CEF → Events calendar |

## 2. Layouts

| Layout | Silhouette | On-screen caption | Source |
|---|---|---|---|
| Classic Pyramid | A stepped four-level pyramid (the traditional style, original coordinates) | "The traditional stepped pyramid." | none (game form) |
| Mountain Tower | A wide mountain with a lattice tower and observation deck rising from it | "Hot Springs Mountain Tower: 216 ft of lattice steel, opened June 3, 1983." | GLM → Mountains and terrain |
| Arlington Towers | A wide symmetrical block with two tall towers and an arched entry | "The Arlington (1924): Spanish Colonial Revival twin towers, 484 rooms, closing the Central Avenue vista." | VSG → Arlington Hotel |
| Bathhouse Row | Eight facades in a line on the promenade: flat, hip roof, cap, wide, dome, twin towers, colonnade, flat | "Eight bathhouses, Superior to Lamar; the Row was completed in 1923." | VSG → Skyline recipe; BRS |
| Ouachita Islands | Scattered islands of different sizes | "Lake Ouachita has about 200 islands." | GLM → Lake Ouachita |

The well-known layouts of commercial mahjong-solitaire games are not reproduced; all coordinates are original.

## 3. Event moments
- **Bathhouse Row complete:** when all 36 Bathhouse-suit tiles are cleared, a toast reads
  "Bathhouse Row complete! The Lamar finished the Row in 1923." (BRS row table; game-hooks §2 idea 10.)
- **Match effect:** matched pairs release steam puffs. The nickname "Valley of Vapors" comes from the
  steam rising off the springs (GLM → Tufa, algae and steam). The title screen subtitle uses it.
- **Win fact:** a random "Did you know?" from `trivia-bank.json`, categories *Places & Landmarks* and
  *Nature & Lakes*, `confidence: "confirmed"`, with items on sensitive topics filtered out.
  The question, answer, explanation and source name are shown.

## 4. Palettes used

| Use | Palette (tokens) |
|---|---|
| Light theme UI | default light theme `--color-*` (gilded-spa based) |
| Light table | thermal-water pool `#1F5F6B` → `#174A54` with a faint tufa texture |
| Dark theme UI and table | deco-neon midnight `#14121F`, surface `#1F1C2E`, gold `#D4AF37`, neon blue `#4FC3FF` |
| Tile face | marble `#F2EFE8` with faint gray vein curves; edge band of cream body and red-tile scallops |
| Tile back (shuffle animation, title) | Quapaw-style chevron mosaic in cobalt `#2B4C9B`, gold `#D9A23A`, terra cotta `#C46A3E`, green `#4E7D5B`, cream `#E6D7B5`. The real dome colors are unknown (VSG) and this is labeled "inspired by" in the help screen |

## 5. Things deliberately left out
- No logos or brand marks (no NPS arrowhead, no hotel or brewery marks); the Arlington and Superior appear as architecture only.
- No people's names or likenesses.
- No summit elevations, no bathhouse street numbers (unsourced or conflicting).
- The DeSoto helmet and the "lost landmarks" bonus round from game-hooks are out of scope for v1.
