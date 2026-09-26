// Kartlar 0..51 arası sayılarla temsil edilir: suit * 13 + (rank - 2)
// Sıralama (renk): 0 = Maça, 1 = Kupa, 2 = Sinek, 3 = Karo  (siyah/kırmızı sırayla)
export type Card = number;
export type Suit = 0 | 1 | 2 | 3;

export const SUITS: Suit[] = [0, 1, 2, 3];
export const SPADES: Suit = 0;

export const SUIT_NAMES = ['Maça', 'Kupa', 'Sinek', 'Karo'] as const;
export const SUIT_SYMBOLS = ['♠', '♥', '♣', '♦'] as const;
export const RANK_LABELS: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};
export const RANK_NAMES: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'Vale', 12: 'Kız', 13: 'Papaz', 14: 'As',
};

export const suitOf = (c: Card): Suit => ((c / 13) | 0) as Suit;
export const rankOf = (c: Card): number => (c % 13) + 2;
export const makeCard = (suit: Suit, rank: number): Card => suit * 13 + (rank - 2);
export const isRed = (s: Suit) => s === 1 || s === 3;

export function cardName(c: Card): string {
  return `${SUIT_NAMES[suitOf(c)]} ${RANK_NAMES[rankOf(c)]}`;
}
export function cardShort(c: Card): string {
  return `${SUIT_SYMBOLS[suitOf(c)]}${RANK_LABELS[rankOf(c)]}`;
}

export function fullDeck(): Card[] {
  const d: Card[] = [];
  for (let i = 0; i < 52; i++) d.push(i);
  return d;
}

// Küçük, hızlı, tohumlanabilir RNG (mulberry32)
export type Rng = () => number;
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

// El içi görüntü sıralaması: renklere göre (koz en sağda/solda), sonra büyükten küçüğe
export function sortHand(hand: Card[], trump: Suit | -1, bySuit = true): Card[] {
  const order: Suit[] = [0, 1, 2, 3];
  const suitRank = (s: Suit) => {
    if (trump !== -1 && s === trump) return -1; // koz en başta
    return order.indexOf(s);
  };
  return [...hand].sort((a, b) => {
    if (bySuit) {
      const d = suitRank(suitOf(a)) - suitRank(suitOf(b));
      if (d !== 0) return d;
      return rankOf(b) - rankOf(a);
    }
    const r = rankOf(b) - rankOf(a);
    if (r !== 0) return r;
    return suitRank(suitOf(a)) - suitRank(suitOf(b));
  });
}
