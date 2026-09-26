import { Card, Rng, Suit, shuffle, suitOf } from '../engine/cards';
import {
  HandState, applyBury, applyPlay, applyTrump, cloneHand, controllerOf, legalMoves, sameTeam,
} from '../engine/hand';
import { MODES } from '../engine/rules';
import { objectiveFor, scoreHand } from '../engine/scoring';
import { heuristicPlay } from './heuristic';
import { chooseBury } from './bury';

/** Kalan eli sezgisel politika ile sonuna kadar oynatır */
export function rollout(h: HandState): void {
  let guard = 0;
  while (h.phase === 'play' && guard++ < 200) {
    const seat = h.turn;
    const ctrl = controllerOf(h, seat);
    const legal = legalMoves(h, seat);
    const card = heuristicPlay(h, seat, ctrl, legal);
    applyPlay(h, seat, card, false);
  }
}

/**
 * me koltuğunun bilgisiyle tutarlı rastgele bir dünya üretir: bilinmeyen kartlar
 * diğer oyunculara (renk yoklukları gözetilerek) dağıtılır.
 */
export function sampleWorld(h: HandState, me: number, rng: Rng): HandState {
  const w = cloneHand(h);
  const known = new Uint8Array(52);
  const knownSeats = new Set<number>([me]);
  for (const c of h.hands[me]) known[c] = 1;
  if (h.phase === 'play' && h.dummy >= 0) {
    knownSeats.add(h.dummy);
    for (const c of h.hands[h.dummy]) known[c] = 1;
  }
  // Yerden alınan (herkese gösterilen) kartlar ihalecinin elinde sabittir
  const fixed: Card[][] = [[], [], [], []];
  if (h.kittyTaken.length && h.bidder >= 0 && !knownSeats.has(h.bidder)) {
    for (const c of h.kittyTaken) {
      if (!h.played[c] && h.hands[h.bidder].includes(c)) {
        fixed[h.bidder].push(c);
        known[c] = 1;
      }
    }
  }
  if (me === h.bidder) for (const c of h.buried) known[c] = 1;

  const pool: Card[] = [];
  for (let c = 0; c < 52; c++) if (!known[c] && !h.played[c]) pool.push(c);

  const targets: number[] = [];
  const need: number[] = [0, 0, 0, 0];
  for (const s of h.seats) {
    if (knownSeats.has(s)) continue;
    targets.push(s);
    need[s] = h.hands[s].length - fixed[s].length;
  }
  // Kalan kartlar: yerdeki / gömülen kartlar (kimsenin elinde değil)
  const sinkCount = pool.length - targets.reduce((a, s) => a + need[s], 0);

  for (let attempt = 0; attempt < 30; attempt++) {
    shuffle(pool, rng);
    const cap = need.slice();
    let sink = sinkCount;
    const out: Card[][] = [[], [], [], []];
    let ok = true;
    const useVoids = attempt < 25;
    for (const c of pool) {
      const s = suitOf(c);
      let total = sink;
      for (const t of targets) if (cap[t] > 0 && (!useVoids || !h.voids[t * 4 + s])) total += cap[t];
      if (total <= 0) { ok = false; break; }
      let r = rng() * total;
      let chosen = -1;
      for (const t of targets) {
        if (cap[t] > 0 && (!useVoids || !h.voids[t * 4 + s])) {
          r -= cap[t];
          if (r < 0) { chosen = t; break; }
        }
      }
      if (chosen === -1) {
        sink--;
      } else {
        out[chosen].push(c);
        cap[chosen]--;
      }
    }
    if (!ok) continue;
    for (const t of targets) w.hands[t] = out[t].concat(fixed[t]);
    return w;
  }
  // Son çare: kısıt gözetmeden
  shuffle(pool, rng);
  let i = 0;
  for (const t of targets) {
    w.hands[t] = pool.slice(i, i + need[t]).concat(fixed[t]);
    i += need[t];
  }
  return w;
}

/** Mükemmel olmayan bilgiyle Monte Carlo: her aday kartı örnek dünyalarda sonuna kadar oynatır */
export function pimcPlay(h: HandState, seat: number, me: number, legal: Card[], rng: Rng, budget = 2400): Card {
  if (legal.length === 1) return legal[0];
  let cardsLeft = 0;
  for (const s of h.seats) cardsLeft += h.hands[s].length;
  const samples = Math.max(10, Math.min(48, Math.floor(budget / (legal.length * Math.max(4, cardsLeft) / 4))));
  const totals = new Float64Array(legal.length);
  for (let i = 0; i < samples; i++) {
    const w = sampleWorld(h, me, rng);
    for (let m = 0; m < legal.length; m++) {
      const sim = cloneHand(w);
      applyPlay(sim, seat, legal[m], false);
      rollout(sim);
      const sc = scoreHand(sim);
      totals[m] += objectiveFor(sim, me, sc.deltas) + 0.05 * teamTricks(sim, me);
    }
  }
  let best = 0;
  for (let m = 1; m < legal.length; m++) if (totals[m] > totals[best]) best = m;
  return legal[best];
}

function teamTricks(h: HandState, me: number): number {
  let t = 0;
  for (const s of h.seats) if (sameTeam(h, s, me)) t += h.tricksWon[s];
  return t;
}

/**
 * İhale aşamasında: me koltuğu verilen kozla ihaleyi alsaydı kaç el (takımıyla) alırdı?
 * Rastgele dağılımlarda sonuna kadar oynatılarak tahmin edilir. Dağılım döner.
 */
export function simulateContract(h: HandState, me: number, trump: Suit, samples: number, rng: Rng): number[] {
  const out: number[] = [];
  const def = MODES[h.mode];
  for (let i = 0; i < samples; i++) {
    const w = cloneHand(h);
    // Diğer eller + yer kartları yeniden dağıtılır
    const pool: Card[] = [];
    const mine = new Uint8Array(52);
    for (const c of h.hands[me]) mine[c] = 1;
    for (let c = 0; c < 52; c++) if (!mine[c]) pool.push(c);
    shuffle(pool, rng);
    let idx = 0;
    for (const s of h.seats) {
      if (s === me) continue;
      w.hands[s] = pool.slice(idx, idx + h.hands[s].length);
      idx += h.hands[s].length;
    }
    w.kitty = pool.slice(idx, idx + def.kitty);
    if (def.auction) {
      w.phase = 'trump';
      w.bidder = me;
      w.bid = Math.max(h.rules.minBid, h.highBid);
      w.highBidder = me;
      w.turn = me;
      applyTrump(w, me, trump);
      if ((w.phase as string) === 'bury') applyBury(w, me, chooseBury(w, me));
    } else {
      // Koz maça: herkes 1 söylemiş varsay
      w.declared = [1, 1, 1, 1];
      w.trump = trump;
      w.phase = 'play';
      w.leader = w.turn = h.seats[(h.seats.indexOf(h.dealer) + 1) % h.seats.length];
    }
    rollout(w);
    out.push(teamTricks(w, me));
  }
  return out;
}
