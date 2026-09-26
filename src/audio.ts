/** WebAudio ile sentezlenen kart ve kahvehane sesleri (dosya indirmeden) */
export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private noise!: AudioBuffer;
  private brown!: AudioBuffer;
  sfxOn = true;
  ambOn = true;
  muted = false;
  private ambStarted = false;
  private clinkTimer = 0;

  /** İlk kullanıcı etkileşiminde çağrılır */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = this.sfxOn ? 1 : 0;
    this.sfx.connect(this.master);
    this.amb = this.ctx.createGain();
    this.amb.gain.value = this.ambOn ? 1 : 0;
    this.amb.connect(this.master);
    const sr = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, sr, sr);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.brown = this.ctx.createBuffer(1, sr * 4, sr);
    const b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < b.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      b[i] = last * 3.5;
    }
    if (this.ambOn) this.startAmbient();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }
  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
  }
  setAmbient(on: boolean) {
    this.ambOn = on;
    if (!this.ctx) return;
    this.amb.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.3);
    if (on) this.startAmbient();
  }

  private noiseBurst(opts: { type: BiquadFilterType; freq: number; q?: number; dur: number; vol: number; attack?: number; when?: number; sweepTo?: number }) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn || this.muted) return;
    const t = ctx.currentTime + (opts.when ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = opts.type;
    f.frequency.setValueAtTime(opts.freq, t);
    if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + opts.dur);
    f.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    const a = opts.attack ?? 0.002;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random() * 0.5, opts.dur + 0.05);
  }

  private tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', when = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn || this.muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Kart elden çıkarken hışırtı */
  flick(when = 0) {
    this.noiseBurst({ type: 'bandpass', freq: 2600 + Math.random() * 1400, q: 0.9, dur: 0.07, vol: 0.22, when });
  }
  /** Kart çuhaya düşerken */
  place(when = 0) {
    this.noiseBurst({ type: 'lowpass', freq: 1300, q: 0.5, dur: 0.11, vol: 0.5, when });
    this.tone(150, 0.05, 0.06, 'sine', when);
  }
  deal(when = 0) {
    this.noiseBurst({ type: 'bandpass', freq: 3200 + Math.random() * 800, q: 1.2, dur: 0.05, vol: 0.13, when });
  }
  shuffle() {
    for (let i = 0; i < 26; i++) this.noiseBurst({ type: 'bandpass', freq: 2200 + Math.random() * 2600, q: 1.3, dur: 0.035, vol: 0.12, when: i * 0.016 });
    for (let i = 0; i < 26; i++) this.noiseBurst({ type: 'bandpass', freq: 2200 + Math.random() * 2600, q: 1.3, dur: 0.035, vol: 0.12, when: 0.55 + i * 0.016 });
  }
  collect() {
    this.noiseBurst({ type: 'bandpass', freq: 700, sweepTo: 2600, q: 0.7, dur: 0.28, vol: 0.16, attack: 0.05 });
  }
  click() {
    this.tone(1900, 0.03, 0.05, 'triangle');
  }
  bid() {
    this.tone(660, 0.12, 0.06, 'triangle');
    this.tone(990, 0.16, 0.04, 'triangle', 0.06);
  }
  turn() {
    this.tone(880, 0.35, 0.06);
    this.tone(1320, 0.45, 0.05, 'sine', 0.09);
  }
  trump() {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.3, 0.06, 'triangle', i * 0.07));
  }
  win() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.45, 0.08, 'triangle', i * 0.1));
  }
  lose() {
    [440, 370, 311].forEach((f, i) => this.tone(f, 0.5, 0.07, 'sine', i * 0.14));
  }
  error() {
    this.tone(220, 0.14, 0.07, 'square');
  }

  // ─── Kahvehane ortam sesi ──────────────────────────────────────────────
  private startAmbient() {
    const ctx = this.ctx;
    if (!ctx || this.ambStarted) return;
    this.ambStarted = true;
    // Oda uğultusu
    const room = ctx.createBufferSource();
    room.buffer = this.brown;
    room.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const rg = ctx.createGain();
    rg.gain.value = 0.05;
    room.connect(lp).connect(rg).connect(this.amb);
    room.start();
    // Uzaktan konuşma mırıltısı: formant filtreli, genliği yavaşça değişen gürültü
    for (let v = 0; v < 3; v++) {
      const src = ctx.createBufferSource();
      src.buffer = this.brown;
      src.loop = true;
      src.playbackRate.value = 1.6 + v * 0.35;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 480 + v * 260;
      bp.Q.value = 2.2;
      const g = ctx.createGain();
      g.gain.value = 0.0;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.9 + v * 0.53;
      const lg = ctx.createGain();
      lg.gain.value = 0.012;
      lfo.connect(lg).connect(g.gain);
      const base = ctx.createConstantSource();
      base.offset.value = 0.014;
      base.connect(g.gain);
      src.connect(bp).connect(g).connect(this.amb);
      src.start(0, v);
      lfo.start();
      base.start();
    }
    this.scheduleClink();
  }

  private scheduleClink() {
    window.clearTimeout(this.clinkTimer);
    this.clinkTimer = window.setTimeout(() => {
      const ctx = this.ctx;
      if (ctx && this.ambOn && !this.muted) {
        const r = Math.random();
        const t = ctx.currentTime;
        if (r < 0.7) {
          // kaşık-bardak şıngırtısı
          const n = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) {
            const o = ctx.createOscillator();
            o.frequency.value = 2900 + Math.random() * 900;
            const g = ctx.createGain();
            const tt = t + i * (0.09 + Math.random() * 0.05);
            g.gain.setValueAtTime(0.0001, tt);
            g.gain.exponentialRampToValueAtTime(0.012 + Math.random() * 0.01, tt + 0.004);
            g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.35);
            o.connect(g).connect(this.amb);
            o.start(tt);
            o.stop(tt + 0.4);
          }
        } else {
          // uzaktaki tavla zarı
          for (let i = 0; i < 5; i++) {
            const src = ctx.createBufferSource();
            src.buffer = this.noise;
            const f = ctx.createBiquadFilter();
            f.type = 'bandpass';
            f.frequency.value = 1800 + Math.random() * 1200;
            f.Q.value = 3;
            const g = ctx.createGain();
            const tt = t + i * (0.06 + Math.random() * 0.05);
            g.gain.setValueAtTime(0.0001, tt);
            g.gain.exponentialRampToValueAtTime(0.03, tt + 0.002);
            g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.05);
            src.connect(f).connect(g).connect(this.amb);
            src.start(tt, Math.random() * 0.5, 0.08);
          }
        }
      }
      this.scheduleClink();
    }, 3500 + Math.random() * 7000);
  }
}
