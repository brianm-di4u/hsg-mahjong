// Council wave 3, batch D: sound, and the cues' small corrections (CL-01, S1-02, S2-23, S5-04, S5-07, S1-08, S2-08, S2-12).
// Sound is judged by measurement: audioRender renders a cue or the busiest moment on an offline context at a chosen volume, and a
// recorder wrapped round the Web Audio calls (below) tells when each live cue starts its parts, relative to its own first sound, so no
// result depends on the clock or on the machine's speed.
const FLAT = 'index.html?gl=0';
const FLY_MS = 640;
// While window.__rec is an array, every source, oscillator and parameter schedule is written to it: {k, v, when}
const recorder = () => {
  const O = window.AudioContext; window.__acs = [];
  window.AudioContext = class extends O { constructor(...a) { super(...a); window.__acs.push(this); } };
  window.__rec = null;
  const log = (k, v, when) => { if (window.__rec) window.__rec.push({ k, v, when }); };
  const s = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (when, ...r) { log('src', 0, when); return s.call(this, when, ...r); };
  const o = OscillatorNode.prototype.start; OscillatorNode.prototype.start = function (when, ...r) { log('osc', 0, when); return o.call(this, when, ...r); };
  const p = AudioParam.prototype.setValueAtTime; AudioParam.prototype.setValueAtTime = function (v, when) { log('param', v, when); return p.call(this, v, when); };
};
const freePair = (s) => { const f = s.tiles.filter((x) => x.present && x.free); for (let a = 0; a < f.length; a++) for (let b = a + 1; b < f.length; b++) if (f[a].key === f[b].key) return [f[a].i, f[b].i]; return null; };
const median = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
// makes the first sound of the game (a tap), so the live audio exists, then runs fn in the page with the recorder on
const live = async (t, fn, ...args) => {
  const r = await t.page.evaluate(([src, args]) => { window.__rec = []; const out = (new Function('return ' + src))()(...args); const rec = window.__rec; window.__rec = null; return { out, rec }; }, [fn.toString(), args]);
  return r;
};
const prime = async (t) => { const s = await t.state(); const f = s.tiles.find((x) => x.present && x.free); await t.game('act', 'click', f.i); await t.game('act', 'click', f.i); };
// start times of the parts of the live cue just recorded, relative to its first noise (the steam hiss): immune to the audio clock
const rel = (rec) => { const src = rec.filter((e) => e.k === 'src').map((e) => e.when).sort((a, b) => a - b); return { src, base: src[0], osc: rec.filter((e) => e.k === 'osc').map((e) => e.when - src[0]) }; };

export const tests = [
  // ------------------------------------------------------------------ CL-01
  {
    name: 'CL-01: the busiest moment and every cue stay under 0.95 with the volume at its maximum, and the volume can be given to the render',
    url: FLAT,
    viewports: ['desktop'],
    async run(t) {
      const mixes = []; for (let k = 0; k < 5; k++) mixes.push((await t.game('audioRender', 'mix', 8, false, 201 + k, 100)).peak);
      t.log('busiest moment at volume 100: ' + mixes.join(', '));
      t.expect(Math.max(...mixes) < 0.95, 'the busiest moment peaks at ' + Math.max(...mixes) + ' with the volume at maximum');
      t.expect(Math.max(...mixes) <= 0.92, 'and the ceiling holds it at 0.92 (' + Math.max(...mixes) + '); it was 0.954 without it');
      const def = (await t.game('audioRender', 'mix', 8, false, 201)).peak, full = mixes[0];
      t.expect(def < 0.8 && full > def * 1.1, 'at the default volume the moment is below the ceiling\'s knee (' + def + ') and the volume setting really moves it (' + full + ')');
      t.equal((await t.game('audioRender', 'cue:match', 3, false, 5, 0)).peak, 0, 'volume 0 renders silence');
      const list = (await t.game('audioList')).cues; let worst = 0;
      for (const name of list) for (let k = 0; k < 8; k++) worst = Math.max(worst, (await t.game('audioRender', 'cue:' + name, 3, false, 101 + k, 100)).peak);
      t.expect(worst <= 0.92, 'no cue at maximum volume peaks above 0.92 (loudest ' + worst + ')');
    },
  },
  // ------------------------------------------------------------------ S1-02
  {
    name: 'S1-02: the steam hiss starts at the tap, the clack and the note wait for the clack on screen (flat board and reduced motion)',
    url: FLAT,
    viewports: ['desktop', 'mobile'],
    initScript: recorder,
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      await prime(t);
      let pr = freePair(await t.state());
      let r = await live(t, (a, b) => window.__game.act('match', a, b), pr[0], pr[1]);
      let p = rel(r.rec);
      t.expect(p.src.length >= 3, 'a match makes a hiss and two clacks (' + p.src.length + ' noises)');
      t.expect(Math.abs((p.src[1] - p.base) - (0.3 - 0.02)) < 0.002 && Math.abs((p.src[2] - p.src[1]) - 0.07) < 0.002, 'the clacks come 0.3 s after the tap on the flat board: ' + p.src.map((x) => +(x - p.base).toFixed(3)).join(', '));
      // reduced motion: the pair fades at once, so the sound does not wait
      await t.page.emulateMedia({ reducedMotion: 'reduce' });
      pr = freePair(await t.state());
      r = await live(t, (a, b) => window.__game.act('match', a, b), pr[0], pr[1]); p = rel(r.rec);
      // the first noise is now the clack itself, at the tap; the hiss follows it 0.02 s later and the second clack at 0.07 s
      t.expect(Math.abs((p.src[1] - p.base) - 0.02) < 0.002 && Math.abs((p.src[2] - p.base) - 0.07) < 0.002, 'with reduced motion the clack is at the tap, not 0.3 s later: ' + p.src.map((x) => +(x - p.base).toFixed(3)).join(', '));
      await t.page.emulateMedia({ reducedMotion: 'no-preference' });
    },
  },
  {
    name: 'S1-02: on the 3D board the clack waits for the tiles to meet (66% of the flight)',
    url: 'index.html',
    viewports: ['desktop', 'mobile'],
    initScript: recorder,
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const gfx = (await t.state()).gfx;
      await prime(t);
      const pr = freePair(await t.state());
      const r = await live(t, (a, b) => window.__game.act('match', a, b), pr[0], pr[1]), p = rel(r.rec);
      const want = (gfx === '3d' ? FLY_MS * 0.66 / 1000 : 0.3) - 0.02;
      t.expect(Math.abs((p.src[1] - p.base) - want) < 0.002, 'the clack comes ' + (want + 0.02).toFixed(3) + ' s after the tap on the ' + gfx + ' board: ' + (p.src[1] - p.base).toFixed(3));
    },
  },
  // ------------------------------------------------------------------ S2-23, S5-04
  {
    name: 'S2-23, S5-04: no two matches clack alike, and the body of the clack follows the suit',
    url: FLAT,
    viewports: ['desktop'],
    initScript: recorder,
    async run(t) {
      // Seeded renders: the same seed gives the same sound, so these numbers never change from run to run.
      const clack = [], hiss = [];
      for (let seed = 1; seed <= 12; seed++) {
        const rec = await t.page.evaluate(async (seed) => { window.__rec = []; await window.__game.audioRender('cue:match', 2, false, seed); const r = window.__rec; window.__rec = null; return r; }, seed);
        clack.push(...rec.filter((e) => e.k === 'param' && e.v >= 1700 && e.v <= 2100).map((e) => e.v));
        hiss.push(...rec.filter((e) => e.k === 'param' && e.v >= 4700 && e.v <= 5900).map((e) => e.v));
      }
      t.expect(clack.length === 12 && Math.min(...clack) >= 1900 * 0.94 - 1 && Math.max(...clack) <= 1900 * 1.06 + 1, 'the first clack is within 6% of 1900 Hz: ' + clack.map(Math.round).join(', '));
      t.expect(new Set(clack.map(Math.round)).size >= 10 && Math.max(...clack) - Math.min(...clack) > 70, 'and it differs from match to match (' + Math.round(Math.max(...clack) - Math.min(...clack)) + ' Hz of spread)');
      t.expect(hiss.length === 12 && new Set(hiss.map(Math.round)).size >= 10 && Math.max(...hiss) - Math.min(...hiss) > 300, 'the hiss band moves between 4800 and 5800 Hz too');
      // the live game: the wooden body of the clack is lower for the Springs than for the Bathhouses, and lower for those than the Lakes
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await prime(t);
      const bodies = {};
      for (let seed = 1; seed <= 40 && Object.keys(bodies).length < 3; seed++) {
        await t.game('newGame', { layout: 'pyramid', seed }); await t.waitIdle(15000);
        const s = await t.state(), by = {};
        for (const x of s.tiles) if (x.present && x.free && x.f < 27) (by[x.key] = by[x.key] || []).push(x);
        for (const [key, tiles] of Object.entries(by)) {
          const suit = Math.floor(+key / 9);
          if (tiles.length < 2 || bodies[suit] != null) continue;
          const r = await live(t, (a, b) => window.__game.act('match', a, b), tiles[0].i, tiles[1].i);
          const base = r.rec.filter((e) => e.k === 'src').map((e) => e.when).sort((a, b) => a - b)[0];
          const body = r.rec.filter((e) => e.k === 'param' && e.v >= 85 && e.v <= 235 && Math.abs(e.when - base - 0.28) < 0.002);
          if (body.length === 1) bodies[suit] = body[0].v;
        }
      }
      t.expect(Object.keys(bodies).length === 3, 'a pair of each of the three suits was matched: ' + JSON.stringify(bodies));
      t.expect(bodies[0] >= 90 && bodies[1] > bodies[0] * 1.15 && bodies[2] > bodies[1] * 1.15, 'the body rises with the suit: ' + [0, 1, 2].map((k) => Math.round(bodies[k])).join(' < ') + ' Hz');
    },
  },
  // ------------------------------------------------------------------ S5-07
  {
    name: 'S5-07: the win fanfare waits for the last clack, and it is a richer, fuller sound than a match',
    url: FLAT,
    viewports: ['desktop', 'mobile'],
    initScript: recorder,
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      await prime(t);
      await t.game('act', 'solveTo', 2);
      const pr = freePair(await t.state());
      const r = await live(t, (a, b) => window.__game.act('match', a, b), pr[0], pr[1]), p = rel(r.rec);
      t.equal((await t.game('audioState')).cues.win, 1, 'the win cue sounded');
      // The audio clock moves a few ms between two cues in one task, so a window of 25 ms stands for "at that moment".
      const at = 0.3 - 0.02 + 0.2; // the clack delay less the hiss lead, plus the beat after the clack
      const near = (x, c) => Math.abs(x - c) < 0.025, first = p.osc.filter((x) => x > 0.4).sort((a, b) => a - b)[0];
      t.expect(near(first, at), 'the fanfare starts 0.2 s after the last clack, at ' + at.toFixed(2) + ' s: it starts at ' + first.toFixed(3) + ' (all starts ' + p.osc.map((x) => +x.toFixed(2)).join(', ') + ')');
      t.expect(p.osc.filter((x) => near(x, first)).length >= 3, 'with the triangle, the sine and the bell of its first note together');
      t.expect(p.osc.filter((x) => Math.abs(x - (first + 0.6)) < 0.01).length >= 5, 'and the held chord of five voices comes 0.6 s into it');
      // measured: a win is no louder than 0.45 at the speakers, within the cue range in peak and well above a match in body
      const peaks = { match: [], win: [] }, rms = { match: [], win: [] };
      for (let seed = 101; seed <= 120; seed++) for (const n of ['match', 'win']) { const x = await t.game('audioRender', 'cue:' + n, 3, false, seed); peaks[n].push(x.peak); rms[n].push(x.rmsDb); }
      // Both medians come from seeded renders, so they are the same every run.
      t.expect(median(peaks.win) >= 0.2 && median(peaks.win) <= 0.45 && Math.max(...peaks.win.slice(0, 7)) <= 0.45, 'the win peaks at a median of ' + median(peaks.win) + ', inside 0.2 to 0.45 (the same for the first seven repeats)');
      t.expect(median(rms.win) >= median(rms.match) + 4, 'and its body (RMS ' + median(rms.win) + ' dB) is at least 4 dB over a match (' + median(rms.match) + ' dB)');
    },
  },
];

tests.push({
  name: 'S5-07: the score ticks as it counts up on the win card',
  url: FLAT,
  viewports: ['desktop'],
  async run(t) {
    await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
    await prime(t);
    const before = (await t.game('audioState')).cues.tick || 0;
    await t.game('act', 'solveTo', 0);
    await t.page.waitForSelector('#o-win.on', { timeout: 15000 });
    await t.page.waitForFunction(() => document.getElementById('ow-score').textContent.replace(/,/g, '') === String(window.__game.getState().score), null, { timeout: 5000 });
    const ticks = (await t.game('audioState')).cues.tick - before;
    t.expect(ticks >= 5 && ticks <= 14, 'about a dozen ticks (one every 70 ms for 0.9 s) as the score counts up: ' + ticks);
  },
});

// ---------------------------------------------------------------------- S1-08, S2-08, S2-12
const reload = async (t) => { await t.page.reload(); await t.page.waitForFunction(() => !!window.__game); await t.waitIdle(15000); };
tests.push(
  {
    name: 'S1-08: a mouse click on a covered tile stays on that tile and shakes it; a finger still reaches a free neighbour',
    url: FLAT,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const box = await t.page.evaluate(() => { const r = document.getElementById('board').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
      // a point on a covered tile, 3 px from the edge of a free one: raw lookups (tolerance 0) at x and at x + 3
      const state = await t.state();
      const spot = await t.page.evaluate(([box, tiles]) => {
        const at = (x, y) => window.__game.act('tileAt', x, y, 0);
        for (let y = 0; y < box.h; y += 2) for (let x = 0; x < box.w - 3; x++) {
          const a = at(box.x + x, box.y + y), b = at(box.x + x + 3, box.y + y);
          if (a >= 0 && b >= 0 && a !== b && !tiles[a].free && tiles[b].free && at(box.x + x + 1, box.y + y) === a) return { x: box.x + x, y: box.y + y, a, b };
        }
        return null;
      }, [box, state.tiles]);
      t.expect(!!spot, 'the deal has a covered tile 3 px from a free one');
      await t.page.mouse.click(spot.x, spot.y);
      let s = await t.state();
      t.expect(s.selected === -1 && /^Blocked/.test(s.status), 'the click on the covered tile does not select its free neighbour: selected ' + s.selected + ', "' + s.status + '"');
      t.equal(await t.game('act', 'tileAt', spot.x, spot.y, 9), spot.b, 'the finger-wide reach still finds the free neighbour (so a thumb near a seam works)');
    },
  },
  {
    name: 'S2-08: a free tile that does not match says so, the first five times, and still moves the selection',
    url: FLAT,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const s = await t.state(), seen = new Set(), run = [];
      for (const x of s.tiles) if (x.present && x.free && !seen.has(x.key)) { seen.add(x.key); run.push(x); }
      t.expect(run.length >= 8, 'the deal has at least 8 free tiles that differ (' + run.length + ')');
      await t.game('act', 'click', run[0].i);
      const said = [];
      for (let k = 1; k <= 7; k++) { await t.game('act', 'click', run[k].i); const st = await t.state(); said.push(/^Not a match: .* and .*\. .* is selected now\.$/.test(st.status)); t.equal(st.selected, run[k].i, 'the selection moves to the new tile'); if (k === 1) await t.shot('S2-08-not-a-match'); }
      t.equal(said, [true, true, true, true, true, false, false], 'the first five mismatches say so, the rest go back to the tile\'s own line');
      await t.game('newGame', { layout: 'pyramid', seed: 21 });
      const a = (await t.state()).tiles.find((x) => x.present && x.free);
      await t.game('act', 'click', a.i);
      t.expect(!/Not a match/.test((await t.state()).status), 'a first tap, with nothing selected, never says it');
    },
  },
  {
    name: 'S2-12: the Daily Puzzle button says what it is, and a second go at a finished puzzle asks first',
    url: FLAT,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const label = async () => (await t.page.locator('#b-daily').innerText()).replace(/\s+/g, ' ').trim();
      t.equal(await label(), 'Daily Puzzle Same board for all', 'before today\'s puzzle the button says it is one board for all');
      await t.shot('S2-12-daily-button');
      await t.game('newGame', { daily: true }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 0); await t.page.waitForSelector('#o-win.on', { timeout: 15000 });
      await t.page.click('#ow-title');
      t.expect(/^Daily Puzzle done \d+:\d\d$/.test(await label()), 'after it, the button says done and the time: ' + await label());
      await t.page.click('#b-daily');
      let s = await t.state();
      t.equal([s.scene, s.overlay], ['title', 'o-confirm'], 'pressing it again asks first');
      const d = await t.page.evaluate(() => ({ h: document.getElementById('oc-h').textContent, text: document.getElementById('oc-text').textContent, go: document.getElementById('oc-new').textContent, keep: document.getElementById('oc-keep').textContent }));
      t.equal([d.h, d.go, d.keep], ['Play it again?', 'Practice', 'Not now'], 'in its own words');
      t.expect(/finished today's puzzle/.test(d.text) && /practice/.test(d.text) && /records or streaks/.test(d.text), 'and says what practice means: ' + d.text);
      await t.shot('S2-12-practice-dialog');
      await t.page.click('#oc-keep');
      s = await t.state();
      t.equal([s.scene, s.overlay], ['title', null], 'Not now leaves the title as it was');
      await t.page.click('#b-daily'); await t.page.click('#oc-new'); await t.waitIdle(15000);
      s = await t.state();
      t.equal([s.scene, s.daily !== null, s.practice], ['game', true, true], 'Practice deals the same board as a practice game');
      // the dialog goes back to its own words when it asks the next question
      await t.game('newGame', { layout: 'pyramid', seed: 5 }); await t.waitIdle(15000);
      const pr = freePair(await t.state()); await t.game('act', 'match', pr[0], pr[1]);
      await t.game('scene', 'layouts'); await t.page.click('#cards .card[data-layout="tower"]');
      t.equal(await t.page.evaluate(() => [document.getElementById('oc-h').textContent, document.getElementById('oc-keep').textContent]), ['Abandon this game?', 'Keep playing'], 'a game in progress gets the usual question afterwards');
    },
  },
);
