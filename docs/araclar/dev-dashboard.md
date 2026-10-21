# Geliştirici Dashboard'u

Oyundaki her sistemi Unity açmadan, saatlerce oynamadan denemek için tek sayfalık web aracı. Yerel Nakama'ya bağlanır; test oyuncularıyla gerçek match mesajlarını gönderir, sunucudaki `dev_*` RPC'leriyle oyuncu durumunu görür ve değiştirir.

```bash
docker compose up -d                 # yerel Nakama (DEV_TOOLS=true local.yml'de)
node tools/dev-dashboard/serve.mjs   # http://127.0.0.1:7360
```

Node dışında bağımlılık yok; derleme adımı yok.

## Sadece geliştirme ortamında

- `dev_*` RPC'leri ve `dev_*` match sinyalleri sadece Nakama runtime env'inde `DEV_TOOLS=true` olduğunda çalışır (`server/local.yml`). Test ve canlı config'te bu satır olmaz; orada her `dev_*` çağrısı `DEV_TOOLS_OFF` (Nakama kodu 7, PERMISSION_DENIED) ile reddedilir.
- Nakama RPC kayıtlarını sadece `InitModule`'ün kendi gövdesinden okuduğu için kayıtlar koşulsuzdur; kapı her RPC'nin ilk satırındaki `devOnly(ctx)` kontrolüdür (`server/src/debug/gate.ts`).
- Match sinyalleri oyun client'ından gönderilemez, sadece sunucu kodu (dev RPC'leri) gönderir.
- `serve.mjs` sadece `127.0.0.1`'e bağlanır. Dashboard yerel ağ dışındaki bir host'a bağlanınca uyarı gösterir.
- Dashboard bir `dev_admin` cihaz hesabıyla giriş yapar; bu hesap oyuncu listesinde görünür.

## Sekmeler

| Sekme | Ne yapar |
|---|---|
| Genel | Bağlantı, canlı dünya (her sunucuda kim, nerede, balık aşaması), özellik durumu tablosu |
| Oyuncular | Tüm hesaplar. Seçilen oyuncunun cüzdanı, enerjisi, çantası (NPC fiyatı ve toz önizlemesiyle), defteri, profili, arkadaşları, cüzdan geçmişi, maçtaki canlı durumu, ham verisi. Eşya ver, Float / Tier düzenle, sil, yığın ayarla, defter kaydı aç / doldur / boşalt / unut, sıfırla. Tek tık senaryolar (zengin, çantayı doldur, birleştirmeye / craft'a hazır, defteri doldur, enerji 0) |
| Oyna | Test oyuncuları oluştur, sunucuya sok, haritada tıklayarak yürü (yol bulma, 10 Hz MOVE), suya olta at, otomatik / elle (boşluk tuşu) çekme, sürekli tutma, beklemeyi atlama. Dev olayları: hemen vursun, sahte kıpırdama, belirli av gelsin, ışınla. Chat, emote, arkadaş durumu, Yanına git, başka sunucuya `near` ile katılım. Çantadan SELL / SALVAGE / MERGE / CRAFT / BOOK_PLACE, `set_profile` |
| Mesajlar | Herhangi bir oyuncu olarak istediğin op ve gövdeyi gönder (tekrar ve aralıkla, hız sınırı denemesi için). Sunucudan bir oyuncuya istediğin S→C mesajını it (keşif kutlaması, sayfa tamamlama, hata ekranları). Filtrelenebilir mesaj kaydı |
| RPC | Her RPC'yi admin ya da bir test oyuncusu olarak çağır, şablonlar ve geçmiş |
| Simülasyon | Av tablosu (bant, enerji, şans ya da bir oyuncunun defter şansı), çekme mini oyunu (sunucudaki çözücü oynar, tarayıcıdaki model tekrar oynatıp sunucuyla aynı mı diye bakar), craft kalitesi |
| Yapılandırma | Eşya tanımları, defter sayfaları, recipe'ler, harita, `config.ts` değerleri |

Yeni bir özellik sunucuya gelince (yem, tamir, depo, XP, takas…) dashboard'u değiştirmeden RPC ve Mesajlar sekmeleriyle denenebilir; kalıcı bir arayüz gerekirse ilgili sekmeye eklenir.

## Dev RPC'leri

Hepsi `{ userId? }` alır (boşsa çağıran). Kaynak: `server/src/debug/rpc.ts`.

| RPC | Ne yapar |
|---|---|
| `dev_info` | Config, op kodları, eşya tanımları, sayfalar, recipe'ler, harita (bant harfleriyle), sunucular |
| `dev_users` | `{ query, limit }` hesaplar ve kim çevrimiçi |
| `dev_player` | Bir oyuncunun tüm durumu, fiyat önizlemesi, maçtaki canlı durumu |
| `dev_world` | Her dünya maçının canlı durumu |
| `dev_give` | `{ defId, count, tier?, float?, bag? }` eşya verir; `bag: true` ilk kopya kuralını atlar |
| `dev_item_edit` | `{ instanceId, float?, tier? }` |
| `dev_item_delete` | `{ instanceIds }` ya da `{ all: true }` (çantadakiler) |
| `dev_stacks` | `{ stacks: { defId: count }, clear? }`, 0 siler |
| `dev_wallet` | `{ set: { coin?, dust? } }` ya da `{ add: … }`, cüzdan geçmişine `action: dev` yazar |
| `dev_energy` | `{ value }` |
| `dev_book` | `{ action: discover \| fill \| unslot \| forget \| fill_page \| reset, defId?, page?, float? }` |
| `dev_profile` | `{ showcase?, hunting? }` kontrolsüz yazar |
| `dev_friends` | `{ a, b, action: befriend \| request \| remove \| block }` |
| `dev_reset` | Oyuncu verisini ve cüzdanı siler, başlangıç recipe'lerini yeniden verir |
| `dev_live` | Maçtaki oyuncuya: `teleport`, `bite_now`, `force { defId }`, `twitch`, `cancel`, `push { op, body }`, `push_all`, `kick` |
| `dev_sim_catch` | `{ n, band, hasEnergy, luck \| userId }` av tablosu simülasyonu |
| `dev_reel` | `{ seed, tier \| params, inputs? , lose? }` mini oyunu oynar ya da girdileri değerlendirir |
| `dev_craft_preview` | `{ recipeId \| grade, average }` craft Float bantları |

Depoyu değiştiren her dev RPC, oyuncu oyundaysa maça `dev_reload` sinyali yollar; maçın bellekteki çanta, defter ve enerji kopyası yenilenir. Unity client'a "çanta değişti" mesajı gitmez; client çantayı yeniden açınca görür.
