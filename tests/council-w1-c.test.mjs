// Council wave 1, batch C: screens, layout and words (S1-23, S2-06, S3-10, S4-06)
const URL = 'index.html?gl=0';

export const tests = [
  {
    name: 'S1-23: a new game starts unzoomed and unpanned, and a tap on a tile still selects it',
    url: URL,
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 41 }); await t.waitIdle(15000);
      await t.page.click('#t-zoom');
      t.equal((await t.state()).zoom, true, 'zoom is on');
      await t.game('newGame', { layout: 'tower', seed: 42 }); await t.waitIdle(15000);
      let s = await t.state();
      t.equal(s.zoom, false, 'the next game is not zoomed');
      t.equal(await t.page.getAttribute('#t-zoom', 'aria-pressed'), 'false', 'the Zoom button shows it is off');
      const f = s.tiles.find((x) => x.free), c = await t.game('act', 'tileCenter', f.i);
      await t.page.mouse.click(c.x, c.y);
      t.equal((await t.state()).selected, f.i, 'a tap on a free tile selects it');
    },
  },
  {
    name: 'S2-06: the status strip shows long system messages in full and the dead-board line is short',
    viewports: ['mobile'],
    url: URL,
    async run(t) {
      const clipped = () => t.page.evaluate(() => { const e = document.getElementById('status-text'); return { clip: e.scrollHeight > e.clientHeight + 1, lines: Math.round(e.clientHeight / parseFloat(getComputedStyle(e).lineHeight)) }; });
      for (const date of ['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05', '2026-04-06', '2026-04-07']) {
        await t.game('newGame', { daily: true, date }); await t.game('act', 'solveTo', 0); await t.waitIdle(15000);
        await t.game('newGame', { daily: true, date });
        const s = await t.state();
        t.expect(s.practice, 'a finished daily is practice');
        t.expect(s.status.startsWith('Practice: already finished today.'), 'practice notice is short: ' + s.status);
        const c = await clipped();
        t.expect(!c.clip, `${date} ${s.layoutId}: practice message is not clipped (${c.lines} lines): ${s.status}`);
      }
      await t.game('newGame', { layout: 'pyramid', seed: 5 }); await t.waitIdle(15000);
      await t.game('act', 'deadBoard');
      const s = await t.state();
      t.expect(/^This board can no longer be cleared\. Undo (one move|up to \d+ moves)\.$|^This board can no longer be cleared\. Undo a few moves\.$/.test(s.status), 'dead-board message: ' + s.status);
      t.expect(!(await clipped()).clip, 'dead-board message is not clipped');
    },
  },
  {
    name: 'S3-10: a hint chosen without a known plan says it is a best guess',
    viewports: ['desktop'],
    url: URL,
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 11 }); await t.waitIdle(15000);
      let s = await t.page.evaluate(() => { const real = ENGINE.solveInfo; ENGINE.solveInfo = () => ({ plan: null, exhausted: false }); const g = window.__game; g.act('noPlan'); g.act('hint'); ENGINE.solveInfo = real; return g.getState(); });
      t.expect(/^Hint \(best guess\)/.test(s.status), 'fallback hint is labelled: ' + s.status);
      t.expect(!/keeps|winnable/.test(s.status), 'and makes no promise');
      await t.game('newGame', { layout: 'pyramid', seed: 12 }); await t.waitIdle(15000);
      s = await t.state();
      await t.game('act', 'hint'); s = await t.state();
      t.expect(/^Hint: match/.test(s.status), 'a hint from the known plan is not labelled a guess: ' + s.status);
    },
  },
];
