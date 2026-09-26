import { describe, expect, it } from 'vitest';
import { makeCard, makeRng } from '../src/engine/cards';
import { defaultRules } from '../src/engine/rules';
import { applyBid, legalMoves, newHand, HandState } from '../src/engine/hand';
import { scoreHand } from '../src/engine/scoring';

const S = 0, H = 1, D = 3;
const c = makeCard;

function playState(): HandState {
  const h = newHand('ihale', defaultRules('ihale'), 3, makeRng(1));
  h.phase = 'play';
  h.trump = H;
  return h;
}

describe('kart atma kuralları', () => {
  it('renge uyma ve büyütme zorunlu', () => {
    const h = playState();
    h.hands[1] = [c(S, 5), c(S, 12), c(S, 14), c(D, 3)];
    h.trick = [{ seat: 0, card: c(S, 10) }];
    h.turn = 1;
    expect(legalMoves(h, 1).sort()).toEqual([c(S, 12), c(S, 14)].sort());
  });
  it('büyütemiyorsa küçük atabilir', () => {
    const h = playState();
    h.hands[1] = [c(S, 5), c(S, 3), c(D, 3)];
    h.trick = [{ seat: 0, card: c(S, 10) }];
    expect(legalMoves(h, 1).sort()).toEqual([c(S, 5), c(S, 3)].sort());
  });
  it('koz çakılmışsa renkte büyütme gerekmez', () => {
    const h = playState();
    h.hands[2] = [c(S, 5), c(S, 14)];
    h.trick = [{ seat: 0, card: c(S, 10) }, { seat: 1, card: c(H, 2) }];
    expect(legalMoves(h, 2).sort()).toEqual([c(S, 5), c(S, 14)].sort());
  });
  it('renk yoksa koz zorunlu, yerde koz varsa yükseltmek zorunlu', () => {
    const h = playState();
    h.hands[2] = [c(H, 4), c(H, 9), c(D, 14)];
    h.trick = [{ seat: 0, card: c(S, 10) }, { seat: 1, card: c(H, 6) }];
    expect(legalMoves(h, 2)).toEqual([c(H, 9)]);
  });
  it('koz kırılmadan kozla açılmaz', () => {
    const h = playState();
    h.hands[0] = [c(H, 4), c(H, 9), c(D, 14)];
    h.trick = [];
    expect(legalMoves(h, 0)).toEqual([c(D, 14)]);
    h.trumpBroken = true;
    expect(legalMoves(h, 0).length).toBe(3);
  });
});

describe('ihale', () => {
  it('herkes pas derse ilk konuşan en düşükle alır', () => {
    const h = newHand('ihale', defaultRules('ihale'), 3, makeRng(2));
    expect(h.turn).toBe(0);
    for (const s of [0, 1, 2, 3]) applyBid(h, s, null);
    expect(h.phase).toBe('trump');
    expect(h.bidder).toBe(0);
    expect(h.bid).toBe(5);
    expect(h.forced).toBe(true);
  });
  it('artırma turu', () => {
    const h = newHand('ihale', defaultRules('ihale'), 3, makeRng(2));
    applyBid(h, 0, 5);
    applyBid(h, 1, 6);
    applyBid(h, 2, null);
    applyBid(h, 3, null);
    expect(h.turn).toBe(0);
    applyBid(h, 0, 7);
    applyBid(h, 1, null);
    expect(h.phase).toBe('trump');
    expect(h.bidder).toBe(0);
    expect(h.bid).toBe(7);
  });
});

describe('puanlama', () => {
  it('tekli: batan ve el almayan eksi yazar', () => {
    const h = newHand('ihale', defaultRules('ihale'), 3, makeRng(3));
    h.bidder = 1; h.bid = 6; h.tricksWon = [0, 5, 4, 4];
    const r = scoreHand(h);
    expect(r.deltas).toEqual([-6, -6, 4, 4]);
  });
  it('eşli: takım toplamı ve savunma sınırı', () => {
    const h = newHand('esli', defaultRules('esli'), 3, makeRng(3));
    h.bidder = 0; h.bid = 8; h.tricksWon = [6, 1, 6, 0];
    const r = scoreHand(h);
    expect(r.deltas).toEqual([12, -8, 12, -8]);
  });
  it('koz maça: 10 x söz + fazla', () => {
    const h = newHand('kozmaca', defaultRules('kozmaca'), 3, makeRng(3));
    h.declared = [3, 0, 4, 2]; h.tricksWon = [5, 0, 3, 5];
    const r = scoreHand(h);
    expect(r.deltas).toEqual([32, 50, -40, 23]);
  });
});
