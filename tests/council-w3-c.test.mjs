// Council wave 3, batch C: difficulty, progression and records, feedback and teaching (S4-03, S4-04, S1-05, S1-06, S1-17, S2-05, S4-08, S1-11).
// Tests read the game through window.__game; the game clock is moved with act('advance') so no result depends on real time.
const URL = 'index.html?gl=0';
const play = async (t, n, sec = 10) => { for (let i = 0; i < n; i++) { await t.game('act', 'advance', sec * 1000); await t.game('act', 'solveStep'); } };
const waitWin = (t) => t.page.waitForSelector('#o-win.on', { timeout: 15000 });

export const tests = [
  // ------------------------------------------------------------------ S4-03
  {
    name: 'S4-03: the win card asks its question and answers it, with no "Did you know?" glued on, and the fact is one not read yet',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21, level: 'classic' }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 0); await waitWin(t);
      const c = await t.page.evaluate(() => ({ kick: document.querySelector('#ow-fact .kick').textContent, q: document.querySelector('#ow-fact .q').textContent, a: document.querySelector('#ow-fact .a').textContent, src: document.querySelector('#ow-fact .src').textContent, card: document.getElementById('o-win').innerText }));
      t.expect(c.q.endsWith('?') && !/Did you know/.test(c.card), 'the question stands alone: ' + c.q);
      t.expect(c.kick === 'Hot Springs question', 'under its own label: ' + c.kick);
      t.expect(/^Answer: /.test(c.a) && /^Source: /.test(c.src), 'the answer and the source follow: ' + c.a);
      const goals = await t.game('goals');
      t.equal(goals.wins.length, 1, 'the fact counts as read');
      await t.shot('S4-03-win-fact');
      await t.page.click('#ow-again'); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 0); await waitWin(t);
      const goals2 = await t.game('goals');
      t.equal([goals2.wins.length, new Set(goals2.wins).size], [2, 2], 'the next win shows a different fact');
    },
  },
];

// S4-04 sits here so the file keeps one order: records for the item, then the next
tests.push(
  {
    name: 'S4-04: the cleared board holds the screen for 1.5 s, then the card opens with a picture of the board and marks a first win',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21, level: 'classic' }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 2);
      const t0 = await t.page.evaluate(() => { window.__game.act('solveTo', 0); return Date.now(); });
      t.expect(!(await t.page.evaluate(() => document.getElementById('o-win').classList.contains('on'))), 'the card is not open the moment the board clears');
      await waitWin(t);
      const held = (await t.page.evaluate(() => Date.now())) - t0;
      t.expect(held >= 1450, 'the board was held for at least 1.5 s before the card (' + held + ' ms; it was 0.9 s)');
      const strip = await t.page.evaluate(() => {
        const cv = document.getElementById('ow-preview'), r = cv.getBoundingClientRect(), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let lit = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) lit++;
        return { w: r.width, h: r.height, lit, inside: r.top >= document.querySelector('#o-win .panel').getBoundingClientRect().top - 1 };
      });
      t.expect(strip.w > 200 && strip.h > 60 && strip.lit > 2000 && strip.inside, 'a picture of the board across the top of the card: ' + JSON.stringify(strip));
      const first = await t.page.evaluate(() => document.getElementById('ow-earned').innerText);
      t.expect(/First win on Classic Pyramid\./.test(first), 'the first win on a board is marked: ' + first);
      await t.shot('S4-04-win-card');
      await t.page.click('#ow-again'); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 0); await waitWin(t);
      const again = await t.page.evaluate(() => document.getElementById('ow-earned').innerText);
      t.expect(!/First win on/.test(again), 'a second win on the same board is not: ' + again);
      await t.page.click('#ow-again'); await t.waitIdle(15000);
      await t.game('newGame', { layout: 'pyramid', seed: 22, level: 'relaxed' }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 0); await waitWin(t);
      const relaxed = await t.page.evaluate(() => document.getElementById('ow-earned').innerText);
      t.expect(/First win on Classic Pyramid \(Relaxed\)\./.test(relaxed), 'each difficulty level has its own first win: ' + relaxed);
    },
  },
);

tests.push(
  // ------------------------------------------------------------------ S1-05
  {
    name: 'S1-05: pressing Hint again while its pair still shows is not charged again; a new pair is',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21, level: 'classic' }); await t.waitIdle(15000);
      await play(t, 12);
      let s = await t.state(); const base = s.score;
      await t.game('act', 'hint'); s = await t.state();
      t.equal([s.hints, s.fee.hint, s.score], [1, 40, base - 40], 'the first hint is charged');
      const pair = s.hint.slice();
      await t.game('act', 'animAt', 'now'); // the clock stands still, so the 8 s the pair shows for cannot run out between presses
      for (let k = 0; k < 3; k++) await t.game('act', 'hint');
      s = await t.state();
      t.equal([s.hints, s.fee.hint, s.score], [1, 40, base - 40], 'three more presses of Hint while it shows cost nothing');
      t.expect(/already paid for/.test(s.status), 'and the line says so: ' + s.status);
      t.equal(s.hint, pair, 'the same pair is still lit');
      await t.game('act', 'animAt', null);
      await t.game('act', 'solveStep'); await t.game('act', 'hint'); s = await t.state();
      t.equal([s.hints, s.fee.hint], [2, 80], 'after a match, the next hint is charged');
      await t.game('act', 'undo'); await t.game('act', 'hint'); s = await t.state();
      t.equal(s.hints, 3, 'after an undo, the next hint is charged');
    },
  },
  {
    name: 'S1-05: Shuffle (the S key or the button) asks first while pairs can be made; Keep playing changes nothing',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21, level: 'classic' }); await t.waitIdle(15000);
      await play(t, 12);
      const before = await t.state();
      t.expect(before.score >= 100, 'a score to lose');
      const open = () => t.page.evaluate(() => ({ on: document.getElementById('o-confirm').classList.contains('on'), h: document.getElementById('oc-h').textContent, text: document.getElementById('oc-text').textContent, go: document.getElementById('oc-new').textContent, focus: document.activeElement && document.activeElement.id }));
      if (t.viewport === 'desktop') await t.page.keyboard.press('s'); else await t.page.click('#t-shuffle');
      await t.page.waitForSelector('#o-confirm.on');
      let d = await open();
      t.expect(d.h === 'Shuffle the tiles?' && /You can still take [0-9]+ pairs?./.test(d.text) && d.text.includes('50 points') && d.go === 'Shuffle (−50)', 'the dialog says what a shuffle costs: ' + JSON.stringify(d));
      t.equal(d.focus, 'oc-keep', 'the safe choice has the focus, so an Enter does not shuffle');
      await t.shot('S1-05-shuffle-confirm');
      let s = await t.state();
      t.equal([s.shuffles, s.score, s.fee.shuffle], [0, before.score, 0], 'nothing has been shuffled or charged yet');
      await t.page.click('#oc-keep');
      s = await t.state();
      t.equal([s.shuffles, s.score], [0, before.score], 'Keep playing leaves the board and the score alone');
      if (t.viewport === 'desktop') await t.page.keyboard.press('s'); else await t.page.click('#t-shuffle');
      await t.page.waitForSelector('#o-confirm.on');
      await t.page.click('#oc-new');
      s = await t.state();
      t.equal([s.shuffles, s.fee.shuffle, s.score], [1, 50, before.score - 50], 'Shuffle (−50) shuffles and charges once');
      // the dialog is the same one New game uses: it says that again afterwards
      await t.page.evaluate(() => { document.getElementById('b-menu').click(); });
      await t.page.click('#op-new');
      d = await open();
      t.expect(d.h === 'Abandon this game?' && d.go === 'New game', 'New game still asks to abandon: ' + JSON.stringify(d));
    },
  },
  {
    name: 'S1-05: Relaxed shuffles at once, and the game hook shuffles directly',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21, level: 'relaxed' }); await t.waitIdle(15000);
      await play(t, 3);
      await t.page.keyboard.press('s');
      await t.waitIdle(15000);
      let s = await t.state();
      t.equal([s.overlay, s.shuffles], [null, 1], 'Relaxed has no cost to guard: S shuffles with no dialog');
      await t.game('newGame', { layout: 'pyramid', seed: 21, level: 'classic' }); await t.waitIdle(15000);
      await play(t, 3);
      await t.game('act', 'shuffle'); s = await t.state();
      t.equal([s.overlay, s.shuffles], [null, 1], 'the game hook shuffles directly, with no dialog');
    },
  },
);

tests.push(
  // ------------------------------------------------------------------ S1-06
  {
    name: 'S1-06: a thin bar under the Score shows the 4 s combo window running out, and clears when it is over',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const bar = () => t.page.evaluate(() => { const e = document.getElementById('h-combo'), r = e.getBoundingClientRect(), p = document.getElementById('h-score').parentElement.getBoundingClientRect(); return { on: e.classList.contains('on'), scale: +(/scaleX\(([\d.]+)\)/.exec(e.style.transform) || [0, -1])[1], w: r.width, inside: r.top >= p.bottom - 1 && r.bottom <= document.querySelector('.hud').getBoundingClientRect().bottom && p.width > 30 }; });
      await t.game('newGame', { layout: 'pyramid', seed: 21, level: 'classic' }); await t.waitIdle(15000);
      let b = await bar();
      t.equal(b.on, false, 'no bar before the first match');
      await t.game('act', 'solveStep');
      await t.game('pause'); // the real clock stops here, so only the moves of the game clock below change the bar
      b = await bar();
      t.expect(b.on && b.scale > 0.8, 'a match fills the bar: ' + JSON.stringify(b));
      await t.game('act', 'advance', 2000);
      await t.page.waitForFunction(() => { const m = /scaleX\(([\d.]+)\)/.exec(document.getElementById('h-combo').style.transform); return m && +m[1] < 0.7; }, null, { timeout: 15000 });
      b = await bar();
      t.expect(b.on && b.scale > 0.3 && b.scale < 0.65 && b.inside, 'two seconds on, about half the window is left, drawn just under the Score box, inside the bar of the HUD: ' + JSON.stringify(b));
      await t.game('resume');
      await t.shot('S1-06-combo-bar');
      await t.game('act', 'solveStep');
      b = await bar();
      t.expect(b.scale > 0.8, 'a quick next pair refills it: ' + b.scale);
      await t.game('act', 'advance', 4100);
      await t.page.waitForFunction(() => !document.getElementById('h-combo').classList.contains('on'), null, { timeout: 15000 });
      t.equal((await bar()).on, false, 'past four seconds the bar is gone');
      await t.game('act', 'solveStep');
      t.equal((await t.state()).combo, 0, 'and the next pair starts the count again, as the bar said');
      await t.game('act', 'undo');
      t.equal((await bar()).on, false, 'undoing it brings back the earlier window, which had run out');
      await t.game('act', 'solveStep'); await t.game('act', 'solveStep');
      await t.game('act', 'undo');
      b = await bar();
      t.expect(b.on && b.scale > 0.5, 'undoing a quick pair puts back the window of the pair before it, still open: ' + JSON.stringify(b));
    },
  },
);

const faces = async (t) => (await t.state()).tiles.map((x) => x.f);
tests.push(
  // ------------------------------------------------------------------ S1-17
  {
    name: 'S1-17: the layout picker takes a seed; the same seed deals the same tiles, and a bad one is refused',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 12345, level: 'classic' }); await t.waitIdle(15000);
      const want = await faces(t);
      await t.game('newGame', { layout: 'terraces', seed: 1 }); await t.waitIdle(15000); // any other game first, so the picker starts from the title
      await t.page.evaluate(() => document.getElementById('b-menu').click());
      await t.page.click('#op-title'); await t.page.click('#b-play');
      await t.page.waitForSelector('#s-layouts.on');
      await t.page.fill('#lb-seed', 'a1b2');
      t.equal(await t.page.inputValue('#lb-seed'), '12', 'only digits stay in the seed field');
      await t.page.fill('#lb-seed', '9999999999');
      await t.page.click('.card[data-layout="pyramid"]');
      t.expect(await t.page.evaluate(() => document.getElementById('s-layouts').classList.contains('on')) && /whole number up to 4294967295/.test(await t.page.textContent('#seed-note')), 'a seed over 4294967295 is refused and the rule is shown');
      await t.shot('S1-17-seed-field');
      await t.page.fill('#lb-seed', '12345');
      await t.page.click('.card[data-layout="pyramid"]');
      if (await t.page.evaluate(() => document.getElementById('o-confirm').classList.contains('on'))) await t.page.click('#oc-new');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game' && window.__game.getState().seed === 12345);
      await t.waitIdle(15000);
      const s = await t.state();
      t.equal([s.layoutId, s.seed], ['pyramid', 12345], 'the game starts on that layout and seed');
      t.equal(await faces(t), want, 'and deals exactly the tiles of that seed');
      t.equal(await t.page.inputValue('#lb-seed'), '', 'the field is emptied once used, so the next card is a new deal');
    },
  },
  {
    name: 'S1-17: the pause menu shows the seed, copies a link for the deal and replays it',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.page.evaluate(() => { window.__copied = []; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (x) => { window.__copied.push(x); return Promise.resolve(); } } }); });
      await t.game('newGame', { layout: 'pyramid', seed: 777, level: 'relaxed' }); await t.waitIdle(15000);
      const want = await faces(t);
      await play(t, 3);
      await t.page.evaluate(() => document.getElementById('b-menu').click());
      await t.page.waitForSelector('#o-pause.on');
      t.equal(await t.page.textContent('#op-seed'), 'Classic Pyramid · Relaxed · seed 777', 'the pause menu names the deal');
      await t.page.click('#op-link');
      await t.page.waitForFunction(() => /Link copied/.test(document.getElementById('op-note').textContent));
      const url = await t.page.evaluate(() => window.__copied[0]);
      t.expect(/index\.html\?layout=pyramid&seed=777&level=relaxed$/.test(url) && !/gl=0/.test(url), 'the link carries layout, seed and level and nothing else: ' + url);
      await t.shot('S1-17-pause-share');
      await t.page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('no')) } }); });
      await t.page.click('#op-link');
      await t.page.waitForFunction(() => /Copy this link to share the deal: /.test(document.getElementById('op-note').textContent));
      t.expect((await t.page.textContent('#op-note')).includes(url), 'when the browser refuses, the link is shown to copy by hand');
      await t.page.click('#op-replay');
      await t.page.waitForSelector('#o-confirm.on');
      t.expect(/ends this one/.test(await t.page.textContent('#oc-text')), 'a game with moves asks before it is replaced');
      await t.page.click('#oc-new');
      await t.page.waitForFunction(() => window.__game.getState().tilesLeft === window.__game.getState().total);
      const s = await t.state();
      t.equal([s.seed, s.level, s.scene, s.overlay], [777, 'relaxed', 'game', null], 'Replay starts the same deal again at the same level');
      t.equal(await faces(t), want, 'with the same tiles');
    },
  },
  {
    name: 'S1-17: a shared link opens the deal it names',
    url: 'index.html?gl=0&layout=row&seed=424242&level=expert',
    viewports: ['desktop'],
    async run(t) {
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game');
      const s = await t.state();
      t.equal([s.layoutId, s.seed, s.level], ['row', 424242, 'expert'], 'layout, seed and level come from the link');
      const search = await t.page.evaluate(() => location.search);
      t.equal(search, '?gl=0', 'the link is taken out of the address afterwards, so a reload does not offer it again; other settings stay');
    },
  },
  {
    name: 'S1-17: a damaged link is ignored, and a link to a board still locked opens the picker with its seed in the field',
    url: 'index.html?gl=0&layout=nowhere&seed=5',
    viewports: ['desktop'],
    async run(t) {
      let s = await t.state();
      t.equal(s.scene, 'title', 'an unknown layout leaves the title screen alone');
      await t.page.goto(t.page.url().replace(/\?.*$/, '') + '?gl=0&layout=pyramid&seed=12abc');
      await t.page.waitForFunction(() => !!window.__game);
      t.equal((await t.state()).scene, 'title', 'a seed that is not a number leaves it alone');
      await t.page.goto(t.page.url().replace(/\?.*$/, '') + '?gl=0&layout=westmtn&seed=99');
      await t.page.waitForFunction(() => !!window.__game && window.__game.getState().scene === 'layouts');
      t.equal([(await t.state()).scene, await t.page.inputValue('#lb-seed')], ['layouts', '99'], 'a locked board opens the picker with the seed filled in');
    },
  },
);

tests.push(
  // ------------------------------------------------------------------ S2-05
  {
    name: 'S2-05: the HUD counts moves (pairs that can come off), not every way of choosing two free twins',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      // a deal with three or more free twins of one kind, found by looking through seeds inside the page (the deals are seeded, so it is always the same one)
      const seed = await t.page.evaluate(() => {
        for (let seed = 1; seed < 400; seed++) {
          window.__game.newGame({ layout: 'row', seed, level: 'classic' });
          const c = new Map(); for (const x of window.__game.getState().tiles) if (x.present && x.free) c.set(x.key, (c.get(x.key) || 0) + 1);
          if ([...c.values()].some((n) => n >= 3)) return seed;
        }
        return 0;
      });
      t.expect(seed > 0, 'a deal with three free twins exists in the first 400 seeds');
      await t.waitIdle(15000);
      const s = await t.state();
      const c = new Map(); for (const x of s.tiles) if (x.present && x.free) c.set(x.key, (c.get(x.key) || 0) + 1);
      const moves = [...c.values()].reduce((a, n) => a + Math.floor(n / 2), 0);
      const hud = await t.page.evaluate(() => ({ n: +document.getElementById('h-pairs').textContent, label: document.getElementById('h-pairs').nextElementSibling.textContent, title: document.getElementById('h-pairs').parentElement.title }));
      t.expect(s.pairsAvailable > moves, 'the old count (' + s.pairsAvailable + ') is bigger than the number of pairs that can come off (' + moves + ') on this deal');
      t.equal([hud.n, hud.label], [moves, 'Moves'], 'the HUD shows the number that can come off, under the label Moves');
      t.equal(hud.title, 'Pairs you can take now', 'and says so when hovered');
      await t.game('act', 'solveStep');
      const s2 = await t.state(), c2 = new Map(); for (const x of s2.tiles) if (x.present && x.free) c2.set(x.key, (c2.get(x.key) || 0) + 1);
      t.equal(+(await t.page.textContent('#h-pairs')), [...c2.values()].reduce((a, n) => a + Math.floor(n / 2), 0), 'and it follows each move');
      await t.shot('S2-05-moves-hud');
      await t.page.evaluate(() => document.getElementById('b-menu').click()); await t.page.click('#op-help');
      const help = await t.page.textContent('#o-help');
      t.expect(/Moves<?.*counter|Moves counter/.test(help) && /eye button, Free, turns the glow on free tiles on or off/.test(help), 'How to Play explains Moves and the eye button');
    },
  },
);

tests.push(
  // ------------------------------------------------------------------ S4-08
  {
    name: 'S4-08: the Row toast names the Bathhouse tile that finished the Row, whichever it was; the guide counts eight bathhouses and the Administration Building',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      const names = (await t.game('act', 'faceMeta')).slice(9, 18).map((m) => m.name.split(': ')[1]);
      t.equal(names.length, 9, 'nine Bathhouse faces');
      // play seeded deals along their plans until the Row is done, and note which face the last pair of the suit was
      const runs = await t.page.evaluate(() => {
        const g = window.__game, out = [];
        for (let seed = 1; seed <= 24; seed++) {
          g.newGame({ layout: 'tower', seed, level: 'classic' });
          let guard = 80, last = -1;
          while (!g.getState().rowDone && guard-- > 0) {
            const before = g.getState().tiles.map((x) => x.present);
            g.act('solveStep');
            const s = g.getState();
            if (s.rowDone) { const gone = s.tiles.filter((x, i) => before[i] && !x.present); last = gone[0].f; out.push({ seed, face: last, toast: document.getElementById('toast').textContent }); }
          }
        }
        return out;
      });
      t.expect(runs.length >= 20, 'the Row was finished on at least 20 of 24 deals (' + runs.length + ')');
      const bad = runs.filter((r) => r.toast !== 'Bathhouse Row complete! The last tile was the ' + names[r.face - 9] + '. +100');
      t.equal(bad, [], 'every toast names the tile that really finished the Row');
      t.expect(new Set(runs.map((r) => r.face)).size >= 3 && runs.some((r) => r.face !== 16), 'and they differ: ' + [...new Set(runs.map((r) => names[r.face - 9]))].join(', '));
      await t.page.evaluate(() => document.getElementById('b-menu').click()); await t.page.click('#op-help');
      t.expect(/the eight bathhouses of the Row from north to south, then the Administration Building/.test(await t.page.textContent('#o-help')), 'How to Play says what the ninth Bathhouse is');
    },
  },
);

const coachState = (t) => t.page.evaluate(() => {
  const c = document.getElementById('coach'), r = c.getBoundingClientRect(), w = document.getElementById('board-wrap').getBoundingClientRect();
  return { hidden: c.hidden, text: c.textContent, top: r.top - w.top, h: r.height, inside: r.left >= w.left && r.right <= w.right && r.bottom <= w.bottom + 1, none: getComputedStyle(c).pointerEvents, btn: getComputedStyle(document.getElementById('coach-ok')).pointerEvents };
});
const FIRST = (t) => t.viewport === 'mobile' ? 'terraces' : 'pyramid';
tests.push(
  // ------------------------------------------------------------------ S1-11
  {
    name: 'S1-11: the first game of a new profile says how a game goes and pulses a free pair at no charge; the first match clears it',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { layout: FIRST(t), seed: 21, level: 'classic' }); await t.waitIdle(15000);
      let c = await coachState(t), s = await t.state();
      t.expect(!c.hidden && /Tap a bright tile, then its twin/.test(c.text) && /Any Flower matches any Flower, and any Season any Season/.test(c.text) && /Hint shows a pair for −40 points/.test(c.text), 'the card teaches free tiles, the wildcards and the hint: ' + c.text);
      t.expect(c.inside && c.h < 220, 'it sits inside the board area and is not tall (' + Math.round(c.h) + ' px)');
      t.equal([c.none, c.btn], ['none', 'auto'], 'taps pass through the card to the tiles; its two buttons take taps');
      t.expect(Array.isArray(s.hint) && s.hint.length === 2 && s.tiles[s.hint[0]].free && s.tiles[s.hint[1]].free, 'one free pair is pulsing: ' + JSON.stringify(s.hint));
      t.equal([s.hints, s.score, s.fee.hint], [0, 0, 0], 'and it cost nothing and counts as no hint');
      const ys = [];
      for (const i of s.hint) { const p = await t.game('act', 'screenCenter', i); const r = await t.page.evaluate(() => document.getElementById('board').getBoundingClientRect().top - document.getElementById('board-wrap').getBoundingClientRect().top); ys.push(p[1] + r); }
      t.expect(Math.max(...ys) < c.top, 'the pulsing pair is above the card, not under it (' + ys.map(Math.round) + ' against ' + Math.round(c.top) + ')');
      await t.shot('S1-11-coach');
      await t.game('act', 'hint'); s = await t.state();
      t.equal(s.hints, 1, 'a real press of Hint is still a hint');
      await t.game('act', 'solveStep');
      t.equal((await coachState(t)).hidden, true, 'the first match takes the card away');
      await t.game('newGame', { layout: FIRST(t), seed: 22, level: 'classic' });
      t.equal((await coachState(t)).hidden, true, 'and the next game does not show it again');
    },
  },
  {
    name: 'S1-11: Got it puts the card away, and a profile that has started a game is not shown it again',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { layout: FIRST(t), seed: 21, level: 'classic' }); await t.waitIdle(15000);
      await t.page.click('#coach-ok');
      t.equal([(await coachState(t)).hidden, (await t.state()).overlay], [true, null], 'Got it hides the card');
      await t.page.reload(); await t.page.waitForFunction(() => !!window.__game); await t.waitIdle(15000);
      await t.game('newGame', { layout: FIRST(t), seed: 21, level: 'classic' }); await t.waitIdle(15000);
      t.equal((await coachState(t)).hidden, true, 'a profile that has started a game is not shown it again');
    },
  },
  {
    name: 'S1-11: How to Play on the card opens the rules; Expert names free tiles without the glow and has no hints; a profile with games played never sees it',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21, level: 'expert' }); await t.waitIdle(15000);
      const c = await coachState(t);
      t.expect(/Tap a free tile, then its twin/.test(c.text) && /Hints are off in Expert/.test(c.text) && !/bright/.test(c.text), 'Expert: ' + c.text);
      await t.page.click('#coach-help');
      t.equal([(await coachState(t)).hidden, (await t.state()).overlay], [true, 'o-help'], 'How to Play opens the rules and puts the card away');
      await t.page.keyboard.press('Escape');
      // a profile with a record never sees it, and Continue (a game from a save) never shows it
      await t.page.evaluate(() => localStorage.setItem('bhm.stats.v1', JSON.stringify({ played: 5, won: 1 })));
      await t.page.reload(); await t.page.waitForFunction(() => !!window.__game); await t.waitIdle(15000);
      await t.game('newGame', { layout: 'pyramid', seed: 23, level: 'classic' }); await t.waitIdle(15000);
      t.equal((await coachState(t)).hidden, true, 'a profile with games played is not shown it');
    },
  },
);
