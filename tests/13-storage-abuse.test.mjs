// Corrupt settings and stats, storage quota errors, two tabs. Ported from the council's seat-6 probes (S6-17).
const URL = 'index.html?gl=0';
const NAN = /NaN|undefined|Infinity|\[object/;

const SETTINGS_CASES = [
  ['junk values', '{"volume":"abc","motion":"x","theme":"zzz","tileset":"nope","graphics":"zz","camera":"zz","sound":"yes"}'],
  ['volume 9999', '{"volume":9999}'],
  ['volume negative', '{"volume":-40}'],
  ['volume null', '{"volume":null}'],
  ['truncated', '{"volume":5'],
  ['array', '[1,2]'],
  ['string', '"hello"'],
  ['null', 'null'],
];
const STATS_CASES = [
  ['layouts null entry and daily junk', '{"layouts":{"tower":null,"pyramid":{"played":"x","won":null,"bestMs":"abc"}},"daily":{"done":null,"streak":"x"}}'],
  ['string played', '{"played":"abc","won":null,"streak":-4}'],
  ['layouts is a string', '{"layouts":"oops","daily":5}'],
  ['truncated', '{"played":3,"lay'],
  ['array', '[]'],
];

export const tests = [
  {
    name: 'settings: corrupt values never stop Play or Settings from working',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      for (const [name, json] of SETTINGS_CASES) {
        await t.page.evaluate((j) => localStorage.setItem('bhm.settings.v1', j), json);
        await t.reload();
        const v = (await t.state()).settings.volume;
        t.expect(Number.isFinite(v) && v >= 0 && v <= 100, name + ': volume is a finite 0-100 number, got ' + v);
        await t.page.click('#b-settings');
        t.equal((await t.state()).overlay, 'o-settings', name + ': Settings opens');
        await t.page.keyboard.press('Escape');
        await t.page.click('#b-play');
        t.equal((await t.state()).scene, 'layouts', name + ': Play works');
      }
    },
  },
  {
    name: 'stats: corrupt values show no NaN and do not break a win',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      for (const [name, json] of STATS_CASES) {
        await t.page.evaluate((j) => localStorage.setItem('bhm.stats.v1', j), json);
        await t.reload();
        await t.page.click('#b-stats');
        const txt = await t.page.evaluate(() => document.getElementById('o-stats').innerText);
        t.expect(!NAN.test(txt), name + ': Stats text is clean: ' + (txt.match(/.*(NaN|undefined|Infinity|\[object).*/) || [''])[0].slice(0, 100));
        await t.page.keyboard.press('Escape');
        await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
        await t.game('act', 'solveTo', 0);
        await t.page.waitForFunction(() => window.__game.getState().gameStatus === 'won', null, { timeout: 10000 });
        const saved = await t.page.evaluate(() => JSON.parse(localStorage.getItem('bhm.stats.v1')));
        t.expect(saved.played >= 1 && saved.won === 1 && Number.isFinite(saved.layouts.pyramid.bestMs), name + ': the win is recorded as numbers');
      }
    },
  },
  {
    name: 'storage: a full quota does not break play, settings or a win',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await t.game('unlockAll');
      await t.game('newGame', { layout: 'pyramid', seed: 5 }); await t.waitIdle(15000);
      await t.page.evaluate(() => {
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('bhm.')) throw new DOMException('quota', 'QuotaExceededError'); return set.call(this, k, v); };
      });
      await t.game('act', 'hint');
      await t.game('act', 'solveTo', 130);
      await t.page.click('#t-free');
      await t.game('scene', 'settings');
      await t.page.click('#o-settings [data-set="camera"] [data-v="top"]');
      t.equal((await t.state()).settings.camera, 'top', 'settings still change in memory');
      await t.page.keyboard.press('Escape');
      await t.game('act', 'solveTo', 0);
      await t.page.waitForFunction(() => window.__game.getState().gameStatus === 'won', null, { timeout: 10000 });
      const s = await t.state();
      t.equal([s.gameStatus, s.statsWon], ['won', 1], 'the win still counts in memory');
    },
  },
  {
    name: 'two tabs: the other tab\'s win survives a new game here',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      const B = await t.page.context().newPage();
      try {
        await B.goto(t.page.url());
        await B.waitForFunction(() => !!window.__game, null, { timeout: 15000 });
        await t.game('newGame', { layout: 'pyramid', seed: 11 }); await t.waitIdle(15000);
        await t.game('act', 'solveTo', 0);
        await t.page.waitForFunction(() => window.__game.getState().gameStatus === 'won', null, { timeout: 10000 });
        await B.evaluate(() => window.__game.newGame({ layout: 'tower', seed: 12 }));
        const st = await B.evaluate(() => JSON.parse(localStorage.getItem('bhm.stats.v1')));
        t.equal([st.played, st.won], [2, 1], 'played and won both kept');
      } finally { await B.close(); }
    },
  },
];
