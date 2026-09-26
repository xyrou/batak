export type ModeId = 'ihale' | 'esli' | 'kozmaca' | 'gommeli';

export interface RuleConfig {
  /** En düşük ihale (ihaleli modlar) */
  minBid: number;
  /** Herkes pas derse: ilk konuşan en düşük ihaleyle alır / yeniden dağıtılır */
  allPass: 'forced' | 'redeal';
  /** Koz kırılmadan (biri koz atmadan) kozla el açılamaz */
  trumpBreak: boolean;
  /** Yerdeki rengi büyütmek zorunlu (büyük atma) */
  mustRaise: boolean;
  /** Yerdeki renk yoksa koz atmak zorunlu */
  mustTrump: boolean;
  /** Yerde koz varsa daha büyük koz atmak zorunlu (varsa) */
  mustOvertrump: boolean;
  /** İhaleyi yapan: aldığı el kadar mı ihale kadar mı yazar */
  bidderScore: 'tricks' | 'bid';
  /** Hiç el alamayan oyuncu ihale kadar batar (tekli/gömmeli) */
  zeroTrickPenalty: boolean;
  /** Eşli: pas diyen takım en az bu kadar el almazsa ihale kadar batar (0 = kapalı) */
  defenseMin: 0 | 1 | 2 | 3;
  /** Eşli: ihalecinin eşi kartlarını açar, ihaleci onun yerine oynar */
  openDummy: boolean;
  /** 13 deyip 13 alan oyunu doğrudan kazanır */
  king13: boolean;
  /** Gömmeli: yerdeki kartları görmeden göm / önce al sonra göm */
  buryMode: 'blind' | 'open';
  /** Koz maça: "el almam" (0) söylenebilir */
  allowNil: boolean;
  /** İlk eli kim açar */
  firstLead: 'bidder' | 'dealerRight';
}

export interface ModeDef {
  id: ModeId;
  name: string;
  short: string;
  desc: string;
  players: 3 | 4;
  cardsEach: number;
  kitty: number;
  teams: boolean;
  auction: boolean;
  fixedTrump: number | -1; // -1 = ihale ile seçilir
}

export const MODES: Record<ModeId, ModeDef> = {
  ihale: {
    id: 'ihale', name: 'İhaleli Batak', short: 'İhaleli',
    desc: '4 kişi, herkes kendine. İhaleyi alan kozu seçer.',
    players: 4, cardsEach: 13, kitty: 0, teams: false, auction: true, fixedTrump: -1,
  },
  esli: {
    id: 'esli', name: 'Eşli İhaleli Batak', short: 'Eşli',
    desc: 'Karşılıklı oturanlar eş. İhale ve eller takıma yazılır.',
    players: 4, cardsEach: 13, kitty: 0, teams: true, auction: true, fixedTrump: -1,
  },
  kozmaca: {
    id: 'kozmaca', name: 'Koz Maça', short: 'Koz Maça',
    desc: 'İhale yok, koz hep maça. Herkes kaç el alacağını söyler.',
    players: 4, cardsEach: 13, kitty: 0, teams: false, auction: false, fixedTrump: 0,
  },
  gommeli: {
    id: 'gommeli', name: 'Gömmeli Batak', short: 'Gömmeli',
    desc: '3 kişi, 16\'şar kart. İhaleyi alan yerdeki 4 kartla takas eder.',
    players: 3, cardsEach: 16, kitty: 4, teams: false, auction: true, fixedTrump: -1,
  },
};

export const MODE_ORDER: ModeId[] = ['ihale', 'esli', 'kozmaca', 'gommeli'];

export function defaultRules(mode: ModeId): RuleConfig {
  const base: RuleConfig = {
    minBid: 5,
    allPass: 'forced',
    trumpBreak: true,
    mustRaise: true,
    mustTrump: true,
    mustOvertrump: true,
    bidderScore: 'tricks',
    zeroTrickPenalty: true,
    defenseMin: 2,
    openDummy: true,
    king13: true,
    buryMode: 'blind',
    allowNil: true,
    firstLead: 'bidder',
  };
  if (mode === 'esli') {
    base.minBid = 7;
    base.trumpBreak = false;
  }
  if (mode === 'gommeli') base.minBid = 7;
  if (mode === 'kozmaca') base.firstLead = 'dealerRight';
  return base;
}

/** Arayüzde gösterilen kural seçenekleri; hangi modda geçerli oldukları ile */
export type RuleOption =
  | { key: keyof RuleConfig; kind: 'toggle'; title: string; desc: string; modes: ModeId[] }
  | {
      key: keyof RuleConfig; kind: 'select'; title: string; desc: string; modes: ModeId[];
      choices: { value: string | number; label: string }[];
    };

export const RULE_OPTIONS: RuleOption[] = [
  {
    key: 'minBid', kind: 'select', title: 'En düşük ihale',
    desc: 'İhalenin açılabileceği en küçük el sayısı.',
    modes: ['ihale', 'esli', 'gommeli'],
    choices: [4, 5, 6, 7, 8].map((v) => ({ value: v, label: String(v) })),
  },
  {
    key: 'allPass', kind: 'select', title: 'Herkes pas derse',
    desc: 'Kimse ihaleye girmezse ne olacağı.',
    modes: ['ihale', 'esli', 'gommeli'],
    choices: [
      { value: 'forced', label: 'İlk konuşan alır' },
      { value: 'redeal', label: 'Yeniden dağıt' },
    ],
  },
  {
    key: 'trumpBreak', kind: 'toggle', title: 'Koz kırılmadan kozla açılmaz',
    desc: 'Biri renk bulamayıp koz atmadan, elinde başka kart olan oyuncu kozla başlayamaz.',
    modes: ['ihale', 'esli', 'kozmaca', 'gommeli'],
  },
  {
    key: 'mustRaise', kind: 'toggle', title: 'Büyük atma zorunluluğu',
    desc: 'Yerdeki renkten daha büyük kartın varsa onu atmak zorundasın.',
    modes: ['ihale', 'esli', 'kozmaca', 'gommeli'],
  },
  {
    key: 'mustTrump', kind: 'toggle', title: 'Renk yoksa koz zorunlu',
    desc: 'Yerdeki renkten kartın yoksa ve kozun varsa koz atmak zorundasın.',
    modes: ['ihale', 'esli', 'kozmaca', 'gommeli'],
  },
  {
    key: 'mustOvertrump', kind: 'toggle', title: 'Kozu yükseltme',
    desc: 'Yere koz atılmışsa, elinde daha büyük koz varsa onu atmak zorundasın.',
    modes: ['ihale', 'esli', 'kozmaca', 'gommeli'],
  },
  {
    key: 'bidderScore', kind: 'select', title: 'İhaleyi yapan yazar',
    desc: 'İhalesini tutturan oyuncunun hanesine yazılan puan.',
    modes: ['ihale', 'esli', 'gommeli'],
    choices: [
      { value: 'tricks', label: 'Aldığı el' },
      { value: 'bid', label: 'İhale kadar' },
    ],
  },
  {
    key: 'zeroTrickPenalty', kind: 'toggle', title: 'El alamayan batar',
    desc: 'Hiç el alamayan oyuncu ihale miktarı kadar eksi yazar.',
    modes: ['ihale', 'gommeli'],
  },
  {
    key: 'defenseMin', kind: 'select', title: 'Pas diyen takımın sınırı',
    desc: 'İhaleye girmeyen takım en az bu kadar el almazsa ihale kadar batar.',
    modes: ['esli'],
    choices: [
      { value: 0, label: 'Kapalı' },
      { value: 1, label: 'En az 1' },
      { value: 2, label: 'En az 2' },
      { value: 3, label: 'En az 3' },
    ],
  },
  {
    key: 'openDummy', kind: 'toggle', title: 'Açık eş',
    desc: 'Koz seçilince ihalecinin eşi kartlarını masaya açar, ihaleci onun kartlarını da oynar.',
    modes: ['esli'],
  },
  {
    key: 'king13', kind: 'toggle', title: 'King (13) oyunu bitirir',
    desc: '13 ihalesini alıp 13 eli de alan oyunu doğrudan kazanır.',
    modes: ['ihale', 'esli', 'gommeli'],
  },
  {
    key: 'buryMode', kind: 'select', title: 'Gömme şekli',
    desc: 'İhaleci yerdeki 4 kartı görmeden mi gömer, yoksa önce alıp sonra mı gömer.',
    modes: ['gommeli'],
    choices: [
      { value: 'blind', label: 'Görmeden (klasik)' },
      { value: 'open', label: 'Önce al, sonra göm' },
    ],
  },
  {
    key: 'allowNil', kind: 'toggle', title: '"El almam" söylenebilir',
    desc: 'Sıfır söyleyen hiç el almazsa +50, alırsa −50 yazar.',
    modes: ['kozmaca'],
  },
  {
    key: 'firstLead', kind: 'select', title: 'İlk eli açan',
    desc: 'Oyunun ilk kartını kim atar.',
    modes: ['ihale', 'esli', 'gommeli'],
    choices: [
      { value: 'bidder', label: 'İhaleci' },
      { value: 'dealerRight', label: 'Dağıtanın sağı' },
    ],
  },
];

export function optionsForMode(mode: ModeId): RuleOption[] {
  return RULE_OPTIONS.filter((o) => o.modes.includes(mode));
}
