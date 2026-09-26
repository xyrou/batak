import { makeRng, Rng } from './cards';
import { HandState, newHand, nextSeat, seatsFor } from './hand';
import { ModeId, RuleConfig } from './rules';
import { HandScore, scoreHand } from './scoring';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface GameConfig {
  mode: ModeId;
  rules: RuleConfig;
  hands: number;
  names: string[]; // 4 koltuk
  difficulty: Difficulty;
  seed?: number;
}

export interface HandSummary {
  no: number;
  dealer: number;
  bidder: number;
  bid: number;
  trump: number;
  forced: boolean;
  declared: (number | null)[];
  tricks: number[];
  score: HandScore;
  totals: number[];
}

export interface GameState {
  config: GameConfig;
  seats: number[];
  handNo: number;
  dealer: number;
  scores: number[];
  summaries: HandSummary[];
  hand: HandState;
  over: boolean;
  kingSeat: number;
  rng: Rng;
  redeals: number;
}

export function newGame(config: GameConfig, firstDealer?: number): GameState {
  const seed = config.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = makeRng(seed);
  const seats = seatsFor(config.mode);
  const dealer = firstDealer ?? seats[Math.floor(rng() * seats.length)];
  return {
    config,
    seats,
    handNo: 1,
    dealer,
    scores: [0, 0, 0, 0],
    summaries: [],
    hand: newHand(config.mode, config.rules, dealer, rng),
    over: false,
    kingSeat: -1,
    rng,
    redeals: 0,
  };
}

/** Herkes pas deyip yeniden dağıtım gerekiyorsa aynı dağıtıcı yeniden dağıtır */
export function redeal(g: GameState): void {
  g.redeals++;
  g.hand = newHand(g.config.mode, g.config.rules, g.dealer, g.rng);
}

/** El bitince puanları işler; oyun bittiyse over = true */
export function finishHand(g: GameState): HandSummary {
  const h = g.hand;
  const score = scoreHand(h);
  for (const s of g.seats) g.scores[s] += score.deltas[s];
  const summary: HandSummary = {
    no: g.handNo,
    dealer: h.dealer,
    bidder: h.bidder,
    bid: h.bid,
    trump: h.trump,
    forced: h.forced,
    declared: h.declared.slice(),
    tricks: h.tricksWon.slice(),
    score,
    totals: g.scores.slice(),
  };
  g.summaries.push(summary);
  if (score.kingSeat >= 0) {
    g.kingSeat = score.kingSeat;
    g.over = true;
  } else if (g.handNo >= g.config.hands) {
    g.over = true;
  }
  return summary;
}

export function startNextHand(g: GameState): void {
  g.handNo++;
  g.dealer = nextSeat({ seats: g.seats }, g.dealer);
  g.hand = newHand(g.config.mode, g.config.rules, g.dealer, g.rng);
}

/** Kazanan koltuklar (eşli modda takım) */
export function winners(g: GameState): number[] {
  if (g.kingSeat >= 0) {
    if (g.config.mode === 'esli') return [g.kingSeat, (g.kingSeat + 2) % 4];
    return [g.kingSeat];
  }
  let best = -Infinity;
  for (const s of g.seats) best = Math.max(best, g.scores[s]);
  return g.seats.filter((s) => g.scores[s] === best);
}

/** Sıralama (1. en yüksek puan) */
export function standings(g: GameState): { seat: number; score: number; place: number }[] {
  const arr = g.seats.map((s) => ({ seat: s, score: g.scores[s], place: 0 }));
  arr.sort((a, b) => b.score - a.score);
  let place = 0;
  let last = Infinity;
  arr.forEach((e, i) => {
    if (e.score !== last) {
      place = i + 1;
      last = e.score;
    }
    e.place = place;
  });
  return arr;
}
