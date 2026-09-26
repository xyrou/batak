import { Card, Suit, SPADES, fullDeck, rankOf, shuffle, suitOf, Rng } from './cards';
import { MODES, ModeId, RuleConfig } from './rules';

export type Phase = 'bidding' | 'trump' | 'bury' | 'declare' | 'play' | 'done' | 'redeal';

export interface Play { seat: number; card: Card }
export interface TrickRecord { leader: number; plays: Play[]; winner: number }

export interface HandState {
  mode: ModeId;
  rules: RuleConfig;
  /** Aktif koltuklar, oynama sırasına göre (saat yönünün tersi): 0 alt, 1 sağ, 2 üst, 3 sol */
  seats: number[];
  dealer: number;
  hands: Card[][];
  kitty: Card[];
  buried: Card[];
  /** Yerden alınıp herkese gösterilen kartlar (gömmeli) */
  kittyTaken: Card[];
  phase: Phase;
  turn: number;
  // ihale
  highBid: number;
  highBidder: number;
  passed: boolean[];
  bidLog: { seat: number; bid: number | null }[];
  forced: boolean;
  // söz (koz maça)
  declared: (number | null)[];
  // sözleşme
  bidder: number;
  bid: number;
  trump: Suit | -1;
  dummy: number;
  // oyun
  trick: Play[];
  leader: number;
  tricksWon: number[];
  history: TrickRecord[];
  trumpBroken: boolean;
  played: Uint8Array;
  /** seat*4 + suit = 1 ise o oyuncunun o renkte kartı kalmadığı herkesçe bilinir */
  voids: Uint8Array;
  totalTricks: number;
}

export function seatsFor(mode: ModeId): number[] {
  return MODES[mode].players === 3 ? [0, 1, 3] : [0, 1, 2, 3];
}

export function nextSeat(h: { seats: number[] }, seat: number): number {
  const i = h.seats.indexOf(seat);
  return h.seats[(i + 1) % h.seats.length];
}

export function partnerOf(h: { mode: ModeId }, seat: number): number {
  return h.mode === 'esli' ? (seat + 2) % 4 : -1;
}

export function sameTeam(h: { mode: ModeId }, a: number, b: number): boolean {
  if (a === b) return true;
  return h.mode === 'esli' && (a + 2) % 4 === b;
}

export function newHand(mode: ModeId, rules: RuleConfig, dealer: number, rng: Rng): HandState {
  const def = MODES[mode];
  const seats = seatsFor(mode);
  const deck = shuffle(fullDeck(), rng);
  const hands: Card[][] = [[], [], [], []];
  const kitty: Card[] = [];
  // Dağıtım dağıtanın sağından başlar
  const order: number[] = [];
  let s = dealer;
  for (let i = 0; i < seats.length; i++) {
    s = seats[(seats.indexOf(s) + 1) % seats.length];
    order.push(s);
  }
  let idx = 0;
  if (def.kitty > 0) {
    for (let k = 0; k < def.kitty; k++) kitty.push(deck[idx++]);
  }
  for (let r = 0; r < def.cardsEach; r++) {
    for (const seat of order) hands[seat].push(deck[idx++]);
  }
  const first = order[0];
  const h: HandState = {
    mode, rules, seats, dealer, hands, kitty, buried: [], kittyTaken: [],
    phase: def.auction ? 'bidding' : 'declare',
    turn: first,
    highBid: 0, highBidder: -1, passed: [false, false, false, false], bidLog: [], forced: false,
    declared: [null, null, null, null],
    bidder: -1, bid: 0, trump: def.fixedTrump === -1 ? -1 : (def.fixedTrump as Suit), dummy: -1,
    trick: [], leader: first, tricksWon: [0, 0, 0, 0], history: [], trumpBroken: false,
    played: new Uint8Array(52), voids: new Uint8Array(16),
    totalTricks: def.cardsEach,
  };
  return h;
}

/** Deste dağıtım sırası (animasyon için): [koltuk, kart] listesi */
export function dealOrder(h: HandState): { seat: number; card: Card }[] {
  const out: { seat: number; card: Card }[] = [];
  const order: number[] = [];
  let s = h.dealer;
  for (let i = 0; i < h.seats.length; i++) {
    s = nextSeat(h, s);
    order.push(s);
  }
  const n = MODES[h.mode].cardsEach;
  for (let r = 0; r < n; r++) for (const seat of order) out.push({ seat, card: h.hands[seat][r] });
  return out;
}

// ─── İhale ──────────────────────────────────────────────────────────────

export function bidRange(h: HandState): { min: number; max: number } {
  const min = h.highBidder >= 0 ? h.highBid + 1 : h.rules.minBid;
  return { min, max: 13 };
}

export function applyBid(h: HandState, seat: number, bid: number | null): void {
  if (h.phase !== 'bidding') throw new Error('İhale aşamasında değil');
  if (seat !== h.turn) throw new Error('Sıra bu oyuncuda değil');
  if (bid !== null) {
    const { min, max } = bidRange(h);
    if (bid < min || bid > max) throw new Error(`Geçersiz ihale: ${bid}`);
    h.highBid = bid;
    h.highBidder = seat;
  } else {
    h.passed[seat] = true;
  }
  h.bidLog.push({ seat, bid });

  const active = h.seats.filter((s) => !h.passed[s]);
  if (h.highBidder >= 0 && (active.length === 1 || h.highBid >= 13)) {
    finishAuction(h, h.highBidder, h.highBid, false);
    return;
  }
  if (active.length === 0) {
    if (h.rules.allPass === 'redeal') {
      h.phase = 'redeal';
      return;
    }
    finishAuction(h, nextSeat(h, h.dealer), h.rules.minBid, true);
    return;
  }
  let n = nextSeat(h, seat);
  while (h.passed[n]) n = nextSeat(h, n);
  h.turn = n;
}

function finishAuction(h: HandState, bidder: number, bid: number, forced: boolean) {
  h.bidder = bidder;
  h.bid = bid;
  h.highBid = bid;
  h.highBidder = bidder;
  h.forced = forced;
  h.phase = 'trump';
  h.turn = bidder;
}

export function applyTrump(h: HandState, seat: number, suit: Suit): void {
  if (h.phase !== 'trump' || seat !== h.bidder) throw new Error('Koz seçimi sırası değil');
  h.trump = suit;
  if (h.mode === 'esli' && h.rules.openDummy) h.dummy = partnerOf(h, h.bidder);
  if (h.mode === 'gommeli') {
    h.phase = 'bury';
    if (h.rules.buryMode === 'open') takeKitty(h);
    return;
  }
  startPlay(h);
}

function takeKitty(h: HandState) {
  h.hands[h.bidder].push(...h.kitty);
  h.kittyTaken = h.kitty.slice();
  h.kitty = [];
}

export const BURY_COUNT = 4;

export function applyBury(h: HandState, seat: number, cards: Card[]): void {
  if (h.phase !== 'bury' || seat !== h.bidder) throw new Error('Gömme sırası değil');
  if (cards.length !== BURY_COUNT) throw new Error('4 kart gömülmeli');
  const hand = h.hands[seat];
  for (const c of cards) {
    const i = hand.indexOf(c);
    if (i < 0) throw new Error('Elde olmayan kart gömülemez');
    hand.splice(i, 1);
  }
  h.buried = cards.slice();
  if (h.rules.buryMode === 'blind') takeKitty(h);
  startPlay(h);
}

// ─── Söz (Koz Maça) ─────────────────────────────────────────────────────

export function declareRange(h: HandState): { min: number; max: number } {
  return { min: h.rules.allowNil ? 0 : 1, max: 13 };
}

export function applyDeclare(h: HandState, seat: number, n: number): void {
  if (h.phase !== 'declare' || seat !== h.turn) throw new Error('Söz sırası değil');
  const { min, max } = declareRange(h);
  if (n < min || n > max) throw new Error('Geçersiz söz');
  h.declared[seat] = n;
  h.bidLog.push({ seat, bid: n });
  const next = nextSeat(h, seat);
  if (h.declared[next] !== null) {
    h.trump = SPADES;
    startPlay(h);
  } else {
    h.turn = next;
  }
}

function startPlay(h: HandState) {
  h.phase = 'play';
  const auction = MODES[h.mode].auction;
  h.leader = auction && h.rules.firstLead === 'bidder' ? h.bidder : nextSeat(h, h.dealer);
  h.turn = h.leader;
}

// ─── Oyun ───────────────────────────────────────────────────────────────

/** Koltuğun kartına kim karar verir (açık eşte ihaleci) */
export function controllerOf(h: HandState, seat: number): number {
  if (h.phase === 'play' && h.dummy >= 0 && seat === h.dummy) return h.bidder;
  return seat;
}

export function legalMoves(h: HandState, seat: number): Card[] {
  const hand = h.hands[seat];
  const trump = h.trump;
  if (h.trick.length === 0) {
    if (trump !== -1 && h.rules.trumpBreak && !h.trumpBroken) {
      const nonTrump = hand.filter((c) => suitOf(c) !== trump);
      if (nonTrump.length) return nonTrump;
    }
    return hand.slice();
  }
  const led = suitOf(h.trick[0].card);
  const follow = hand.filter((c) => suitOf(c) === led);
  let trumped = false;
  let hiLed = 0;
  let hiTrump = 0;
  for (const p of h.trick) {
    const s = suitOf(p.card);
    const r = rankOf(p.card);
    if (s === led && r > hiLed) hiLed = r;
    if (trump !== -1 && s === trump) {
      if (led !== trump) trumped = true;
      if (r > hiTrump) hiTrump = r;
    }
  }
  if (follow.length) {
    if (h.rules.mustRaise && !trumped) {
      const higher = follow.filter((c) => rankOf(c) > hiLed);
      if (higher.length) return higher;
    }
    return follow;
  }
  if (trump !== -1 && h.rules.mustTrump) {
    const trumps = hand.filter((c) => suitOf(c) === trump);
    if (trumps.length) {
      if (h.rules.mustOvertrump && trumped) {
        const higher = trumps.filter((c) => rankOf(c) > hiTrump);
        if (higher.length) return higher;
      }
      return trumps;
    }
  }
  return hand.slice();
}

export function isLegal(h: HandState, seat: number, card: Card): boolean {
  return legalMoves(h, seat).includes(card);
}

/** a kartı b kartını yener mi (b şu an eli tutan, led açılan renk) */
export function beats(a: Card, b: Card, _led: Suit, trump: Suit | -1): boolean {
  const sa = suitOf(a);
  const sb = suitOf(b);
  if (sa === sb) return rankOf(a) > rankOf(b);
  if (trump !== -1 && sa === trump) return true;
  return false;
}

export function currentWinner(trick: Play[], trump: Suit | -1): Play {
  let best = trick[0];
  const led = suitOf(trick[0].card);
  for (let i = 1; i < trick.length; i++) {
    if (beats(trick[i].card, best.card, led, trump)) best = trick[i];
  }
  return best;
}

export interface PlayResult {
  completed: boolean;
  winner: number;
  plays: Play[];
  handOver: boolean;
}

export function applyPlay(h: HandState, seat: number, card: Card, validate = true): PlayResult {
  if (validate) {
    if (h.phase !== 'play') throw new Error('Oyun aşamasında değil');
    if (seat !== h.turn) throw new Error('Sıra bu oyuncuda değil');
    if (!isLegal(h, seat, card)) throw new Error('Kural dışı kart');
  }
  const hand = h.hands[seat];
  const i = hand.indexOf(card);
  hand.splice(i, 1);
  h.played[card] = 1;
  const s = suitOf(card);
  const trump = h.trump;
  if (h.trick.length > 0) {
    const led = suitOf(h.trick[0].card);
    if (s !== led) {
      h.voids[seat * 4 + led] = 1;
      if (trump !== -1 && s !== trump && h.rules.mustTrump) h.voids[seat * 4 + trump] = 1;
    }
  }
  if (trump !== -1 && s === trump) h.trumpBroken = true;
  h.trick.push({ seat, card });
  if (h.trick.length === h.seats.length) {
    const winner = currentWinner(h.trick, trump).seat;
    const plays = h.trick;
    h.tricksWon[winner]++;
    h.history.push({ leader: h.leader, plays, winner });
    h.trick = [];
    h.leader = winner;
    h.turn = winner;
    const handOver = h.hands[winner].length === 0;
    if (handOver) h.phase = 'done';
    return { completed: true, winner, plays, handOver };
  }
  h.turn = nextSeat(h, seat);
  return { completed: false, winner: -1, plays: h.trick, handOver: false };
}

export function cloneHand(h: HandState): HandState {
  return {
    ...h,
    seats: h.seats.slice(),
    hands: h.hands.map((x) => x.slice()),
    kitty: h.kitty.slice(),
    buried: h.buried.slice(),
    kittyTaken: h.kittyTaken.slice(),
    passed: h.passed.slice(),
    bidLog: h.bidLog.slice(),
    declared: h.declared.slice(),
    trick: h.trick.slice(),
    tricksWon: h.tricksWon.slice(),
    history: h.history.slice(),
    played: h.played.slice(),
    voids: h.voids.slice(),
  };
}

/** Kim karar verecek: aşamaya göre (açık eşte kartı ihaleci oynar) */
export function decisionSeat(h: HandState): { seat: number; controller: number } {
  switch (h.phase) {
    case 'bidding':
    case 'declare':
      return { seat: h.turn, controller: h.turn };
    case 'trump':
    case 'bury':
      return { seat: h.bidder, controller: h.bidder };
    case 'play':
      return { seat: h.turn, controller: controllerOf(h, h.turn) };
    default:
      return { seat: -1, controller: -1 };
  }
}
