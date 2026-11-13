// Council wave 1, batch B: input, rules and play (S1-01 ...)
export const tests = [
  {
    name: 'S1-01: a tap made during the deal-in or shuffle flip is applied when it ends',
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 8 });
      let s = await t.state(); const f = s.tiles.find((x) => x.free);
      let c = await t.game('act', 'tileCenter', f.i);
      await t.waitFrames(2); await t.game('act', 'animAt', 300, 'deal'); // hold the clock mid-deal
      await t.page.mouse.click(c.x, c.y);
      t.equal((await t.state()).selected, -1, 'nothing is selected while the deal is running');
      await t.game('act', 'animAt', null);
      await t.waitIdle(15000); await t.waitFrames(3);
      t.equal((await t.state()).selected, f.i, 'the early tap selects once the deal is done');
      await t.page.mouse.click(c.x, c.y);
      // same for the shuffle flip
      await t.game('act', 'shuffle'); await t.game('act', 'animAt', 200, 'shuffle');
      s = await t.state(); const g = s.tiles.find((x) => x.free); c = await t.game('act', 'tileCenter', g.i);
      await t.page.mouse.click(c.x, c.y);
      t.equal((await t.state()).selected, -1, 'nothing is selected during the shuffle flip');
      await t.game('act', 'animAt', null);
      await t.waitIdle(15000); await t.waitFrames(3);
      t.equal((await t.state()).selected, g.i, 'the early tap selects once the shuffle is done');
    },
  },
  {
    name: 'S1-07: hovering does not erase the match result or the hint text for a couple of seconds',
    viewports: ['desktop'],
    url: 'index.html?gl=0',
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const hint = await t.game('act', 'hint');
      let s = await t.state();
      t.expect(/^Hint/.test(s.status), 'the hint is shown: ' + s.status);
      const other = s.tiles.find((x) => x.free && !hint.includes(x.i));
      const c = await t.game('act', 'tileCenter', other.i);
      await t.page.mouse.move(c.x - 30, c.y - 30); await t.page.mouse.move(c.x, c.y, { steps: 3 });
      t.equal((await t.state()).status, s.status, 'hovering a tile leaves the hint text alone');
      await t.game('act', 'match', hint[0], hint[1]);
      s = await t.state();
      t.expect(/^Matched/.test(s.status), 'the match result is shown: ' + s.status);
      const free = s.tiles.filter((x) => x.free);
      const o2 = free[free.length - 1], c2 = await t.game('act', 'tileCenter', o2.i);
      await t.page.mouse.move(c2.x - 40, c2.y - 40); await t.page.mouse.move(c2.x, c2.y, { steps: 3 });
      t.equal((await t.state()).status, s.status, 'hovering a tile leaves the match result alone');
      await t.page.waitForTimeout(2800);
      await t.page.mouse.move(c2.x - 40, c2.y - 40); await t.page.mouse.move(c2.x, c2.y, { steps: 3 });
      t.expect(!/^Matched/.test((await t.state()).status), 'after the hold, hover shows tile facts again');
    },
  },
];
