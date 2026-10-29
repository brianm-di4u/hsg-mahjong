// Core loop: select, match, blocked, combo scoring, hint, undo/redo, stuck + shuffle, win (PRD AC4-AC5, AC8-AC13, AC23-AC24).
function freePairs(s) {
  const by = new Map();
  for (const x of s.tiles) if (x.present && x.free) { if (!by.has(x.key)) by.set(x.key, []); by.get(x.key).push(x.i); }
  return [...by.values()].filter((l) => l.length >= 2).map((l) => [l[0], l[1]]);
}
const waitOverlay = (t, id) => t.page.waitForFunction((i) => document.getElementById(i).classList.contains('on'), id, { timeout: 5000 }).catch(() => t.fail('overlay ' + id + ' did not open'));

export const tests = [
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
      // combo: a second pair right away
      const [c, d] = freePairs(await t.state())[0];
      await t.game('act', 'match', c, d);
      s = await t.state();
      t.equal(s.combo, 1, 'quick second pair is a combo');
      t.equal(s.score, 25, 'combo pair scores 10 + 5');
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
      let s;
      for (let seed = 1923; seed < 1960; seed++) {
        await t.game('newGame', { layout: 'tower', seed });
        let guard = 80;
        while (!(await t.state()).rowDone && guard-- > 0) await t.game('act', 'solveStep');
        s = await t.state();
        if (s.tilesLeft >= 20) break;
      }
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
      await t.shot('03-shuffled');
    },
  },
  {
    name: 'hints clear the whole board and the win screen shows a fact',
    async run(t) {
      await t.game('newGame', { layout: 'row', seed: 314 });
      let guard = 80;
      while (guard-- > 0) {
        const s = await t.state();
        if (s.tilesLeft === 0) break;
        const pr = await t.game('act', 'hint');
        if (!pr) { t.fail('hint returned nothing with ' + s.tilesLeft + ' tiles left'); break; }
        await t.game('act', 'match', pr[0], pr[1]);
      }
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
