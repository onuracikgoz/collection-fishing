"""Kafe terası prop'larını ai-src/kafe_teras.png'dan keser ve temizler (kutular aşağıda).
Kullanım: python3 teras_kes.py [çıktı_klasörü]   (sonra: split_parts.py masa_sandalye.png sandalye_sag masa sandalye_sol; fence.py)
"""
import os, subprocess, sys
from PIL import Image
SRC='ai-src/kafe_teras.png'; OUT='../../client/Assets/Art/Custom/Cafe/Teras'
boxes=dict(masa_sandalye=(12,445,202,556),semsiye_masa=(192,383,338,556),bank=(328,458,438,556),
 saksi_cicek=(443,463,552,556),fener_direk=(558,383,642,556),menu_tahta=(658,438,764,556),
 saksi_agac=(778,393,874,556),cit=(882,466,1008,556))
out_dir=sys.argv[1] if len(sys.argv)>1 else OUT
im=Image.open(SRC).convert('RGB')
from PIL import ImageDraw
MASK={'semsiye_masa':[(192,455,200,556),(329,455,338,556)]}  # sadece o kesitte: komşu sandalye/bank kenarları
for n,b in boxes.items():
    src=im.copy(); d=ImageDraw.Draw(src)
    for r in MASK.get(n,[]): d.rectangle(r,fill='white')
    c=src.crop(b); p=Image.new('RGB',(c.width+20,c.height+20),'white'); p.paste(c,(10,10))
    f=f'/tmp/claude-0/teras/{n}_src.png'; p.save(f)
    subprocess.run(['python3','clean_ai.py',f,f'{out_dir}/{n}.png','9999','4.26'],env=dict(os.environ,UP='2'),check=True)
