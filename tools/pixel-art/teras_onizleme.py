"""Teras önizlemesi: çitli alan + prop'lar + LPC oturma pozu (3. sütun). Oyundaki kural gibi her şey AYAK HİZASINA (alt kenar) göre sıralanır.
Kullanım: python3 teras_onizleme.py  -> /mnt/project-files/.../cesme-cozy-sahne.png
"""
from PIL import Image
C='../../client/Assets/Art/LPC/Characters/'
Ls=['Body/Body 02 - Masculine, Thin/Peach','Clothing/Masculine, Thin/Legs/Pants 03 - Pants/Denim','Clothing/Masculine, Thin/Feet/Shoes 01 - Shoes/Brown','Clothing/Masculine, Thin/Torso/Shirt 04 - T-shirt/Blue','Head/Head 02 - Masculine/Peach','Hair/Short 02 - Parted/Brown']
sh=Image.new('RGBA',(192,256))
for l in Ls: sh.alpha_composite(Image.open(C+l+'/Sitting.png').convert('RGBA'))
fr=lambda r: sh.crop((128,r*64,192,r*64+64))
O='../../client/Assets/Art/Custom/Cafe/Teras/'; I=lambda n: Image.open(O+n+'.png')
g=Image.open('../../client/Assets/Art/Custom/Ground/cimen-toprak-gecis-16.png').convert('RGBA').crop((0,0,32,32))
P=16; cols,rows=24,12; ox,oy=24,20
W,H=cols*P+60,rows*P+70
can=Image.new('RGBA',(W,H))
for y in range(0,H,32):
    for x in range(0,W,32): can.alpha_composite(g,(x,y))
items=[]   # (ayak_y, img, x, y_üst)
def put(img,x,foot):
    if isinstance(img,str): img=I(img)
    items.append((foot,img,x,foot-img.height))
yat,dik,dir_=I('cit_yatay'),I('cit_dikey'),I('cit_direk')
for edge in (oy, oy+rows*P):
    for i in range(cols): put(yat,ox+i*P,edge+yat.height)
    put(dir_,ox+cols*P,edge+dir_.height)
for j in range(1,rows+1):
    for x in (ox,ox+cols*P): put(dik,x,oy+j*P-P+dik.height)
# şemsiyeli masa + 4 sandalye (oturan)
cx,cy=120,130     # masanın ayak hizası
t=I('semsiye_masa'); put(t,cx-t.width//2,cy)
put('sandalye_on',cx-15,cy-34); items.append((cy-33,fr(2),cx-32,cy-34-63))
put('sandalye_yan_sag',cx-60,cy+2); items.append((cy+3,fr(3),cx-79,cy-58))
put('sandalye_yan_sol',cx+31,cy+2); items.append((cy+3,fr(1),cx+15,cy-58))
items.append((cy+30,fr(0),cx-32,cy-16)); put('sandalye_arka',cx-15,cy+31)
# yuvarlak masa + iki yan sandalye
mx,my=270,110
m=I('masa'); put(m,mx-m.width//2,my)
put('sandalye_sag',mx-50,my+2); put('sandalye_sol',mx+16,my+2)
put('bank',330,80); put('saksi_cicek',300,190); put('menu_tahta',240,180)
put('saksi_agac',370,200); put('fener_direk',180,205)
for f,img,x,y in sorted(items,key=lambda i:i[0]): can.alpha_composite(img,(x,y))
can.resize((W*2,H*2),Image.NEAREST).save('/mnt/project-files/collectiongame/harita/zemin-v3/cesme-cozy-sahne.png')
