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
];
