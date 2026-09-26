import { Difficulty } from './engine/game';
import { MODE_ORDER, ModeId, RuleConfig, defaultRules } from './engine/rules';
import { Quality } from './render/stage';

export type Speed = 'slow' | 'normal' | 'fast' | 'veryfast';

export interface Prefs {
  name: string;
  mode: ModeId;
  difficulty: Difficulty;
  hands: number;
  speed: Speed;
  turnTime: number;
  quality: Quality;
  sfx: boolean;
  ambient: boolean;
  fastDeal: boolean;
  oneClick: boolean;
  sortBySuit: boolean;
  rules: Record<ModeId, RuleConfig>;
}

const KEY = 'batak.prefs.v1';

export function defaultPrefs(): Prefs {
  const rules = {} as Record<ModeId, RuleConfig>;
  for (const m of MODE_ORDER) rules[m] = defaultRules(m);
  const mobile = Math.min(window.innerWidth, window.innerHeight) < 600;
  return {
    name: 'Sen',
    mode: 'ihale',
    difficulty: 'medium',
    hands: 5,
    speed: 'normal',
    turnTime: 0,
    quality: mobile ? 'low' : 'medium',
    sfx: true,
    ambient: true,
    fastDeal: false,
    oneClick: true,
    sortBySuit: true,
    rules,
  };
}

export function loadPrefs(): Prefs {
  const d = defaultPrefs();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<Prefs>;
    const rules = { ...d.rules };
    if (p.rules) for (const m of MODE_ORDER) rules[m] = { ...d.rules[m], ...(p.rules[m] ?? {}) };
    return { ...d, ...p, rules };
  } catch {
    return d;
  }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* depolama yoksa önemli değil */
  }
}

export const SPEED_FACTOR: Record<Speed, { think: number; anim: number }> = {
  slow: { think: 1.5, anim: 1.25 },
  normal: { think: 1, anim: 1 },
  fast: { think: 0.55, anim: 0.72 },
  veryfast: { think: 0.25, anim: 0.45 },
};
