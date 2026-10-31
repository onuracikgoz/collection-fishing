# content

- `palette.hex`: oyunun ortak renk paleti (Resurrect 64). Item Art Studio bunu okur.
- `maps/<id>.json`: harita dosyası (çarpışma, su, önemli noktalar). Sunucu ve client aynı dosyayı okur; biçim `docs/protokol.md`, Harita dosyası.
- `sets/index.md`: tüm setlerin listesi
- `sets/<set_id>/set.json`: setin taslak tanımı (skill çıktısı; Item Art Studio sırayı buradan okur)
- `sets/<set_id>/prompts.md`: eşya başına Perchance promptları

Oyundaki eşyalar, setler ve recipe'ler burada değil, sunucu verisinde durur; admin paneliyle eklenir (`docs/araclar/admin-paneli.md`). Görseller de Item Art Studio ZIP'iyle admin paneline yüklenir.

Setler `collection-set-generator` skill'i ile üretilir.
