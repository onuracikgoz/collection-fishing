# Client ↔ Sunucu Protokolü

Bu dosya client ve server agent'larının ortak sözleşmesidir. Yeni mesaj veya alan eklemeden önce burası güncellenir. Kodda op code'lar ve tipler bu tabloyla birebir aynı olur (`server/src/protocol.ts`, `client/Assets/Scripts/Net/Protocol.cs`).

- Bağlantı: Nakama WebSocket. Mesaj gövdesi **JSON** (ileride gerekirse ikili formata geçilir).
- Konum birimi: **tile** (1 tile = 32 px, ondalıklı). x sağa, **y aşağı** doğru büyür (satır 0 haritanın kuzey kenarı). Süreler milisaniye.
- Unity tarafında 1 tile = 1 birim ve dünya konumu `(x, -y)`; sunucu tile'ı `(sütun, satır)` tilemap hücresi `(sütun, -satır - 1)` olur (`client/Assets/Scripts/World/LakeMap.cs`, `Coords`).
- Sunucu tick hızı: **10 Hz** (Öneri).
- Sürüm: client bağlanırken `protocolVersion` gönderir; uyuşmazsa sunucu reddeder.

`protocolVersion = 1`

## Giriş

| Adım | Nasıl |
|---|---|
| Faz 1 | `authenticateDevice` (cihaz kimliği) + kullanıcı adı |
| Faz 7 | `authenticateSteam` |

- Kullanıcı adı ilk girişte (hesap oluşurken) gönderilir. Kural: **3–16 karakter**, harf (Türkçe harfler dahil), rakam ve `_` (Öneri). Uymazsa giriş `BAD_REQUEST` ile reddedilir. Ad başkasındaysa Nakama'nın kendi hatası döner.
- Ad gönderilmezse Nakama rastgele bir ad atar, bu yüzden client ilk girişte adı her zaman gönderir. Hesap zaten varsa gönderilen ad yok sayılır.

## RPC'ler

| RPC | İstek | Cevap | Faz |
|---|---|---|---|
| `healthcheck` | `{}` | `{ ok: true, serverTime, protocolVersion }` | 0 |
| `list_servers` | `{}` | `{ servers: [{ matchId, name, language, players, capacity }] }` | 1 |

Sunucular (match'ler) sunucu açılışında config'teki listeden oluşturulur; oyuncu yeni sunucu açamaz. `players` o andaki kişi sayısıdır, liste config sırasıyla döner.

## Match (harita) mesajları

Oyuncu `list_servers`'tan seçtiği `matchId`'ye `joinMatch` ile girer. Katılım metadata'sı: `{ protocolVersion, characterId }`. Nakama metadata değerlerini string taşır (`"1"`); `characterId` boşsa `"default"` sayılır. Katılım reddinde mesaj bir hata kodudur: sürüm uyuşmazsa `PROTOCOL_MISMATCH`, sunucu doluysa `SERVER_FULL`, metadata bozuksa `BAD_REQUEST`.

Aynı hesap ikinci kez girerse eski bağlantı match'ten atılır, yeni bağlantı devam eder (yeniden bağlanma). Oyuncu ayrılınca konumu kaydedilir.

`id` her yerde oyuncunun Nakama kullanıcı id'sidir. `dir` şu dördünden biridir: `"up"`, `"down"`, `"left"`, `"right"`.

| Op | Yön | Ad | Gövde | Faz |
|---|---|---|---|---|
| 1 | C → S | `MOVE` | `{ seq, x, y, dir, moving }` | 1 |
| 2 | S → C | `SNAPSHOT` | `{ t, players: [{ id, x, y, dir, moving }] }` (yakındakilerden bu tick'te değişenler, oyuncunun kendisi hariç) | 1 |
| 3 | S → C | `PLAYER_ENTER` | `{ id, name, characterId, x, y, dir, moving }` (görüş alanına girdi) | 1 |
| 4 | S → C | `PLAYER_LEAVE` | `{ id }` (görüş alanından çıktı veya ayrıldı) | 1 |
| 5 | C → S | `SAY` | `{ text }` | 1 |
| 6 | S → C | `BUBBLE` | `{ id, text }` (konuşanın kendisi de alır) | 1 |
| 7 | S → C | `CORRECTION` | `{ seq, x, y }` (sunucu konumu düzeltti) | 1 |
| 8 | S → C | `WELCOME` | `{ you: { id, x, y }, serverName }` (katılım sonrası ilk mesaj) | 1 |

### Hareket kuralları

- Client kendi karakterini anında yürütür ve en fazla 10 Hz'de `MOVE` gönderir. `x, y` oyuncunun yeni konumudur, `seq` her mesajda artan tam sayıdır; eski `seq`'li mesaj yok sayılır.
- Sunucu her `MOVE`'u kontrol eder: hız sınırı (yürüme hızı × 1.2 tolerans), harita sınırı, çarpışma. Geçersizse son geçerli konumu `CORRECTION` ile döner, client oraya ışınlanır.
- Hız sınırı bir "yürüme bütçesi"dir: bütçe saniyede yürüme hızı × 1.2 tile dolar, en fazla 0.5 saniyelik yol birikir (Öneri). Ağ yüzünden üst üste gelen mesajlar böylece haksız düzeltme almaz.
- Yürüme hızı (Öneri): **4 tile/sn**, sunucu config'idir.
- Yakınlık (Öneri): görüş yarıçapı **20 tile**, görüşten çıkma **22 tile** (sınırda gidip gelen oyuncu titremesin). `PLAYER_ENTER` tam durumu taşır, `SNAPSHOT` sadece değişenleri.
- Başlangıç: ilk girişte meydan, sonraki girişlerde son konum (`docs/tasarim/02-harita-sunucu.md`).

### Chat kuralları

- `text` en fazla **120 karakter** (Öneri), boşluk kırpılır, boş mesaj yok sayılır.
- Hız sınırı: saniyede 1 mesaj, aşan mesaj sessizce düşer (Öneri).
- `BUBBLE` gönderilmeden önce de sunucu metni kırpar; client gelen metni olduğu gibi gösterir.
- `BUBBLE` sadece konuşanın **12 tile** (Öneri) yakınındakilere gider.
- Küfür filtresi ve şikayet Faz 5'te.

## Hata kodları

RPC hataları Nakama hata kodu + `{ code, message }`. Ortak kodlar: `BAD_REQUEST`, `PROTOCOL_MISMATCH`, `SERVER_FULL`, `RATE_LIMITED`.
