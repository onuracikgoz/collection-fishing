# Kafe terası parçaları

Kaynak: `tools/pixel-art/ai-src/kafe_teras.png` (Gemini). Kesme ve temizleme: `UP=2 clean_ai.py <kesit> <çıktı> 9999 4.26`.

- `masa_sandalye.png`: orijinal grup. `split_parts.py` ile ayrıldı:
  - `sandalye_sag.png`: yüzü sağa bakan sandalye (masanın solunda durur)
  - `masa.png`: yuvarlak masa
  - `sandalye_sol.png`: yüzü sola bakan sandalye (masanın sağında durur)
- Önden / arkadan görünen sandalye yok, Gemini'den ayrıca istenecek.
- Çit: `cit.png` orijinal, `fence.py` ile uzatılabilir parçalar:
  - `cit_yatay.png` 16 px adımla yan yana dizilir (dikişsiz)
  - `cit_direk.png` sağ uç ve köşe
  - `cit_dikey.png` yandan görünen çit, 16 px adımla üst üste (alttaki önde)
