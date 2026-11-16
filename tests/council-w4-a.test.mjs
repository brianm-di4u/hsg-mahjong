// Council wave 4, batch A: saves, lifecycle, robustness, controls, rules and play (C4-05, C4-07 part, and the rest as each item lands).
const FLAT = 'index.html?gl=0';
const freePair = (s) => { const f = s.tiles.filter((x) => x.present && x.free); for (let a = 0; a < f.length; a++) for (let b = a + 1; b < f.length; b++) if (f[a].key === f[b].key) return [f[a].i, f[b].i, f[a].f]; return null; };

export const tests = [
  // ------------------------------------------------------------------ C4-05
  {
    name: 'C4-05: after a match the status line stays the Matched line: no tile story or Did you know follows it',
    url: FLAT,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      // a Bathhouse pair and a pair of another kind: the old story came after either
      let bath = null, other = null;
      for (let seed = 1; seed < 40 && !(bath && other); seed++) {
        await t.game('newGame', { layout: 'pyramid', seed }); await t.waitIdle(15000);
        const f = (await t.state()).tiles.filter((x) => x.present && x.free);
        bath = null; other = null;
        for (let a = 0; a < f.length; a++) for (let b = a + 1; b < f.length; b++) if (f[a].key === f[b].key) { if (f[a].f >= 9 && f[a].f < 18) bath = bath || [f[a].i, f[b].i]; else if (f[a].f < 9) other = other || [f[a].i, f[b].i]; }
      }
      t.expect(!!(bath && other), 'found a deal with a Bathhouse pair and a Springs pair');
      // every text the status line takes is recorded; the old story came 2.5 s after the match (and the page clock is what is waited on, not this tool's)
      await t.page.evaluate(() => { window.__lines = []; new MutationObserver(() => window.__lines.push(document.getElementById('status-text').textContent)).observe(document.getElementById('status-text'), { childList: true, characterData: true, subtree: true }); window.__t0 = performance.now(); });
      await t.game('act', 'match', bath[0], bath[1]);
      await t.game('act', 'match', other[0], other[1]);
      await t.page.waitForFunction(() => performance.now() - window.__t0 > 9000, null, { timeout: 30000 }); // past the old 2.5 s + 4.5 s story window
      const lines = await t.page.evaluate(() => window.__lines);
      t.expect(lines.length >= 2 && lines.every((l) => /^Matched /.test(l)), 'the only lines were Matched lines: ' + JSON.stringify(lines));
      t.expect(!(await t.state()).status.includes('Did you know'), 'and no Did you know is on the strip');
    },
  },
  // ------------------------------------------------------------------ C4-07 (S2-11)
  {
    name: 'C4-07: on every layout each tile has its own row, column and layer in words, counted from the top left',
    url: FLAT,
    viewports: ['desktop'],
    async run(t) {
      const ids = await t.page.evaluate(() => { window.__game.scene('layouts'); return [...document.querySelectorAll('#cards .card')].map((c) => c.dataset.layout); });
      t.equal(ids.length, 18, 'the picker lists 18 layouts');
      for (const id of ids) {
        await t.game('newGame', { layout: id, seed: 3 }); await t.waitIdle(15000);
        const s = await t.state();
        const spots = [];
        for (const x of s.tiles) {
          const m = /^row (\d+), column (\d+)(?:, layer (\d+))?$/.exec(await t.game('act', 'spot', x.i));
          if (!m) { t.fail(id + ': tile ' + x.i + ' has no row and column in words'); return; }
          spots.push({ x: x.x, y: x.y, z: x.z || 0, row: +m[1], col: +m[2], layer: m[3] ? +m[3] : 1 });
        }
        t.equal(new Set(spots.map((p) => p.row + ',' + p.col + ',' + p.layer)).size, spots.length, id + ': no two tiles share a name (' + spots.length + ' tiles)');
        t.expect(spots.every((p) => p.layer === p.z + 1), id + ': the layer is the tile\'s own layer, counted from 1');
        const minRow = Math.min(...spots.map((p) => p.row)), minCol = Math.min(...spots.map((p) => p.col));
        t.expect(minRow === 1 && minCol === 1, id + ': counting starts at row 1, column 1 (' + minRow + ', ' + minCol + ')');
        // order: a tile further right is never in an earlier column, a tile further down never in an earlier row
        let ordered = true;
        for (const a of spots) for (const b of spots) { if (a.x < b.x && a.col > b.col) ordered = false; if (a.y < b.y && a.row > b.row) ordered = false; }
        t.expect(ordered, id + ': columns follow left to right and rows top to bottom');
        // compact: a tile is two units wide, so the count of columns never outruns the span in tile widths (plus one)
        const spanX = Math.max(...spots.map((p) => p.x)) - Math.min(...spots.map((p) => p.x)), spanY = Math.max(...spots.map((p) => p.y)) - Math.min(...spots.map((p) => p.y));
        t.expect(Math.max(...spots.map((p) => p.col)) <= Math.ceil(spanX / 2) + 1 && Math.max(...spots.map((p) => p.row)) <= Math.ceil(spanY / 2) + 1, id + ': rows and columns are counted in tile widths');
      }
    },
  },
];
