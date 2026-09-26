# Batak — Kahvehane Masası 3B

Tarayıcıda çalışan, üç boyutlu kahvehane masasında oynanan Batak. Rakipler yapay zekâdır (Mehmet, Ayşe, Kemal); kurulum ya da sunucu gerektirmez.

## Oyun türleri

| Tür | Oyuncu | Özet |
| --- | --- | --- |
| **İhaleli Batak** | 4, tekli | İhaleyi alan kozu seçer ve ilk kartı atar. |
| **Eşli İhaleli Batak** | 4, eşli | Karşılıklı oturanlar eştir. İhalecinin eşi kartlarını açar (açık batak). |
| **Koz Maça** | 4, tekli | İhale yok, koz hep maça. Herkes kaç el alacağını söyler. |
| **Gömmeli Batak** | 3 | 16'şar kart dağıtılır, 4 kart yerde kalır. İhaleci 4 kart gömüp yerdekileri alır. |

Her türün kuralları menüdeki **Kural seçenekleri** panelinden değiştirilebilir: en düşük ihale, herkes pas derse ne olacağı, koz kırılması, büyük atma, koz yükseltme, puanlama, açık eş, King, gömme şekli ve "el almam".

## Özellikler

- three.js ile yapılmış kahvehane: yeşil çuha, ahşap masa, ince belli çay bardakları, kehribar tespih, tavla ve çaydanlık. Masadaki yazboz defterine puanlar el yazısıyla işlenir.
- Kart yüzleri, resimli kartlar ve lale desenli sırt canvas üzerinde çiziliyor; dışarıdan görsel dosyası yüklenmez.
- Üç zorlukta yapay zekâ:
  - **Kolay:** kurallı ama hataya açık oynar.
  - **Orta:** kart sayar ve renk yokluklarını takip eder.
  - **Zor:** her hamlede olası dağılımları örnekleyip eli sonuna kadar simüle eder (Monte Carlo).
- Ses efektleri ve kahvehane ortam sesi WebAudio ile anlık üretiliyor.
- Duraklatma menüsü, skor tablosu, oyun kaydı, son el, ipucu, kamera görünümleri ve tur süresi var.

## Kontroller

| Eylem | Kısayol |
| --- | --- |
| Kart at | Tıkla ya da masaya sürükle (ayarlardan "iki tıkla at" seçilebilir) |
| Masaya bak / yakınlaş | Sağ tık + sürükle / tekerlek |
| Duraklat | Esc |
| Kurallar | K |
| İpucu | H |
| Sıralama | S |
| Son el | L |
| Kamera | C |

## Geliştirme

```bash
npm install
npm run dev       # yerel sunucu
npm test          # kural motoru + tam oyun simülasyonları
npm run build     # dist/ üretir
```

Kod yapısı:

- `src/engine`: kurallar, el akışı ve puanlama. Saf TypeScript; testler burada.
- `src/ai`: tahmin, sezgisel oyun ve Monte Carlo yapay zekâ.
- `src/render`: sahne, kartlar, dokular ve animasyon.
- `src/ui`: menü, göstergeler ve pencereler.
- `src/director.ts`: oyun akışını sahneye ve arayüze bağlar.

Vercel'de Vite projesi olarak ek ayar gerekmeden yayınlanır (`vercel.json`).
