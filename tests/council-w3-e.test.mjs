// Council wave 3, batch E: sound, layout and accessibility, world, words and ceremony (S5-10, S5-11, S5-13, S5-19, S5-12, S2-10, S4-05, S6-12, S2-11, S4-25).
// Sound is judged by what is scheduled: the recorder below wraps the Web Audio calls, so no result depends on the audio clock. The game clock is
// moved with act('advance'), so nothing waits on real time except for the page to notice.
const FLAT = 'index.html?gl=0';
// While window.__rec is an array, every source start and every oscillator frequency is written to it: {k: 'src' | 'osc', v}
const recorder = () => {
  window.__acs = []; window.__pans = [];
  const O = window.AudioContext; window.AudioContext = class extends O { constructor(...a) { super(...a); window.__acs.push(this); } };
  window.__rec = null;
  const log = (k, v) => { if (window.__rec) window.__rec.push({ k, v }); };
  const s = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...r) { log('src', 0); return s.apply(this, r); };
  const co = BaseAudioContext.prototype.createOscillator;
  BaseAudioContext.prototype.createOscillator = function () { const o = co.call(this), f = o.frequency.setValueAtTime.bind(o.frequency); o.frequency.setValueAtTime = (v, t) => { log('osc', v); return f(v, t); }; return o; };
  const cp = BaseAudioContext.prototype.createStereoPanner;
  BaseAudioContext.prototype.createStereoPanner = function () { const p = cp.call(this); if (window.__rec) window.__pans.push(p); return p; };
};
const freePair = (s) => { const f = s.tiles.filter((x) => x.present && x.free); for (let a = 0; a < f.length; a++) for (let b = a + 1; b < f.length; b++) if (f[a].key === f[b].key) return [f[a].i, f[b].i]; return null; };
const median = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
// runs fn in the page with the recorder on; returns what it returned and what the audio calls recorded
const live = (t, fn, ...args) => t.page.evaluate(([src, args]) => { window.__rec = []; window.__pans = []; const out = (new Function('return ' + src))()(...args); const rec = window.__rec, pans = window.__pans.map((p) => p.pan.value); window.__rec = null; return { out, rec, pans }; }, [fn.toString(), args]);
// the first sound of the game (a tap and its undo), so the live audio exists
const prime = async (t) => { const f = (await t.state()).tiles.find((x) => x.present && x.free); await t.game('act', 'click', f.i); await t.game('act', 'click', f.i); };
// the highest oscillator frequency of an offline render of one cue: for the match cue, twice the note
const topOsc = (t, name, seed) => t.page.evaluate(async ([name, seed]) => { window.__rec = []; await window.__game.audioRender(name, 2, false, seed); const r = window.__rec; window.__rec = null; return { top: Math.max(...r.filter((e) => e.k === 'osc').map((e) => e.v)), all: r.filter((e) => e.k === 'osc').map((e) => e.v) }; }, [name, seed]);
const cues = (t) => t.game('audioState').then((s) => s.cues);
const setSettings = (t, o) => t.page.evaluate((o) => localStorage.setItem('bhm.settings.v1', JSON.stringify(o)), o);
const statsPlayed = (t) => t.page.evaluate(() => { const s = JSON.parse(localStorage.getItem('bhm.stats.v1') || 'null'); return s ? { all: s.played, pyramid: (s.layouts.pyramid || {}).played || 0 } : { all: 0, pyramid: 0 }; });
const LADDER = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1568, 1760, 2093, 2349.32]; // PENTA, then the same five notes an octave up and the top two

export const tests = [
  // ------------------------------------------------------------------ S5-10
  {
    name: 'S5-10: the combo ladder climbs for two octaves, and a chain that runs out falls',
    url: FLAT,
    viewports: ['desktop'],
    initScript: recorder,
    async run(t) {
      // The note of the match cue is its highest oscillator divided by two (its octave overtone). Pitch jitter is 25 cents, so the allowance is 3%.
      const note = {};
      for (let c = 0; c <= 13; c++) {
        const tops = []; for (let seed = 1; seed <= 3; seed++) tops.push((await topOsc(t, 'cue:match:' + c, seed)).top / 2);
        note[c] = median(tops);
        const want = LADDER[Math.min(c, LADDER.length - 1)];
        t.expect(Math.abs(note[c] / want - 1) < 0.03, 'combo ' + c + ' sounds ' + want + ' Hz, got ' + Math.round(note[c]));
      }
      for (let c = 1; c <= 11; c++) t.expect(note[c] > note[c - 1] * 1.05, 'combo ' + c + ' is higher than combo ' + (c - 1) + ' (' + Math.round(note[c]) + ' against ' + Math.round(note[c - 1]) + ')');
      t.expect(note[12] / note[11] < 1.03 && note[13] / note[11] < 1.03, 'past the top the note stays on the top note');
      // the top of the ladder is no louder than the bottom: typical peak of seven seeded renders, inside the cue range
      for (const c of [0, 11]) {
        const peaks = []; for (let seed = 1; seed <= 7; seed++) peaks.push((await t.game('audioRender', 'cue:match:' + c, 2, false, seed)).peak);
        t.expect(median(peaks) >= 0.2 && median(peaks) <= 0.45 && Math.min(...peaks) >= 0.17 && Math.max(...peaks) <= 0.48, 'match at combo ' + c + ' peaks at ' + median(peaks) + ' (' + Math.min(...peaks) + ' to ' + Math.max(...peaks) + ')');
      }
      // at maximum volume the top of the ladder stays under the ceiling
      let worst = 0; for (let seed = 1; seed <= 8; seed++) worst = Math.max(worst, (await t.game('audioRender', 'cue:match:11', 2, false, seed, 100)).peak);
      t.expect(worst <= 0.92, 'a combo 11 match at volume 100 peaks at ' + worst);
      // the falling blip: it exists, falls, and is a cue of its own in the cue range
      t.expect((await t.game('audioList')).cues.includes('comboEnd'), 'there is a comboEnd cue');
      const o = (await topOsc(t, 'cue:comboEnd', 4)).all;
      t.expect(o.length >= 2 && o[0] > o[1] * 1.3, 'it steps down: ' + o.map(Math.round).join(', '));
      const peaks = []; for (let seed = 1; seed <= 7; seed++) peaks.push((await t.game('audioRender', 'cue:comboEnd', 2, false, seed)).peak);
      t.expect(median(peaks) >= 0.2 && median(peaks) <= 0.45 && Math.min(...peaks) >= 0.17 && Math.max(...peaks) <= 0.48, 'comboEnd peaks at ' + median(peaks));
    },
  },
  {
    name: 'S5-10: when the combo bar empties on a chain of three or more, the blip sounds once; a short chain gives none',
    url: FLAT,
    viewports: ['desktop', 'mobile'],
    initScript: recorder,
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      await prime(t);
      const bar = () => t.page.waitForFunction(() => !document.getElementById('h-combo').classList.contains('on'), null, { timeout: 15000 });
      // a short chain (two matches: combo 1) runs out in silence
      await t.game('act', 'solveStep'); await t.game('act', 'solveStep');
      t.equal((await t.state()).combo, 1, 'two quick matches make combo 1');
      await t.game('act', 'advance', 5000); await bar();
      t.equal((await cues(t)).comboEnd || 0, 0, 'a chain of two ends with no blip');
      // a chain of four runs out with one
      for (let i = 0; i < 4; i++) await t.game('act', 'solveStep');
      t.expect((await t.state()).combo >= 2, 'four quick matches make a combo of 2 or more');
      await t.page.waitForFunction(() => document.getElementById('h-combo').classList.contains('on'), null, { timeout: 15000 });
      await t.game('act', 'advance', 5000); await bar();
      t.equal((await cues(t)).comboEnd, 1, 'a chain of four ends with the blip');
      // the clock readout and the combo check run in the same 250 ms tick: once the readout has moved on by the 5 s, the check has run
      const clock = await t.page.evaluate(() => document.getElementById('h-time').textContent);
      await t.game('act', 'advance', 5000);
      await t.page.waitForFunction((c) => document.getElementById('h-time').textContent !== c, clock, { timeout: 15000 });
      t.equal((await cues(t)).comboEnd, 1, 'and it does not sound again while the board waits');
    },
  },
  // ------------------------------------------------------------------ S5-11
  {
    name: 'S5-11: cues sit where their tile is: left tiles pan left, right tiles pan right',
    url: FLAT,
    viewports: ['desktop'],
    initScript: recorder,
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      await prime(t);
      const s = await t.state(), fr = s.tiles.filter((x) => x.present && x.free).sort((a, b) => a.x - b.x), left = fr[0], right = fr[fr.length - 1];
      const l = await live(t, (i) => window.__game.act('click', i), left.i), r = await live(t, (i) => window.__game.act('click', i), right.i);
      t.expect(l.pans.length > 0 && l.pans.every((p) => p < -0.1 && p >= -0.7), 'the leftmost free tile pans left: ' + l.pans.map((p) => +p.toFixed(2)).join(', '));
      t.expect(r.pans.length > 0 && r.pans.every((p) => p > 0.1 && p <= 0.7), 'the rightmost pans right: ' + r.pans.map((p) => +p.toFixed(2)).join(', '));
    },
  },
  // ------------------------------------------------------------------ S5-13, S5-12, S5-19
  {
    name: 'S5-13: select, match, blocked, hint and undo each start sounds, and with Sound off none of them makes any',
    url: FLAT,
    viewports: ['desktop'],
    initScript: recorder,
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      await prime(t);
      const st = await t.state(), pr = freePair(st), blocked = st.tiles.find((x) => x.present && !x.free);
      const acts = { select: ['click', pr[0]], match: ['match', pr[0], pr[1]], blocked: ['click', blocked.i], hint: ['hint'], undo: ['undo'] };
      for (const [name, a] of Object.entries(acts)) {
        const r = await live(t, (a) => window.__game.act(...a), a);
        t.expect(r.rec.length >= 2, name + ' starts sounds (' + r.rec.length + ' sources)');
      }
      // the same actions with Sound off: no context, no source, no cue counted
      await setSettings(t, { sound: false, volume: 70 }); await t.reload();
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const s2 = await t.state(), p2 = freePair(s2), b2 = s2.tiles.find((x) => x.present && !x.free);
      let n = 0;
      for (const a of [['click', p2[0]], ['click', b2.i], ['hint'], ['match', p2[0], p2[1]], ['undo'], ['click', p2[0]]]) { const r = await live(t, (a) => window.__game.act(...a), a); n += r.rec.length; }
      t.equal(n, 0, 'with Sound off no source starts');
      t.equal([await t.page.evaluate(() => window.__acs.length), Object.keys(await cues(t)).length], [0, 0], 'no audio context is made and no cue is counted');
    },
  },
  {
    name: 'S5-12: volume 0 is a mute: no context, no sources, no music; raising it brings the sound back',
    url: FLAT,
    viewports: ['desktop'],
    initScript: recorder,
    async run(t) {
      await setSettings(t, { sound: true, volume: 0 }); await t.reload();
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const s = await t.state(), pr = freePair(s); let n = 0;
      for (const a of [['click', pr[0]], ['click', pr[0]], ['hint'], ['match', pr[0], pr[1]], ['undo']]) { const r = await live(t, (a) => window.__game.act(...a), a); n += r.rec.length; }
      t.equal([n, await t.page.evaluate(() => window.__acs.length), Object.keys(await cues(t)).length], [0, 0, 0], 'at volume 0 nothing is started, made or counted');
      // raise it from the slider: a tick confirms it (S5-19), and the music and the bed follow
      await t.game('scene', 'settings');
      await t.page.locator('#se-vol').fill('40');
      t.expect((await cues(t)).tick >= 1, 'moving the slider off 0 ticks at the new level');
      await t.page.waitForFunction(() => { const a = window.__game.audioState(); return a.music && a.ambience; }, null, { timeout: 10000 });
      t.equal((await t.game('audioState')).master, 0.2, 'the master level is the slider (40 of 100, half of it)');
      // and back to 0: the music and the bed stop, and a tap makes no new sound
      await t.page.locator('#se-vol').fill('0');
      const a = await t.game('audioState');
      t.equal([a.music, a.ambience, a.master], [null, null, 0], 'sliding to 0 stops the music and the bed');
      await t.game('scene', 'title'); await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const before = JSON.stringify(await cues(t)), f = (await t.state()).tiles.find((x) => x.present && x.free);
      await t.game('act', 'click', f.i);
      t.equal(JSON.stringify(await cues(t)), before, 'a tap at volume 0 counts no cue');
    },
  },
  {
    name: 'S5-19: the volume slider, a switch and a choice each sound, and turning Sound on says so',
    url: FLAT,
    viewports: ['desktop', 'mobile'],
    initScript: recorder,
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      await prime(t);
      await t.game('scene', 'settings');
      const n = async () => (await cues(t)).tick || 0;
      // the game spaces its ticks 70 ms apart; let that pass before each step so a slow or fast machine gives the same answer
      const gap = () => t.page.waitForTimeout(100);
      await gap();
      let k = await n();
      await t.page.locator('#se-vol').fill('35');
      t.expect(await n() > k, 'the volume slider ticks'); k = await n();
      await gap(); await t.page.click('#se-free');
      t.expect(await n() > k, 'a switch ticks'); k = await n();
      await gap(); await t.page.click('[data-set="motion"] [data-v="full"]');
      t.expect(await n() > k, 'a choice ticks'); k = await n();
      await gap(); await t.page.click('#se-sound');
      t.expect(await n() === k, 'turning Sound off is silent'); k = await n();
      await gap(); await t.page.click('#se-sound');
      t.expect(await n() > k, 'turning Sound on ticks, so the player hears that it is on');
    },
  },
  // ------------------------------------------------------------------ S2-10
  {
    name: 'S2-10: with a dialog open Tab stays inside it and the page behind is out of reach; a dialog on a dialog takes the focus',
    url: FLAT,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const where = () => t.page.evaluate(() => { const a = document.activeElement, o = a && a.closest('.overlay'); return { overlay: o ? o.id : null, tag: a ? a.tagName : null }; });
      const inert = () => t.page.evaluate(() => ({ app: document.getElementById('app').inert, pause: document.getElementById('o-pause').inert, settings: document.getElementById('o-settings').inert }));
      t.equal((await inert()).app, false, 'nothing is inert before a dialog opens');
      await t.game('pause');
      t.equal(await where(), { overlay: 'o-pause', tag: 'BUTTON' }, 'the pause card takes the focus');
      t.equal((await inert()).app, true, 'the page behind it is inert');
      for (let i = 0; i < 14; i++) { await t.page.keyboard.press('Tab'); const w = await where(); if (w.overlay !== 'o-pause') t.fail('Tab ' + (i + 1) + ' left the pause card for ' + JSON.stringify(w)); }
      for (let i = 0; i < 14; i++) { await t.page.keyboard.press('Shift+Tab'); const w = await where(); if (w.overlay !== 'o-pause') t.fail('Shift+Tab ' + (i + 1) + ' left the pause card for ' + JSON.stringify(w)); }
      // Settings opens on top of the pause card: only Settings can be reached
      await t.page.click('#op-settings');
      let i = await inert();
      t.equal([i.pause, i.settings], [true, false], 'Settings on the pause card: the pause card is inert, Settings is not');
      for (let k = 0; k < 40; k++) { await t.page.keyboard.press('Tab'); const w = await where(); if (w.overlay !== 'o-settings') { t.fail('Tab ' + (k + 1) + ' left Settings for ' + JSON.stringify(w)); break; } }
      await t.page.keyboard.press('Escape');
      i = await inert();
      t.equal([i.app, i.pause, i.settings], [true, false, false], 'closing Settings gives the pause card back');
      t.equal((await where()).overlay, 'o-pause', 'with the focus on it');
      await t.page.click('#op-resume');
      t.equal(await inert(), { app: false, pause: false, settings: false }, 'closing the last dialog frees the page');
      // the board answers again
      const f = (await t.state()).tiles.find((x) => x.present && x.free);
      await t.game('act', 'click', f.i);
      t.equal((await t.state()).selected, f.i, 'and a tile can be selected');
    },
  },
  // ------------------------------------------------------------------ S4-05
  {
    name: 'S4-05: the layout picker sits on the painted backdrop, and its words still read (day and Neon Night)',
    url: FLAT,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      for (const theme of ['light', 'dark']) {
        await setSettings(t, { theme }); await t.reload();
        await t.game('scene', 'layouts');
        // the canvas holds the painting: wait for its art, then judge it by the spread of its pixels, not by one pixel
        await t.page.waitForFunction(() => {
          const c = document.getElementById('layouts-art'), x = c.getContext('2d'); if (!c.width) return false;
          const v = []; for (let i = 1; i < 12; i++) { const d = x.getImageData(Math.floor(c.width * i / 12), Math.floor(c.height * 0.5), 1, 1).data; v.push(d[0] + d[1] + d[2]); }
          return Math.max(...v) - Math.min(...v) > 12;
        }, null, { timeout: 10000 });
        const r = await t.page.evaluate(() => {
          const c = document.getElementById('layouts-art'), x = c.getContext('2d'), k = c.width / c.clientWidth;
          const lum = (rgb) => { const f = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
          const out = { fills: c.clientWidth === innerWidth && c.clientHeight === innerHeight, ratios: [] };
          for (const sel of ['#s-layouts .levelbar .lbl', '#s-layouts .levelbar p']) {
            const el = document.querySelector(sel), b = el.getBoundingClientRect(), fg = getComputedStyle(el).color.match(/[\d.]+/g).slice(0, 3).map(Number);
            let worst = 99;
            for (let i = 0; i < 6; i++) { const d = x.getImageData(Math.floor((b.left + b.width * (i + 0.5) / 6) * k), Math.floor((b.top + b.height / 2) * k), 1, 1).data, a = lum(fg), bl = lum([d[0], d[1], d[2]]); worst = Math.min(worst, (Math.max(a, bl) + 0.05) / (Math.min(a, bl) + 0.05)); }
            out.ratios.push(+worst.toFixed(1));
          }
          out.cards = document.querySelectorAll('#cards .card').length; out.sheet = getComputedStyle(document.getElementById('s-layouts')).backgroundColor;
          return out;
        });
        t.expect(r.fills, theme + ': the painting fills the screen');
        t.expect(r.ratios.every((q) => q >= 4.5), theme + ': the labels read on it (contrast ' + r.ratios.join(', ') + ')');
        t.expect(r.cards >= 18, theme + ': the cards are all there');
        await t.shot('S4-05-layouts-' + theme);
      }
    },
  },
  // ------------------------------------------------------------------ S6-12
  {
    name: 'S6-12: a game counts as played when its first pair is matched, not when it is dealt',
    url: FLAT,
    viewports: ['desktop'],
    async run(t) {
      for (let k = 0; k < 4; k++) { await t.game('newGame', { layout: 'pyramid', seed: 30 + k }); await t.waitIdle(15000); }
      t.equal(await statsPlayed(t), { all: 0, pyramid: 0 }, 'four new games with no move leave the records at 0');
      await t.game('act', 'solveStep');
      t.equal(await statsPlayed(t), { all: 1, pyramid: 1 }, 'the first match counts the game');
      await t.game('act', 'solveStep'); await t.game('act', 'undo'); await t.game('act', 'undo'); await t.game('act', 'redo');
      t.equal(await statsPlayed(t), { all: 1, pyramid: 1 }, 'more matches, undo and redo count nothing more');
      await t.reload();
      await t.page.click('#b-continue'); await t.waitIdle(15000);
      await t.game('act', 'solveStep');
      t.equal(await statsPlayed(t), { all: 1, pyramid: 1 }, 'a reload in the middle of the game does not count it twice');
      await t.game('newGame', { layout: 'pyramid', seed: 99 }); await t.waitIdle(15000);
      t.equal(await statsPlayed(t), { all: 1, pyramid: 1 }, 'the next deal is not counted yet');
      await t.game('act', 'solveStep');
      t.equal(await statsPlayed(t), { all: 2, pyramid: 2 }, 'until its first match');
      await t.game('act', 'solveTo', 0); await t.page.waitForSelector('#o-win.on', { timeout: 15000 });
      const s = await t.page.evaluate(() => JSON.parse(localStorage.getItem('bhm.stats.v1')));
      t.equal([s.played, s.won], [2, 1], 'a win after it reads 1 won of 2 played');
    },
  },
  // ------------------------------------------------------------------ S2-11
  {
    name: 'S2-11: the keyboard cursor and the hint say where a tile is, in rows and columns',
    url: FLAT,
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const s = await t.state();
      const mx = Math.min(...s.tiles.map((x) => x.x)), my = Math.min(...s.tiles.map((x) => x.y));
      const spot = (x) => 'row ' + (Math.round((x.y - my) / 2) + 1) + ', column ' + (Math.round((x.x - mx) / 2) + 1) + (x.z ? ', layer ' + (x.z + 1) : '');
      const said = async (re) => { await t.page.waitForFunction((src) => new RegExp(src).test(document.getElementById('live').textContent), re.source, { timeout: 5000 }); return t.page.evaluate(() => document.getElementById('live').textContent); };
      const pr = await t.game('act', 'hint');
      const a = s.tiles[pr[0]], b = s.tiles[pr[1]];
      const live = await said(/^Hint: /);
      t.expect(live.includes('First tile: ' + spot(a) + '.') && live.includes('Match it with the tile at ' + spot(b) + '.'), 'the hint names both places: ' + live);
      t.equal((await t.state()).cursor, pr[0], 'and the keyboard cursor is on the first tile of the pair');
      for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']) { await t.game('act', 'key', k); if ((await t.state()).cursor !== pr[0]) break; }
      const st = await t.state(), c = st.tiles[st.cursor];
      const l2 = await said(/^(?!Hint).*column/);
      t.expect(l2.includes(spot(c)) && /(free|blocked)$/.test(l2), 'an arrow key names the tile it lands on, with its place: ' + l2);
    },
  },
  // ------------------------------------------------------------------ S4-25
  {
    name: 'S4-25: the page has a theme colour that follows the theme, a manifest, and a description that counts the layouts right',
    url: FLAT,
    viewports: ['desktop'],
    async run(t) {
      const meta = () => t.page.evaluate(() => ({ color: (document.querySelector('meta[name=theme-color]') || {}).content || null, manifest: (document.querySelector('link[rel=manifest]') || {}).href || null, desc: (document.querySelector('meta[name=description]') || {}).content || '' }));
      let m = await meta();
      t.equal(m.color, '#173F47', 'the light theme colours the phone\'s bar like the game\'s top bar');
      const man = JSON.parse(decodeURIComponent((m.manifest || '').replace(/^data:application\/manifest\+json,/, '') || 'null'));
      t.expect(man && man.name === 'Bathhouse Mahjong' && man.display === 'standalone' && man.theme_color === '#173F47', 'the manifest names the game: ' + JSON.stringify(man));
      await setSettings(t, { theme: 'dark' }); await t.reload();
      t.equal((await meta()).color, '#1D1A31', 'Neon Night colours it for the night');
      await t.game('scene', 'layouts');
      const n = await t.page.evaluate(() => document.querySelectorAll('#cards .card').length);
      const words = { 18: 'eighteen', 17: 'seventeen', 19: 'nineteen', 20: 'twenty' };
      t.expect(m.desc.includes(words[n] + ' local layouts'), 'the description says ' + words[n] + ' local layouts for the ' + n + ' cards: ' + m.desc);
    },
  },
];
