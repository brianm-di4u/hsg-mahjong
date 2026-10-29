// Free-tile highlight, dark theme, reduced motion, sound settings (PRD AC22, AC26-AC28).
export const tests = [
  {
    name: 'free-tile highlight toggle',
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 77 });
      t.equal((await t.state()).settings.highlightFree, true, 'highlight on by default');
      const on = await t.shot('05-highlight-on');
      await t.page.click('#t-free');
      t.equal((await t.state()).settings.highlightFree, false, 'toolbar toggles it off');
      t.equal(await t.page.getAttribute('#t-free', 'aria-pressed'), 'false', 'toggle state exposed');
      const off = await t.shot('05-highlight-off');
      t.expect(off.stats.mean > on.stats.mean + 2, `blocked tiles are dimmed only when on (mean ${on.stats.mean} vs ${off.stats.mean})`);
      await t.game('act', 'key', 'f');
      t.equal((await t.state()).settings.highlightFree, true, 'F key toggles it back');
    },
  },
  {
    name: 'dark theme from the color scheme',
    colorScheme: 'dark',
    async run(t) {
      t.equal((await t.state()).theme, 'dark', 'auto theme follows prefers-color-scheme: dark');
      await t.shot('05-dark-title');
      await t.game('newGame', { layout: 'arlington', seed: 3 });
      const pr = await t.game('act', 'hint');
      await t.game('act', 'click', pr[0]);
      await t.shot('05-dark-game');
      await t.game('scene', 'help');
      await t.shot('05-dark-help');
      const bad = (await t.game('act', 'contrast')).filter((c) => c.ratio < 4.5);
      t.equal(bad, [], 'dark theme text contrast >= 4.5');
    },
  },
  {
    name: 'manual theme switch',
    viewports: ['desktop'],
    async run(t) {
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"] [data-v="dark"]');
      t.equal((await t.state()).theme, 'dark', 'Neon Night selected');
      await t.page.click('[data-set="theme"] [data-v="light"]');
      t.equal((await t.state()).theme, 'light', 'Light selected');
    },
  },
  {
    name: 'reduced motion uses short fades',
    reducedMotion: true,
    async run(t) {
      await t.game('newGame', { layout: 'tower', seed: 8 });
      t.equal((await t.state()).reduced, true, 'reduced motion detected');
      const pr = await t.game('act', 'hint');
      const t0 = Date.now();
      await t.game('act', 'match', pr[0], pr[1]);
      await t.waitForStable();
      const ms = Date.now() - t0;
      t.expect(ms < 600, 'match settles quickly with reduced motion (' + ms + ' ms)');
      await t.shot('05-reduced');
    },
  },
  {
    name: 'sound settings',
    viewports: ['desktop'],
    async run(t) {
      const before = await t.page.evaluate(() => window.__game.getState().settings.sound);
      t.equal(before, true, 'sound on by default');
      await t.game('scene', 'settings');
      await t.page.click('#se-sound');
      t.equal((await t.state()).settings.sound, false, 'sound off');
      await t.page.fill('#se-vol', '30');
      t.equal((await t.state()).settings.volume, 30, 'volume saved');
      await t.page.click('#se-sound');
      t.equal((await t.state()).settings.sound, true, 'sound on');
      const saved = await t.page.evaluate(() => JSON.parse(localStorage.getItem('bhm.settings.v1')));
      t.equal(saved.volume, 30, 'settings persisted');
    },
  },
];
