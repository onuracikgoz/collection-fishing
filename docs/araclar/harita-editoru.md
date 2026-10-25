# Harita Editörü (Unity Tilemap)

Haritayı Unity'de sürükle-bırak ve fırçayla çizersin. Çizdiğin harita oyunun haritası olur; sunucunun bildiği çarpışma ve su da tek tıkla aynı haritadan üretilir (kural 1: sunucu otorite, ikisi aynı olmalı).

> Durum: bulutta yazıldı, Unity editöründe henüz denenmedi. İlk denemede bir menü ya da pencere beklediğin gibi çıkmazsa Console'daki hatayı yaz, düzeltilir.

## Parçalar

| Ne | Nerede |
|---|---|
| Harita prefab'ı (çizdiğin şey) | `client/Assets/Resources/Map/Lake.prefab` |
| Menü | `CollectionGame > Map` (`Assets/Editor/MapAuthoring.cs`) |
| Oyunda gösterim | `MapView` prefab'ı yükler. Prefab yoksa eski kodla çizilen test haritası çıkar |
| Çarpışma (sunucu) | `server/src/data/lake-map.ts` (**Export yazar, elle düzenleme**) |
| Çarpışma (client) | `client/Assets/Scripts/World/LakeMapData.cs` (**Export yazar**) |
| Tile / işaretçi dosyaları | `client/Assets/Map/` |

Harita **128 × 96 tile**. Unity'de koordinatlar: x sağa 0..127, y aşağıya doğru **-1..-96** (sunucudaki "satır 0 kuzey" = Unity'de y -1). Scene penceresinde sarı çerçeve haritanın sınırıdır.

## İlk kurulum

1. Unity'de `CollectionGame > Map > Create Map Prefab`. Araç prefab'ı kurar (çimen zemin, düz su gölü, çeşme, işaretçiler) ve açar. Prefab modunda Scene penceresinde haritayı görürsün.
2. `Window > 2D > Tile Palette` aç, **Create New Palette** (örn. `Assets/Map/Palettes/Lake`).
3. Sheet'i parçalara böl: `Assets/Art/LPC/Terrain/terrain_summer.png`'yi seç > `CollectionGame > Map > Slice Selected Textures (32x32)`. Uyarı çıkarsa elle yap: dosyayı seç > Inspector'da **Sprite Mode = Multiple** > **Sprite Editor** > Slice > Type **Grid By Cell Size**, 32 × 32 > Slice > Apply. Sonra dosyanın yanındaki oka basıp parçaları aç, **tümünü seçip palete sürükle**. Unity her parça için bir tile kaydeder (`Assets/Map/Tiles/` seç). Aynısını başka sheet'ler için de yap.
4. İşaretçi karelerini de palete sürükle: `Assets/Map/Markers/water-tile.asset` (mavi) ve `blocked-tile.asset` (kırmızı).

## Çizim

Hierarchy'de `Lake` altında katmanlar var. Tile Palette'te **Active Tilemap** olarak boyayacağın katmanı seç:

| Katman | Ne için |
|---|---|
| `Ground` | Zemin: çimen, toprak, su, kıyı |
| `Detail` | Zeminin üstündeki düz şeyler: yol, iskele tahtası, çiçek |
| `Above` | Karakterin **önünde** çizilenler: ağaç tepesi, çatı |
| `Water` | **İşaretçi.** Balık tutulabilen su (mavi kare). Yürünemez |
| `Blocked` | **İşaretçi.** Kimsenin basamayacağı yer (kırmızı kare): bina, çeşme, ağaç gövdesi, çit |
| `Spawn` | Yeni oyuncunun doğduğu nokta (sarı kare, taşı) |
| `Objects` | Tek tek koyduğun nesneler (ağaç, ev, tabela) |

İşaretçiler (`Water`, `Blocked`, `Spawn`) oyunda görünmez, sadece çarpışmayı belirler. **Görünen su ile `Water` işaretçisi aynı yerde olmalı**; ikisini de sen boyarsın. İskele gibi suyun üstünden **yürünecek** yere `Water` boyama.

### Ağaç, ev, tabela (sürükle-bırak)

1. Resmi Project'ten Hierarchy'de `Lake > Objects` altına sürükle.
2. Üstüne **Add Component > Map Object** ekle. Karakter ağacın arkasından geçerken gizlenir, önünden geçerken görünür.
3. Sprite'ın pivot'u **Bottom** (ayak) olmalı: resmi seç > Sprite Editor > pivotu alta al. Çok parçalı sheet'te (ağaçlar, evler) önce `Slice > Automatic`.
4. Nesnenin bastığı yeri `Blocked` ile kırmızıya boya, yoksa içinden yürünür.

Kısa yol: Project'te bir veya birkaç .png seç, `CollectionGame > Map > Slice Selected Textures (32x32)` ile sheet'i tile parçalarına böl.

## Kaydet ve sunucuya ver

1. Prefab modundan çık (sol üst ok). Kayıt otomatik; kaydetmezse `Ctrl/Cmd+S`.
2. **`CollectionGame > Map > Export (server + client)`**. Sunucu ve client dosyaları yazılır. `Spawn` suyun ya da engelin üstündeyse hata verir.
3. Sunucuyu yeniden başlat: `docker compose up -d --force-recreate server-build nakama`.
4. Play. Prefab'ı boyayıp Export etmezsen Console'da "markers changed after the last export" uyarısı çıkar, yürürken sunucu seni geri çeker.
5. Commit: `Lake.prefab`, `Assets/Map/`, `LakeMapData.cs`, `server/src/data/lake-map.ts` ve `.meta` dosyaları.

## Haritayı değiştirince güncellenecekler

Bu yerler eski test haritasının koordinatlarına bağlı. İskeleyi, Banka'yı ya da göl kıyısını taşırsan elle güncelle:

- `server/src/config.ts` `STASH.bank` (şimdi `30.5, 78.5`) ve haritada Banka yazısı (`docs/protokol.md` Depo).
- `server/test/map.test.ts` ve `server/test/water.test.ts` (iskele ve göl koordinatları).
- `server/scripts/smoke-test.mjs` (iskeleye yürüme `74.5, 47.5 → 85.4, 47.5`, atış `88.5, 47.5`).
- `client/Assets/Scripts/Dev/Autopilot.cs` (iskele ucu).
- `docs/tasarim/16-ilk-harita.md`.
