import { ModeId } from '../engine/rules';

export const GENERAL_RULES = `
<h4>Temel kurallar</h4>
<ul>
  <li>52 kartlık iskambil destesiyle oynanır. Büyükten küçüğe sıralama: <b>As, Papaz, Kız, Vale, 10 … 2</b>.</li>
  <li>Oyun saat yönünün tersine (sağa doğru) döner. Her elde herkes bir kart atar, en büyük kartı atan eli alır.</li>
  <li><b>Renge uymak zorunludur.</b> Yerdeki renkten kartın varsa onu atmalısın.</li>
  <li><b>Büyük atma:</b> Yerdeki renkten daha büyük kartın varsa onu atmak zorundasın (yere koz çakılmışsa gerekmez).</li>
  <li><b>Koz çakma:</b> Yerdeki renk sende yoksa ve kozun varsa koz atmak zorundasın. Yerde koz varsa, elinde daha büyük koz varsa onu atmalısın.</li>
  <li><b>Koz kırılması:</b> Biri renk bulamayıp koz atmadan, elinde başka kart olan oyuncu kozla başlayamaz.</li>
  <li>Koz, diğer tüm renklerden büyüktür: en küçük koz bile başka renkteki Ası alır.</li>
</ul>
<h4>Kontroller</h4>
<ul>
  <li><b>Kart at:</b> kartın üzerine tıkla (ayarlardan "iki tıkla at" seçilebilir) ya da kartı masaya sürükle.</li>
  <li><b>Masaya bak:</b> sağ tık + sürükle. <b>Yakınlaş:</b> fare tekerleği.</li>
  <li><b>Kısayollar:</b> Esc duraklat · K kurallar · H ipucu · S sıralama · L son el · C kamera · Boşluk seçili kartı at.</li>
</ul>`;

export const MODE_RULES: Record<ModeId, string> = {
  ihale: `
<h4>İhaleli Batak</h4>
<ul>
  <li>4 oyuncu, herkes kendi başına oynar. Her oyuncuya 13 kart dağıtılır.</li>
  <li>Dağıtanın sağındaki oyuncudan başlayarak ihale açılır. Her oyuncu kaç el alacağını söyleyerek teklifi yükseltir ya da <b>pas</b> der. Pas diyen o elde bir daha teklif veremez.</li>
  <li>En yüksek teklifi veren ihaleyi alır ve <b>kozu seçer</b>. İlk kartı ihaleci atar.</li>
  <li>Herkes pas derse ihale, ilk konuşan oyuncuya en düşük ihale ile kalır (kural seçeneklerinden yeniden dağıtım seçilebilir).</li>
</ul>
<h4>Puanlama</h4>
<ul>
  <li>İhaleci söylediği kadar ya da daha fazla el alırsa <b>aldığı el kadar</b> yazar; alamazsa <b>ihale kadar batar</b> (eksi yazar).</li>
  <li>Diğer oyuncular aldıkları el kadar yazar. Hiç el alamayan oyuncu ihale kadar batar.</li>
  <li><b>King:</b> 13 ihalesini alıp 13 eli de alan oyunu doğrudan kazanır.</li>
  <li>Belirlenen el sayısı bitince en yüksek puanlı oyuncu kazanır.</li>
</ul>`,
  esli: `
<h4>Eşli İhaleli Batak</h4>
<ul>
  <li>Karşılıklı oturanlar eştir: <b>Sen ve Ayşe</b>, <b>Mehmet ve Kemal</b>. Eşlerin aldığı eller toplanır.</li>
  <li>İhale 7'den açılır ve takım adına verilir. İhaleyi alan kozu seçer.</li>
  <li><b>Açık eş:</b> Koz seçilince ihalecinin eşi kartlarını masaya açar; ihaleci o kartları da kendisi oynar. Eşi yalnızca izler.</li>
  <li>Koz her zaman ilk kart olarak oynanabilir (kural seçeneklerinden değiştirilebilir).</li>
</ul>
<h4>Puanlama</h4>
<ul>
  <li>İhaleci takım söylediği kadar el alırsa aldığı el kadar yazar; alamazsa ihale kadar batar.</li>
  <li>Pas diyen takım en az 2 el almak zorundadır; alamazsa ihale kadar batar. Aldıysa aldığı el kadar yazar.</li>
  <li>13 deyip 13 alan takım oyunu kazanır.</li>
</ul>`,
  kozmaca: `
<h4>Koz Maça</h4>
<ul>
  <li>4 oyuncu, herkes kendine. İhale yoktur, koz her zaman <b>maça</b>dır.</li>
  <li>Dağıtanın sağından başlayarak herkes o elde kaç el alacağını söyler (söz verir). "El almam" (0) da denebilir.</li>
  <li>Maça kırılmadan, elinde başka kart olan oyuncu maça ile başlayamaz.</li>
</ul>
<h4>Puanlama</h4>
<ul>
  <li>Sözünü tutan: <b>10 × söz + fazla aldığı el</b>. Örneğin 4 deyip 5 alan 41 yazar.</li>
  <li>Sözünü tutamayan: <b>−10 × söz</b>. Örneğin 5 deyip 3 alan −50 yazar.</li>
  <li>"El almam" diyen hiç el almazsa +50, el alırsa −50 yazar.</li>
</ul>`,
  gommeli: `
<h4>Gömmeli Batak (3 kişilik)</h4>
<ul>
  <li>3 oyuncu. Her oyuncuya 16 kart dağıtılır, 4 kart masaya kapalı bırakılır.</li>
  <li>İhale 7'den açılır ve 13'e kadar gider. İhaleyi alan kozu söyler.</li>
  <li><b>Gömme:</b> İhaleci elinden 4 kart seçip gömer ve masadaki 4 kartı alır. Klasik kuralda yerdeki kartları görmeden gömer; yerden gelen kartlar herkese gösterilir. (Kural seçeneklerinden "önce al, sonra göm" seçilebilir.)</li>
  <li>Gömülen kartlar oyuna girmez; herkes 16 el için oynar.</li>
</ul>
<h4>Puanlama</h4>
<ul>
  <li>İhaleci ihalesini tutarsa aldığı el kadar yazar, tutamazsa ihale kadar batar.</li>
  <li>Diğerleri aldıkları el kadar yazar; hiç el alamayan ihale kadar batar.</li>
</ul>`,
};
