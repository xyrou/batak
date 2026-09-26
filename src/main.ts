import './styles.css';
import { Stage } from './render/stage';
import { CardTable } from './render/cards3d';
import { drawScorepad } from './render/scorepad';
import { Sound } from './audio';
import { UI } from './ui/ui';
import { Director } from './director';
import { loadPrefs } from './prefs';

const bar = document.getElementById('load-bar') as HTMLElement;
const txt = document.getElementById('load-text') as HTMLElement;
const pct = document.getElementById('load-pct') as HTMLElement;

function progress(p: number, label?: string) {
  const v = Math.round(p * 100);
  bar.style.width = `${v}%`;
  pct.textContent = `%${v}`;
  if (label) txt.textContent = label;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

async function boot() {
  progress(0.04, 'Yazı tipleri yükleniyor');
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('700 60px Rubik'),
        document.fonts.load('700 30px "Playfair Display"'),
        document.fonts.load('700 30px Caveat'),
      ]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* yazı tipi gelmezse sistem fontu kullanılır */
  }
  progress(0.12, 'Kahvehane kuruluyor');
  await tick();
  const prefs = loadPrefs();
  const stage = new Stage(document.getElementById('stage')!);
  stage.setQuality(prefs.quality);
  progress(0.3, 'Kartlar basılıyor');
  await tick();
  const table = new CardTable(stage);
  const texSize = prefs.quality === 'high' ? 448 : prefs.quality === 'low' ? 256 : 352;
  await table.init(texSize, (p) => progress(0.3 + p * 0.6));
  progress(0.92, 'Çaylar demleniyor');
  await tick();
  drawScorepad(stage.notepadCanvas, null);
  stage.notepadTex.needsUpdate = true;
  table.resetToDeck(0);
  table.views.forEach((v, i) => table.place(v, table.deckSlot(0, i)));
  stage.renderer.compile(stage.scene, stage.camera);
  stage.start();

  const sound = new Sound();
  sound.sfxOn = prefs.sfx;
  sound.ambOn = prefs.ambient;
  const ui = new UI(document.getElementById('ui')!, prefs, sound);
  const director = new Director(stage, table, ui, sound, prefs);
  const showMenu = () => ui.showMenu((p) => void director.start(p));
  director.onMenu = showMenu;
  document.addEventListener('pointerdown', () => sound.ensure());

  progress(1, 'Masa hazır');
  await new Promise((r) => setTimeout(r, 250));
  document.getElementById('loader')!.classList.add('hide');
  setTimeout(() => document.getElementById('loader')?.remove(), 700);
  showMenu();
  (window as unknown as Record<string, unknown>).__batak = { stage, table, ui, director };
}

boot().catch((e) => {
  console.error(e);
  txt.textContent = 'Yükleme hatası: ' + (e instanceof Error ? e.message : String(e));
});
