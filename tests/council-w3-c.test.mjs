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
