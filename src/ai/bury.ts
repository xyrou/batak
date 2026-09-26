import { Card, Suit, rankOf, suitOf } from '../engine/cards';
import { BURY_COUNT, HandState } from '../engine/hand';
import { estimateTricks } from './estimate';

/** Gömülecek 4 kartı seçer: kalan elin tahmini gücünü en yükseğe çıkaran kombinasyon */
export function chooseBury(h: HandState, seat: number): Card[] {
  const hand = h.hands[seat];
  const trump = h.trump as Suit;
  const n = hand.length;
  let best: Card[] = [];
  let bestScore = -Infinity;
  const rest: Card[] = [];
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++) {
          rest.length = 0;
          for (let i = 0; i < n; i++) if (i !== a && i !== b && i !== c && i !== d) rest.push(hand[i]);
          const bury = [hand[a], hand[b], hand[c], hand[d]];
          let score = estimateTricks(rest, trump, 3);
          // Koz ve as gömmek genelde kötü: küçük ceza
          for (const x of bury) {
            if (suitOf(x) === trump) score -= 0.25;
            if (rankOf(x) === 14) score -= 0.4;
          }
          if (score > bestScore) {
            bestScore = score;
            best = bury;
          }
        }
  if (best.length !== BURY_COUNT) best = hand.slice(0, BURY_COUNT);
  return best;
}
