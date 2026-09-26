import { Card, Rng, SPADES, Suit, rankOf, suitOf } from '../engine/cards';
import { HandState, bidRange, declareRange, legalMoves, partnerOf } from '../engine/hand';
import { Difficulty } from '../engine/game';
import { bestTrump, estimateTricks } from './estimate';
import { heuristicPlay } from './heuristic';
import { pimcPlay, simulateContract } from './pimc';
import { chooseBury } from './bury';

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

/** Oyuncunun kendi (ve eşli modda takımının) alabileceği el tahmini, en iyi koz ile */
function strength(h: HandState, seat: number, diff: Difficulty, rng: Rng): { suit: Suit; est: number } {
  const players = h.seats.length;
  if (diff === 'hard') {
    let best: Suit = 0;
    let bestEst = -1;
    const pre = bestTrump(h.hands[seat], players);
    // Formülle en umut verici iki kozu simüle et
    const ranked = ([0, 1, 2, 3] as Suit[])
      .map((s) => ({ s, e: estimateTricks(h.hands[seat], s, players) }))
      .sort((a, b) => b.e - a.e)
      .slice(0, 2);
    for (const { s } of ranked) {
      const e = mean(simulateContract(h, seat, s, 14, rng));
      if (e > bestEst) {
        bestEst = e;
        best = s;
      }
    }
    if (bestEst < 0) return pre;
    return { suit: best, est: bestEst };
  }
  const b = bestTrump(h.hands[seat], players);
  let est = b.est;
  if (h.mode === 'gommeli') est += 1.8; // yerden gelecek kartlar + gömme
  return { suit: b.suit, est };
}

export function aiBid(h: HandState, seat: number, diff: Difficulty, rng: Rng): number | null {
  const { min, max } = bidRange(h);
  if (min > max) return null;
  const st = strength(h, seat, diff, rng);
  let est = st.est;

  if (h.mode === 'esli') {
    const partner = partnerOf(h, seat);
    // Eşin ilk teklifi (benim teklifimi duymadan önceki) onun gücünü gösterir
    let partnerFirst = 0;
    for (const e of h.bidLog) {
      if (e.seat === partner && e.bid !== null) { partnerFirst = e.bid; break; }
    }
    if (h.highBidder === partner) {
      // Eşimin ihalesini gereksiz yere yükseltme: ancak kendi elim çok güçlüyse
      const own = diff === 'hard' ? est - 2.8 : est;
      if (own + 2.5 < min + 1) return null;
    }
    if (diff === 'hard') {
      // simülasyon takım elini rastgele bir eşle ölçer; eşin konuşmasına göre düzelt
      if (partnerFirst) est += Math.max(0, partnerFirst - 7) * 0.5 + 0.3;
      else if (h.passed[partner]) est -= 0.7;
    } else {
      let contrib = 2.6;
      if (partnerFirst) contrib = Math.max(2.6, partnerFirst - 3.0);
      else if (h.passed[partner]) contrib = 2.0;
      est += contrib;
    }
  }

  let aggression = 0.15;
  if (diff === 'easy') aggression = rng() * 2.4 - 1.0;
  if (diff === 'hard') aggression = 0.1;
  const target = Math.min(13, Math.floor(est + aggression));
  if (target < min) return null;
  if (diff === 'easy' && rng() < 0.25) return Math.min(target, max);
  return min;
}

export function aiTrump(h: HandState, seat: number, diff: Difficulty, rng: Rng): Suit {
  if (diff === 'easy' && rng() < 0.2) {
    // en uzun renk
    const len = [0, 0, 0, 0];
    for (const c of h.hands[seat]) len[suitOf(c)]++;
    return len.indexOf(Math.max(...len)) as Suit;
  }
  return strength(h, seat, diff, rng).suit;
}

export function aiBury(h: HandState, seat: number): Card[] {
  return chooseBury(h, seat);
}

export function aiDeclare(h: HandState, seat: number, diff: Difficulty, rng: Rng): number {
  const { min, max } = declareRange(h);
  const hand = h.hands[seat];
  const est = estimateTricks(hand, SPADES, 4);
  const hasHigh = hand.some((c) => rankOf(c) >= 13);
  const spades = hand.filter((c) => suitOf(c) === SPADES).length;
  const nilOk = min === 0 && est < 0.5 && !hasHigh && spades <= 2;

  if (diff === 'hard') {
    const dist = simulateContract(h, seat, SPADES, 24, rng);
    let bestD = 1;
    let bestEv = -Infinity;
    for (let d = 1; d <= 13; d++) {
      let ev = 0;
      for (const t of dist) ev += t >= d ? 10 * d + (t - d) : -10 * d;
      ev /= dist.length;
      if (ev > bestEv) {
        bestEv = ev;
        bestD = d;
      }
    }
    const p0 = dist.filter((t) => t === 0).length / dist.length;
    if (nilOk && p0 >= 0.35 && 100 * p0 - 50 > bestEv) return 0;
    return Math.max(min, Math.min(max, bestD));
  }
  if (nilOk && (diff === 'medium' || rng() < 0.5)) return 0;
  let d = Math.round(est - 0.2);
  if (diff === 'easy') d = Math.round(est + (rng() * 2 - 0.8));
  return Math.max(Math.max(1, min), Math.min(max, d));
}

export function aiPlay(h: HandState, seat: number, controller: number, diff: Difficulty, rng: Rng): Card {
  const legal = legalMoves(h, seat);
  if (legal.length === 1) return legal[0];
  if (diff === 'easy') {
    if (rng() < 0.3) return legal[Math.floor(rng() * legal.length)];
    return heuristicPlay(h, seat, controller, legal);
  }
  if (diff === 'medium') return heuristicPlay(h, seat, controller, legal);
  return pimcPlay(h, seat, controller, legal, rng);
}

/** Oyuncuya ipucu: zor seviye yapay zekânın önerisi */
export function hintFor(h: HandState, seat: number, controller: number, rng: Rng): Card {
  const legal = legalMoves(h, seat);
  if (legal.length === 1) return legal[0];
  return pimcPlay(h, seat, controller, legal, rng, 1600);
}
