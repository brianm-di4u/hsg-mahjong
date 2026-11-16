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
  // ------------------------------------------------------------------ S5-06
  {
    name: 'S5-06: a speaker button beside Pause mutes all sound in play and brings it back, kept in the Sound setting',
    url: FLAT,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const mute = t.page.locator('#b-mute'), box = await mute.boundingBox(), pause = await t.page.locator('#b-pause').boundingBox();
      t.expect(box.width >= 44 && box.height >= 44, 'it is a full-size touch target: ' + box.width + ' x ' + box.height);
      t.expect(box.x + box.width <= pause.x + 1 && pause.x - (box.x + box.width) < 16 && Math.abs(box.y - pause.y) < 4, 'it sits right beside Pause');
      t.expect(box.x >= 0 && pause.x + pause.width <= t.vp.width, 'nothing in the top bar is pushed off the screen');
      t.equal(await mute.getAttribute('aria-pressed'), 'false', 'with sound on it is not pressed');
      t.equal(await mute.getAttribute('aria-label'), 'Mute sound', 'and offers to mute');
      await t.shot('S5-06-hud-sound-on');
      await mute.click();
      t.equal((await t.state()).settings.sound, false, 'one press turns Sound off');
      t.equal(await mute.getAttribute('aria-pressed'), 'true', 'it shows pressed');
      t.equal(await mute.getAttribute('aria-label'), 'Unmute sound', 'and offers to unmute');
      t.equal(await t.page.evaluate(() => JSON.parse(localStorage.getItem('bhm.settings.v1')).sound), false, 'the choice is saved');
      const before = (await t.game('audioState')).cues;
      const f = (await t.state()).tiles.find((x) => x.present && x.free);
      await t.game('act', 'click', f.i); await t.game('act', 'click', f.i);
      t.equal(JSON.stringify((await t.game('audioState')).cues), JSON.stringify(before), 'and playing makes no sound');
      await t.shot('S5-06-hud-muted');
      await mute.focus(); await t.page.keyboard.press('Enter'); // a real button: Enter works from the keyboard
      t.equal((await t.state()).settings.sound, true, 'Enter on it turns Sound back on');
      t.equal(await mute.getAttribute('aria-pressed'), 'false', 'and it shows not pressed');
      await t.game('scene', 'settings');
      t.equal(await t.page.locator('#se-sound').getAttribute('aria-pressed'), 'true', 'the Sound switch in Settings agrees');
    },
  },
  {
    name: 'S5-06: a profile saved with Sound off opens with the speaker button already showing it',
    url: FLAT,
    viewports: ['desktop'],
    initScript: () => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('bhm.settings.v1', JSON.stringify({ sound: false })); } },
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      t.equal(await t.page.locator('#b-mute').getAttribute('aria-pressed'), 'true', 'muted from the first frame');
      t.equal(await t.page.locator('#b-mute').getAttribute('aria-label'), 'Unmute sound', 'and says what a press does');
    },
  },
  {
    name: 'S5-06: the top bar holds the speaker button at 320, 360 and 390 px without overlap or overflow',
    url: FLAT,
    viewports: ['mobile'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      for (const w of [320, 360, 390]) {
        await t.page.setViewportSize({ width: w, height: 844 });
        await t.page.waitForFunction((w) => window.innerWidth === w, w);
        const r = await t.page.evaluate(() => {
          const hud = document.querySelector('.hud'), kids = ['#b-menu', '.hud .name', '.hud .stats', '#b-mute', '#b-pause'].map((s) => document.querySelector(s).getBoundingClientRect());
          let overlap = false; for (let i = 0; i < kids.length - 1; i++) if (kids[i].right > kids[i + 1].left + 0.5) overlap = true;
          const pills = [...document.querySelectorAll('.stats > div')].map((d) => d.getBoundingClientRect()); for (let i = 0; i < pills.length - 1; i++) if (pills[i].right > pills[i + 1].left + 0.5) overlap = true;
          const over = [...hud.querySelectorAll('*')].some((e) => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 0.5 || b.left < -0.5); });
          const mute = kids[3];
          return { overlap, over, muteW: mute.width, nameW: kids[1].width, scroll: document.documentElement.scrollWidth };
        });
        t.expect(!r.overlap && !r.over && r.scroll <= w, w + ' px: nothing overlaps or runs off (' + JSON.stringify(r) + ')');
        t.expect(r.muteW >= 44, w + ' px: the speaker button stays 44 px wide');
      }
      await t.page.setViewportSize({ width: 390, height: 844 });
    },
  },
];
