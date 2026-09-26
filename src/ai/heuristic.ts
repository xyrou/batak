import { Card, Suit, rankOf, suitOf } from '../engine/cards';
import { HandState, beats, currentWinner, nextSeat, sameTeam } from '../engine/hand';
import { MODES } from '../engine/rules';

/**
 * Kural tabanlı kart seçimi (orta seviye yapay zekâ ve simülasyonların oyun politikası).
 * Yalnızca karar verenin görebildiği bilgiyi kullanır: kendi eli, açık eş eli,
 * oynanmış kartlar, herkesçe bilinen renk yoklukları.
 */
export function heuristicPlay(h: HandState, seat: number, me: number, legal: Card[]): Card {
  if (legal.length === 1) return legal[0];
  const k = new Knowledge(h, seat, me);
  if (h.trick.length === 0) return k.lead(legal);
  return k.follow(legal);
}

class Knowledge {
  h: HandState;
  seat: number;
  me: number;
  trump: Suit | -1;
  /** Dost ellerde (kendim / açık eşim) bulunan kartlar */
  friendly = new Uint8Array(52);
  /** Oyundan çıkmış olduğunu bildiğim kartlar (oynanan + benim gömdüklerim) */
  gone: Uint8Array;
  hostileVisible = -1;
  hand: Card[];

  constructor(h: HandState, seat: number, me: number) {
    this.h = h;
    this.seat = seat;
    this.me = me;
    this.trump = h.trump;
    this.hand = h.hands[seat];
    for (const c of h.hands[seat]) this.friendly[c] = 1;
    if (me !== seat) for (const c of h.hands[me]) this.friendly[c] = 1;
    if (h.dummy >= 0 && h.phase === 'play') {
      if (sameTeam(h, h.dummy, me)) for (const c of h.hands[h.dummy]) this.friendly[c] = 1;
      else this.hostileVisible = h.dummy;
    }
    this.gone = h.played;
    if (h.buried.length && me === h.bidder) {
      this.gone = h.played.slice();
      for (const c of h.buried) this.gone[c] = 1;
    }
  }

  isFriend(s: number) {
    return s === this.seat || s === this.me || sameTeam(this.h, s, this.me);
  }

  isNil(s: number) {
    return this.h.mode === 'kozmaca' && this.h.declared[s] === 0;
  }

  /** Bu karttan büyük, dost olmayan ellerde olabilecek kart sayısı */
  higherOut(c: Card): number {
    const s = suitOf(c);
    let n = 0;
    for (let r = rankOf(c) + 1; r <= 14; r++) {
      const x = s * 13 + r - 2;
      if (!this.gone[x] && !this.friendly[x]) n++;
    }
    return n;
  }

  unseen(suit: number): number {
    let n = 0;
    for (let r = 0; r < 13; r++) {
      const x = suit * 13 + r;
      if (!this.gone[x] && !this.friendly[x]) n++;
    }
    return n;
  }

  laterPlayers(): number[] {
    const out: number[] = [];
    const n = this.h.seats.length - this.h.trick.length - 1;
    let s = this.seat;
    for (let i = 0; i < n; i++) {
      s = nextSeat(this.h, s);
      out.push(s);
    }
    return out;
  }

  isVoid(p: number, suit: number) {
    return this.h.voids[p * 4 + suit] === 1;
  }

  /** p oyuncusu (sonra oynayacak) bu kartı geçebilir mi — temkinli tahmin */
  threatens(p: number, card: Card, led: Suit, hostileLater: number): boolean {
    if (this.isFriend(p)) return false;
    const trump = this.trump;
    if (p === this.hostileVisible) {
      const hp = this.h.hands[p];
      const hasLed = hp.some((x) => suitOf(x) === led);
      if (hasLed) return hp.some((x) => suitOf(x) === led && beats(x, card, led, trump));
      return trump !== -1 && hp.some((x) => suitOf(x) === trump && beats(x, card, led, trump));
    }
    const cs = suitOf(card);
    const voidL = this.isVoid(p, led);
    const voidT = trump === -1 || this.isVoid(p, trump);
    const trumpsOut = trump === -1 ? 0 : this.unseen(trump);
    const maybeVoidL = voidL || this.unseen(led) < hostileLater;
    if (trump !== -1 && cs === trump && led !== trump) {
      // koz çakılmış: ancak daha büyük kozla ve rengi yoksa geçilir
      return maybeVoidL && !voidT && this.higherOut(card) > 0;
    }
    // açılan renkte kart
    if (!voidL && this.higherOut(card) > 0) return true;
    if (trump !== -1 && led !== trump && maybeVoidL && !voidT && trumpsOut > 0) return true;
    return false;
  }

  safe(card: Card, led: Suit, later: number[]): boolean {
    const hostile = later.filter((p) => !this.isFriend(p)).length;
    for (const p of later) if (this.threatens(p, card, led, hostile)) return false;
    return true;
  }

  lowest(cards: Card[]): Card {
    let best = cards[0];
    for (const c of cards) {
      const a = this.cost(c);
      const b = this.cost(best);
      if (a < b) best = c;
    }
    return best;
  }

  /** Kazanmak için harcanan kartın "maliyeti": koz pahalı, sonra büyüklük */
  cost(c: Card): number {
    return rankOf(c) + (this.trump !== -1 && suitOf(c) === this.trump ? 20 : 0);
  }

  suitLen(suit: number): number {
    let n = 0;
    for (const c of this.hand) if (suitOf(c) === suit) n++;
    return n;
  }

  /** Eli kaybedeceğimiz durumda atılacak kart */
  dump(legal: Card[]): Card {
    const s0 = suitOf(legal[0]);
    if (legal.every((c) => suitOf(c) === s0)) {
      let lo = legal[0];
      for (const c of legal) if (rankOf(c) < rankOf(lo)) lo = c;
      return lo;
    }
    const haveTrumps = this.trump !== -1 && this.hand.some((c) => suitOf(c) === this.trump);
    let best = legal[0];
    let bestScore = Infinity;
    for (const c of legal) {
      const s = suitOf(c);
      let score = rankOf(c);
      if (this.trump !== -1 && s === this.trump) score += 25;
      if (this.higherOut(c) === 0 && rankOf(c) >= 10) score += 15;
      const len = this.suitLen(s);
      if (len === 1 && haveTrumps) score -= 4;
      if (len >= 5) score -= 1;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }

  follow(legal: Card[]): Card {
    const h = this.h;
    const trump = this.trump;
    const led = suitOf(h.trick[0].card);
    const win = currentWinner(h.trick, trump);
    const later = this.laterPlayers();

    if (this.isNil(this.seat)) {
      const losing = legal.filter((c) => !beats(c, win.card, led, trump));
      if (losing.length) {
        let hi = losing[0];
        for (const c of losing) if (this.cost(c) > this.cost(hi)) hi = c;
        return hi;
      }
      let hi = legal[0];
      for (const c of legal) if (this.cost(c) > this.cost(hi)) hi = c;
      return hi;
    }

    const winners = legal.filter((c) => beats(c, win.card, led, trump));
    const partnerWinning = win.seat !== this.seat && this.isFriend(win.seat);
    if (partnerWinning) {
      if (winners.length === 0 || this.safe(win.card, led, later)) return this.dump(legal);
      const safeWins = winners.filter((c) => this.safe(c, led, later));
      if (safeWins.length) return this.lowest(safeWins);
      return this.dump(legal);
    }

    // Rakibi el almaya zorlamak (koz maça'da "el almam" diyen rakip)
    if (this.isNil(win.seat) && !this.isFriend(win.seat)) {
      const losing = legal.filter((c) => !beats(c, win.card, led, trump));
      if (losing.length) return this.dump(losing);
    }

    if (winners.length) {
      const safeWins = winners.filter((c) => this.safe(c, led, later));
      if (safeWins.length) return this.lowest(safeWins);
      if (later.length === 0) return this.lowest(winners);
      if (suitOf(winners[0]) !== led) return this.lowest(winners); // koz çakma
      if (winners.length === legal.length) return this.lowest(winners);
      // Kaybetme riski yüksek: yüksek kartı harcama
      return this.dump(legal.filter((c) => !winners.includes(c)).length ? legal.filter((c) => !winners.includes(c)) : legal);
    }
    return this.dump(legal);
  }

  lead(legal: Card[]): Card {
    const h = this.h;
    const trump = this.trump;
    if (this.isNil(this.seat)) {
      let lo = legal[0];
      for (const c of legal) if (this.cost(c) < this.cost(lo)) lo = c;
      return lo;
    }
    const opps = h.seats.filter((s) => !this.isFriend(s));
    const trumpsOut = trump === -1 ? 0 : this.unseen(trump);
    const bidderSide =
      h.mode === 'kozmaca' || (MODES[h.mode].auction && h.bidder >= 0 && this.isFriend(h.bidder));

    // 1) Koz çekme
    if (trump !== -1 && trumpsOut > 0) {
      const myTrumps = legal.filter((c) => suitOf(c) === trump);
      if (myTrumps.length) {
        const bosses = myTrumps.filter((c) => this.higherOut(c) === 0);
        if (bosses.length && (bidderSide || myTrumps.length >= 3)) return this.lowest(bosses);
        if (bidderSide && myTrumps.length > trumpsOut && myTrumps.length >= 3 && myTrumps.length < legal.length) {
          return this.lowest(myTrumps);
        }
      }
    }

    // 2) Kesilme riski düşük olan patronlar (As vb.)
    const ruffRisk = (suit: number) => {
      if (trump === -1 || suit === trump || trumpsOut === 0) return false;
      for (const p of opps) {
        if (this.isVoid(p, suit) && !this.isVoid(p, trump)) return true;
        if (p === this.hostileVisible) {
          const hp = h.hands[p];
          if (!hp.some((x) => suitOf(x) === suit) && hp.some((x) => suitOf(x) === trump)) return true;
        }
      }
      return this.unseen(suit) < opps.length;
    };
    const sideBosses = legal.filter(
      (c) => (trump === -1 || suitOf(c) !== trump) && this.higherOut(c) === 0 && this.unseen(suitOf(c)) > 0,
    );
    const safeBosses = sideBosses.filter((c) => !ruffRisk(suitOf(c)));
    if (safeBosses.length) {
      let best = safeBosses[0];
      for (const c of safeBosses) if (rankOf(c) > rankOf(best)) best = c;
      return best;
    }

    // 3) Eşli: eşimin kesebileceği renk
    if (h.mode === 'esli' && trump !== -1) {
      const partner = (this.seat + 2) % 4;
      if (!this.isVoid(partner, trump)) {
        for (const c of legal) {
          const s = suitOf(c);
          if (s !== trump && this.isVoid(partner, s)) {
            const cands = legal.filter((x) => suitOf(x) === s);
            let lo = cands[0];
            for (const x of cands) if (rankOf(x) < rankOf(lo)) lo = x;
            return lo;
          }
        }
      }
    }

    // 4) Uygun renkten küçük kart
    let bestSuit = -1;
    let bestScore = -Infinity;
    for (let s = 0; s < 4; s++) {
      const cards = legal.filter((c) => suitOf(c) === s);
      if (!cards.length) continue;
      let score = 0;
      const len = cards.length;
      const ranks = cards.map(rankOf);
      const hasA = ranks.includes(14);
      const hasK = ranks.includes(13);
      const hasQ = ranks.includes(12);
      if (trump !== -1 && s === trump) score -= 6;
      if (hasK && !hasA && this.higherOut(s * 13 + 11) > 0) score -= 3;
      if (hasQ && !hasK && !hasA) score -= 1.5;
      score += len * 0.6;
      if (len === 1 && trump !== -1 && s !== trump && this.suitLen(trump) > 0) score += 1.5;
      if (ruffRisk(s)) score -= 4;
      // Rakiplerin kalmayan rengini açmamak
      if (score > bestScore) {
        bestScore = score;
        bestSuit = s;
      }
    }
    const cands = legal.filter((c) => suitOf(c) === bestSuit);
    let lo = cands[0];
    for (const c of cands) if (rankOf(c) < rankOf(lo)) lo = c;
    return lo;
  }
}
