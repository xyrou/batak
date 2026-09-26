import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/engine/cards';
import { defaultRules, MODE_ORDER, ModeId } from '../src/engine/rules';
import { Difficulty, finishHand, newGame, redeal, startNextHand } from '../src/engine/game';
import { applyBid, applyBury, applyDeclare, applyPlay, applyTrump, decisionSeat } from '../src/engine/hand';
import { aiBid, aiBury, aiDeclare, aiPlay, aiTrump } from '../src/ai/decide';

function playGame(mode: ModeId, diff: Difficulty, seed: number, hands = 3) {
  const rng = makeRng(seed);
  const g = newGame({ mode, rules: defaultRules(mode), hands, names: ['A', 'B', 'C', 'D'], difficulty: diff, seed });
  let guard = 0;
  while (!g.over && guard++ < 100) {
    const h = g.hand;
    let steps = 0;
    while (h.phase !== 'done' && h.phase !== 'redeal' && steps++ < 400) {
      const { seat, controller } = decisionSeat(h);
      switch (h.phase) {
        case 'bidding': applyBid(h, seat, aiBid(h, seat, diff, rng)); break;
        case 'declare': applyDeclare(h, seat, aiDeclare(h, seat, diff, rng)); break;
        case 'trump': applyTrump(h, seat, aiTrump(h, seat, diff, rng)); break;
        case 'bury': applyBury(h, seat, aiBury(h, seat)); break;
        case 'play': applyPlay(h, seat, aiPlay(h, seat, controller, diff, rng)); break;
      }
    }
    if (h.phase === 'redeal') { redeal(g); continue; }
    expect(h.phase).toBe('done');
    const total = h.seats.reduce((a, s) => a + h.tricksWon[s], 0);
    expect(total).toBe(h.totalTricks);
    for (const s of h.seats) expect(h.hands[s].length).toBe(0);
    finishHand(g);
    if (!g.over) startNextHand(g);
  }
  expect(g.over).toBe(true);
  return g;
}

describe('tam oyun simülasyonu', () => {
  for (const mode of MODE_ORDER) {
    for (const diff of ['easy', 'medium', 'hard'] as Difficulty[]) {
      it(`${mode} / ${diff}`, () => {
        const n = diff === 'hard' ? 2 : 12;
        for (let i = 0; i < n; i++) playGame(mode, diff, 1000 + i * 17, diff === 'hard' ? 2 : 3);
      }, 120000);
    }
  }
});
