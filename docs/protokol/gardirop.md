# Protokol: Gardırop: katalog, görünüm, LOOK_SET / LOOK_SHOW

Genel kurallar ve op code dizini: `docs/protokol.md`.

## Gardırop (16.11.2026)

Kurallar: `docs/tasarim/20-gardirop.md`. Sunucu: `rules/wardrobe.ts` (saf kurallar), `match/wardrobe.ts`, `rpc/wardrobe.ts`. Görünüm sadece sunucuda doğrulanır; client sadece istediği görünümü gönderir.

**Katalog** `get_content` içinde gelir (`wardrobe`), içerik belgesinin parçasıdır ve admin panelinden değişir:

- `wardrobe.parts: [{ id, name, slot, family, tier, colors, color2?, effects, bodies, free, active }]`
  - `id`: parçanın kimliği (LPC tanım dosyasının adı, ör. `torso_clothes_tshirt`), hiç değişmez. `slot`: yuva (LPC katman türü, ör. `clothes`, `hair`, `hat`, `wings`); bir yuvada bir parça. `family`: pencere sekmesi ve craft ailesi (`UST`, `SAC`, `KANAT`...).
  - `tier`: `common` … `legendary`; bedava parçada `null`.
  - `colors`: kabul ettiği renk türleri (`dye`, `hair`, `metal`, `gem`). Boşsa parça tek renktir (`fixed`), rengi `""`. `color2`: ikinci renk alanı varsa onun türleri. `effects`: Mythic yapılabildiği efekt renkleri.
  - `bodies`: `male`, `female` (parça hangi gövdede çizili). `free`: Başlangıç parçası.
  - JsonUtility için `get_content` cevabında `tier` bedava parçada `""`, `color2` ikinci alan yoksa `[]` gelir.
- `wardrobe.colors: [{ id, kind, tier, free }]`: `kind` `dye`, `hair`, `metal`, `gem`, `fx` (efekt, Mythic), `skin`, `eye`. Id'ler türüyle başlar: `dye_red`, `hair_blonde`, `metal_gold`, `gem_red`, `fx_rainbow`, `skin_light`, `eye_blue`. `free`: bedava parçada kullanılabilir (ten ve göz her zaman bedava).

**Gardırop eşyası** (`WardrobeItem`): `{ instanceId, part, color, color2?, source, obtainedAt, until?, locked }`.
- `source`: `admin`, `craft`, `rent_coin`, `rent_diamond`. `until`: kiralıkta bitiş zamanı (ms); yoksa kalıcı. `locked: true` takas, pazar ve satışa girmez (kiralık her zaman kilitli).
- Rengi eşyanın kendisidir; aynı parçanın iki rengi iki ayrı eşyadır. Tier: renk `fx_*` ise `mythic`, değilse parçanın Tier'ı.

**Görünüm** (`Look`): `{ body, skin, eyes, parts: [{ part, color, color2?, rented? }] }`.
- `body`: `male` / `female`. `skin` ve `eyes`: `skin_*` / `eye_*` renk id'si. `parts` sırasızdır; client katman sırasını kendi parça listesinden bilir. `rented: true` kiralık parçadır (başkaları saat işaretini görür).
- Görünümünü hiç kaydetmemiş oyuncuya sunucu kimliğinden türetilmiş bedava bir görünüm verir (her yerde aynı).

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 69 | C → S | `LOOK_SET` | `{ body, skin, eyes, parts: [{ part, color, color2?, instanceId? }] }` (bütün görünüm; "Kaydet") |
| 70 | S → C | `LOOK_SHOW` | `{ id, look, reason? }` (oyuncunun kendisi ve onu görenler) |

- `LOOK_SET`: her parça ya `instanceId` ile oyuncunun **kendi eşyası**dır (rengi eşyadan gelir, gönderilen renk yok sayılır) ya da `instanceId`'siz **bedava parça + bedava renk**tir. Sunucu kontrol eder: gövde, ten ve göz geçerli mi; eşya oyuncunun mu ve süresi dolmamış mı; parça bu gövdede var mı; renk parçaya uyuyor mu; bir yuvada tek parça mı. Hepsi geçerse kaydeder ve `LOOK_SHOW { id, look }` oyuncuya ve onu görenlere gider. Değilse sadece oyuncuya `{ id, look: <şu anki>, reason }` gider, client eski halini geri koyar.
- `reason`: `NOT_OWNED` (eşya yok, başkasının ya da süresi dolmuş), `BAD_LOOK` (bilinmeyen parça / renk, gövdede olmayan parça, aynı yuvada iki parça), `RATE_LIMITED` (1 sn'de bir, Öneri).
- Yeni gelen oyuncular için `PLAYER_ENTER` içinde `look` vardır; oyuncunun kendi görünümü `WELCOME` içinde `look`.
- **Süre dolunca:** sunucu çevrimiçi oyuncunun giyili kiralığı dolduğu anda parçayı çıkarır ve `LOOK_SHOW` gönderir. Girişte de bakılır. Dolan eşya gardıroptan silinir.
- **Panelden verme / geri alma** (`docs/araclar/admin-paneli.md`): oyuncuya Nakama bildirimi gider (kod **120**, konu `wardrobe`, `{}`); client açık gardırop penceresini `get_wardrobe` ile yeniler. Geri alınan parça giyiliyse oyuncunun sunucusu görünümü hemen düzeltir (`LOOK_SHOW`).
- `characterId` (katılım metadata'sı) eskisi gibi gelir ama kullanılmaz; görünüm `look`'tur.

**RPC:**
- `get_wardrobe` `{}` → `{ items: WardrobeItem[], look: Look, worn: [{ slot, instanceId }] }`: oyuncunun eşyaları (süresi dolanlar hariç), kayıtlı görünümü ve hangi yuvada hangi eşyasının giyili olduğu (bedava parçalar `worn`'da yok).
