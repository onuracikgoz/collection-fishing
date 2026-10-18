# İçerik Planı ve Görsel Hattı

> Kaynak: tasarım dokümanı v0.8, bölüm 17, 19. Numaralar eski dokümana atıf için korunmuştur.

## 17. Faz 1 İçeriği

Tek bölge (Göl), yaklaşık **60 defter kaydı**:

| Grup | Adet | Not |
|---|---|---|
| Balıklar | 20 | 10 Common, 5 Rare, 3 Epic, 1 Legendary, 1 Mythic |
| Sudan çıkan eşyalar | 15 | gözlük, bot, şişe, eski para, kristal... Renk varyantları ayrı kayıt sayılır |
| Craft malzemeleri | 8 | pul, inci, yosun, odun parçası... Balık tutarken düşer |
| Recipe'ler | 8 | "şişedeki recipe", nadir |
| Craft eşyaları | 8 | Yalnızca recipe ile. 2-3'ü üst recipe |

Her defter kaydı kendi AI görseliyle üretilir, renk varyantları dahil (karar 18.10.2026: araçta renk değiştirerek üretilen varyantlar AI görselinin ışık-gölgesiyle uyuşmadı). Faz 1 için yaklaşık **60 AI görseli**.

### 17.1. Faz 1 Sistemleri

- Karakter seçimi (birkaç varyasyon)
- 200 kişilik sunucu, tek açık harita, hareket, yakınlık bazlı chat balonları, arkadaşa ışınlanma
- Balık tutma (atış, bekleme, vuruş, çekme mini oyunu), yem
- Coin ve NPC satışı
- XP / Level (olta, yem, takas açılışı)
- Bot önlemleri ve enerji, dinlenme alanları
- Olta dayanıklılığı ve tamir, temel / özel yem
- Drop sistemi, Tier + Float
- Envanter
- Collection Book (3 durum, sayfalar, şans bonusu)
- Collection Score ve public profil
- Recipe + craft
- Toz, güvenli takas, oyun içi pazar
- Harita ve temalı sohbet mekanları
- Envanter yığma ve depo
- Günlük görevler, sandık ve seri ödülleri
- Admin paneli
- Sunucu tarafında doğrulanan oyuncu durumu

### 17.2. Faz 1'de Olmayanlar

Steam Market, oyun içi gerçek para ödemesi, Auto-Farm, boosterlar, sezonlar, birden fazla bölge, ziyaret edilebilir sergiler, giyilebilir eşyalar, gelişmiş animasyon, quest zinciri.

## 19. Eşya Görseli Üretim Hattı

```
AI (ör. Perchance), eşya başına bir görsel → Item Art Studio (arka plan, 128×128, ortak palet, onay) → PNG + JSON → Unity Addressables
```

- Her eşya için tek, ortalanmış, önden görünüm, 128×128, şeffaf arka planlı PNG.
- Renk varyantları da AI'a ayrı ayrı ürettirilir. Aynı nesnenin varyantları için prompt aynı tutulur, yalnızca renk / malzeme kelimeleri değişir; Perchance şekli birebir korumaz.
- Float (kir / parlaklık) görselde değil, Unity'deki shader ile oyun anında uygulanır.
- Detaylar: `docs/araclar/item-art-studio.md`.
