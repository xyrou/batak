import * as THREE from 'three';
import { Card, SUIT_NAMES, SUIT_SYMBOLS, Suit, isRed, makeRng, suitOf } from './engine/cards';
import { GameState, finishHand, newGame, redeal, startNextHand } from './engine/game';
import {
  HandState, Play, applyBid, applyBury, applyDeclare, applyPlay, applyTrump, dealOrder, decisionSeat, legalMoves,
} from './engine/hand';
import { MODES } from './engine/rules';
import { aiBid, aiBury, aiDeclare, aiPlay, aiTrump, hintFor } from './ai/decide';
import { heuristicPlay } from './ai/heuristic';
import { Stage } from './render/stage';
import { CardTable, CardView } from './render/cards3d';
import { drawScorepad } from './render/scorepad';
import { UI, cardLabel } from './ui/ui';
import { Sound } from './audio';
import { Prefs, SPEED_FACTOR, savePrefs } from './prefs';

class Aborted extends Error {}

export class Director {
  stage: Stage;
  table: CardTable;
  ui: UI;
  sound: Sound;
  prefs: Prefs;
  game: GameState | null = null;
  rng = makeRng(Date.now() & 0x7fffffff);
  private gen = 0;
  paused = false;
  private pauseWaiters: (() => void)[] = [];
  private cancelers: (() => void)[] = [];
  private humanPlay: { seat: number; legal: Card[]; resolve: (c: Card) => void } | null = null;
  private bury: { sel: Set<Card>; update: (n: number) => void; resolve: (c: Card[]) => void } | null = null;
  private hovered: CardView | null = null;
  private selected: CardView | null = null;
  private down: { x: number; y: number; view: CardView | null; id: number } | null = null;
  private drag: { view: CardView; seat: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private idle = 0;
  private stopTimer: () => void = () => {};
  /** Test/izleme: insan koltuğunu da yapay zekâ oynar */
  autoHuman = false;

  constructor(stage: Stage, table: CardTable, ui: UI, sound: Sound, prefs: Prefs) {
    this.stage = stage;
    this.table = table;
    this.ui = ui;
    this.sound = sound;
    this.prefs = prefs;
    this.ui.isPaused = () => this.paused;
    this.bindInput();
    stage.onFrame((dt) => {
      // Menüdeyken kamera hafifçe salınır
      if (!this.game) {
        this.idle += dt;
        stage.orbitGoal.yaw = Math.sin(this.idle * 0.12) * 0.35;
      }
    });
  }

  // ─── Yardımcılar ───────────────────────────────────────────────────────
  private check(gen: number) {
    if (gen !== this.gen) throw new Aborted();
  }

  private async gate(gen: number) {
    this.check(gen);
    while (this.paused) {
      await new Promise<void>((r) => this.pauseWaiters.push(r));
      this.check(gen);
    }
  }

  private async wait(sec: number, gen: number) {
    await this.stage.tweens.wait(sec);
    await this.gate(gen);
  }

  private get think() {
    return SPEED_FACTOR[this.prefs.speed].think;
  }

  private dur(s: number) {
    return this.table.dur(s);
  }

  private name(seat: number) {
    return this.ui.names[seat];
  }

  applySpeed() {
    this.table.speed = SPEED_FACTOR[this.prefs.speed].anim;
  }

  pause() {
    if (this.paused || !this.game) return;
    this.paused = true;
    this.stage.tweens.paused = true;
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.stage.tweens.paused = false;
    const w = this.pauseWaiters;
    this.pauseWaiters = [];
    w.forEach((r) => r());
  }

  // ─── Oyun başlat / bitir ────────────────────────────────────────────────
  async start(prefs: Prefs) {
    this.prefs = prefs;
    this.abort();
    const gen = ++this.gen;
    this.applySpeed();
    this.table.sortBySuit = prefs.sortBySuit;
    this.stage.setView('seat');
    this.ui.hideMenu();
    const names = ['Sen', 'Mehmet', 'Ayşe', 'Kemal'];
    names[0] = prefs.name || 'Sen';
    const g = newGame({
      mode: prefs.mode,
      rules: { ...prefs.rules[prefs.mode] },
      hands: prefs.hands,
      names,
      difficulty: prefs.difficulty,
    });
    this.game = g;
    this.ui.buildHud(g, {
      pause: () => this.openPause(),
      scoreboard: () => this.modalWithPause((done) => this.ui.showScoreboard(g, done)),
      camera: () => this.stage.cycleView(),
      sound: () => this.toggleMute(),
      sort: () => this.toggleSort(),
      hint: () => this.hint(),
      lastTrick: () => this.game && this.ui.showLastTrick(this.game.hand),
      cameraReset: () => this.stage.setView('seat'),
      log: () => this.ui.toggleLog(),
    });
    this.updatePad();
    this.ui.log(`<b>${MODES[g.config.mode].name}</b> başladı · ${g.config.hands} el · ${diffName(g.config.difficulty)}`);
    try {
      await this.runGame(gen);
    } catch (e) {
      if (!(e instanceof Aborted)) {
        console.error(e);
        this.ui.toast('Beklenmeyen bir hata oluştu');
      }
    }
  }

  abort() {
    this.gen++;
    this.cancelers.forEach((c) => c());
    this.cancelers = [];
    this.humanPlay = null;
    this.bury = null;
    this.stopTimer();
    this.resume();
    this.ui.closeAction();
    this.ui.closeAllModals();
    this.ui.clearBubbles();
  }

  quitToMenu(showMenu: () => void) {
    this.abort();
    this.game = null;
    this.ui.destroyHud();
    void this.table.gatherToDeck(0);
    this.stage.setView('seat');
    showMenu();
  }

  private async runGame(gen: number) {
    const g = this.game!;
    let first = true;
    while (true) {
      await this.playHand(gen, first);
      first = false;
      this.check(gen);
      if (g.over) break;
      startNextHand(g);
    }
    this.ui.setTurn(-1);
    const iWon = winnersInclude(g, 0);
    if (iWon) this.sound.win();
    else this.sound.lose();
    const res = await this.ui.showGameOver(g);
    this.check(gen);
    if (res === 'again') void this.start(this.prefs);
    else this.quitToMenu(() => this.onMenu());
  }

  onMenu: () => void = () => {};

  // ─── Bir el ────────────────────────────────────────────────────────────
  private async playHand(gen: number, first: boolean) {
    const g = this.game!;
    let h = g.hand;
    this.table.trump = -1;
    this.table.dummySeat = -1;
    this.table.seatsActive = g.seats;
    this.ui.updateHud(g);
    this.ui.setTurn(-1);
    this.ui.status('Kartlar karıştırılıyor', `${this.name(h.dealer)} dağıtıyor · ${g.handNo}. el`);
    if (!first) await this.table.gatherToDeck(h.dealer);
    else {
      this.table.resetToDeck(h.dealer);
      this.table.views.forEach((v, i) => this.table.moveTo(v, this.table.deckSlot(h.dealer, i), this.dur(0.6), { delay: i * 0.004 }));
      await this.wait(this.dur(0.7), gen);
    }
    this.check(gen);
    this.sound.shuffle();
    await this.table.shuffleAnim(h.dealer);
    await this.gate(gen);
    await this.deal(h, gen);
    this.ui.log(`<b>${g.handNo}. el</b> · dağıtan ${this.name(h.dealer)}`);

    while (h.phase !== 'done') {
      await this.gate(gen);
      if (h.phase === 'redeal') {
        this.ui.toast('Herkes pas dedi — kartlar yeniden dağıtılıyor');
        this.ui.log('Herkes pas dedi, yeniden dağıtım');
        await this.wait(1.2 * this.think, gen);
        redeal(g);
        h = g.hand;
        this.ui.updateHud(g);
        await this.table.gatherToDeck(h.dealer);
        this.sound.shuffle();
        await this.table.shuffleAnim(h.dealer);
        await this.deal(h, gen);
        continue;
      }
      const { seat, controller } = decisionSeat(h);
      this.ui.setTurn(seat);
      this.ui.updateHud(g);
      switch (h.phase) {
        case 'bidding':
          await this.stepBid(h, seat, gen);
          break;
        case 'declare':
          await this.stepDeclare(h, seat, gen);
          break;
        case 'trump':
          await this.stepTrump(h, seat, gen);
          break;
        case 'bury':
          await this.stepBury(h, seat, gen);
          break;
        case 'play':
          await this.stepPlay(h, seat, controller, gen);
          break;
      }
      this.ui.updateHud(g);
    }
    this.ui.setTurn(-1);
    const summary = finishHand(g);
    this.ui.updateHud(g);
    this.updatePad();
    const d = summary.score.deltas[0];
    this.ui.log(`El sonu: ${g.seats.map((s) => `${this.name(s)} ${summary.score.deltas[s] > 0 ? '+' : ''}${summary.score.deltas[s]}`).join(' · ')}`);
    if (d > 0) this.sound.bid();
    else if (d < 0) this.sound.error();
    this.ui.status('El bitti', 'Sonuçlar hesaplandı');
    await this.wait(0.5 * this.think, gen);
    const resultP = this.ui.showHandResult(g, summary);
    if (this.autoHuman) {
      await this.wait(1.2, gen);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    }
    await resultP;
    this.check(gen);
  }

  private async deal(h: HandState, gen: number) {
    const order = dealOrder(h);
    const interval = (this.prefs.fastDeal ? 0.016 : 0.042) * this.table.speed;
    const counts = [0, 0, 0, 0];
    const totals = [0, 0, 0, 0];
    for (const o of order) totals[o.seat]++;
    // Yer kartları (gömmeli)
    h.kitty.forEach((c, i) => {
      const v = this.table.view(c);
      v.zone = 'kitty';
      void this.table.moveTo(v, this.table.kittySlot(i, false), this.dur(0.4), { delay: i * 0.05, arc: 0.04 });
    });
    const ps: Promise<void>[] = [];
    order.forEach((o, i) => {
      const v = this.table.view(o.card);
      const k = counts[o.seat]++;
      v.seat = o.seat;
      v.zone = 'hand';
      const slot = o.seat === 0 ? this.table.handSlot(k, totals[0]) : this.table.oppHandSlot(o.seat, k, totals[o.seat]);
      if (o.seat === 0) v.setShadow(false);
      ps.push(
        this.table.moveTo(v, slot, this.dur(0.32), { delay: 0.2 + i * interval, arc: 0.05 }).then(() => {
          if (i % 2 === 0) this.sound.deal();
        }),
      );
    });
    await Promise.all(ps);
    await this.gate(gen);
    this.table.layoutHand(this.dur(0.4), h.hands[0]);
    for (const s of h.seats) if (s !== 0) this.table.layoutOpp(s, h.hands[s], this.dur(0.3));
    await this.wait(this.dur(0.45), gen);
  }

  // ─── Adımlar ───────────────────────────────────────────────────────────
  private async aiThink<T>(seat: number, base: number, gen: number, fn: () => T): Promise<T> {
    this.ui.setThinking(seat, true);
    await this.wait(0.06, gen);
    const t0 = performance.now();
    const r = fn();
    const spent = (performance.now() - t0) / 1000;
    const jitter = 0.75 + this.rng() * 0.5;
    await this.wait(Math.max(0.08, base * this.think * jitter - spent), gen);
    this.ui.setThinking(seat, false);
    return r;
  }

  private withTimer(onExpire: () => void) {
    this.stopTimer();
    if (this.prefs.turnTime > 0) this.stopTimer = this.ui.startTimer(this.prefs.turnTime, onExpire);
    else this.stopTimer = () => {};
  }

  private async stepBid(h: HandState, seat: number, gen: number) {
    let bid: number | null;
    if (seat === 0 && !this.autoHuman) {
      this.ui.status('İhale sırası sende', 'Kaç el alabileceğini söyle ya da pas de', true);
      this.sound.turn();
      const rec = aiBid(h, 0, 'medium', this.rng);
      const p = this.ui.askBid(h, rec);
      this.withTimer(() => this.ui.pendingCancel?.());
      bid = await p;
      this.stopTimer();
      this.check(gen);
    } else {
      this.ui.status(`${this.name(seat)} ihalede`, 'Düşünüyor…');
      bid = await this.aiThink(seat, 0.9, gen, () => aiBid(h, seat, this.game!.config.difficulty, this.rng));
    }
    applyBid(h, seat, bid);
    this.ui.bubble(seat, bid === null ? 'Pas' : String(bid), bid === null ? 'pass' : '');
    this.ui.log(`${this.name(seat)}: ${bid === null ? 'pas' : bid}`);
    if (bid !== null) this.sound.bid();
    else this.sound.click();
    if (h.phase === 'trump') {
      const msg = h.forced
        ? `Herkes pas dedi — ihale ${h.bid} ile <b>${this.name(h.bidder)}</b>'e kaldı`
        : `<b>${this.name(h.bidder)}</b> ihaleyi <b>${h.bid}</b> ile aldı`;
      this.ui.toast(msg);
      this.ui.log(msg);
      await this.wait(0.7 * this.think, gen);
    }
  }

  private async stepDeclare(h: HandState, seat: number, gen: number) {
    let n: number;
    if (seat === 0 && !this.autoHuman) {
      this.ui.status('Söz sırası sende', 'Bu elde kaç el alacağını söyle', true);
      this.sound.turn();
      const rec = aiDeclare(h, 0, 'medium', this.rng);
      let applyAuto: (x: number) => void = () => {};
      const auto = new Promise<number>((r) => (applyAuto = r));
      const p = this.ui.askDeclare(h, rec);
      this.withTimer(() => {
        this.ui.closeAction();
        applyAuto(rec);
      });
      n = await Promise.race([p, auto]);
      this.stopTimer();
      this.check(gen);
    } else {
      this.ui.status(`${this.name(seat)} söz veriyor`, 'Düşünüyor…');
      n = await this.aiThink(seat, 0.8, gen, () => aiDeclare(h, seat, this.game!.config.difficulty, this.rng));
    }
    applyDeclare(h, seat, n);
    this.ui.bubble(seat, n === 0 ? 'El almam' : `${n} el`);
    this.ui.log(`${this.name(seat)}: ${n === 0 ? 'el almam' : n + ' el'}`);
    this.sound.bid();
    if (h.phase === 'play') {
      this.table.resort(h.trump);
      this.ui.toast('Koz <b>♠ Maça</b> · oyun başlıyor');
      await this.wait(0.6 * this.think, gen);
    }
  }

  private async stepTrump(h: HandState, seat: number, gen: number) {
    let suit: Suit;
    if (seat === 0 && !this.autoHuman) {
      this.ui.status('Kozu seç', `İhale ${h.bid} ile sende`, true);
      this.sound.turn();
      const rec = aiTrump(h, 0, 'medium', this.rng);
      let auto: (s: Suit) => void = () => {};
      const autoP = new Promise<Suit>((r) => (auto = r));
      const p = this.ui.askTrump(h, rec);
      this.withTimer(() => {
        this.ui.closeAction();
        auto(rec);
      });
      suit = await Promise.race([p, autoP]);
      this.stopTimer();
      this.check(gen);
    } else {
      this.ui.status(`${this.name(seat)} koz seçiyor`, 'Düşünüyor…');
      suit = await this.aiThink(seat, 1.0, gen, () => aiTrump(h, seat, this.game!.config.difficulty, this.rng));
    }
    applyTrump(h, seat, suit);
    this.sound.trump();
    const red = isRed(suit);
    this.ui.bubble(seat, `Koz ${SUIT_SYMBOLS[suit]}`, red ? 'red' : '');
    this.ui.toast(`Koz <b style="color:${red ? '#ff8f96' : 'inherit'}">${SUIT_SYMBOLS[suit]} ${SUIT_NAMES[suit]}</b>`);
    this.ui.log(`${this.name(seat)} kozu ${SUIT_SYMBOLS[suit]} ${SUIT_NAMES[suit]} seçti`);
    this.table.resort(suit);
    if (h.dummy >= 0) {
      if (h.dummy !== 0) this.table.layoutDummy(h.dummy, h.hands[h.dummy], this.dur(0.6));
      this.ui.log(`${this.name(h.dummy)} kartlarını açtı`);
      this.ui.toast(h.dummy === 0 ? `Kartların açıldı — <b>${this.name(h.bidder)}</b> senin yerine oynayacak` : `<b>${this.name(h.dummy)}</b> kartlarını masaya açtı`);
      await this.wait(this.dur(0.7), gen);
    }
    if (h.phase === 'bury' && h.kittyTaken.length) {
      // önce al sonra göm: yer kartları açılır ve ihaleciye gider
      await this.revealKitty(h, gen);
    }
    await this.wait(0.4 * this.think, gen);
  }

  private async revealKitty(h: HandState, gen: number) {
    const cards = h.kittyTaken;
    const ps = cards.map((c, i) => this.table.moveTo(this.table.view(c), this.table.kittySlot(i, true), this.dur(0.45), { delay: i * 0.08, arc: 0.05 }));
    await Promise.all(ps);
    this.sound.flick();
    this.ui.toast(`Yerden gelen: <b>${cards.map(cardLabel).join(' ')}</b>`);
    this.ui.log(`Yerden ${this.name(h.bidder)}'e: ${cards.map(cardLabel).join(' ')}`);
    await this.wait(1.4 * this.think, gen);
    if (h.bidder === 0) this.table.layoutHand(this.dur(0.45), h.hands[0]);
    else this.table.layoutOpp(h.bidder, h.hands[h.bidder], this.dur(0.45));
    await this.wait(this.dur(0.5), gen);
  }

  private async stepBury(h: HandState, seat: number, gen: number) {
    let cards: Card[];
    const blind = h.rules.buryMode === 'blind';
    if (seat === 0 && !this.autoHuman) {
      this.ui.status('Kart göm', 'Elinden gömeceğin 4 kartı seç', true);
      this.sound.turn();
      cards = await new Promise<Card[]>((resolve) => {
        const sel = new Set<Card>();
        const panel = this.ui.buryPanel(
          blind,
          () => {
            if (sel.size === 4) {
              this.ui.closeAction();
              resolve([...sel]);
            }
          },
          () => {
            const sug = aiBury(h, 0);
            sel.clear();
            for (const c of sug) sel.add(c);
            this.refreshBurySel();
          },
        );
        this.bury = { sel, update: panel.update, resolve };
        this.withTimer(() => {
          this.ui.closeAction();
          resolve(aiBury(h, 0));
        });
        this.refreshBurySel();
      });
      this.stopTimer();
      this.bury = null;
      this.check(gen);
      for (const v of this.table.views) {
        v.selected = false;
        v.lift = 0;
        v.setGlow(false);
      }
    } else {
      this.ui.status(`${this.name(seat)} kart gömüyor`, 'Düşünüyor…');
      cards = await this.aiThink(seat, 1.3, gen, () => aiBury(h, seat));
    }
    applyBury(h, seat, cards);
    this.sound.flick();
    const ps = cards.map((c, i) => this.table.moveTo(this.table.view(c), this.table.buriedSlot(seat, i), this.dur(0.5), { delay: i * 0.07, arc: 0.05 }));
    for (const c of cards) this.table.view(c).zone = 'buried';
    if (seat === 0) this.table.layoutHand(this.dur(0.35), h.hands[0].filter((c) => !h.kittyTaken.includes(c) || !blind));
    else this.table.layoutOpp(seat, h.hands[seat].filter((c) => !h.kittyTaken.includes(c) || !blind), this.dur(0.35));
    await Promise.all(ps);
    this.ui.log(`${this.name(seat)} 4 kart gömdü`);
    if (blind) await this.revealKitty(h, gen);
    else {
      if (seat === 0) this.table.layoutHand(this.dur(0.35), h.hands[0]);
      else this.table.layoutOpp(seat, h.hands[seat], this.dur(0.35));
      await this.wait(this.dur(0.4), gen);
    }
  }

  private async stepPlay(h: HandState, seat: number, controller: number, gen: number) {
    let card: Card;
    const order = h.trick.length;
    if (controller === 0 && !this.autoHuman) {
      const legal = legalMoves(h, seat);
      const forDummy = seat !== 0;
      this.ui.status(
        forDummy ? `${this.name(seat)} için oyna` : 'Sıra sende',
        forDummy ? 'Açık eşinin kartlarından birini seç' : order === 0 ? 'Eli sen açıyorsun — bir kart at' : 'Bir kart seç ve at',
        true,
      );
      this.sound.turn();
      card = await new Promise<Card>((resolve) => {
        this.humanPlay = { seat, legal, resolve };
        this.markLegal(h, seat, legal);
        this.withTimer(() => {
          const pick = heuristicPlay(h, seat, 0, legal);
          this.finishHumanPlay(pick);
        });
      });
      this.stopTimer();
      this.check(gen);
    } else {
      const who = controller !== seat ? `${this.name(controller)}, ${this.name(seat)} yerine oynuyor` : `${this.name(seat)} oynuyor`;
      this.ui.status(who, order === 0 ? 'Eli açıyor…' : 'Düşünüyor…');
      card = await this.aiThink(controller, order === 0 ? 0.75 : 0.6, gen, () =>
        aiPlay(h, seat, controller, this.game!.config.difficulty, this.rng),
      );
    }
    const res = applyPlay(h, seat, card);
    await this.animatePlay(h, seat, card, order);
    this.ui.updateHud(this.game!);
    if (res.completed) {
      await this.collectTrick(h, res.winner, res.plays, gen);
    }
  }

  private async animatePlay(h: HandState, seat: number, card: Card, order: number) {
    const v = this.table.view(card);
    v.selected = false;
    v.lift = 0;
    v.setDim(false);
    v.setGlow(false);
    v.setShadow(true);
    v.zone = 'trick';
    if (this.selected === v) this.selected = null;
    if (this.hovered === v) this.hovered = null;
    this.sound.flick();
    if (seat === 0) this.table.layoutHand(this.dur(0.28), h.hands[0]);
    else if (seat === h.dummy) this.table.layoutDummy(seat, h.hands[seat], this.dur(0.3));
    else this.table.layoutOpp(seat, h.hands[seat], this.dur(0.28));
    await this.table.moveTo(v, this.table.trickSlot(seat, order), this.dur(0.36), { arc: 0.07, ease: (t) => 1 - Math.pow(1 - t, 3) });
    this.sound.place();
  }

  private async collectTrick(h: HandState, winner: number, plays: Play[], gen: number) {
    const win = plays.find((p) => p.seat === winner)!;
    await this.wait(this.dur(0.35), gen);
    this.table.view(win.card).setGlow(true, '#f3c969');
    const trumped = h.trump !== -1 && suitOf(win.card) === h.trump && suitOf(plays[0].card) !== h.trump;
    this.ui.log(`${h.history.length}. el: <b>${this.name(winner)}</b> aldı (${cardLabel(win.card)}${trumped ? ', koz' : ''}) — ${plays.map((p) => cardLabel(p.card)).join(' ')}`);
    await this.wait(this.dur(0.55), gen);
    this.table.view(win.card).setGlow(false);
    this.sound.collect();
    const idx = h.tricksWon[winner] - 1;
    const ps = plays.map((p, k) => {
      const v = this.table.view(p.card);
      v.zone = 'won';
      return this.table.moveTo(v, this.table.wonSlot(winner, idx, k), this.dur(0.45), { delay: k * 0.035, arc: 0.03 });
    });
    await Promise.all(ps);
    await this.gate(gen);
  }

  // ─── Yazboz ────────────────────────────────────────────────────────────
  updatePad() {
    const g = this.game;
    if (!g) return;
    const short = (s: string) => (s.length > 6 ? s.slice(0, 5) + '.' : s);
    if (g.config.mode === 'esli') {
      drawScorepad(this.stage.notepadCanvas, {
        title: 'Eşli Batak',
        columns: ['Biz', 'Onlar'],
        rows: g.summaries.map((s) => [s.score.deltas[0], s.score.deltas[1]]),
        totals: [g.scores[0], g.scores[1]],
      });
    } else {
      drawScorepad(this.stage.notepadCanvas, {
        title: MODES[g.config.mode].short,
        columns: g.seats.map((s) => short(this.name(s))),
        rows: g.summaries.map((s) => g.seats.map((x) => s.score.deltas[x])),
        totals: g.seats.map((s) => g.scores[s]),
      });
    }
    this.stage.notepadTex.needsUpdate = true;
  }

  // ─── İnsan girdisi ─────────────────────────────────────────────────────
  private markLegal(h: HandState, seat: number, legal: Card[]) {
    for (const c of h.hands[seat]) this.table.view(c).setDim(!legal.includes(c));
  }

  private clearMarks() {
    for (const v of this.table.views) {
      v.setDim(false);
      if (!this.bury) v.setGlow(false);
    }
  }

  private finishHumanPlay(card: Card) {
    const hp = this.humanPlay;
    if (!hp) return;
    this.humanPlay = null;
    this.clearMarks();
    this.selected = null;
    hp.resolve(card);
  }

  private interactiveViews(): CardView[] {
    const g = this.game;
    if (!g) return [];
    const h = g.hand;
    if (this.humanPlay && this.humanPlay.seat !== 0) return h.hands[this.humanPlay.seat].map((c) => this.table.view(c));
    return this.table.handOrder.map((c) => this.table.view(c));
  }

  private pick(clientX: number, clientY: number): CardView | null {
    const views = this.interactiveViews();
    if (!views.length) return null;
    const r = this.stage.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.stage.camera);
    const hits = this.raycaster.intersectObjects(views.map((v) => v.front), false);
    if (!hits.length) return null;
    return hits[0].object.userData.view as CardView;
  }

  private setHover(v: CardView | null) {
    if (this.hovered === v) return;
    const prev = this.hovered;
    this.hovered = v;
    const inHand = (x: CardView | null) => !!x && this.table.handOrder.includes(x.card);
    const canAct = (x: CardView) => !!this.humanPlay || !!this.bury || !x.dim;
    if (prev && inHand(prev)) prev.lift = prev.selected ? 0.045 : 0;
    if (v && inHand(v) && canAct(v)) v.lift = v.selected ? 0.05 : v.dim ? 0.008 : 0.022;
    if (prev?.zone === 'dummy' && !prev.selected) prev.setGlow(false);
    if (v?.zone === 'dummy' && !v.dim) v.setGlow(true, '#f3e2b0');
    if (inHand(prev) || inHand(v)) this.table.refreshLift();
    this.stage.renderer.domElement.style.cursor = v && !v.dim && (this.humanPlay || this.bury) ? 'pointer' : 'default';
  }

  private tryCard(v: CardView, viaDouble = false) {
    const g = this.game;
    if (!g) return;
    const h = g.hand;
    if (this.bury) {
      if (!h.hands[0].includes(v.card)) return;
      const sel = this.bury.sel;
      if (sel.has(v.card)) sel.delete(v.card);
      else if (sel.size < 4) sel.add(v.card);
      else {
        this.sound.error();
        this.ui.toast('En fazla 4 kart gömebilirsin');
        return;
      }
      this.sound.click();
      this.refreshBurySel();
      return;
    }
    const hp = this.humanPlay;
    if (!hp) return;
    if (!h.hands[hp.seat].includes(v.card)) return;
    if (!hp.legal.includes(v.card)) {
      this.sound.error();
      this.ui.toast(illegalReason(h, hp.seat, v.card));
      return;
    }
    if (this.prefs.oneClick || viaDouble || this.selected === v) {
      this.finishHumanPlay(v.card);
      return;
    }
    if (this.selected) {
      this.selected.selected = false;
      this.selected.lift = 0;
      this.selected.setGlow(false);
    }
    this.selected = v;
    v.selected = true;
    v.lift = 0.05;
    v.setGlow(true, '#f3c969');
    this.table.refreshLift();
    this.sound.click();
  }

  private refreshBurySel() {
    const b = this.bury;
    if (!b) return;
    for (const c of this.table.handOrder) {
      const v = this.table.view(c);
      const on = b.sel.has(c);
      v.selected = on;
      v.lift = on ? 0.05 : 0;
      v.setGlow(on, '#e0505a');
    }
    this.table.refreshLift();
    b.update(b.sel.size);
  }

  private bindInput() {
    const el = this.stage.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      this.sound.ensure();
      if (e.button !== 0) return;
      const v = this.pick(e.clientX, e.clientY);
      this.down = { x: e.clientX, y: e.clientY, view: v, id: e.pointerId };
    });
    el.addEventListener('pointermove', (e) => {
      if (this.drag) {
        this.dragMove(e.clientX, e.clientY);
        return;
      }
      if (this.down?.view && this.humanPlay && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 14) {
        const v = this.down.view;
        if (this.humanPlay.legal.includes(v.card) && this.table.handOrder.includes(v.card)) {
          this.drag = { view: v, seat: this.humanPlay.seat };
          el.setPointerCapture(this.down.id);
          this.stage.tweens.cancel(v);
          this.dragMove(e.clientX, e.clientY);
          return;
        }
      }
      if (e.pointerType === 'mouse') this.setHover(this.pick(e.clientX, e.clientY));
    });
    el.addEventListener('pointerup', (e) => {
      if (e.button !== 0) return;
      const d = this.down;
      this.down = null;
      if (this.drag) {
        const v = this.drag.view;
        this.drag = null;
        const r = el.getBoundingClientRect();
        const up = (e.clientY - r.top) / r.height < 0.66;
        if (up && this.humanPlay && this.humanPlay.legal.includes(v.card)) this.finishHumanPlay(v.card);
        else this.table.refreshLift();
        return;
      }
      if (!d) return;
      const v = this.pick(e.clientX, e.clientY);
      if (v && v === d.view) this.tryCard(v);
    });
    el.addEventListener('dblclick', (e) => {
      const v = this.pick(e.clientX, e.clientY);
      if (v && this.humanPlay) this.tryCard(v, true);
    });
    el.addEventListener('pointerleave', () => this.setHover(null));

    document.addEventListener('keydown', (e) => {
      this.sound.ensure();
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
      if (!this.game) return;
      const k = e.key.toLowerCase();
      if (e.key === 'Escape') {
        if (this.ui.modalOpen) {
          if (this.paused && this.ui.modalOpen) {
            this.ui.closeAllModals();
            this.resume();
          }
          return;
        }
        this.openPause();
        return;
      }
      if (this.ui.modalOpen) return;
      if (k === 'k') this.modalWithPause((done) => { this.ui.showRules(this.game!.config.mode); watchClose(this.ui, done); });
      else if (k === 'h') this.hint();
      else if (k === 's') this.toggleSort();
      else if (k === 'l') this.ui.showLastTrick(this.game.hand);
      else if (k === 'c') this.stage.cycleView();
      else if ((e.key === ' ' || e.key === 'Enter') && this.selected && this.humanPlay) {
        e.preventDefault();
        this.tryCard(this.selected, true);
      }
    });
  }

  private dragMove(x: number, y: number) {
    const d = this.drag;
    if (!d) return;
    const r = this.stage.renderer.domElement.getBoundingClientRect();
    const nx = ((x - r.left) / r.width) * 2 - 1;
    const ny = -((y - r.top) / r.height) * 2 + 1;
    const depth = 0.7;
    const half = this.stage.visibleHalfSize(depth);
    d.view.group.position.set(nx * half.w, ny * half.h, -depth);
  }

  // ─── Araç çubuğu eylemleri ──────────────────────────────────────────────
  openPause() {
    if (!this.game || this.ui.modalOpen) return;
    this.pause();
    this.ui.showPause({
      resume: () => {
        this.ui.closeAllModals();
        this.resume();
      },
      settings: () => this.ui.showSettings((key) => this.onSettingChange(key)),
      rules: () => this.ui.showRules(this.game!.config.mode),
      mute: () => {
        this.toggleMute();
        this.ui.closeTop();
        this.paused = false;
        this.openPause();
      },
      fullscreen: () => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
      },
      scoreboard: () => this.ui.showScoreboard(this.game!),
      log: () => {
        this.ui.closeAllModals();
        this.resume();
        this.ui.toggleLog();
      },
      menu: () => this.quitToMenu(() => this.onMenu()),
    });
  }

  private modalWithPause(open: (done: () => void) => void) {
    if (!this.game) return;
    const wasPaused = this.paused;
    this.pause();
    open(() => {
      if (!wasPaused) this.resume();
    });
  }

  onSettingChange(key: string) {
    if (key === 'speed') this.applySpeed();
    if (key === 'quality') this.stage.setQuality(this.prefs.quality);
    if (key === 'sfx') this.sound.setSfx(this.prefs.sfx);
    if (key === 'ambient') this.sound.setAmbient(this.prefs.ambient);
  }

  toggleMute() {
    this.sound.ensure();
    this.sound.setMuted(!this.sound.muted);
    this.ui.setSoundIcon();
  }

  toggleSort() {
    this.prefs.sortBySuit = !this.prefs.sortBySuit;
    this.table.sortBySuit = this.prefs.sortBySuit;
    this.table.resort(this.table.trump);
    this.ui.setSortIcon();
    savePrefs(this.prefs);
  }

  hint() {
    const g = this.game;
    if (!g) return;
    const h = g.hand;
    if (this.bury) {
      const sug = aiBury(h, 0);
      this.bury.sel.clear();
      for (const c of sug) this.bury.sel.add(c);
      this.refreshBurySel();
      return;
    }
    const hp = this.humanPlay;
    if (!hp) {
      this.ui.toast('İpucu kendi sıranda kullanılabilir');
      return;
    }
    const c = hintFor(h, hp.seat, 0, this.rng);
    const v = this.table.view(c);
    v.setGlow(true, '#7fe0a3');
    if (this.table.handOrder.includes(c)) {
      v.lift = 0.05;
      this.table.refreshLift();
    }
    this.ui.toast(`Öneri: <b>${cardLabel(c)}</b>`);
    window.setTimeout(() => {
      if (this.selected !== v) {
        v.setGlow(false);
        if (this.table.handOrder.includes(c) && this.hovered !== v) {
          v.lift = 0;
          this.table.refreshLift();
        }
      }
    }, 2200);
  }
}

function watchClose(ui: UI, done: () => void) {
  const iv = window.setInterval(() => {
    if (!ui.modalOpen) {
      window.clearInterval(iv);
      done();
    }
  }, 200);
}

function winnersInclude(g: GameState, seat: number): boolean {
  if (g.kingSeat >= 0) return g.config.mode === 'esli' ? g.kingSeat % 2 === seat % 2 : g.kingSeat === seat;
  if (g.config.mode === 'esli') return g.scores[seat] > g.scores[(seat + 1) % 4];
  const best = Math.max(...g.seats.map((s) => g.scores[s]));
  return g.scores[seat] === best;
}

function diffName(d: string) {
  return d === 'easy' ? 'Kolay' : d === 'hard' ? 'Zor' : 'Orta';
}

export function illegalReason(h: HandState, seat: number, card: Card): string {
  const hand = h.hands[seat];
  const s = suitOf(card);
  const trump = h.trump;
  if (h.trick.length === 0) {
    if (trump !== -1 && s === trump && !h.trumpBroken) return 'Koz henüz kırılmadı — kozla başlayamazsın';
    return 'Bu kartı şu an atamazsın';
  }
  const led = suitOf(h.trick[0].card);
  const hasLed = hand.some((c) => suitOf(c) === led);
  if (hasLed && s !== led) return `Renge uymalısın: ${SUIT_SYMBOLS[led]} ${SUIT_NAMES[led]} at`;
  if (hasLed && s === led) return 'Yerdeki kartı büyütmek zorundasın';
  if (trump !== -1 && s !== trump && hand.some((c) => suitOf(c) === trump)) return `Rengin yok — koz (${SUIT_SYMBOLS[trump]}) atmalısın`;
  if (trump !== -1 && s === trump) return 'Yerdeki kozu yükseltmek zorundasın';
  return 'Bu kartı şu an atamazsın';
}
