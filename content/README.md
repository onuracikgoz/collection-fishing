# content

- `palette.hex`: oyunun ortak renk paleti (Resurrect 64). Item Art Studio bunu okur.
- `sets/index.md`: tüm setlerin listesi
- `sets/<set_id>/set.json`: setin makine okunur tanımı
- `sets/<set_id>/prompts.md`: Perchance promptları ve renk varyantı planı
- `sets/<set_id>/png/`: Item Art Studio çıktıları (ZIP'teki `png/` klasörü)
- `sets/<set_id>/studio/`: Item Art Studio `.studio.json` dosyaları (varyantları yeniden üretmek için)

Setler `collection-set-generator` skill'i ile üretilir.
