export type Ease = (t: number) => number;

export const easings = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => {
    const c1 = 1.4;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
};

interface Tween {
  start: number;
  duration: number;
  update: (t: number) => void;
  ease: Ease;
  resolve: () => void;
  key?: object;
  done: boolean;
}

/** Oyun saatine bağlı basit animasyon yöneticisi (duraklatılabilir) */
export class Tweens {
  time = 0;
  paused = false;
  private list: Tween[] = [];

  tick(dt: number) {
    if (this.paused) return;
    this.time += dt;
    const now = this.time;
    const active = this.list;
    this.list = [];
    for (const tw of active) {
      if (tw.done) continue;
      const t = Math.min(1, (now - tw.start) / tw.duration);
      tw.update(tw.ease(Math.max(0, t)));
      if (t >= 1) {
        tw.done = true;
        tw.resolve();
      } else {
        this.list.push(tw);
      }
    }
    // tick sırasında eklenenler
  }

  add(duration: number, update: (t: number) => void, ease: Ease = easings.outCubic, key?: object, delay = 0): Promise<void> {
    if (key) this.cancel(key);
    return new Promise((resolve) => {
      if (duration <= 0) {
        update(1);
        resolve();
        return;
      }
      this.list.push({ start: this.time + delay, duration, update, ease, resolve, key, done: false });
    });
  }

  cancel(key: object) {
    for (const tw of this.list) {
      if (tw.key === key && !tw.done) {
        tw.done = true;
        tw.resolve();
      }
    }
  }

  wait(sec: number): Promise<void> {
    return this.add(sec, () => {}, easings.linear);
  }

  get busy() {
    return this.list.length > 0;
  }
}
