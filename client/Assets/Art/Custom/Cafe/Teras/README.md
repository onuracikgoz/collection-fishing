# Kafe terası parçaları

Kaynak: `tools/pixel-art/ai-src/kafe_teras.png` (Gemini). Kesme ve temizleme: `UP=2 clean_ai.py <kesit> <çıktı> 9999 4.26`.

- `teras_mobilya.png` (Gemini, `ai-src/teras_mobilya.png`, ızgara 8, UP=2) `split_parts.py` ile ayrıldı. KULLANILAN mobilya bunlar:
  - `sandalye_on.png` oturağı kameraya bakan (masanın arkasında durur, oturan aşağı bakar)
  - `sandalye_arka.png` arkalığı kameraya bakan (masanın önünde durur, oturanın önünde çizilir)
  - `sandalye_yan_sag.png`, `sandalye_yan_sol.png` sağa / sola bakan
  - `masa_yuvarlak.png`, `masa_kare.png`, `semsiye.png` (şemsiye kare masanın ortasına konur)
  - `bank_on.png`, `bank_arka.png`
- Eski `masa_sandalye.png`, `masa.png`, `semsiye_masa.png`, `bank.png` ilk görselden; yeni set geldiği için kullanılmıyor.
- Oturan karakter: LPC `Sitting.png` 3. sütun (sandalye pozu), 4 yön.
- Sıralama: oyunda olduğu gibi ayak hizası (alt kenar) büyük olan önde. Prop'lar çit hattına değmemeli (`teras_onizleme.py`).
- Çit: `cit.png` orijinal, `fence.py` ile uzatılabilir parçalar:
  - `cit_yatay.png` 16 px adımla yan yana dizilir (dikişsiz)
  - `cit_direk.png` sağ uç ve köşe
  - `cit_dikey.png` yandan görünen çit, 16 px adımla üst üste (alttaki önde)
