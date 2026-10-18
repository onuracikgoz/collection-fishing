# Görsel Stil

Karar (18.10.2026): oyun **pixel-art**. Sebep: tek geliştirici, tasarımcı yok; LPC karakter animasyonları ve kıyafetleri hazır; AI eşya ikonları palete çekilerek uydurulabilir; web build hafif kalır.

## Ölçek

- Tile: **32×32 px**. Karakter kare boyutu: **64×64** (LPC).
- Eşya ikonu: 128×128 üretilir, oyunda 32 / 48 / 96 px gösterilir (en yakın komşu ölçekleme).
- Kamera: Stardew gibi hafif üstten. Unity'de Pixel Perfect Camera, tam sayı katları.
- `client/Assets/Art/` altındaki her görsel otomatik olarak 32 PPU, point filtre, sıkıştırmasız içe aktarılır (`client/Assets/Editor/PixelArtImporter.cs`).

## Kaynaklar

- Harita ve karakterler: LPC. Harita tile'ları **LPC Revised** (github.com/ElizaWy/LPC) paketinden, lisansı **OGA-BY 3.0**: isim verilir, share-alike yok. Eski LPC parçaları (CC-BY-SA / GPL) kullanılırsa değiştirilen çizimler aynı lisansla paylaşılır. Kredi listesi: `content/CREDITS.md`.
- LPC'de olta animasyonu yok: ayrıca çizdirilecek.
- Eşyalar: AI (Perchance) → Item Art Studio → ortak palet.

## Tutarlılık kuralları

- **Tek renk paleti** (Öneri: 32–64 renk). Eşya ikonları bu palete çekilir.
- Arayüz pixel-art, ahşap ve kağıt teması (defter hissi).
- Efektler oyunu canlı gösterir: su parıltısı, balık sıçraması, Pristine parlaması, "Yeni keşif!" kartı.

## Arayüz tasarımı (Öneri)

- Faz 1–6: ücretsiz / ucuz hazır pixel UI paketi + Claude'un çizdiği yerleşim taslakları.
- Faz 7'den önce: freelance pixel artist ile özel UI kit, logo ve Steam kapak görselleri.

Örnek ekran: `docs/gorsel/ornek-ekran.png`.
