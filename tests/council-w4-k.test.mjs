// Council wave 4b, batch A: clean-up (K-01, K-02, K-04, K-06).
const FLAT = 'index.html?gl=0';
import { loadEngine } from '../tools/engine-load.mjs';
const E = loadEngine();
// The eighteen boards that shipped before K-02: a fingerprint of each one's tile positions and its measured rating, taken on council/wave-4 (the build is unchanged).
const OLD_BOARDS = {"pyramid":[30407121,37],"tower":[2846638198,29],"arlington":[3188498039,31],"row":[2324947466,19],"islands":[1012854104,69],"terraces":[2514675955,35],"display":[180268120,68],"hale":[2599074331,36],"lamar":[1346181682,36],"quapaw":[12523608,30],"lake":[220495125,50],"promenade":[670843869,27],"central":[1663590990,29],"valley":[1193547111,28],"northmtn":[3805481258,27],"westmtn":[1687109814,27],"sugarloaf":[1986492041,52],"cascade":[2615291768,71]};
const NEW_BOARDS = { rix: { name: 'Rix Tower', need: 8 }, sunset: { name: 'Sunset Trail', need: 10 } };
const put = (t, k, v) => t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [k, v]);
const reload = async (t) => { await t.page.reload(); await t.page.waitForFunction(() => !!window.__game); await t.waitIdle(15000); };
const stats = (n, won) => ({ played: won + 2, won, streak: 0, bestStreak: 0, layouts: Object.fromEntries(Object.keys(OLD_BOARDS).slice(0, n).map((id) => [id, { played: 1, won: 1, bestMs: 400000, bestScore: 900 }])), daily: { last: null, streak: 0, best: 0, done: {} } });
const cards = (t) => t.page.$$eval('#cards .card', (cs) => cs.map((c) => ({ id: c.dataset.layout, name: c.querySelector('b').textContent, locked: c.classList.contains('locked'), best: c.querySelector('.best').textContent })));
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
  // ------------------------------------------------------------------ K-02
  {
    name: 'K-02: two new boards of 144 tiles sit after the eighteen, with their own names; no earlier board changed',
    node: true,
    async run(t) {
      const L = E.LAYOUTS, ids = L.map((l) => l.id);
      t.equal(ids.slice(0, 18), Object.keys(OLD_BOARDS), 'the eighteen boards keep their places');
      t.equal(ids.slice(18), ['rix', 'sunset'], 'and the two new ones are last');
      for (const id of Object.keys(OLD_BOARDS)) { const l = L.find((x) => x.id === id); t.equal([E.hashStr(JSON.stringify(l.build())), l.measured], OLD_BOARDS[id], id + ' is exactly as it was'); }
      t.equal(new Set(L.map((l) => l.name)).size, L.length, 'every board has its own name');
      for (const [id, n] of Object.entries(NEW_BOARDS)) {
        const l = L.find((x) => x.id === id), pos = l.build(), g = E.buildGeometry(pos);
        t.equal(l.name, n.name, id + ' is called ' + n.name);
        t.equal(pos.length, 144, id + ' has 144 tiles');
        t.equal(E.validateLayout(pos), [], id + ' passes the layout check (support, overlap, even count)');
        t.expect(l.measured > 0 && l.measured < 100, id + ' has a measured rating: ' + l.measured);
        for (let seed = 1; seed <= 6; seed++) for (const shape of [-1, 0, 1]) {
          const d = E.deal(g, E.makeRng(seed * 7919), shape);
          t.expect(d && E.planValid(g, new Array(g.n).fill(true), d.faces, d.plan), id + ' seed ' + seed + ' shape ' + shape + ' deals a board that replays to empty');
        }
        for (let seed = 1; seed <= 6; seed++) { const d = E.deal(g, E.makeRng(1000 + seed)); t.expect(!!E.solve(g, new Array(g.n).fill(true), d.faces, 25000), id + ' seed ' + (1000 + seed) + " is solved by the game's own solver"); }
      }
    },
  },
  {
    name: 'K-02: the new boards are in the picker, locked until 8 and 10 different layouts are cleared, and both deal 144 tiles',
    url: FLAT, viewports: ['desktop', 'mobile'],
    async run(t) {
      await put(t, 'bhm.stats.v1', stats(7, 7));
      await reload(t); await t.game('scene', 'layouts');
      let c = await cards(t), by = Object.fromEntries(c.map((x) => [x.id, x]));
      t.equal(c.length, 20, 'twenty cards');
      const ids = c.map((x) => x.id); // a phone held upright leads with the boards that fit it, so Sunset Trail comes with those
      t.equal(t.vp.width < 700 ? ids.slice(0, 5).sort() : ids.slice(18), t.vp.width < 700 ? ['cascade', 'display', 'sugarloaf', 'sunset', 'terraces'] : ['rix', 'sunset'], t.vp.width < 700 ? 'Sunset Trail sits among the five boards that fit a phone, and Rix Tower (27 px tiles on a phone, like Mountain Tower) does not' : 'the two new ones come last');
      t.expect(Object.keys(NEW_BOARDS).every((id) => by[id] && by[id].name === NEW_BOARDS[id].name), 'each card shows its own name');
      t.expect(by.rix.locked && /Clear 8 different layouts to unlock \(7 of 8\)/.test(by.rix.best), 'Rix Tower waits for 8 cleared layouts: ' + by.rix.best);
      t.expect(by.sunset.locked && /Clear 10 different layouts to unlock \(7 of 10\)/.test(by.sunset.best), 'Sunset Trail waits for 10: ' + by.sunset.best);
      await put(t, 'bhm.stats.v1', stats(8, 8));
      await reload(t); await t.game('scene', 'layouts');
      by = Object.fromEntries((await cards(t)).map((x) => [x.id, x]));
      t.expect(!by.rix.locked && by.rix.best === '144 tiles', 'with 8 cleared Rix Tower is open: ' + by.rix.best);
      t.expect(by.sunset.locked, 'and Sunset Trail is still shut');
      await put(t, 'bhm.stats.v1', stats(10, 10));
      await reload(t); await t.game('scene', 'layouts');
      by = Object.fromEntries((await cards(t)).map((x) => [x.id, x]));
      t.expect(!by.rix.locked && !by.sunset.locked, 'with 10 cleared both are open');
      await t.page.locator('#cards .card[data-layout="sunset"]').scrollIntoViewIfNeeded();
      await t.shot('K-02-picker');
      for (const id of Object.keys(NEW_BOARDS)) {
        await t.page.click('#cards .card[data-layout="' + id + '"]'); await t.waitIdle(15000);
        const st = await t.state();
        t.equal([st.layoutId, st.total], [id, 144], id + ' starts a 144-tile board');
        await t.shot('K-02-' + id);
        await t.game('scene', 'layouts');
      }
      const kept = await t.page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('bhm.stats.v1')).layouts));
      t.equal(Object.keys(OLD_BOARDS).slice(0, 10).filter((id) => !kept.includes(id)), [], 'the save still holds its record for every board it had');
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
