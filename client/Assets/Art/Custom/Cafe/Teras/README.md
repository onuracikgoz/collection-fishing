# Kafe terası parçaları

Kaynak: `tools/pixel-art/ai-src/kafe_teras.png` (Gemini). Kesme ve temizleme: `UP=2 clean_ai.py <kesit> <çıktı> 9999 4.26`.

- `masa_sandalye.png`: orijinal grup. `split_parts.py` ile ayrıldı:
  - `sandalye_sag.png`, `sandalye_sol.png`: eski tip sandalye, KULLANILMIYOR (16.11.2026, tek tip için 4 yönlü set kullanılır)
  - `masa.png`: yuvarlak masa
- `sandalyeler_4yon.png` (Gemini, `ai-src/sandalyeler.png`, ızgara 8.7, UP=1) ayrıldı:
  - `sandalye_on.png` oturağı kameraya bakan (masanın arkasında durur, oturan aşağı bakar)
  - `sandalye_arka.png` arkalığı kameraya bakan (masanın önünde durur, oturanın önünde çizilir)
  - `sandalye_yan_sag.png`, `sandalye_yan_sol.png` tam yandan görünen sağa / sola bakan
- Oturan karakter: LPC `Sitting.png` 3. sütun (sandalye pozu), 4 yön.
- Sıralama: oyunda olduğu gibi ayak hizası (alt kenar) büyük olan önde. Prop'lar çit hattına değmemeli (`teras_onizleme.py`).
- Çit: `cit.png` orijinal, `fence.py` ile uzatılabilir parçalar:
  - `cit_yatay.png` 16 px adımla yan yana dizilir (dikişsiz)
  - `cit_direk.png` sağ uç ve köşe
  - `cit_dikey.png` yandan görünen çit, 16 px adımla üst üste (alttaki önde)
