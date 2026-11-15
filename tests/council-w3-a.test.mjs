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
  // ------------------------------------------------------------------ S6-05
  {
    name: 'S6-05: a refused write (storage full) is said once in a toast and kept in the Settings and Stats notes',
    url: URL,
    viewports: ['desktop', 'mobile'],
    // the page's storage refuses every bhm.* write while window.__full is set, as a full disk does
    initScript: () => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { if (window.__full && String(k).startsWith('bhm.')) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } return set.call(this, k, v); };
    },
    async run(t) {
      const toastText = () => t.page.evaluate(() => (document.getElementById('toast').classList.contains('on') ? document.getElementById('toast').textContent : ''));
      const note = async () => { await t.game('scene', 'settings'); const x = await t.page.locator('#se-storage').innerText(); await t.page.evaluate(() => document.querySelector('#o-settings [data-close]').click()); return x; };
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      t.expect(/saved in this browser/.test(await note()), 'with room to write, the note says it is saved');
      t.equal(await toastText(), '', 'and there is no warning');
      await t.page.evaluate(() => { window.__full = true; });
      let s = await t.state(); const pr = freePair(s);
      await t.game('act', 'match', pr[0], pr[1]); await t.waitIdle(15000);
      t.expect(/storage is full/.test(await toastText()), 'the first refused write says so in a toast: ' + await toastText());
      await t.shot('S6-05-toast', { wait: false });
      t.expect(/will not be kept/.test(await note()), 'and Settings says progress will not be kept');
      await t.game('scene', 'stats');
      t.expect(/storage is full/.test(await t.page.locator('#ost-body').innerText()), 'and so does Stats');
      await t.page.evaluate(() => document.querySelector('#o-stats [data-close]').click());
      await t.page.evaluate(() => { document.getElementById('toast').classList.remove('on'); document.getElementById('toast').textContent = ''; });
      s = await t.state(); const pr2 = freePair(s);
      await t.game('act', 'match', pr2[0], pr2[1]); await t.waitIdle(15000);
      t.equal(await toastText(), '', 'a second refused write does not toast again');
      await t.game('scene', 'settings'); await t.page.locator('#se-storage').scrollIntoViewIfNeeded(); await t.shot('S6-05-settings-note');
      await t.page.evaluate(() => document.querySelector('#o-settings [data-close]').click());
      await t.page.evaluate(() => { window.__full = false; });
      s = await t.state(); const pr3 = freePair(s);
      await t.game('act', 'match', pr3[0], pr3[1]); await t.waitIdle(15000);
      t.expect(/saved in this browser/.test(await note()), 'once a write succeeds the note goes back to normal');
      t.equal((await stored(t, 'bhm.game.v1')).history.length, 3, 'and the game is saved again');
    },
  },
  // ------------------------------------------------------------------ P-N01
  {
    name: 'P-N01: reloading does not dodge the win streak: abandoning the saved game resets it',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const setStreak = (n) => t.page.evaluate((n) => { const s = JSON.parse(localStorage.getItem('bhm.stats.v1')); s.streak = n; s.bestStreak = Math.max(n, s.bestStreak || 0); localStorage.setItem('bhm.stats.v1', JSON.stringify(s)); }, n);
      const startFromTitle = async () => { await t.page.click('#b-play'); await t.page.click('.card[data-layout="pyramid"]'); };
      // a saved game with a match, and a streak of 4
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const pr = freePair(await t.state());
      await t.game('act', 'match', pr[0], pr[1]); await t.waitIdle(15000);
      await setStreak(4);
      await reload(t);
      t.equal((await stored(t, 'bhm.game.v1')).history.length, 1, 'the game with a match is saved');
      await startFromTitle();
      const text = await t.page.locator('#oc-text').innerText();
      t.expect(await t.page.locator('#o-confirm.on').count() === 1, 'the Abandon dialog opens');
      t.expect(/your saved game and resets your win streak of 4./.test(text), 'and it says what is at stake: ' + text);
      t.equal((await stored(t, 'bhm.stats.v1')).streak, 4, 'asking does not change the streak');
      await t.shot('P-N01-confirm');
      await t.page.click('#oc-keep');
      t.equal((await stored(t, 'bhm.stats.v1')).streak, 4, 'keeping the game keeps the streak');
      await t.page.click('.card[data-layout="pyramid"]'); await t.page.click('#oc-new'); // still on the picker after keeping
      t.equal((await stored(t, 'bhm.stats.v1')).streak, 0, 'abandoning it after a reload resets the streak, as the dialog said');
      t.equal((await t.state()).scene, 'game', 'and the new game started');
      // a saved game with no match yet has nothing to lose
      await t.game('newGame', { layout: 'pyramid', seed: 22 }); await t.waitIdle(15000);
      await setStreak(4);
      await reload(t);
      await startFromTitle();
      t.equal(await t.page.locator('#o-confirm.on').count(), 0, 'no dialog for a game with no match');
      t.equal((await stored(t, 'bhm.stats.v1')).streak, 4, 'and the streak is untouched');
    },
  },
];
