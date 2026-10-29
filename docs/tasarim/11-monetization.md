# Monetization

> Kaynak: tasarım dokümanı v0.8, bölüm 16. Numaralar eski dokümana atıf için korunmuştur.

## 16. Monetization

Oyun ücretsizdir. Ana model: **kozmetik + kolaylık**.

**Temel kural:** parayla satılan hiçbir şey çıkan eşyanın **miktarını veya kalitesini** artırmaz. Eşyalar dış sitelerde gerçek para ettiği için aksi "para ver, daha çok Mythic çıkar, sat" anlamına gelir: hem pay-to-win olur hem kumar tartışmasını geri getirir. Bu yüzden daha iyi olta, enerji, drop / şans artışı, sandık ve anahtar **satılmaz**.

Satılabilecekler:

- **Görünüm:** karakter kıyafetleri, saç, renkler (LPC'de hazır parçalar, AI gerekmez); olta ve şamandıra görünümleri (yalnızca görüntü, aynı özellik); chat balonu stilleri, isim rengi, emote; Collection Book temaları ve çerçeveleri; unvan, showcase özelleştirme.
- **Kolaylık:** ekstra depo alanı, ekstra / daha uzun açık kalan pazar tezgahı, isim değiştirme.
- **Sezon kartı:** her sezon oynadıkça açılan kozmetik ödüller, ücretsiz yolu da olur.
- **Destekçi paketi:** aylık küçük ücretle depo, tezgah ve o aya özel bir kozmetik.

Parayla alınan kozmetikler **takas edilemez**, dış sitelerde satılık mala dönüşmesin.

Sosyal oyunda kozmetik iyi satar çünkü herkes seni görür (Sanalika'nın modeli de kıyafet üzerineydi). Ödeme: Steam'de Steamworks, mobilde Unity IAP.

### Elmas (karar 29.10.2026, Onur)

- Elmas oyunun **premium parasıdır**: pano reklamı, elmasla alınan kozmetikler ve pet türleri (`09-ekonomi-pazar.md`, `10-sosyal.md`) elmasla ödenir. Eşya miktarı veya kalitesi satın alınmaz (kural 2).
- **Kazanma:** balık tutarken enerjiyle yapılan her başarılı çekişte küçük bir şansla 1 elmas düşer; **günde ortalama 5** elmas (Öneri). Ücretsiz oyuncu da biriktirip harcayabilir. Enerjisiz atış ve kaçan balık vermez, böylece botun sınırsız atışı elmas üretmez.
- **Satın alma:** gerçek parayla elmas satışı sonra (Faz 7, Steamworks). Bu yüzden elmas **takas edilemez** ve oyuncular arası geçmez; yoksa elmas Coin'e çevrilip kazanılan eşya yerine kullanılırdı (kural 2 ve 3).
- Sayılar ve protokol: `docs/protokol.md` Ekonomi, `server/src/config.ts` `DIAMOND`.
