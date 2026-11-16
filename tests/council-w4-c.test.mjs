// Council wave 4, batch C: sound; layout and accessibility; world, words and ceremony (S5-20, C4-08, C4-09, C4-02, C4-04, S2-27).
// Every check reads what the player sees or hears and waits for a condition, never for a time.
const FLAT = 'index.html?gl=0';
const median = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];

// Records the pitches of a rendered cue, and the delays of the timers the game sets for the streak and best-time cues (read when they are set).
const recorder = () => {
  window.__rec = null; window.__streakTimers = []; window.__bestTimers = [];
  const log = (k, v) => { if (window.__rec) window.__rec.push({ k, v }); };
  const co = BaseAudioContext.prototype.createOscillator;
  BaseAudioContext.prototype.createOscillator = function () { const o = co.call(this), f = o.frequency.setValueAtTime.bind(o.frequency); o.frequency.setValueAtTime = (v, t) => { log('osc', v); return f(v, t); }; return o; };
  const st = window.setTimeout;
  window.setTimeout = function (fn, ms, ...a) { if (typeof fn === 'function') { const s = String(fn); if (s.includes('AUDIO.streak')) window.__streakTimers.push(ms); if (s.includes('AUDIO.best')) window.__bestTimers.push(ms); } return st.call(this, fn, ms, ...a); };
};
const rendered = (t, name, seed) => t.page.evaluate(async ([name, seed]) => { window.__rec = []; const r = await window.__game.audioRender(name, 3, false, seed); const rec = window.__rec; window.__rec = null; return { r, osc: rec.filter((e) => e.k === 'osc').map((e) => e.v) }; }, [name, seed]);
const near = (list, hz, tol = 0.04) => list.some((v) => Math.abs(v / hz - 1) < tol);
const timers = (t) => t.page.evaluate(() => ({ streak: window.__streakTimers.slice(), best: window.__bestTimers.slice() }));
const cueCount = (t, k) => t.game('audioState').then((s) => (s.cues || {})[k] || 0);
const factsOf = (t) => t.page.evaluate(() => JSON.parse(document.getElementById('facts').textContent));

export const tests = [
  // ------------------------------------------------------------------ S5-20
  {
    name: 'S5-20: a streak that goes on has its own cue, climbing with the run, in the cue range and quieter than the win',
    url: FLAT, viewports: ['desktop'], initScript: recorder,
    async run(t) {
      t.expect((await t.game('audioList')).cues.includes('streak'), 'there is a streak cue');
      const first = [], last = [];
      for (const seed of [101, 102, 103]) { first.push((await rendered(t, 'cue:streak:2', seed)).osc); last.push((await rendered(t, 'cue:streak:6', seed)).osc); }
      t.expect(first.every((o) => near(o, 523.25) && near(o, 587.33) && near(o, 659.25)), 'day 2 climbs the scale from its first note');
      t.expect(last.every((o) => near(o, 880) && near(o, 1046.5) && near(o, 1174.66) && !near(o, 659.25, 0.01)), 'day 6 starts four steps up');
      const peaks = [], wins = [], rms = [];
      for (let seed = 101; seed <= 120; seed++) { const s = await t.game('audioRender', 'cue:streak:3', 3, false, seed), w = await t.game('audioRender', 'cue:win', 3, false, seed); peaks.push(s.peak); rms.push(s.rmsDb); wins.push(w.rmsDb); }
      t.expect(median(peaks) >= 0.2 && median(peaks) <= 0.45 && Math.max(...peaks.slice(0, 7)) <= 0.45, 'its peak is in the cue range: median ' + median(peaks));
      t.expect(median(rms) < median(wins), 'and it is quieter than the win (' + median(rms) + ' dB against ' + median(wins) + ' dB)');
      const mixes = []; for (let k = 0; k < 4; k++) mixes.push((await t.game('audioRender', 'mix', 8, false, 201 + k, 100)).peak);
      t.expect(Math.max(...mixes) <= 0.92, 'the busiest moment at volume 100 still peaks under 0.92: ' + Math.max(...mixes));
    },
  },
  {
    name: 'S5-20: the second day of a Daily Puzzle streak sounds the cue after the best-time cue; the first day and a practice replay do not',
    url: FLAT, viewports: ['desktop'], initScript: recorder,
    async run(t) {
      const win = async (date) => { await t.game('newGame', { daily: true, date }); await t.game('act', 'solveTo', 0); await t.page.waitForSelector('#o-win.on', { timeout: 15000 }); };
      await win('2026-03-01');
      t.equal((await timers(t)).streak.length, 0, 'day 1 of a streak schedules no streak cue');
      await win('2026-03-02');
      const a = await timers(t);
      t.equal(a.streak.length, 1, 'day 2 schedules it once');
      t.expect(a.best.length >= 1 && a.streak[0] > Math.min(...a.best), 'after the best-time cue, so they are not heard together: ' + a.streak + ' against ' + a.best);
      await t.page.waitForFunction(() => (window.__game.audioState().cues || {}).streak >= 1, null, { timeout: 15000 });
      t.equal(await cueCount(t, 'streak'), 1, 'and it sounds once');
      await win('2026-03-02');
      t.equal((await timers(t)).streak.length, 1, 'replaying that day (practice) schedules nothing more');
    },
  },
  {
    name: 'S5-20: three wins in a row sound the streak cue on the third and not before; the fourth does not repeat it',
    url: FLAT, viewports: ['desktop'], initScript: recorder,
    async run(t) {
      const win = async (seed) => { await t.game('newGame', { layout: 'islands', seed }); await t.game('act', 'solveTo', 0); await t.page.waitForSelector('#o-win.on', { timeout: 15000 }); };
      await win(1); await win(2);
      t.equal((await timers(t)).streak.length, 0, 'two wins in a row: no streak cue');
      await win(3);
      t.equal((await timers(t)).streak.length, 1, 'the third schedules it');
      await t.page.waitForFunction(() => (window.__game.audioState().cues || {}).streak >= 1, null, { timeout: 15000 });
      await win(4);
      t.equal((await timers(t)).streak.length, 1, 'the fourth does not');
    },
  },
];
