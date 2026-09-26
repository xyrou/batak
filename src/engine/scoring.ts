import { HandState } from './hand';

export type SeatNote = 'yaptı' | 'battı' | 'el almadı' | 'aldı' | 'sınırın altında' | 'el almam tuttu' | 'el almam battı' | '';

export interface HandScore {
  deltas: number[];
  notes: SeatNote[];
  /** İhaleli modlarda ihaleci (takımı) ihalesini tuttu mu */
  bidderMade: boolean | null;
  /** King: 13 deyip 13 alan — oyunu doğrudan kazanır (koltuk) */
  kingSeat: number;
  /** Eşli modda takım başına el sayısı [takım0 (0-2), takım1 (1-3)] */
  teamTricks?: [number, number];
}

export function teamOf(seat: number): 0 | 1 {
  return (seat % 2) as 0 | 1;
}

export function scoreHand(h: HandState): HandScore {
  const deltas = [0, 0, 0, 0];
  const notes: SeatNote[] = ['', '', '', ''];
  const r = h.rules;
  let bidderMade: boolean | null = null;
  let kingSeat = -1;

  if (h.mode === 'kozmaca') {
    for (const s of h.seats) {
      const d = h.declared[s] ?? 0;
      const t = h.tricksWon[s];
      if (d === 0) {
        deltas[s] = t === 0 ? 50 : -50;
        notes[s] = t === 0 ? 'el almam tuttu' : 'el almam battı';
      } else if (t >= d) {
        deltas[s] = 10 * d + (t - d);
        notes[s] = 'yaptı';
      } else {
        deltas[s] = -10 * d;
        notes[s] = 'battı';
      }
    }
    return { deltas, notes, bidderMade, kingSeat };
  }

  if (h.mode === 'esli') {
    const bt = teamOf(h.bidder);
    const tt: [number, number] = [h.tricksWon[0] + h.tricksWon[2], h.tricksWon[1] + h.tricksWon[3]];
    const bTricks = tt[bt];
    const dTricks = tt[1 - bt];
    const made = bTricks >= h.bid;
    bidderMade = made;
    const bScore = made ? (r.bidderScore === 'bid' ? h.bid : bTricks) : -h.bid;
    const dFail = r.defenseMin > 0 && dTricks < r.defenseMin;
    const dScore = dFail ? -h.bid : dTricks;
    for (const s of h.seats) {
      if (teamOf(s) === bt) {
        deltas[s] = bScore;
        notes[s] = made ? 'yaptı' : 'battı';
      } else {
        deltas[s] = dScore;
        notes[s] = dFail ? 'sınırın altında' : 'aldı';
      }
    }
    if (r.king13 && h.bid >= 13 && bTricks >= 13) kingSeat = h.bidder;
    return { deltas, notes, bidderMade, kingSeat, teamTricks: tt };
  }

  // İhaleli (tekli) ve gömmeli
  for (const s of h.seats) {
    const t = h.tricksWon[s];
    if (s === h.bidder) {
      const made = t >= h.bid;
      bidderMade = made;
      deltas[s] = made ? (r.bidderScore === 'bid' ? h.bid : t) : -h.bid;
      notes[s] = made ? 'yaptı' : 'battı';
      if (r.king13 && h.bid >= 13 && t >= 13) kingSeat = s;
    } else if (t === 0) {
      deltas[s] = r.zeroTrickPenalty ? -h.bid : 0;
      notes[s] = 'el almadı';
    } else {
      deltas[s] = t;
      notes[s] = 'aldı';
    }
  }
  return { deltas, notes, bidderMade, kingSeat };
}

/** Yapay zekâ için: bir koltuğun bakış açısından el sonucunun değeri */
export function objectiveFor(h: HandState, seat: number, deltas: number[]): number {
  if (h.mode === 'esli') {
    const mine = deltas[seat];
    const theirs = deltas[(seat + 1) % 4];
    return mine - theirs;
  }
  let sum = 0;
  let n = 0;
  for (const s of h.seats) {
    if (s === seat) continue;
    sum += deltas[s];
    n++;
  }
  return deltas[seat] - sum / Math.max(1, n);
}
