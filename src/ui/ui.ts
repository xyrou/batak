import { Card, RANK_LABELS, SUIT_NAMES, SUIT_SYMBOLS, Suit, isRed, rankOf, suitOf } from '../engine/cards';
import { GameState, HandSummary, standings, winners } from '../engine/game';
import { HandState, bidRange, declareRange, partnerOf } from '../engine/hand';
import { MODES, MODE_ORDER, ModeId, defaultRules, optionsForMode } from '../engine/rules';
import { Prefs, savePrefs } from '../prefs';
import { Sound } from '../audio';
import { icons } from './icons';
import { GENERAL_RULES, MODE_RULES } from './rulesText';

export const SEAT_NAMES = ['Sen', 'Mehmet', 'Ayşe', 'Kemal'];
const AV_COLORS = ['#c9a14e', '#8a2a2a', '#2f5a3a', '#2a4a7a'];

function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function suitHtml(s: number) {
  return `<span class="${isRed(s as Suit) ? 'neg' : ''}" style="${isRed(s as Suit) ? 'color:#ff8f96' : ''}">${SUIT_SYMBOLS[s]}</span>`;
}

export function cardLabel(c: Card) {
  return `${RANK_LABELS[rankOf(c)]}${SUIT_SYMBOLS[suitOf(c)]}`;
}

export interface HudHandlers {
  pause(): void;
  scoreboard(): void;
  camera(): void;
  sound(): void;
  sort(): void;
  hint(): void;
  lastTrick(): void;
  cameraReset(): void;
  log(): void;
}

export class UI {
  root: HTMLElement;
  prefs: Prefs;
  sound: Sound;
  names = SEAT_NAMES.slice();
  private menuEl: HTMLElement | null = null;
  private hud: HTMLElement | null = null;
  private chips: (HTMLElement | null)[] = [null, null, null, null];
  private statusEl: HTMLElement | null = null;
  private infoEl: HTMLElement | null = null;
  private actionEl: HTMLElement | null = null;
  private logEl: HTMLElement | null = null;
  private logLines: string[] = [];
  private bubbles: (HTMLElement | null)[] = [null, null, null, null];
  private bubbleTimers: number[] = [0, 0, 0, 0];
  private timerInt = 0;
  private modalStack: HTMLElement[] = [];
  private soundBtn: HTMLElement | null = null;
  private sortBtn: HTMLElement | null = null;
  hintBtn: HTMLButtonElement | null = null;

  constructor(root: HTMLElement, prefs: Prefs, sound: Sound) {
    this.root = root;
    this.prefs = prefs;
    this.sound = sound;
  }

  // ─── Ana menü ───────────────────────────────────────────────────────────
  showMenu(onStart: (p: Prefs) => void) {
    this.hideMenu();
    const p = this.prefs;
    const wrap = el(`<div class="menu-wrap"><div class="menu glass">
      <aside class="menu-side">
        <div class="logo-cards"><span class="mini-card red">A<i>♥</i></span><span class="mini-card">K<i>♠</i></span><span class="mini-card red">Q<i>♦</i></span></div>
        <div>
          <h1 class="brand">Batak <em>İhale</em></h1>
          <div class="brand-sub">KAHVEHANE MASASI · 3B</div>
        </div>
        <ul class="feat">
          <li><span>${icons.cards}</span><span>El çizimi desteler, <b>yeşil çuha</b> ve ahşap masada gerçekçi 3B oyun</span></li>
          <li><span>${icons.gavel}</span><span><b>İhaleli, Eşli, Koz Maça</b> ve 3 kişilik <b>Gömmeli</b> batak</span></li>
          <li><span>${icons.cpu}</span><span>Üç zorlukta yapay zekâ rakipler: <b>Mehmet, Ayşe, Kemal</b></span></li>
        </ul>
        <div class="controls-box"><h4>KONTROLLER</h4><div class="rows">
          <div class="row"><span>Kart at</span><b>Tık · Sürükle</b></div>
          <div class="row"><span>Masaya bak</span><b>Sağ tık + sürükle</b></div>
          <div class="row"><span>Yakınlaş</span><b>Tekerlek</b></div>
          <div class="row"><span>İpucu / Kurallar</span><b>H · K</b></div>
        </div></div>
      </aside>
      <section class="menu-main">
        <div class="menu-head"><h2>Yeni Oyun</h2><p>Masaya oturmadan önce oyun türünü ve ayarlarını seç</p></div>
        <div class="menu-body">
          <div class="field-label"><span>OYUN TÜRÜ</span></div>
          <div class="modes" data-k="mode"></div>
          <div class="grid2">
            <div><div class="field-label"><span>OYUNCU ADIN</span></div><input class="text-input" maxlength="14" data-k="name" value="${esc(p.name)}"></div>
            <div><div class="field-label"><span>ZORLUK</span></div><div class="seg" data-seg="difficulty"></div></div>
            <div><div class="field-label"><span>EL SAYISI</span></div><div class="seg" data-seg="hands"></div></div>
            <div><div class="field-label"><span>OYUN HIZI</span></div><div class="seg" data-seg="speed"></div></div>
            <div><div class="field-label"><span>TUR SÜRESİ</span><span>saniye</span></div><div class="seg" data-seg="turnTime"></div></div>
            <div><div class="field-label"><span>GRAFİK KALİTESİ</span></div><div class="seg" data-seg="quality"></div></div>
          </div>
          <div class="field-label"><span>SES VE OYNANIŞ</span></div>
          <div class="toggles">
            <label class="tog" data-tog="sfx"><span class="switch"></span>Ses efektleri</label>
            <label class="tog" data-tog="ambient"><span class="switch"></span>Kahvehane ortam sesi</label>
            <label class="tog" data-tog="fastDeal"><span class="switch"></span>Hızlı dağıtım</label>
            <label class="tog" data-tog="oneClick"><span class="switch"></span>Tek tıkla kart at</label>
          </div>
          <div class="rules-box">
            <div class="rules-head">${icons.sliders}<span>Kural seçenekleri</span><span class="count"></span><span class="chev">${icons.chevron}</span></div>
            <div class="rules-list"></div>
          </div>
        </div>
        <div class="menu-foot">
          <span class="hint">Oyunda kurallar: <span class="kbd">K</span></span>
          <button class="btn" data-act="rules">${icons.book}Kurallar</button>
          <button class="btn gold" data-act="start">${icons.play}Oyuna Başla</button>
        </div>
      </section>
    </div></div>`);

    const modesEl = wrap.querySelector('[data-k="mode"]') as HTMLElement;
    const modeIcons: Record<ModeId, string> = { ihale: '♠', esli: '♥', kozmaca: '♣', gommeli: '♦' };
    const renderModes = () => {
      modesEl.innerHTML = MODE_ORDER.map((m) => {
        const d = MODES[m];
        return `<button class="mode ${p.mode === m ? 'active' : ''}" data-mode="${m}"><span class="pl">${d.players} kişi</span><span class="ic">${modeIcons[m]}</span><div class="t">${d.name}</div><div class="d">${d.desc}</div></button>`;
      }).join('');
      modesEl.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) =>
        b.addEventListener('click', () => {
          p.mode = b.dataset.mode as ModeId;
          this.sound.click();
          renderModes();
          renderRules();
        }),
      );
    };

    const segs: Record<string, { v: string | number; l: string }[]> = {
      difficulty: [{ v: 'easy', l: 'Kolay' }, { v: 'medium', l: 'Orta' }, { v: 'hard', l: 'Zor' }],
      hands: [1, 3, 5, 7, 11, 15].map((v) => ({ v, l: String(v) })),
      speed: [{ v: 'slow', l: 'Ağır' }, { v: 'normal', l: 'Normal' }, { v: 'fast', l: 'Hızlı' }, { v: 'veryfast', l: 'Çok hızlı' }],
      turnTime: [{ v: 0, l: 'Kapalı' }, { v: 15, l: '15' }, { v: 20, l: '20' }, { v: 30, l: '30' }, { v: 45, l: '45' }],
      quality: [{ v: 'low', l: 'Düşük' }, { v: 'medium', l: 'Orta' }, { v: 'high', l: 'Yüksek' }],
    };
    wrap.querySelectorAll<HTMLElement>('[data-seg]').forEach((s) => {
      const key = s.dataset.seg as keyof Prefs;
      const render = () => {
        s.innerHTML = segs[key].map((o) => `<button class="${(p[key] as unknown) === o.v ? 'on' : ''}" data-v="${o.v}">${o.l}</button>`).join('');
        s.querySelectorAll<HTMLElement>('button').forEach((b, i) =>
          b.addEventListener('click', () => {
            (p as unknown as Record<string, unknown>)[key] = segs[key][i].v;
            this.sound.click();
            render();
          }),
        );
      };
      render();
    });
    wrap.querySelectorAll<HTMLElement>('[data-tog]').forEach((t) => {
      const key = t.dataset.tog as 'sfx' | 'ambient' | 'fastDeal' | 'oneClick';
      const sw = t.querySelector('.switch')!;
      sw.classList.toggle('on', !!p[key]);
      t.addEventListener('click', (e) => {
        e.preventDefault();
        p[key] = !p[key];
        sw.classList.toggle('on', p[key]);
        if (key === 'sfx') this.sound.setSfx(p.sfx);
        if (key === 'ambient') this.sound.setAmbient(p.ambient);
        this.sound.click();
      });
    });

    const rulesBox = wrap.querySelector('.rules-box') as HTMLElement;
    rulesBox.querySelector('.rules-head')!.addEventListener('click', () => rulesBox.classList.toggle('open'));
    const renderRules = () => {
      const opts = optionsForMode(p.mode);
      (rulesBox.querySelector('.count') as HTMLElement).textContent = `${opts.length} seçenek · ${MODES[p.mode].short}`;
      const list = rulesBox.querySelector('.rules-list') as HTMLElement;
      list.innerHTML = '';
      const rules = p.rules[p.mode];
      for (const o of opts) {
        const row = el(`<div class="rule-row"><div class="txt"><b>${o.title}</b><small>${o.desc}</small></div></div>`);
        if (o.kind === 'toggle') {
          const sw = el(`<span class="switch ${rules[o.key] ? 'on' : ''}" style="cursor:pointer"></span>`);
          sw.addEventListener('click', () => {
            (rules as unknown as Record<string, unknown>)[o.key] = !rules[o.key];
            sw.classList.toggle('on', !!rules[o.key]);
            this.sound.click();
          });
          row.appendChild(sw);
        } else {
          const sel = el<HTMLSelectElement>(`<select class="select">${o.choices.map((c) => `<option value="${c.value}" ${String(rules[o.key]) === String(c.value) ? 'selected' : ''}>${c.label}</option>`).join('')}</select>`);
          sel.addEventListener('change', () => {
            const c = o.choices.find((x) => String(x.value) === sel.value)!;
            (rules as unknown as Record<string, unknown>)[o.key] = c.value;
          });
          row.appendChild(sel);
        }
        list.appendChild(row);
      }
      const reset = el(`<div style="text-align:right;padding:8px 0 4px"><button class="btn small">Varsayılana dön</button></div>`);
      reset.querySelector('button')!.addEventListener('click', () => {
        p.rules[p.mode] = defaultRules(p.mode);
        renderRules();
      });
      list.appendChild(reset);
    };
    renderModes();
    renderRules();

    const nameInput = wrap.querySelector('[data-k="name"]') as HTMLInputElement;
    nameInput.addEventListener('keydown', (e) => e.stopPropagation());
    wrap.querySelector('[data-act="rules"]')!.addEventListener('click', () => this.showRules(p.mode));
    wrap.querySelector('[data-act="start"]')!.addEventListener('click', () => {
      p.name = nameInput.value.trim().slice(0, 14) || 'Sen';
      savePrefs(p);
      this.sound.click();
      onStart(p);
    });
    this.root.appendChild(wrap);
    this.menuEl = wrap;
  }

  hideMenu() {
    this.menuEl?.remove();
    this.menuEl = null;
  }

  get menuOpen() {
    return !!this.menuEl;
  }

  // ─── HUD ────────────────────────────────────────────────────────────────
  buildHud(g: GameState, hnd: HudHandlers) {
    this.destroyHud();
    this.names = SEAT_NAMES.slice();
    this.names[0] = this.prefs.name || 'Sen';
    const hud = el(`<div class="passthru"></div>`);
    const tl = el(`<div class="hud-tl"><div class="info-panel glass"></div><button class="icon-btn glass" title="Oyun kaydı" style="width:44px;height:44px">${icons.list}</button></div>`);
    tl.querySelector('button')!.addEventListener('click', () => hnd.log());
    this.infoEl = tl.querySelector('.info-panel');
    hud.appendChild(tl);

    const tr = el(`<div class="hud-tr"><div class="icon-bar glass">
      <button class="icon-btn" data-a="scoreboard" title="Skor tablosu">${icons.table}</button>
      <button class="icon-btn" data-a="camera" title="Kamera görünümü (C)">${icons.camera}</button>
      <button class="icon-btn" data-a="sound" title="Ses">${this.sound.muted ? icons.mute : icons.volume}</button>
      <button class="icon-btn" data-a="pause" title="Menü (Esc)">${icons.menu}</button>
    </div><div class="status glass"><div class="t">Hazırlanıyor</div><div class="d">Kartlar karıştırılıyor…</div><div class="timer"><div></div></div></div></div>`);
    tr.querySelectorAll<HTMLElement>('[data-a]').forEach((b) =>
      b.addEventListener('click', () => {
        this.sound.click();
        (hnd as unknown as Record<string, () => void>)[b.dataset.a!]();
      }),
    );
    this.soundBtn = tr.querySelector('[data-a="sound"]');
    this.statusEl = tr.querySelector('.status');
    hud.appendChild(tr);

    for (const s of [0, 1, 2, 3]) {
      const active = g.seats.includes(s);
      const chip = el(`<div class="chip glass seat-${s} ${active ? '' : 'hidden'}">
        <div class="av" style="background:${AV_COLORS[s]}">${esc(this.names[s][0]?.toUpperCase() ?? '?')}<span class="dealer">D</span></div>
        <div><div class="nm"><span class="n">${esc(this.names[s])}</span><span class="tm"></span><span class="dots"><i></i><i></i><i></i></span></div><div class="meta"></div></div>
      </div>`);
      hud.appendChild(chip);
      this.chips[s] = chip;
    }

    const tb = el(`<div class="toolbar glass">
      <button class="icon-btn" data-a="sort" title="Sıralama (S)">${this.prefs.sortBySuit ? icons.sortSuit : icons.sortRank}</button>
      <button class="icon-btn" data-a="hint" title="İpucu (H)">${icons.hint}</button>
      <span class="sep"></span>
      <button class="icon-btn" data-a="lastTrick" title="Son el (L)">${icons.history}</button>
      <button class="icon-btn" data-a="cameraReset" title="Kamerayı sıfırla">${icons.reset}</button>
    </div>`);
    tb.querySelectorAll<HTMLElement>('[data-a]').forEach((b) =>
      b.addEventListener('click', () => {
        this.sound.click();
        (hnd as unknown as Record<string, () => void>)[b.dataset.a!]();
      }),
    );
    this.sortBtn = tb.querySelector('[data-a="sort"]');
    this.hintBtn = tb.querySelector('[data-a="hint"]');
    hud.appendChild(tb);
    this.root.appendChild(hud);
    this.hud = hud;
    this.logLines = [];
    this.updateHud(g);
  }

  destroyHud() {
    this.hud?.remove();
    this.hud = null;
    this.closeAction();
    this.logEl?.remove();
    this.logEl = null;
    this.chips = [null, null, null, null];
    clearInterval(this.timerInt);
  }

  setSortIcon() {
    if (this.sortBtn) this.sortBtn.innerHTML = this.prefs.sortBySuit ? icons.sortSuit : icons.sortRank;
  }
  setSoundIcon() {
    if (this.soundBtn) this.soundBtn.innerHTML = this.sound.muted ? icons.mute : icons.volume;
  }

  updateHud(g: GameState) {
    const h = g.hand;
    const mode = g.config.mode;
    if (this.infoEl) {
      const trump = h.trump;
      const koz = trump === -1
        ? `<span class="koz-badge none">?</span>`
        : `<span class="koz-badge ${isRed(trump) ? 'red' : ''}">${SUIT_SYMBOLS[trump]}</span>`;
      let second = '';
      if (mode === 'kozmaca') {
        const total = h.declared.reduce<number>((a, b) => a + (b ?? 0), 0);
        const any = h.declared.some((d) => d !== null);
        second = `<div class="info-col"><div class="lbl">SÖZLER</div><div class="val">${any ? total : '–'}<small>/13</small></div><div class="sub">toplam söz</div></div>`;
      } else {
        const has = h.bidder >= 0;
        const hb = h.highBidder >= 0;
        second = `<div class="info-col"><div class="lbl">İHALE</div><div class="val">${has ? h.bid : hb ? h.highBid : '–'}</div><div class="sub">${has ? esc(this.names[h.bidder]) : hb ? esc(this.names[h.highBidder]) + '…' : 'bekleniyor'}</div></div>`;
      }
      let team = '';
      if (mode === 'esli') {
        const us = h.tricksWon[0] + h.tricksWon[2];
        const them = h.tricksWon[1] + h.tricksWon[3];
        team = `<div class="info-col"><div class="lbl">TAKIMLAR</div><div class="val">${us}<small> – </small>${them}</div><div class="sub">biz · onlar</div></div>`;
      }
      const tricksPlayed = h.history.length;
      this.infoEl.innerHTML = `
        <div class="info-col"><div class="lbl">KOZ</div>${koz}</div>
        ${second}
        ${team}
        <div class="info-col opt"><div class="lbl">TUR</div><div class="val">${Math.min(h.totalTricks, tricksPlayed + (h.phase === 'play' ? 1 : 0))}<small>/${h.totalTricks}</small></div><div class="sub">el oynanan</div></div>
        <div class="info-col opt"><div class="lbl">OYUN</div><div class="val">${g.handNo}<small>/${g.config.hands}</small></div><div class="sub">${MODES[mode].short}</div></div>`;
    }
    for (const s of g.seats) {
      const chip = this.chips[s];
      if (!chip) continue;
      chip.classList.toggle('is-dealer', h.dealer === s);
      const tm = chip.querySelector('.tm') as HTMLElement;
      if (mode === 'esli') {
        const mine = s === 0 || s === 2;
        tm.innerHTML = `<span class="team ${mine ? 'us' : ''}">${s === 0 ? 'SEN' : s === 2 ? 'EŞİN' : 'RAKİP'}</span>`;
      } else tm.innerHTML = '';
      const meta = chip.querySelector('.meta') as HTMLElement;
      const parts: string[] = [];
      if (mode === 'kozmaca') {
        const d = h.declared[s];
        if (d !== null) parts.push(`<span class="bidtag">${d === 0 ? 'El almam' : 'Söz ' + d}</span>`);
      } else if (h.bidder === s) {
        parts.push(`<span class="bidtag">İhale ${h.bid}${h.trump !== -1 ? ' ' + SUIT_SYMBOLS[h.trump] : ''}</span>`);
      } else if (h.phase === 'bidding') {
        const last = [...h.bidLog].reverse().find((e) => e.seat === s);
        if (last) parts.push(last.bid === null ? 'Pas' : `<span class="bidtag">${last.bid}</span>`);
      }
      if (h.dummy === s) parts.push('<span class="bidtag">açık</span>');
      if (h.phase === 'play' || h.phase === 'done') parts.push(`<b>${h.tricksWon[s]}</b> el`);
      parts.push(`<b>${g.scores[s]}</b> puan`);
      meta.innerHTML = parts.join(' · ');
    }
  }

  setTurn(seat: number) {
    this.chips.forEach((c, s) => c?.classList.toggle('turn', s === seat));
  }

  setThinking(seat: number, on: boolean) {
    this.chips[seat]?.classList.toggle('thinking', on);
  }

  status(title: string, desc: string, you = false) {
    if (!this.statusEl) return;
    this.statusEl.classList.toggle('you', you);
    (this.statusEl.querySelector('.t') as HTMLElement).textContent = title;
    (this.statusEl.querySelector('.d') as HTMLElement).innerHTML = desc;
  }

  /** Tur süresi göstergesi; süre bitince onExpire çağrılır. Dönen fonksiyon iptal eder. */
  startTimer(sec: number, onExpire: () => void): () => void {
    clearInterval(this.timerInt);
    if (!this.statusEl || sec <= 0) return () => {};
    this.statusEl.classList.add('timed');
    const bar = this.statusEl.querySelector('.timer div') as HTMLElement;
    const start = performance.now();
    let done = false;
    let pausedAt = 0;
    let pausedTotal = 0;
    // Sekme arka plandayken ya da oyun duraklatılmışken süre işlemez
    const tick = () => {
      if (done) return;
      const now = performance.now();
      if (this.isPaused() || document.hidden) {
        if (!pausedAt) pausedAt = now;
      } else if (pausedAt) {
        pausedTotal += now - pausedAt;
        pausedAt = 0;
      }
      const el = (now - start - pausedTotal - (pausedAt ? now - pausedAt : 0)) / 1000;
      const left = Math.max(0, 1 - el / sec);
      bar.style.width = `${left * 100}%`;
      if (left <= 0) {
        done = true;
        clearInterval(this.timerInt);
        this.statusEl?.classList.remove('timed');
        onExpire();
      }
    };
    tick();
    this.timerInt = window.setInterval(tick, 100);
    return () => {
      done = true;
      clearInterval(this.timerInt);
      this.statusEl?.classList.remove('timed');
    };
  }

  isPaused: () => boolean = () => false;

  bubble(seat: number, html: string, cls = '') {
    this.bubbles[seat]?.remove();
    window.clearTimeout(this.bubbleTimers[seat]);
    const b = el(`<div class="bubble seat-${seat} ${cls}">${html}</div>`);
    this.root.appendChild(b);
    this.bubbles[seat] = b;
    this.bubbleTimers[seat] = window.setTimeout(() => {
      b.remove();
      if (this.bubbles[seat] === b) this.bubbles[seat] = null;
    }, 2200);
  }

  clearBubbles() {
    this.bubbles.forEach((b) => b?.remove());
    this.bubbles = [null, null, null, null];
  }

  toast(html: string) {
    const t = el(`<div class="toast glass">${html}</div>`);
    this.root.appendChild(t);
    setTimeout(() => t.remove(), 1700);
  }

  log(html: string) {
    this.logLines.push(html);
    if (this.logLines.length > 200) this.logLines.shift();
    if (this.logEl) this.renderLog();
  }

  toggleLog() {
    if (this.logEl) {
      this.logEl.remove();
      this.logEl = null;
      return;
    }
    this.logEl = el(`<div class="log-panel glass"></div>`);
    this.root.appendChild(this.logEl);
    this.renderLog();
  }

  private renderLog() {
    if (!this.logEl) return;
    this.logEl.innerHTML = `<h4>Oyun kaydı</h4>` + (this.logLines.length ? this.logLines.slice().reverse().map((l) => `<div class="ln">${l}</div>`).join('') : '<div class="ln">Henüz kayıt yok.</div>');
  }

  // ─── Aksiyon panelleri ──────────────────────────────────────────────────
  closeAction() {
    this.actionEl?.remove();
    this.actionEl = null;
  }

  private action(html: string): HTMLElement {
    this.closeAction();
    const a = el(`<div class="action glass">${html}</div>`);
    this.root.appendChild(a);
    this.actionEl = a;
    return a;
  }

  askBid(h: HandState, rec: number | null): Promise<number | null> {
    const { min, max } = bidRange(h);
    const high = h.highBidder >= 0 ? `En yüksek: <b>${h.highBid}</b> · ${esc(this.names[h.highBidder])}` : `İhale en az <b>${min}</b> ile açılır`;
    let partnerInfo = '';
    if (h.mode === 'esli') {
      const p = partnerOf(h, 0);
      const last = [...h.bidLog].reverse().find((e) => e.seat === p);
      if (last) partnerInfo = ` · Eşin: <b>${last.bid === null ? 'pas' : last.bid}</b>`;
    }
    const nums: string[] = [];
    for (let n = h.rules.minBid; n <= 13; n++) {
      nums.push(`<button data-n="${n}" ${n < min || n > max ? 'disabled' : ''} class="${rec === n ? 'rec' : ''}">${n}</button>`);
    }
    const a = this.action(`<h3>İhale</h3><div class="sub">${high}${partnerInfo}</div><div class="num-grid">${nums.join('')}</div>
      <div class="row"><button class="btn" data-pass>Pas</button></div>
      <div class="legend">${rec !== null ? 'Yeşil çerçeve: önerilen ihale' : 'Elin ihale için zayıf görünüyor — pas önerilir'}</div>`);
    return new Promise((resolve) => {
      a.querySelectorAll<HTMLButtonElement>('[data-n]').forEach((b) =>
        b.addEventListener('click', () => {
          this.closeAction();
          resolve(Number(b.dataset.n));
        }),
      );
      a.querySelector('[data-pass]')!.addEventListener('click', () => {
        this.closeAction();
        resolve(null);
      });
      this.pendingCancel = () => {
        this.closeAction();
        resolve(null);
      };
    });
  }

  pendingCancel: (() => void) | null = null;

  askTrump(h: HandState, rec: Suit): Promise<Suit> {
    const counts = [0, 0, 0, 0];
    for (const c of h.hands[h.bidder]) counts[suitOf(c)]++;
    const btns = ([0, 1, 2, 3] as Suit[]).map((s) =>
      `<button class="suit-btn ${isRed(s) ? 'red' : ''} ${rec === s ? 'rec' : ''}" data-s="${s}"><div class="s">${SUIT_SYMBOLS[s]}</div><div class="n">${SUIT_NAMES[s]}</div><div class="c">${counts[s]} kart</div></button>`,
    ).join('');
    const a = this.action(`<h3>Kozu seç</h3><div class="sub">İhale <b>${h.bid}</b> ile sende${h.forced ? ' (herkes pas dedi)' : ''}. Hangi renk koz olsun?</div><div class="suits">${btns}</div><div class="legend">Yeşil çerçeve: önerilen koz</div>`);
    return new Promise((resolve) => {
      a.querySelectorAll<HTMLElement>('[data-s]').forEach((b) =>
        b.addEventListener('click', () => {
          this.closeAction();
          resolve(Number(b.dataset.s) as Suit);
        }),
      );
    });
  }

  /** Gömme paneli: kart seçimi 3B elden yapılır */
  buryPanel(blind: boolean, onConfirm: () => void, onSuggest: () => void): { update(n: number): void } {
    const a = this.action(`<h3>Kart göm</h3><div class="sub">${blind ? 'Yerdeki 4 kartı <b>görmeden</b> gömeceksin. Elinden 4 kart seç.' : 'Yerden gelen kartlar eline eklendi. Gömülecek 4 kartı seç.'}</div>
      <div class="row" style="margin-top:14px"><button class="btn" data-sug>${icons.hint}Öneri</button><button class="btn gold" data-ok disabled>Göm (0/4)</button></div>`);
    const ok = a.querySelector('[data-ok]') as HTMLButtonElement;
    ok.addEventListener('click', () => onConfirm());
    a.querySelector('[data-sug]')!.addEventListener('click', () => onSuggest());
    return {
      update: (n: number) => {
        ok.disabled = n !== 4;
        ok.textContent = `Göm (${n}/4)`;
      },
    };
  }

  askDeclare(h: HandState, rec: number): Promise<number> {
    const { min, max } = declareRange(h);
    const total = h.declared.reduce<number>((a, b) => a + (b ?? 0), 0);
    const nums: string[] = [];
    for (let n = min; n <= max; n++) nums.push(`<button data-n="${n}" class="${rec === n ? 'rec' : ''}" ${n === 0 ? 'title="El almam"' : ''}>${n === 0 ? '0' : n}</button>`);
    const a = this.action(`<h3>Kaç el alacaksın?</h3><div class="sub">Koz <b>♠ Maça</b> · Şu ana kadar toplam söz: <b>${total}</b>${min === 0 ? ' · 0 = El almam' : ''}</div><div class="num-grid">${nums.join('')}</div><div class="legend">Yeşil çerçeve: önerilen söz</div>`);
    return new Promise((resolve) => {
      a.querySelectorAll<HTMLButtonElement>('[data-n]').forEach((b) =>
        b.addEventListener('click', () => {
          this.closeAction();
          resolve(Number(b.dataset.n));
        }),
      );
    });
  }

  // ─── Modallar ───────────────────────────────────────────────────────────
  modal(html: string, wide = false, onClose?: () => void): HTMLElement {
    const w = el(`<div class="modal-wrap"><div class="modal glass ${wide ? 'wide' : ''}">${html}</div></div>`);
    w.addEventListener('pointerdown', (e) => {
      if (e.target === w && onClose) {
        this.closeTop();
        onClose();
      }
    });
    this.root.appendChild(w);
    this.modalStack.push(w);
    return w;
  }

  closeTop() {
    const m = this.modalStack.pop();
    m?.remove();
  }

  closeAllModals() {
    while (this.modalStack.length) this.closeTop();
  }

  get modalOpen() {
    return this.modalStack.length > 0;
  }

  showPause(h: { resume(): void; settings(): void; rules(): void; mute(): void; fullscreen(): void; scoreboard(): void; log(): void; menu(): void }) {
    const m = this.modal(`<div class="pause-ic">${icons.pause}</div><h2>Oyun duraklatıldı</h2><div class="lead">Masa seni bekliyor. Hazır olduğunda devam et.</div>
      <div class="menu-grid">
        <button class="btn gold full" data-a="resume">${icons.play}Devam Et</button>
        <button class="btn" data-a="settings">${icons.settings}Ayarlar</button>
        <button class="btn" data-a="rules">${icons.book}Kurallar</button>
        <button class="btn" data-a="mute">${this.sound.muted ? icons.volume : icons.mute}${this.sound.muted ? 'Sesi aç' : 'Sesi kapat'}</button>
        <button class="btn" data-a="fullscreen">${icons.expand}Tam ekran</button>
        <button class="btn" data-a="scoreboard">${icons.table}Skor tablosu</button>
        <button class="btn" data-a="log">${icons.list}Oyun kaydı</button>
        <button class="btn danger full" data-a="menu">${icons.exit}Ana Menüye Dön</button>
      </div>`, false, () => h.resume());
    m.querySelectorAll<HTMLElement>('[data-a]').forEach((b) =>
      b.addEventListener('click', () => {
        this.sound.click();
        (h as unknown as Record<string, () => void>)[b.dataset.a!]();
      }),
    );
  }

  showRules(mode: ModeId) {
    let cur = mode;
    const m = this.modal(`<h2>Kurallar</h2><div class="rules-tabs"></div><div class="rules-content"></div><div class="actions"><button class="btn gold" data-close>Tamam</button></div>`, true, () => {});
    const tabs = m.querySelector('.rules-tabs') as HTMLElement;
    const content = m.querySelector('.rules-content') as HTMLElement;
    const render = () => {
      tabs.innerHTML = MODE_ORDER.map((k) => `<button class="btn small ${k === cur ? 'gold' : ''}" data-m="${k}">${MODES[k].name}</button>`).join('');
      tabs.querySelectorAll<HTMLElement>('[data-m]').forEach((b) => b.addEventListener('click', () => { cur = b.dataset.m as ModeId; render(); }));
      content.innerHTML = MODE_RULES[cur] + GENERAL_RULES;
    };
    render();
    m.querySelector('[data-close]')!.addEventListener('click', () => this.closeTop());
  }

  scoreboardHtml(g: GameState): string {
    const mode = g.config.mode;
    const seats = g.seats;
    if (mode === 'esli') {
      const rows = g.summaries.map((s) => {
        const info = `${esc(this.names[s.bidder])} ${s.bid}${s.trump >= 0 ? ' ' + suitHtml(s.trump) : ''}`;
        const us = s.score.deltas[0];
        const th = s.score.deltas[1];
        return `<tr><td>${s.no}. ${info}</td><td class="${us < 0 ? 'neg' : ''}">${us}</td><td class="${th < 0 ? 'neg' : ''}">${th}</td></tr>`;
      }).join('');
      return `<table class="score-table"><thead><tr><th>EL · İHALE</th><th>${esc(this.names[0])} & ${esc(this.names[2])}</th><th>${esc(this.names[1])} & ${esc(this.names[3])}</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3" style="text-align:center;color:var(--dim)">Henüz el oynanmadı</td></tr>'}</tbody>
        <tfoot><tr><td>Toplam</td><td>${g.scores[0]}</td><td>${g.scores[1]}</td></tr></tfoot></table>`;
    }
    const head = seats.map((s) => `<th>${esc(this.names[s])}</th>`).join('');
    const rows = g.summaries.map((s) => {
      const info = mode === 'kozmaca' ? 'Koz ♠' : `${esc(this.names[s.bidder])} ${s.bid}${s.trump >= 0 ? ' ' + suitHtml(s.trump) : ''}`;
      const cells = seats.map((x) => {
        const d = s.score.deltas[x];
        const extra = mode === 'kozmaca' ? `<small style="color:var(--dim)"> (${s.declared[x]}/${s.tricks[x]})</small>` : '';
        return `<td class="${d < 0 ? 'neg' : ''}">${d}${extra}</td>`;
      }).join('');
      return `<tr><td>${s.no}. ${info}</td>${cells}</tr>`;
    }).join('');
    const foot = seats.map((s) => `<td>${g.scores[s]}</td>`).join('');
    return `<table class="score-table"><thead><tr><th>EL · İHALE</th>${head}</tr></thead>
      <tbody>${rows || `<tr><td colspan="${seats.length + 1}" style="text-align:center;color:var(--dim)">Henüz el oynanmadı</td></tr>`}</tbody>
      <tfoot><tr><td>Toplam</td>${foot}</tr></tfoot></table>`;
  }

  showScoreboard(g: GameState, onClose?: () => void) {
    const m = this.modal(`<h2>Skor tablosu</h2><div class="lead">${MODES[g.config.mode].name} · ${g.config.hands} el</div>${this.scoreboardHtml(g)}<div class="actions"><button class="btn gold" data-close>Kapat</button></div>`, true, onClose);
    m.querySelector('[data-close]')!.addEventListener('click', () => {
      this.closeTop();
      onClose?.();
    });
  }

  showSettings(onChange: (key: string) => void, onClose?: () => void) {
    const p = this.prefs;
    const m = this.modal(`<h2>Ayarlar</h2><div class="lead">Değişiklikler hemen uygulanır</div><div class="settings-list">
      <div><div class="field-label"><span>OYUN HIZI</span></div><div class="seg" data-seg="speed"></div></div>
      <div><div class="field-label"><span>GRAFİK KALİTESİ</span></div><div class="seg" data-seg="quality"></div></div>
      <div class="toggles" style="margin:0">
        <label class="tog" data-tog="sfx"><span class="switch"></span>Ses efektleri</label>
        <label class="tog" data-tog="ambient"><span class="switch"></span>Ortam sesi</label>
        <label class="tog" data-tog="oneClick"><span class="switch"></span>Tek tıkla kart at</label>
        <label class="tog" data-tog="fastDeal"><span class="switch"></span>Hızlı dağıtım</label>
      </div></div><div class="actions"><button class="btn gold" data-close>Tamam</button></div>`, false, onClose);
    const segs: Record<string, { v: string; l: string }[]> = {
      speed: [{ v: 'slow', l: 'Ağır' }, { v: 'normal', l: 'Normal' }, { v: 'fast', l: 'Hızlı' }, { v: 'veryfast', l: 'Çok hızlı' }],
      quality: [{ v: 'low', l: 'Düşük' }, { v: 'medium', l: 'Orta' }, { v: 'high', l: 'Yüksek' }],
    };
    m.querySelectorAll<HTMLElement>('[data-seg]').forEach((s) => {
      const key = s.dataset.seg!;
      const render = () => {
        s.innerHTML = segs[key].map((o) => `<button class="${(p as unknown as Record<string, unknown>)[key] === o.v ? 'on' : ''}">${o.l}</button>`).join('');
        s.querySelectorAll('button').forEach((b, i) =>
          b.addEventListener('click', () => {
            (p as unknown as Record<string, unknown>)[key] = segs[key][i].v;
            render();
            onChange(key);
            savePrefs(p);
          }),
        );
      };
      render();
    });
    m.querySelectorAll<HTMLElement>('[data-tog]').forEach((t) => {
      const key = t.dataset.tog as 'sfx' | 'ambient' | 'oneClick' | 'fastDeal';
      const sw = t.querySelector('.switch')!;
      sw.classList.toggle('on', !!p[key]);
      t.addEventListener('click', (e) => {
        e.preventDefault();
        p[key] = !p[key];
        sw.classList.toggle('on', p[key]);
        onChange(key);
        savePrefs(p);
      });
    });
    m.querySelector('[data-close]')!.addEventListener('click', () => {
      this.closeTop();
      onClose?.();
    });
  }

  showHandResult(g: GameState, s: HandSummary): Promise<void> {
    const mode = g.config.mode;
    const h = g.hand;
    let title = 'El bitti';
    let big = '';
    if (mode === 'kozmaca') {
      title = 'El sonucu';
      const mine = s.score.deltas[0];
      big = `<div class="big ${mine < 0 ? 'neg' : 'pos'}">${mine > 0 ? '+' : ''}${mine}</div>`;
    } else {
      const who = this.names[s.bidder];
      const made = s.score.bidderMade;
      const teamWord = mode === 'esli' ? (s.bidder % 2 === 0 ? 'Takımınız' : 'Rakip takım') : who;
      title = made ? `${teamWord} ihaleyi tuttu` : `${teamWord} battı`;
      const bt = mode === 'esli' ? s.tricks[s.bidder] + s.tricks[(s.bidder + 2) % 4] : s.tricks[s.bidder];
      big = `<div class="big ${made ? 'pos' : 'neg'}">${bt} / ${s.bid}</div>`;
    }
    if (s.score.kingSeat >= 0) title = `KİNG! ${this.names[s.score.kingSeat]} 13'ü de aldı`;
    const kozTxt = s.trump >= 0 ? `Koz ${SUIT_SYMBOLS[s.trump]} ${SUIT_NAMES[s.trump]}` : '';
    let rows = '';
    if (mode === 'esli') {
      const teams: [number, number][] = [[0, 2], [1, 3]];
      rows = teams.map(([a, b]) => {
        const d = s.score.deltas[a];
        const t = s.tricks[a] + s.tricks[b];
        const bidT = s.bidder % 2 === a % 2 ? `<span class="tag gold">İhale ${s.bid}</span>` : '<span class="tag">Pas</span>';
        return `<tr class="${a === 0 ? 'me' : ''}"><td>${esc(this.names[a])} & ${esc(this.names[b])}</td><td>${bidT}</td><td>${t}</td><td class="${d < 0 ? 'neg' : 'pos'}">${d > 0 ? '+' : ''}${d}</td><td>${s.totals[a]}</td></tr>`;
      }).join('');
    } else {
      rows = g.seats.map((x) => {
        const d = s.score.deltas[x];
        let bidT = '<span class="tag">–</span>';
        if (mode === 'kozmaca') bidT = `<span class="tag ${s.score.notes[x].includes('battı') ? 'bad' : 'ok'}">${s.declared[x] === 0 ? 'El almam' : 'Söz ' + s.declared[x]}</span>`;
        else if (x === s.bidder) bidT = `<span class="tag gold">İhale ${s.bid}</span>`;
        else if (s.score.notes[x] === 'el almadı') bidT = '<span class="tag bad">El almadı</span>';
        return `<tr class="${x === 0 ? 'me' : ''}"><td>${esc(this.names[x])}</td><td>${bidT}</td><td>${s.tricks[x]}</td><td class="${d < 0 ? 'neg' : 'pos'}">${d > 0 ? '+' : ''}${d}</td><td>${s.totals[x]}</td></tr>`;
      }).join('');
    }
    const last = g.over;
    const m = this.modal(`<div class="result-head"><h2>${esc(title)}</h2>${big}<div class="koz">${kozTxt}${h.forced ? ' · herkes pas dedi, ihale zorunlu verildi' : ''}</div></div>
      <table class="score-table"><thead><tr><th>OYUNCU</th><th>${mode === 'kozmaca' ? 'SÖZ' : 'İHALE'}</th><th>ALDIĞI</th><th>PUAN</th><th>TOPLAM</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="actions"><button class="btn" data-sb>${icons.table}Skor tablosu</button><button class="btn gold" data-next>${last ? 'Sonucu gör' : 'Sonraki el'} <span class="kbd">␣</span></button></div>`, true);
    return new Promise((resolve) => {
      const go = () => {
        document.removeEventListener('keydown', key);
        this.closeTop();
        resolve();
      };
      const key = (e: KeyboardEvent) => {
        if ((e.key === ' ' || e.key === 'Enter') && this.modalStack[this.modalStack.length - 1] === m) {
          e.preventDefault();
          go();
        }
      };
      document.addEventListener('keydown', key);
      m.querySelector('[data-next]')!.addEventListener('click', go);
      m.querySelector('[data-sb]')!.addEventListener('click', () => this.showScoreboard(g));
    });
  }

  showGameOver(g: GameState): Promise<'again' | 'menu'> {
    const w = winners(g);
    const st = standings(g);
    const mode = g.config.mode;
    const iWon = w.includes(0);
    let title = iWon ? 'Tebrikler, kazandın!' : 'Oyun bitti';
    let podium = '';
    if (mode === 'esli') {
      const us = g.scores[0];
      const them = g.scores[1];
      title = us > them || (g.kingSeat >= 0 && g.kingSeat % 2 === 0) ? 'Takımınız kazandı!' : us === them ? 'Berabere!' : 'Rakip takım kazandı';
      podium = `<div class="podium"><div class="p ${us >= them ? 'first' : ''}"><div class="pl">BİZ</div><div class="nm">${esc(this.names[0])} & ${esc(this.names[2])}</div><div class="sc">${us}</div></div>
        <div class="p ${them > us ? 'first' : ''}"><div class="pl">ONLAR</div><div class="nm">${esc(this.names[1])} & ${esc(this.names[3])}</div><div class="sc">${them}</div></div></div>`;
    } else {
      podium = `<div class="podium">${st.map((e) => `<div class="p ${e.place === 1 ? 'first' : ''}"><div class="pl">${e.place}.</div><div class="nm">${esc(this.names[e.seat])}</div><div class="sc">${e.score}</div></div>`).join('')}</div>`;
    }
    if (g.kingSeat >= 0) title = `KİNG! ${this.names[g.kingSeat]} oyunu bitirdi`;
    const m = this.modal(`<h2>${esc(title)}</h2><div class="lead">${MODES[mode].name} · ${g.summaries.length} el oynandı</div>${podium}${this.scoreboardHtml(g)}
      <div class="actions"><button class="btn" data-menu>${icons.exit}Ana menü</button><button class="btn gold" data-again>${icons.play}Yeni oyun</button></div>`, true);
    return new Promise((resolve) => {
      m.querySelector('[data-again]')!.addEventListener('click', () => { this.closeTop(); resolve('again'); });
      m.querySelector('[data-menu]')!.addEventListener('click', () => { this.closeTop(); resolve('menu'); });
    });
  }

  showLastTrick(h: HandState) {
    const t = h.history[h.history.length - 1];
    if (!t) {
      this.toast('Henüz tamamlanan el yok');
      return;
    }
    const cards = t.plays.map((p) => {
      const red = isRed(suitOf(p.card));
      return `<div><div class="mini ${red ? 'red' : ''} ${p.seat === t.winner ? 'win' : ''}">${RANK_LABELS[rankOf(p.card)]}<i>${SUIT_SYMBOLS[suitOf(p.card)]}</i></div><div class="mini-name">${esc(this.names[p.seat])}</div></div>`;
    }).join('');
    const m = this.modal(`<h2>Son el</h2><div class="lead"><b>${esc(this.names[t.winner])}</b> aldı · ${h.history.length}. el</div><div class="last-trick-cards" style="display:flex;gap:12px;justify-content:center">${cards}</div><div class="actions"><button class="btn gold" data-close>Kapat</button></div>`, false, () => {});
    m.querySelector('[data-close]')!.addEventListener('click', () => this.closeTop());
  }
}
