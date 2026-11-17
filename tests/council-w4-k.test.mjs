// Council wave 4b, batch A: clean-up (K-04 and K-06 as they land).
const FLAT = 'index.html?gl=0';
const freePair = (s) => { const f = s.tiles.filter((x) => x.present && x.free); for (let a = 0; a < f.length; a++) for (let b = a + 1; b < f.length; b++) if (f[a].key === f[b].key) return [f[a].i, f[b].i]; return null; };

export const tests = [
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
];
