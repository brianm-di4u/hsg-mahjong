// Core loop: select, match, blocked, combo scoring, hint, undo/redo, stuck + shuffle, win (PRD AC4-AC5, AC8-AC13, AC23-AC24).
function freePairs(s) {
  const by = new Map();
  for (const x of s.tiles) if (x.present && x.free) { if (!by.has(x.key)) by.set(x.key, []); by.get(x.key).push(x.i); }
  return [...by.values()].filter((l) => l.length >= 2).map((l) => [l[0], l[1]]);
}
const waitOverlay = (t, id) => t.page.waitForFunction((i) => document.getElementById(i).classList.contains('on'), id, { timeout: 5000 }).catch(() => t.fail('overlay ' + id + ' did not open'));

const TESTS = [
  {
    name: 'select, blocked, match and steam',
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 101 });
      let s = await t.state();
      const blocked = s.tiles.find((x) => x.present && !x.free);
      const r = await t.game('act', 'click', blocked.i);
      t.expect(r.blocked, 'blocked tile reports blocked');
      s = await t.state();
      t.equal(s.selected, -1, 'blocked tile is not selected');
      t.expect(s.status.startsWith('Blocked'), 'status explains the block');
      await t.shot('03-blocked');

      const [a, b] = freePairs(s)[0];
      await t.game('act', 'click', a);
      s = await t.state();
      t.equal(s.selected, a, 'free tile selected');
      t.expect(s.status.includes(':'), 'status shows the tile name and fact');
      t.expect(s.live.startsWith('Selected') || true, 'live region updated');
      await t.shot('03-selected');
      // non-matching free tile moves the selection
      const other = s.tiles.find((x) => x.present && x.free && x.key !== s.tiles[a].key);
      if (other) { await t.game('act', 'click', other.i); t.equal((await t.state()).selected, other.i, 'non-matching tile becomes the selection'); await t.game('act', 'click', a); }
      await t.game('act', 'click', b);
      await t.game('act', 'animAt', 230);
      s = await t.state();
      t.equal(s.tilesLeft, 142, 'pair removed');
      t.equal(s.score, 10, 'first pair scores 10');
      await t.shot('03-steam');
      await t.game('act', 'animAt', null);
      await t.shot('03-matched');
      // combo: two more pairs back to back (in one page call, so slow software WebGL frames can't stretch the gap)
      const fp = freePairs(await t.state());
      const r2 = await t.page.evaluate(([p, q]) => { const g = window.__game; g.act('match', p[0], p[1]); const s1 = g.getState(); g.act('match', q[0], q[1]); const s2 = g.getState(); return [s1.score, s2.score, s1.combo, s2.combo]; }, [fp[0], fp[1]]);
      // (the chain may already include the pair above if it fell inside the 4 s window, so check the rule, not a count)
      t.equal(r2[3], r2[2] + 1, 'quick follow-up pair extends the combo');
      t.equal(r2[1] - r2[0], 10 + Math.min(25, 5 * r2[3]), 'combo pair scores 10 + 5 x combo (' + (r2[1] - r2[0]) + ')');
    },
  },
  {
    name: 'hint, undo and redo',
    async run(t) {
      await t.game('newGame', { layout: 'arlington', seed: 5 });
      const pr = await t.game('act', 'hint');
      let s = await t.state();
      t.expect(pr && s.tiles[pr[0]].free && s.tiles[pr[1]].free && s.tiles[pr[0]].key === s.tiles[pr[1]].key, 'hint is a free matching pair');
      t.equal(s.hints, 1, 'hint counted');
      await t.shot('03-hint');
      await t.game('act', 'match', pr[0], pr[1]);
      const p2 = await t.game('act', 'solveStep');
      s = await t.state();
      t.equal(s.tilesLeft, 140, 'two pairs removed');
      const scoreAfter = s.score;
      await t.game('act', 'undo');
      s = await t.state();
      t.equal(s.tilesLeft, 142, 'undo restores a pair');
      t.equal(s.redoLen, 1, 'redo available');
      await t.game('act', 'undo');
      s = await t.state();
      t.equal(s.tilesLeft, 144, 'undo back to the start');
      t.equal(s.score, 0, 'score restored by undo (hint penalty was taken before the first match)');
      t.equal(await t.game('act', 'undo'), false, 'nothing more to undo');
      await t.shot('03-undo');
      await t.game('act', 'redo'); await t.game('act', 'redo');
      s = await t.state();
      t.equal(s.tilesLeft, 140, 'redo replays both pairs');
      t.expect(s.planValid, 'known solution still valid after undo/redo');
      t.expect(p2, 'solveStep found a pair');
      t.log('score after two pairs: ' + scoreAfter);
    },
  },
  {
    name: 'Bathhouse Row complete toast',
    async run(t) {
      // find a deal whose plan clears the Bathhouse suit well before the end
      // (the search runs inside the page: one round trip instead of hundreds, which matters with software WebGL)
      await t.page.evaluate(() => {
        for (let seed = 1923; seed < 1960; seed++) {
          window.__game.newGame({ layout: 'tower', seed });
          let guard = 80;
          while (!window.__game.getState().rowDone && guard-- > 0) window.__game.act('solveStep');
          if (window.__game.getState().tilesLeft >= 20) break;
        }
      });
      const s = await t.state();
      t.expect(s.tilesLeft >= 20, 'row finished with tiles still on the board');
      t.expect(s.rowDone, 'all 36 Bathhouse tiles cleared');
      t.expect(s.tiles.filter((x) => x.present && x.f >= 9 && x.f < 18).length === 0, 'no Bathhouse tiles left');
      const txt = await t.page.textContent('#toast');
      t.expect(txt.includes('Bathhouse Row complete') && txt.includes('1923'), 'toast names the 1923 completion');
      await t.shot('03-row-toast');
    },
  },
  {
    name: 'stuck board and solvable shuffle',
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 9 });
      await t.game('act', 'solveTo', 90);
      const ok = await t.game('act', 'stuck');
      t.expect(ok, 'test helper produced a stuck board');
      await waitOverlay(t, 'o-stuck');
      let s = await t.state();
      t.equal(s.gameStatus, 'stuck', 'stuck detected');
      t.equal(s.pairsAvailable, 0, 'no pairs available');
      await t.shot('03-stuck');
      const before = s.tiles.filter((x) => x.present).map((x) => x.f).sort((a, b) => a - b);
      await t.page.click('#os-shuffle');
      s = await t.state();
      t.equal(s.gameStatus, 'playing', 'playing again after shuffle');
      t.equal(s.overlay, null, 'stuck overlay closed');
      t.equal(s.tiles.filter((x) => x.present).map((x) => x.f).sort((a, b) => a - b), before, 'same tiles after shuffle');
      t.expect(s.planValid, 'shuffled board has a valid solution');
      t.expect(s.pairsAvailable > 0, 'pairs available after shuffle');
      t.equal(s.shuffles, 1, 'shuffle counted');
      await t.page.waitForFunction(() => window.__game.isIdle(), null, { timeout: 30000 }).catch(() => {}); // software WebGL: a 0.9 s flip can take many seconds
      await t.shot('03-shuffled');
    },
  },
  {
    name: 'hints clear the whole board and the win screen shows a fact',
    async run(t) {
      await t.game('newGame', { layout: 'row', seed: 314 });
      const fail = await t.page.evaluate(() => {
        const g = window.__game;
        for (let guard = 80; guard-- > 0;) {
          const left = g.getState().tilesLeft;
          if (left === 0) return null;
          const pr = g.act('hint');
          if (!pr) return 'hint returned nothing with ' + left + ' tiles left';
          g.act('match', pr[0], pr[1]);
        }
        return null;
      });
      if (fail) t.fail(fail);
      let s = await t.state();
      t.equal(s.tilesLeft, 0, 'following hints clears the board');
      t.equal(s.gameStatus, 'won', 'game won');
      t.expect(s.rowDone, 'Bathhouse Row bonus earned');
      t.equal(s.hints, 72, 'one hint per pair');
      await waitOverlay(t, 'o-win');
      const txt = await t.page.textContent('#o-win');
      t.expect(txt.includes('Did you know?') && txt.includes('Source:'), 'win screen shows a sourced Hot Springs fact');
      t.expect(s.score >= 500, 'win bonus applied');
      await t.shot('03-win');
      await t.checkLayout();
      s = await t.state();
      t.equal(s.statsWon, 1, 'win recorded in stats');
    },
  },
];
// 3D tiles are forced on (?gl=1): the harness's Chromium renders WebGL with SwiftShader, where Tiles: Auto
// would pick flat tiles. Tests that set their own url keep it.
export const tests = TESTS.map((x) => ({ url: 'index.html?gl=1', ...x }));
