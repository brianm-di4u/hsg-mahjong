// Council wave 2, batch A: music, ambience and the silent events (S5-01, S5-02, S5-03).
// Everything heard is checked by measurement: audioRender renders a piece, a scene or a cue on an offline
// context at the level the game ships (volume 70) and measures it. Set HS_WAV_DIR to also write WAV previews.
import fs from 'node:fs';
import path from 'node:path';

const URL = 'index.html?gl=0';
const BPM = { title: 62, play: 72, win: 80 }; // the scores' tempos (4 beats a bar), to turn formBars into seconds
const stored = (t, k) => t.page.evaluate((k) => { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }, k);
const audio = (t) => t.game('audioState');
const wavOut = (name, r) => { if (process.env.HS_WAV_DIR && r.wav) { fs.mkdirSync(process.env.HS_WAV_DIR, { recursive: true }); fs.writeFileSync(path.join(process.env.HS_WAV_DIR, name.replace(/[^\w-]/g, '_') + '.wav'), Buffer.from(r.wav, 'base64')); } };
const watchContexts = () => { const O = window.AudioContext; window.__acs = []; window.AudioContext = class extends O { constructor(...a) { super(...a); window.__acs.push(this); } }; };
const settle = (t, ms) => t.page.waitForTimeout(ms);

export const tests = [
  {
    name: 'S5-01: every piece of music renders 60 s inside the mix limits and does not loop early',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      const list = await t.game('audioList');
      t.equal(list.music, ['title', 'play', 'win'], 'three moods: title, play and win');
      for (const name of list.music) {
        const r = await t.game('audioRender', name, 60, !!process.env.HS_WAV_DIR);
        wavOut('music-' + name, r);
        const formSeconds = r.built.formBars * 4 * 60 / BPM[name];
        t.log(name + ': peak ' + r.peak + ', rms ' + r.rmsDb + ' dB, form ' + formSeconds.toFixed(0) + ' s (' + r.built.formBars + ' bars), distinct bars ' + r.built.distinctBars + ', pitches ' + r.built.pitches + ', longest silence ' + r.longestSilence + ' s, stereo ' + r.stereo);
        t.expect(r.peak >= 0.06 && r.peak <= 0.16, name + ' peak ' + r.peak + ' is between 0.06 and 0.16');
        t.expect(r.rmsDb >= -40 && r.rmsDb <= -28, name + ' rms ' + r.rmsDb + ' dBFS is between -40 and -28');
        t.expect(formSeconds >= 45, name + ' runs ' + formSeconds.toFixed(0) + ' s before it repeats');
        t.expect(r.built.distinctBars >= 6, name + ' has ' + r.built.distinctBars + ' distinct bars');
        t.expect(r.built.pitches >= 6, name + ' uses ' + r.built.pitches + ' pitches');
        t.expect(r.longestSilence <= 2, name + ' has a ' + r.longestSilence + ' s silence');
        t.expect(BPM[name] >= 60 && BPM[name] <= 84, name + ' is calm: ' + BPM[name] + ' bpm');
      }
    },
  },
  {
    name: 'S5-02: the ambience scenes render 30 s inside the limits with no silent stretch',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      const list = await t.game('audioList');
      t.equal(list.ambience, ['spring', 'springNight'], 'a day and a night bed for the Row');
      for (const name of list.ambience) {
        const r = await t.game('audioRender', name, 30, !!process.env.HS_WAV_DIR);
        wavOut('ambience-' + name, r);
        t.log(name + ': peak ' + r.peak + ', rms ' + r.rmsDb + ' dB, longest silence ' + r.longestSilence + ' s, stereo ' + r.stereo);
        t.expect(r.peak < 0.07, name + ' peak ' + r.peak + ' is under 0.07');
        t.expect(r.rmsDb >= -52 && r.rmsDb <= -38, name + ' rms ' + r.rmsDb + ' dBFS is between -52 and -38');
        t.expect(r.longestSilence < 2, name + ' has a ' + r.longestSilence + ' s silence');
      }
      // it never repeats audibly: two renders with different seeds differ
      const a = await t.game('audioRender', 'spring', 20, false, 3), b = await t.game('audioRender', 'spring', 20, false, 9);
      t.expect(JSON.stringify(a.secs) !== JSON.stringify(b.secs), 'two seeds give two different beds');
    },
  },
  {
    name: 'S5-01: music and ambience sit under the cues, and the worst case never clips',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      const mix = await t.game('audioRender', 'mix', 8, false);
      t.log('music + ambience + win, match, Row and blocked cues together: peak ' + mix.peak);
      t.expect(mix.peak < 0.95, 'the worst case peaks at ' + mix.peak + ', under 0.95');
      const music = await t.game('audioRender', 'play', 20, false), amb = await t.game('audioRender', 'spring', 20, false);
      t.expect(amb.rmsDb < music.rmsDb, 'ambience (' + amb.rmsDb + ' dB) sits under the music (' + music.rmsDb + ' dB)');
    },
  },
  {
    name: 'S5-03: every cue peaks between 0.2 and 0.45 and no two repeats are identical',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      const list = await t.game('audioList');
      for (const need of ['deal', 'deselect', 'undo', 'stuck', 'dead', 'row', 'best', 'pause', 'resume', 'zoomIn', 'zoomOut', 'tick']) t.expect(list.cues.includes(need), 'there is a ' + need + ' cue');
      for (const name of list.cues) {
        const r = await t.game('audioRender', 'cue:' + name, 3, !!process.env.HS_WAV_DIR);
        wavOut('cue-' + name, r);
        t.log('cue ' + name + ': peak ' + r.peak + ', rms ' + r.rmsDb + ' dB');
        t.expect(r.peak >= 0.2 && r.peak <= 0.45, 'cue ' + name + ' peaks at ' + r.peak);
        for (let seed = 2; seed <= 7; seed++) { const p = (await t.game('audioRender', 'cue:' + name, 3, false, seed)).peak; t.expect(p >= 0.2 && p <= 0.45, 'cue ' + name + ' (repeat ' + seed + ') peaks at ' + p); }
      }
      for (const name of ['click', 'match', 'tick']) {
        const peaks = new Set();
        for (let s = 1; s <= 6; s++) peaks.add((await t.game('audioRender', 'cue:' + name, 2, false, s)).peak);
        t.expect(peaks.size >= 5, name + ': six repeats gave ' + peaks.size + ' different levels');
      }
    },
  },
  {
    name: 'S5-01: nothing sounds before the first gesture, then the title music and the spring start',
    url: URL,
    viewports: ['desktop'],
    initScript: watchContexts,
    async run(t) {
      t.equal(await t.page.evaluate(() => window.__acs.length), 0, 'no audio context at load');
      t.equal((await audio(t)).music, null, 'no music before a gesture');
      await t.page.click('#b-play');
      await t.page.waitForFunction(() => window.__acs.length > 0 && window.__acs[0].state === 'running', null, { timeout: 5000 }).catch(() => {});
      const a = await audio(t);
      t.equal([a.ctx, a.music, a.ambience], ['running', 'title', 'spring'], 'the title mood and the day spring after the first click');
      await t.game('scene', 'title');
    },
  },
  {
    name: 'S5-01: the mood follows the screen: title, play, win',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await t.page.click('#b-play');
      t.equal((await audio(t)).music, 'title', 'layout picker: title music');
      await t.game('newGame', { layout: 'pyramid', seed: 21 });
      t.equal((await audio(t)).music, 'play', 'a game: play music');
      await t.waitIdle(15000);
      await t.game('act', 'solveTo', 0);
      t.equal((await audio(t)).music, 'win', 'a won game: win music');
      await t.game('newGame', { layout: 'pyramid', seed: 22 });
      t.equal((await audio(t)).music, 'play', 'a new game: back to play music');
      await t.game('scene', 'title');
      t.equal((await audio(t)).music, 'title', 'title: title music');
    },
  },
  {
    name: 'S5-02: the night theme plays the night bed, and the day theme the day bed',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await t.page.click('#b-settings');
      await t.page.click('[data-set="theme"] [data-v="dark"]');
      t.equal((await audio(t)).ambience, 'springNight', 'Neon Night: crickets over the water');
      await t.page.click('[data-set="theme"] [data-v="light"]');
      t.equal((await audio(t)).ambience, 'spring', 'Light: birds over the water');
    },
  },
  {
    name: 'S5-01: Music, Ambience and Sound effects each have a setting that silences them and persists',
    url: URL,
    async run(t) {
      await t.page.click('#b-settings');
      let s = (await t.state()).settings;
      t.equal([s.music, s.ambience, s.effects], [true, true, true], 'all three on by default');
      await t.shot('S5-01-settings');
      if (t.viewport === 'mobile') {
        const small = await t.page.evaluate(() => ['se-sfx', 'se-music', 'se-amb'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); }).filter((v) => v < 44));
        t.equal(small, [], 'the three new buttons are at least 44 px');
      }
      t.equal((await audio(t)).music, 'title', 'music is playing');
      await t.page.click('#se-music');
      let a = await audio(t);
      t.equal([a.music, a.ambience], [null, 'spring'], 'Music off silences the music only');
      t.equal((await t.state()).settings.music, false, 'Music off is in the settings');
      await t.page.click('#se-amb');
      a = await audio(t);
      t.equal([a.music, a.ambience], [null, null], 'Ambience off silences the ambience');
      await t.page.click('#se-sfx');
      t.equal((await audio(t)).effects, 0, 'Sound effects off closes the effects bus');
      const saved = await stored(t, 'bhm.settings.v1');
      t.equal([saved.music, saved.ambience, saved.effects], [false, false, false], 'all three are saved');
      await t.reload();
      s = (await t.state()).settings;
      t.equal([s.music, s.ambience, s.effects], [false, false, false], 'they survive a reload');
      await t.page.click('#b-play');
      a = await audio(t);
      t.equal([a.music, a.ambience, a.effects], [null, null, 0], 'and stay silent after the reload');
      await t.game('scene', 'title');
      await t.page.click('#b-settings');
      await t.page.click('#se-music');
      await t.page.click('#se-amb');
      await t.page.click('#se-sfx');
      a = await audio(t);
      t.equal([a.music, a.ambience], ['title', 'spring'], 'turning them back on brings them back');
      t.expect(a.effects > 0, 'effects bus open again');
    },
  },
  {
    name: 'S5-01: the master Sound switch silences music and ambience, and a save that had sound off stays silent',
    url: URL,
    viewports: ['desktop'],
    initScript: watchContexts,
    async run(t) {
      await t.page.click('#b-settings');
      await t.page.click('#se-sound');
      let a = await audio(t);
      t.equal([a.music, a.ambience, a.master], [null, null, 0], 'Sound off: no music, no ambience, master at 0');
      await t.page.click('#se-sound');
      a = await audio(t);
      t.equal([a.music, a.ambience], ['title', 'spring'], 'Sound on: both come back');
      // an old save with sound off (and none of the new keys) stays silent
      await t.page.evaluate(() => localStorage.setItem('bhm.settings.v1', JSON.stringify({ sound: false, volume: 55, motion: 'auto' })));
      await t.page.evaluate(() => { window.__acs = []; });
      await t.reload();
      const s = (await t.state()).settings;
      t.equal([s.sound, s.volume, s.music, s.ambience, s.effects], [false, 55, true, true, true], 'the old save keeps sound off and its volume; the new keys default on');
      await t.page.click('#b-play');
      await t.game('newGame', { layout: 'pyramid', seed: 23 });
      a = await audio(t);
      t.equal([a.ctx, a.music, a.ambience], ['none', null, null], 'no audio context is made and nothing plays');
    },
  },
  {
    name: 'S5-01: a pre-wave save with damaged music settings loads with the defaults',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await t.page.evaluate(() => localStorage.setItem('bhm.settings.v1', JSON.stringify({ sound: true, volume: 40, music: 'maybe', ambience: 7, effects: null, theme: 'dark' })));
      await t.reload();
      const s = (await t.state()).settings;
      t.equal([s.music, s.ambience, s.effects, s.volume, s.theme], [true, true, true, 40, 'dark'], 'junk values fall back, good values stay');
    },
  },
  {
    name: 'S5-01: the pause card and a hidden tab hold the music, and nothing is scheduled meanwhile',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await t.page.click('#b-play');
      await t.game('newGame', { layout: 'pyramid', seed: 24 });
      await t.waitIdle(15000);
      await t.page.waitForFunction(() => window.__game.audioState().ctx === 'running', null, { timeout: 5000 }).catch(() => {});
      const before = await audio(t);
      t.equal([before.held, before.music], [false, 'play'], 'playing');
      await t.game('pause');
      let a = await audio(t);
      t.equal(a.held, true, 'the pause card holds the music and the ambience');
      t.expect((a.cues.pause || 0) >= 1, 'the pause card has a cue');
      await settle(t, 4500);
      const b = await audio(t);
      t.equal(b.bars, a.bars, 'no bar is scheduled while paused (' + a.bars + ' bars)');
      await t.game('resume');
      a = await audio(t);
      t.equal(a.held, false, 'resume lets them back');
      t.expect((a.cues.resume || 0) >= 1, 'resume has a cue');
      await settle(t, 4500);
      t.expect((await audio(t)).bars > b.bars, 'bars are scheduled again after resume');
      // hidden tab
      const setHidden = (h) => t.page.evaluate((h) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, h);
      await setHidden(true);
      a = await audio(t);
      t.equal([a.held, a.ctx], [true, 'suspended'], 'a hidden tab holds the music and suspends the context');
      await setHidden(false);
      await settle(t, 400);
      a = await audio(t);
      t.equal([a.held, a.ctx], [false, 'running'], 'coming back releases it');
      // paused and hidden together: coming back stays held until Resume
      await t.game('pause'); await setHidden(true); await setHidden(false); await settle(t, 300);
      t.equal((await audio(t)).held, true, 'a paused game stays held when the tab comes back');
      await t.game('resume');
      t.equal((await audio(t)).held, false, 'and is released by Resume');
    },
  },
  {
    name: 'S5-03: the events that were silent each have their cue',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await t.page.click('#b-play');
      const n = async (k) => ((await audio(t)).cues[k] || 0);
      await t.game('newGame', { layout: 'pyramid', seed: 31 });
      await t.waitIdle(15000);
      t.expect((await n('deal')) >= 1, 'the deal-in has a cue');
      // select, deselect, blocked
      const st = await t.state();
      const open = st.tiles.filter((x) => x.present && x.free), blocked = st.tiles.find((x) => x.present && !x.free);
      await t.game('act', 'click', open[0].i);
      t.expect((await n('click')) >= 1, 'selecting a tile clicks');
      await t.game('act', 'click', open[0].i);
      t.expect((await n('deselect')) >= 1, 'deselecting has its own soft tick');
      await t.game('act', 'click', blocked.i);
      t.expect((await n('thud')) >= 1, 'a blocked tile thuds');
      // match, undo, hint, shuffle
      const pr = await t.game('act', 'hint');
      t.expect((await n('hintCost')) >= 1 && (await n('chime')) === 0, 'a hint that costs points sounds its own soft question, not the chime (S5-15)');
      await t.game('act', 'match', pr[0], pr[1]);
      t.expect((await n('match')) >= 1, 'a match sounds');
      const m = await n('click');
      await t.game('act', 'undo');
      t.expect((await n('undo')) >= 1, 'undo has its own cue');
      t.equal(await n('click'), m, 'and no longer reuses the select click');
      await t.game('act', 'shuffle');
      t.expect((await n('rattle')) >= 1, 'a shuffle rattles');
      // zoom and the toggles
      await t.page.click('#t-zoom');
      t.expect((await n('zoomIn')) >= 1, 'Zoom in swishes');
      await t.page.click('#t-zoom');
      t.expect((await n('zoomOut')) >= 1, 'Zoom out swishes back');
      const k0 = await n('tick');
      await t.page.click('#t-free');
      t.expect((await n('tick')) > k0, 'the Free toggle ticks');
      // dead board
      await t.game('act', 'deadBoard');
      t.expect((await n('dead')) >= 1, 'the dead-board notice has its cue');
      // stuck dialog
      await t.game('newGame', { layout: 'pyramid', seed: 32 });
      await t.waitIdle(15000);
      await t.game('act', 'solveTo', 60);
      const stuck = await t.game('act', 'stuck');
      t.expect(stuck, 'a stuck board was arranged');
      if (stuck) { await t.page.waitForFunction(() => window.__game.getState().overlay === 'o-stuck', null, { timeout: 4000 }); t.expect((await n('stuck')) >= 1, 'the stuck dialog has its cue'); await t.page.click('#os-shuffle'); }
    },
  },
  {
    name: 'S5-03: the Bathhouse Row bonus, a new best time and a win each have their cue',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await t.page.click('#b-play');
      await t.game('newGame', { layout: 'pyramid', seed: 33 });
      await t.waitIdle(15000);
      const n = async (k) => ((await audio(t)).cues[k] || 0);
      const solved = await t.page.evaluate(() => { for (let g = 0; g < 100; g++) { window.__game.act('solveStep'); if (window.__game.getState().rowDone) return true; } return false; });
      t.expect(solved, 'the Row was cleared by solving');
      t.expect((await n('row')) >= 1, 'the Row bonus has its own cue');
      await t.game('act', 'solveTo', 0);
      t.equal((await t.state()).gameStatus, 'won', 'won');
      t.expect((await n('win')) >= 1, 'the win fanfare plays');
      await settle(t, 2000);
      t.expect((await n('best')) >= 1, 'a new best time has its cue');
    },
  },
  {
    name: 'S5-01: a stray audio failure never breaks play',
    url: URL,
    viewports: ['desktop'],
    initScript: () => { window.AudioContext = class { constructor() { throw new Error('no audio here'); } }; delete window.webkitAudioContext; },
    async run(t) {
      await t.page.click('#b-play');
      await t.game('newGame', { layout: 'pyramid', seed: 34 });
      await t.waitIdle(15000);
      const pr = await t.game('act', 'hint');
      await t.game('act', 'match', pr[0], pr[1]);
      t.equal((await t.state()).tilesLeft, 142, 'a match works with no audio at all');
      t.equal((await audio(t)).ctx, 'none', 'and no context exists');
    },
  },
];
