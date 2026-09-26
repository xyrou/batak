import { Card, Suit, rankOf, suitOf } from '../engine/cards';

/**
 * Bir elin verilen koz ile kaç el alabileceğine dair hızlı tahmin.
 * players: masadaki oyuncu sayısı (3 ya da 4)
 */
export function estimateTricks(hand: Card[], trump: Suit | -1, players = 4): number {
  const bySuit: number[][] = [[], [], [], []];
  for (const c of hand) bySuit[suitOf(c)].push(rankOf(c));
  for (const r of bySuit) r.sort((a, b) => b - a);

  const three = players === 3;
  let total = 0;
  const tl = trump >= 0 ? bySuit[trump].length : 0;

  for (let s = 0; s < 4; s++) {
    const r = bySuit[s];
    const len = r.length;
    if (len === 0) continue;
    const has = (x: number) => r.includes(x);
    if (s === trump) continue;
    let v = 0;
    if (has(14)) v += len >= 7 ? 0.8 : 0.95;
    if (has(13)) v += len >= 2 ? (has(14) ? 0.85 : three ? 0.7 : 0.6) : 0.15;
    if (has(12)) {
      if (len >= 3) v += has(14) || has(13) ? (three ? 0.55 : 0.45) : three ? 0.4 : 0.28;
      else v += 0.05;
    }
    if (has(11) && len >= 4 && (has(14) || has(13)) && has(12)) v += 0.3;
    // Uzun renkler: koz destekliyse sonradan el getirir
    if (len >= 5 && tl >= 4) v += (len - 4) * (three ? 0.4 : 0.3);
    total += v;
  }

  if (trump >= 0) {
    const r = bySuit[trump];
    const len = r.length;
    const has = (x: number) => r.includes(x);
    let hon = 0;
    let honCount = 0;
    if (has(14)) { hon += 1; honCount++; }
    if (has(13)) { hon += len >= 2 ? 0.9 : 0.5; honCount++; }
    if (has(12)) { hon += len >= 3 ? 0.75 : 0.3; honCount++; }
    if (has(11)) { hon += len >= 4 ? 0.5 : 0.15; honCount++; }
    const lengthTricks = Math.max(0, len - (three ? 4 : 3)) * 0.9;
    // Kısa renklerde koz çakma değeri
    let shortness = 0;
    for (let s = 0; s < 4; s++) {
      if (s === trump) continue;
      const l = bySuit[s].length;
      shortness += l === 0 ? 1.3 : l === 1 ? 0.8 : l === 2 ? 0.3 : 0;
    }
    const smallTrumps = Math.max(0, len - honCount);
    const ruff = Math.min(smallTrumps * 0.85, shortness) * 0.8;
    total += hon + lengthTricks + ruff;
  }
  return total;
}

/** En iyi koz ve tahmini */
export function bestTrump(hand: Card[], players = 4): { suit: Suit; est: number } {
  let best: Suit = 0;
  let bestEst = -1;
  for (let s = 0 as Suit; s < 4; s = (s + 1) as Suit) {
    const e = estimateTricks(hand, s, players);
    const len = hand.filter((c) => suitOf(c) === s).length;
    const score = e + len * 0.01;
    if (score > bestEst) {
      bestEst = score;
      best = s;
    }
  }
  return { suit: best, est: estimateTricks(hand, best, players) };
}
