# Client ↔ Sunucu Protokolü

Bu dosya client ve server agent'larının ortak sözleşmesidir. Yeni mesaj veya alan eklemeden önce burası güncellenir. Kodda op code'lar ve tipler bu tabloyla birebir aynı olur (`server/src/protocol.ts`, `client/Assets/Scripts/Net/Protocol.cs`).

- Bağlantı: Nakama WebSocket. Mesaj gövdesi **JSON** (ileride gerekirse ikili formata geçilir).
- Konum birimi: **tile** (1 tile = 32 px, ondalıklı). x sağa, **y aşağı** doğru büyür (satır 0 haritanın kuzey kenarı). Süreler milisaniye.
- Unity tarafında 1 tile = 1 birim ve dünya konumu `(x, -y)`; sunucu tile'ı `(sütun, satır)` tilemap hücresi `(sütun, -satır - 1)` olur (`client/Assets/Scripts/World/LakeMap.cs`, `Coords`). Harita verisi: bkz. Harita dosyası.
- Sunucu tick hızı: **10 Hz** (Öneri).
- Sürüm: client bağlanırken `protocolVersion` gönderir; uyuşmazsa sunucu reddeder.

`protocolVersion = 1`

Protokol konulara bölündü (17.11.2026): sadece işinle ilgili dosyayı oku. Yeni mesaj eklerken ilgili konu dosyasını **ve** aşağıdaki op code dizinini güncelle.

## Konu dosyaları

| Dosya | İçinde | Bölümler |
|---|---|---|
| `docs/protokol/temel.md` | Giriş, RPC listesi, hız sınırları, hata kodları | Giriş; RPC'ler; Hata kodları; Geliştirici RPC'leri (sadece yerel) |
| `docs/protokol/dunya.md` | Harita: hareket, chat, oturma, duyurular, harita dosyası | Match (harita) mesajları; Oturma (16.11.2026, Onur); Duyurular (nadir av); Harita dosyası |
| `docs/protokol/balik.md` | Balık tutma, olta ve özel yem | Balık tutma (Faz 2); Olta ve özel yem (Faz 4) |
| `docs/protokol/sosyal.md` | Defter, arkadaşlar, ışınlanma, emote, fısıltı, XP | Collection Book (Faz 3); Arkadaşlar, ışınlanma, emote (Faz 3); Fısıltı (Faz 5); XP ve level |
| `docs/protokol/takas-pazar.md` | Takas, takas kayıtları, eşya kilidi, eşya atma, pazar ve pano | Takas (Faz 5); Takas kayıtları; Eşya kilidi; Eşya atma (31.10.2026, Onur); Pazar (Faz 5, pet tezgahı) |
| `docs/protokol/ekonomi.md` | Coin, NPC satış, toz, birleştirme, craft, depo, fiyatlar, günlük görev | Ekonomi: Coin, NPC satış, toz (Faz 4); Birleştirme ve craft (Faz 4); Depo (Faz 4); Fiyat ve recipe listesi (Faz 4); Günlük görev (Faz 6) |
| `docs/protokol/icerik.md` | Eşya adları ve görselleri, dil dosyaları | İçerik: eşya adları ve görselleri (Faz 6); Dil dosyaları (Faz 6, 01.11.2026) |
| `docs/protokol/gardirop.md` | Gardırop: katalog, görünüm, LOOK_SET / LOOK_SHOW | Gardırop (16.11.2026) |

Kodda "docs/protokol.md, <bölüm>" diye geçen bir atıf, yukarıdaki tabloda o bölümün dosyasıdır.

## Op code dizini

| Op | Yön | Ad | Dosya |
|---|---|---|---|
| 1 | C → S | `MOVE` | `dunya.md` |
| 2 | S → C | `SNAPSHOT` | `dunya.md` |
| 3 | S → C | `PLAYER_ENTER` | `dunya.md` |
| 4 | S → C | `PLAYER_LEAVE` | `dunya.md` |
| 5 | C → S | `SAY` | `dunya.md` |
| 6 | S → C | `BUBBLE` | `dunya.md` |
| 7 | S → C | `CORRECTION` | `dunya.md` |
| 8 | S → C | `WELCOME` | `dunya.md` |
| 9 | C → S | `CAST` | `balik.md` |
| 10 | S → C | `BOBBER` | `balik.md` |
| 11 | C → S | `HOOK` | `balik.md` |
| 12 | S → C | `REEL_START` | `balik.md` |
| 13 | C → S | `REEL_DONE` | `balik.md` |
| 14 | S → C | `FISH_END` | `balik.md` |
| 15 | C → S | `CANCEL` | `balik.md` |
| 16 | C → S | `BOOK_PLACE` | `sosyal.md` |
| 17 | S → C | `BOOK_RESULT` | `sosyal.md` |
| 18 | C → S | `GOTO_FRIEND` | `sosyal.md` |
| 19 | S → C | `TELEPORT` | `sosyal.md` |
| 20 | C → S | `EMOTE` | `sosyal.md` |
| 21 | S → C | `EMOTE_SHOW` | `sosyal.md` |
| 22 | C → S | `SELL` | `ekonomi.md` |
| 23 | C → S | `SALVAGE` | `ekonomi.md` |
| 24 | S → C | `ECONOMY_RESULT` | `ekonomi.md` |
| 25 | C → S | `MERGE` | `ekonomi.md` |
| 26 | C → S | `CRAFT` | `ekonomi.md` |
| 27 | S → C | `CRAFT_RESULT` | `ekonomi.md` |
| 28 | C → S | `REPAIR_ROD` | `balik.md` |
| 29 | C → S | `BUY_BAIT` | `balik.md` |
| 30 | S → C | `SHOP_RESULT` | `balik.md` |
| 31 | C → S | `STASH_OPEN` | `ekonomi.md` |
| 32 | C → S | `STASH_PUT` | `ekonomi.md` |
| 33 | C → S | `STASH_TAKE` | `ekonomi.md` |
| 34 | C → S | `STASH_EXPAND` | `ekonomi.md` |
| 35 | S → C | `STASH_RESULT` | `ekonomi.md` |
| 36 | C → S | `EMOTE_STATUS` | `sosyal.md` |
| 37 | S → C | `EMOTE_STATUS_SHOW` | `sosyal.md` |
| 38 | S → C | `ANNOUNCE` | `dunya.md` |
| 39 | C → S | `TRADE_OFFER` | `takas-pazar.md` |
| 40 | C → S | `TRADE_REPLY` | `takas-pazar.md` |
| 41 | C → S | `TRADE_SET` | `takas-pazar.md` |
| 42 | C → S | `TRADE_LOCK` | `takas-pazar.md` |
| 43 | C → S | `TRADE_CONFIRM` | `takas-pazar.md` |
| 44 | C → S | `TRADE_CANCEL` | `takas-pazar.md` |
| 45 | S → C | `TRADE_INVITE` | `takas-pazar.md` |
| 46 | S → C | `TRADE_STATE` | `takas-pazar.md` |
| 47 | S → C | `TRADE_END` | `takas-pazar.md` |
| 48 | C → S | `ITEM_LOCK` | `takas-pazar.md` |
| 49 | S → C | `ITEM_LOCK_RESULT` | `takas-pazar.md` |
| 50 | C → S | `STALL_OPEN` | `takas-pazar.md` |
| 51 | C → S | `STALL_RECALL` | `takas-pazar.md` |
| 52 | C → S | `STALL_VIEW` | `takas-pazar.md` |
| 53 | C → S | `STALL_BUY` | `takas-pazar.md` |
| 54 | S → C | `STALL_LIST` | `takas-pazar.md` |
| 55 | S → C | `STALL_STATE` | `takas-pazar.md` |
| 56 | S → C | `STALL_RESULT` | `takas-pazar.md` |
| 57 | S → C | `QUEST_STATE` | `ekonomi.md` |
| 58 | C → S | `QUEST_CLAIM` | `ekonomi.md` |
| 59 | S → C | `QUEST_CLAIM_RESULT` | `ekonomi.md` |
| 60 | C → S | `BOARD_AD` | `takas-pazar.md` |
| 61 | S → C | `BOARD_STATE` | `takas-pazar.md` |
| 62 | S → C | `BOARD_RESULT` | `takas-pazar.md` |
| 63 | C → S | `BOARD_GOTO` | `takas-pazar.md` |
| 64 | C → S | `GOTO_SPAWN` | `sosyal.md` |
| 65 | C → S | `ITEM_DISCARD` | `takas-pazar.md` |
| 66 | S → C | `ITEM_DISCARD_RESULT` | `takas-pazar.md` |
| 67 | C → S | `SIT` | `dunya.md` |
| 68 | S → C | `SEAT_SHOW` | `dunya.md` |
| 69 | C → S | `LOOK_SET` | `gardirop.md` |
| 70 | S → C | `LOOK_SHOW` | `gardirop.md` |

Nakama bildirim kodları ve hata kodları: `docs/protokol/temel.md`, Hata kodları.
