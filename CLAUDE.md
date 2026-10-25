# CollectionGame

Sosyal balık tutma ve koleksiyon oyunu. Unity 6 client, Nakama (TypeScript) sunucu. Tek geliştirici: Onur. Konuşma dili Türkçe; kod, ID'ler, commit ve PR başlıkları İngilizce.

## Önce oku

| Konu | Dosya |
|---|---|
| Hangi fazdayız, faz bitince ne olmalı | `docs/fazlar.md` |
| Mimari, klasörler, kim neye karar verir | `docs/mimari.md` |
| Client ile sunucu arasındaki mesajlar | `docs/protokol.md` |
| Oyun kuralları (konuya göre) | `docs/tasarim/*.md` |
| Cevap bekleyen tasarım soruları | `docs/acik-sorular.md` |
| Item Art Studio | `docs/araclar/item-art-studio.md` |
| Geliştirici dashboard'u (dev RPC'leri) | `docs/araclar/dev-dashboard.md` |
| Harita editörü (Unity Tilemap, çarpışma dışa aktarma) | `docs/araclar/harita-editoru.md` |

Sadece işinle ilgili tasarım dosyasını oku. Bir kural belirsizse uydurma, `docs/acik-sorular.md`'ye ekle ve Onur'a sor.

## Değişmez kurallar

1. **Sunucu otoritedir.** Drop, Float, Coin, toz, enerji, craft, takas sonucu sadece sunucuda hesaplanır. Client yalnızca niyet gönderir.
2. **Parayla eşya miktarı veya kalitesi artmaz.** Satılan her şey kozmetik veya kolaylıktır. Ücretli kozmetikler takas edilemez.
3. **Oyunda gerçek para akmaz.** Oyuncu arası değişim sadece oyun içi takas penceresi ve pazar panosuyla olur.
4. **Toz takas edilemez.** Recipe tek kullanımlıktır, recipe olmadan craft yoktur.
5. **Genel kitle (13+).** Flört özelliği yok, yabancıya whisper kısıtlı.
6. Ayarlanabilir sayılar (oranlar, fiyatlar, süreler) koda gömülmez, sunucu verisi veya config'tir. **(Öneri)** işaretli değerler kesin değildir.

## Çalışma düzeni

- Agent rolleri: server, client, tools, test/review. Her oturum tek role odaklanır.
- **Sözleşme önce:** client ile sunucu arasında yeni bir mesaj gerekiyorsa önce `docs/protokol.md` güncellenir, sonra iki taraf yazılır.
- Server kuralları `server/src/rules/` altında saf fonksiyon ve birim testli olur (`npm test`).
- Her iş bir branch ve PR ile gelir. Faz sonu PR'ını test/review agent inceler.
- Tasarım değişirse ilgili `docs/tasarim/` dosyası aynı PR'da güncellenir.
- Client (Unity) işleri Onur'un Mac'inde çalışan oturumda yapılır; bulut oturumu Unity'yi çalıştıramaz.

## Komutlar

```bash
docker compose up -d          # sunucuyu derler, Nakama + Postgres'i açar (konsol: http://localhost:7351)
docker compose up -d --force-recreate server-build nakama   # sunucu kodu değişince
cd server && npm install && npm test                        # kural testleri
cd server && npm run smoke                                  # çalışan Nakama'ya iki sahte oyuncuyla uçtan uca test
node tools/dev-dashboard/serve.mjs                          # geliştirici dashboard'u: http://127.0.0.1:7360
```
