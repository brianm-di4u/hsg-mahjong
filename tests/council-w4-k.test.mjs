// Council wave 4b, batch A: clean-up (K-04 and K-06 as they land).
const FLAT = 'index.html?gl=0';
const freePair = (s) => { const f = s.tiles.filter((x) => x.present && x.free); for (let a = 0; a < f.length; a++) for (let b = a + 1; b < f.length; b++) if (f[a].key === f[b].key) return [f[a].i, f[b].i]; return null; };

const factsOf = (t) => t.page.evaluate(() => JSON.parse(document.getElementById('facts').textContent));
// The 32 explanations the owner approved as written (decisions 57 and 83): each one now names its subject. Copied from the review table.
const APPROVED_E = {
  "hs-0063": "The Crystal Bathhouse stood at 415 Malvern Ave. and burned in the 1913 fire.",
  "hs-0072": "The Eastman Hotel was popular with baseball teams and taken over by the military in 1942.",
  "hs-0073": "The Ohio Club ran as a speakeasy in Prohibition and as a casino until 1967.",
  "hs-0078": "The Quapaw Bathhouse was to be the Platt Bathhouse until the finds and a tufa cave inspired the new name.",
  "hs-0082": "The Quapaw's chevron-mosaic dome is topped by a small copper cupola.",
  "hs-0083": "The Quapaw Bathhouse was renamed after a tufa cave and Native artifacts were found.",
  "hs-0087": "The NPS Administration Building faces the street because its predecessor kept being mistaken for a bathhouse.",
  "hs-0095": "Hot Springs Village opened June 1, 1970, on about 20,000 acres bought from Dierks Forests.",
  "hs-0096": "The Fordyce Bathhouse reopened May 13, 1989, after closing in 1962.",
  "hs-0098": "Bathhouse Row was listed on the National Register in 1974 and became an NHL district May 28, 1987.",
  "hs-0100": "Bathhouse Row became a National Historic Landmark District in 1987.",
  "hs-0104": "The Ozark Bathhouse reopened in 2014 as a cultural center showing artist-in-residence work.",
  "hs-0111": "The Arlington Hotel stands at the \"Y\" of Central Avenue and Fountain Street.",
  "hs-0112": "The three Arlington Hotels date from 1875, 1892–93 and 1924.",
  "hs-0113": "The Dunbar–Hunter expedition counted four principal springs and two lesser ones.",
  "hs-0115": "The Dunbar–Hunter party camped at Calfait (Gulpha) Creek, at Ellis Landing, on Dec. 7, 1804.",
  "hs-0117": "Hot Springs Creek was enclosed in an underground arch in 1882–83.",
  "hs-0118": "The Arkansas National Forest was renamed on April 29, 1926.",
  "hs-0120": "Display Spring had been covered by a grate for decades.",
  "hs-0124": "Remmel Dam was built in 1924 by Ford, Bacon & Davis with Ambursen Construction.",
  "hs-0132": "DeGray Lake's average depth is about 47 ft.",
  "hs-0137": "The state-record striped bass was caught in the Beaver Lake tailwater in 2000; Lake Ouachita stripers chase it.",
  "hs-0153": "Hot Springs' rainwater heats through the geothermal gradient roughly a mile down.",
  "hs-0163": "The Grand Promenade is a National Recreation Trail and the entry point from downtown.",
  "hs-0166": "The Gulpha Gorge Trail links the campground to the park's trail network.",
  "hs-0168": "The Ouachita Mountains run east–west; most U.S. ranges trend north–south.",
  "hs-0170": "The maple-leaf oak is one of several Ouachita endemic plants.",
  "hs-0172": "The Ouachita National Recreation Trail crosses the Ouachita National Forest, headquartered in Hot Springs.",
  "hs-0177": "Hot Springs' record high of 115°F was reached in 1936 and again in 1986.",
  "hs-0178": "Most of Hot Springs' snow falls in January and February.",
  "hs-0179": "The Ouachita River rises in Polk County and joins the Tensas in Louisiana.",
  "hs-0180": "Magnet Cove's minerals include magnetite, rutile and perovskite."
};

export const tests = [
  // ------------------------------------------------------------------ K-01
  {
    name: 'K-01: thirty-two win-card facts name their subject, word for word, and nothing else about the 146 records changed',
    url: FLAT, viewports: ['desktop'],
    async run(t) {
      const f = await factsOf(t), by = Object.fromEntries(f.map((x) => [x.id, x]));
      t.equal(f.length, 146, 'still 146 records');
      t.equal(Object.keys(APPROVED_E).length, 32, 'thirty-two approved explanations');
      t.equal(Object.keys(APPROVED_E).filter((id) => !by[id] || by[id].e !== APPROVED_E[id]), [], 'each is in the game character for character');
      t.equal(f.filter((x) => /^(It|He|She|They|Its|Their|His)/.test(x.e)).map((x) => x.id), [], 'and no explanation opens with a pronoun that names nothing');
      t.expect(by['hs-0102'].e.includes('in 2013'), 'the brewery still says 2013');
    },
  },
  // ------------------------------------------------------------------ K-06
  {
    name: 'K-06: on a phone the status strip keeps one height whether a line takes one row or two, with or without the turn-your-phone chip',
    url: FLAT, viewports: ['mobile'],
    async run(t) {
      const read = () => t.page.evaluate(() => { const e = document.getElementById('status-text'); return { strip: Math.round(document.getElementById('status').getBoundingClientRect().height * 10) / 10, rows: Math.round(e.getBoundingClientRect().height / (parseFloat(getComputedStyle(e).lineHeight) || 18)), text: e.textContent }; });
      for (const w of [390, 360, 320]) {
        await t.page.setViewportSize({ width: w, height: 844 });
        await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
        for (const chip of [true, false]) {
          await t.page.evaluate((c) => { document.getElementById('rot-chip').hidden = !c; }, chip);
          const heights = [], rows = [];
          const take = async () => { const r = await read(); heights.push(r.strip); rows.push(r.rows); };
          await take();
          let s = await t.state();
          const blocked = s.tiles.find((x) => x.present && !x.free), pair = freePair(s);
          await t.game('act', 'click', blocked.i); await take();                       // a Blocked line
          await t.game('act', 'click', pair[0]); await t.game('act', 'click', pair[1]); // a Matched line
          await take();
          await t.page.keyboard.press('u'); await take();                              // the first-undo note
          s = await t.state();
          const other = s.tiles.find((x) => x.present && x.free && x.i !== pair[0]);
          await t.game('act', 'click', other.i); await take();                         // a tile's story
          await t.page.evaluate(() => { document.getElementById('status-text').textContent = 'A line long enough to need a second row on a phone, so hold it.'; });
          await take();
          const kept = heights.filter((h, k) => rows[k] <= 2); // a story of three rows (a few of the 42, on the narrowest phones) is clamped at three and is not reserved
          t.expect(Math.max(...kept) === Math.min(...kept), 'at ' + w + ' px (chip ' + chip + ') the strip is one height for every line: ' + JSON.stringify(heights) + ' for rows ' + JSON.stringify(rows));
          t.expect(rows.includes(2), 'and a line really took two rows (' + JSON.stringify(rows) + ')');
          if (chip) await t.shot('K-06-strip-' + w);
        }
      }
    },
  },
  // ------------------------------------------------------------------ K-04
  {
    name: 'K-04: the streak cue at its default volume peaks inside 0.2 to 0.45 on every seed and every day of a streak, not only at the median',
    url: FLAT, viewports: ['desktop'],
    async run(t) {
      // Measured over seeds 101 to 200 at streak days 2 to 6 before this change: max 0.480 (TRIM 3.0); after: max 0.418 (TRIM 2.6). The rendering is seeded, so the same seeds give the same peaks every run.
      const peaks = [];
      for (const n of [2, 3, 4, 5, 6]) for (let seed = 101; seed <= 140; seed++) peaks.push((await t.game('audioRender', 'cue:streak:' + n, 3, false, seed)).peak);
      t.expect(Math.max(...peaks) <= 0.45, 'the loudest of ' + peaks.length + ' renders is under 0.45: ' + Math.max(...peaks).toFixed(3));
      t.expect(Math.min(...peaks) >= 0.2, 'and the quietest is over 0.2: ' + Math.min(...peaks).toFixed(3));
    },
  },
];
