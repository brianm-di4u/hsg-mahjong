// Council wave 1, batch A: stability, saves and lifecycle (S2-02 ...)
const URL = 'index.html?gl=0';
const stored = (t, k) => t.page.evaluate((k) => { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }, k);

export const tests = [
  {
    name: 'S2-02: layout cards and Daily ask before abandoning a game in progress',
    url: URL,
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 301 }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 136);
      const a = await t.state();
      t.equal(a.tilesLeft, 136, 'two pairs matched');
      // layout card
      await t.game('scene', 'layouts');
      await t.page.click('#cards .card[data-layout="tower"]');
      let s = await t.state();
      t.equal(s.overlay, 'o-confirm', 'the confirm dialog opens');
      t.equal([s.layoutId, s.tilesLeft], ['pyramid', 136], 'the game in progress is untouched while asking');
      await t.page.click('#oc-keep');
      s = await t.state();
      t.equal([s.overlay, s.layoutId, s.tilesLeft], [null, 'pyramid', 136], 'Keep playing leaves the game alone');
      // Daily
      await t.game('scene', 'title');
      await t.page.click('#b-daily');
      s = await t.state();
      t.equal([s.overlay, s.daily, s.tilesLeft], ['o-confirm', null, 136], 'Daily asks first too');
      await t.page.click('#oc-keep');
      // confirming starts the card the player picked, not the old layout
      await t.game('scene', 'layouts');
      await t.page.click('#cards .card[data-layout="tower"]');
      await t.page.click('#oc-new');
      s = await t.state();
      t.equal([s.scene, s.layoutId, s.tilesLeft], ['game', 'tower', 144], 'Start the new game opens the chosen layout');
      // with no match made there is nothing to lose: no dialog
      await t.game('scene', 'layouts');
      await t.page.click('#cards .card[data-layout="islands"]');
      s = await t.state();
      t.equal([s.scene, s.overlay, s.layoutId], ['game', null, 'islands'], 'no dialog when no match has been made');
    },
  },
  {
    name: 'S2-02: a saved game is protected after a reload',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 302 }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 136);
      await t.game('act', 'hint'); // saves the game
      await t.page.evaluate(() => { document.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true); });
      t.expect((await stored(t, 'bhm.game.v1')) !== null, 'a save exists');
      await t.reload();
      t.expect(await t.page.evaluate(() => !document.getElementById('b-continue').hidden), 'Continue is offered');
      await t.page.click('#b-play');
      await t.page.click('#cards .card[data-layout="tower"]');
      let s = await t.state();
      t.equal(s.overlay, 'o-confirm', 'the dialog opens over the layout picker');
      t.equal((await stored(t, 'bhm.game.v1')).layoutId, 'pyramid', 'the saved game is still there');
      await t.page.click('#oc-keep');
      await t.game('scene', 'title');
      await t.page.click('#b-daily');
      s = await t.state();
      t.equal(s.overlay, 'o-confirm', 'Daily asks too');
      t.equal((await stored(t, 'bhm.game.v1')).layoutId, 'pyramid', 'the saved game is still there after Daily');
      await t.page.click('#oc-keep');
      await t.game('scene', 'title');
      await t.page.click('#b-continue');
      s = await t.state();
      t.equal([s.layoutId, s.tilesLeft], ['pyramid', 136], 'Continue still resumes it');
    },
  },
];
