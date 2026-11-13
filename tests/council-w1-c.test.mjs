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
];
