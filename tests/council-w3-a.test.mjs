// Council wave 3, batch A: saves and lifecycle, controls, rules and play (S1-04, S4-26, S6-05, P-N01, S4-01, S1-10, S2-09, S3-17, S1-03, S2-19).
// Tests read the game's state through window.__game; animations are held still with animAt so nothing depends on timing.
const URL = 'index.html?gl=0';
const stored = (t, k) => t.page.evaluate((k) => { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }, k);
const put = (t, k, v) => t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [k, v]);
const reload = async (t) => { await t.page.reload(); await t.page.waitForFunction(() => !!window.__game); await t.waitIdle(15000); };
// a free pair that matches (indexes into the tile list), or null
const freePair = (s) => { const f = s.tiles.filter((x) => x.present && x.free); for (let a = 0; a < f.length; a++) for (let b = a + 1; b < f.length; b++) if (f[a].key === f[b].key) return [f[a].i, f[b].i]; return null; };
const blockedTile = (s) => s.tiles.find((x) => x.present && !x.free);

export const tests = [
  // ------------------------------------------------------------------ S1-04
  {
    name: 'S1-04: an undone pair settles back from above, and with reduced motion it just returns',
    url: 'index.html',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const pr = freePair(await t.state());
      await t.game('act', 'match', pr[0], pr[1]); await t.waitIdle(15000);
      await t.game('act', 'animAt', 'now');                       // hold the animation clock so the state can be read at leisure
      t.equal(await t.game('act', 'undo'), true, 'undo works');
      const info = await t.game('act', 'animInfo');
      t.equal(info.drop, pr, 'the pair that came back is the pair that settles');
      t.equal((await t.state()).tiles[pr[0]].present, true, 'and it is back on the board at once');
      await t.shot('S1-04-undo-mid');
      await t.game('act', 'animAt', null);
      await t.waitIdle(15000);
      t.equal((await t.game('act', 'animInfo')).drop, null, 'it comes to rest');
      t.expect((await t.game('audioState')).cues.undo >= 1, 'with the undo cue, not the select tick');
      t.equal((await t.game('audioState')).cues.click || 0, 0, 'and no select click was played for it');
    },
  },
  {
    name: 'S1-04: reduced motion gives no settling animation',
    url: 'index.html',
    reducedMotion: true,
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const pr = freePair(await t.state());
      await t.game('act', 'match', pr[0], pr[1]); await t.waitIdle(15000);
      await t.game('act', 'animAt', 'now');
      await t.game('act', 'undo');
      t.equal((await t.game('act', 'animInfo')).drop, null, 'no drop under reduced motion');
      await t.game('act', 'animAt', null);
    },
  },
  // ------------------------------------------------------------------ S4-26
  {
    name: 'S4-26: the title buttons carry their own solid colour, so their contrast is measured against the real pair',
    url: 'index.html',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      for (const theme of ['light', 'dark']) {
        await t.page.evaluate((th) => document.querySelector('[data-set="theme"] [data-v="' + th + '"]').click(), theme);
        const r = await t.contrastReport({ selector: '#s-title .menu .btn' });
        t.log(theme + ': ' + r.checked + ' title buttons checked, fails: ' + JSON.stringify(r.fails));
        t.expect(r.checked >= 5, 'the probe saw the title buttons (' + r.checked + ')');
        t.equal(r.fails, [], 'no title button fails contrast in the ' + theme + ' theme');
        const solid = await t.page.evaluate(() => [...document.querySelectorAll('#s-title .menu .btn')].filter((b) => !b.hidden && b.offsetParent && !b.classList.contains('primary')).map((b) => getComputedStyle(b).backgroundColor).every((c) => /^rgb\(/.test(c)));
        t.expect(solid, 'each title button has an opaque background colour under its gradient (' + theme + ')');
      }
      await t.shot('S4-26-title-buttons');
    },
  },
];
