# Draws the wardrobe window draft (docs/gorsel/ui-taslaklar/gardirop.png) from the UI kit and Universal LPC sprites.
# Usage: python3 tools/wardrobe/draft_window.py <work dir> <out.png>. The work dir holds ulpc/ (a Universal LPC
# checkout), us/ (body, clothes, hair, hat walk sheets) and wg/ (wing bg/fg walk sheets) taken from that checkout.
import json, sys
from PIL import Image, ImageDraw, ImageFont, ImageEnhance
S=sys.argv[1]; R='/home/user/collection-fishing/'
UI=R+'client/Assets/Art/UI/'
B={i['name']:(i['l'],i['t'],i['r'],i['b']) for i in json.load(open(UI+'ui-borders.json'))['items']}
FONT=ImageFont.truetype(R+'client/Assets/Resources/Fonts/PressStart2P-Regular.ttf',8)
INK=(58,44,36); MUTED=(120,104,86); WHITE=(250,247,239)
def kit(n): return Image.open(UI+n+'.png').convert('RGBA')
def nine(n,w,h):
    im=kit(n); l,t,r,b=B.get(n,(0,0,0,0)); W,H=im.size
    out=Image.new('RGBA',(w,h))
    def part(x0,y0,x1,y1,dx,dy,dw,dh):
        if x1<=x0 or y1<=y0 or dw<=0 or dh<=0: return
        out.alpha_composite(im.crop((x0,y0,x1,y1)).resize((dw,dh),Image.NEAREST),(dx,dy))
    xs=[(0,l,0,l),(l,W-r,l,w-l-r),(W-r,W,w-r,r)]; ys=[(0,t,0,t),(t,H-b,t,h-t-b),(H-b,H,h-b,b)]
    for sx0,sx1,dx,dw in xs:
        for sy0,sy1,dy,dh in ys: part(sx0,sy0,sx1,sy1,dx,dy,dw,dh)
    return out
def put(c,im,x,y): c.alpha_composite(im,(x,y))
def text(d,x,y,s,fill=INK,center=None):
    if center is not None:
        w=d.textlength(s,font=FONT); x=center-w/2
    d.text((x,y),s,font=FONT,fill=fill)

# background: world from the bag draft at 1x, dimmed
bg=Image.open(R+'docs/gorsel/ui-taslaklar/canta-v2.png').convert('RGBA').resize((704,448),Image.NEAREST)
bg=bg.crop((0,0,704,448)); c=ImageEnhance.Brightness(bg).enhance(0.55)
d=ImageDraw.Draw(c)

WX,WY,WW,WH=96,40,512,372
put(c,nine('window',WW,WH),WX,WY)
# title plate and close
put(c,nine('button_wood_normal',120,20),WX+WW//2-60,WY-8); text(d,0,WY-2,'Gardırop',WHITE,center=WX+WW//2)
put(c,kit('button_close_normal').resize((24,24),Image.NEAREST),WX+WW-30,WY+6)

# --- character preview (left) ---
PX,PY,PW,PH=WX+16,WY+30,150,196
put(c,nine('card',PW,PH),PX,PY)
U=S+'/us/'
def L(p): return Image.open(p).convert('RGBA')
def pal(m,f,base,name):
    dd=json.load(open(S+f'/ulpc/palette_definitions/{m}/{m}_{f}.json'))
    h=lambda s:tuple(int(s[i:i+2],16) for i in (1,3,5))
    return {a:h(dd[name][i]) for i,a in enumerate(h(x) for x in dd[base])}
def rc(im,m):
    px=im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=px[x,y]
            if a and (r,g,b) in m: px[x,y]=m[(r,g,b)]+(a,)
    return im
teal=pal('cloth','ulpc','white','teal'); navy=pal('cloth','ulpc','white','navy'); brown=pal('cloth','ulpc','white','brown')
hair=pal('hair','ulpc','orange','dark_brown')
def char(row,wings=True,hat=True):
    layers=[]
    if wings: layers.append((S+'/wg/pixie_bg.png',None))
    layers+=[(U+'body_bodies_male_walk.png',None),(U+'feet_shoes_basic_male_walk.png',brown),(U+'legs_pants_male_walk.png',navy),
             (U+'torso_clothes_shortsleeve_tshirt_male_walk.png',teal),(U+'head_heads_human_male_walk.png',None),(U+'hair_parted_adult_walk.png',hair)]
    if hat: layers.append((U+'hat_wizard_walk.png',None))
    if wings: layers.append((S+'/wg/pixie_fg.png',None))
    cell=Image.new('RGBA',(64,64))
    for p,m in layers:
        im=L(p); fr=im.crop((0,row*64,64,row*64+64))
        if m: fr=rc(fr,m)
        cell.alpha_composite(fr)
    return cell
big=char(2).resize((128,128),Image.NEAREST)
put(c,nine('box_dark',PW-16,140),PX+8,PY+8)
put(c,big,PX+PW//2-64,PY+12)
# rotate buttons
for i,arrow in enumerate(['<','>']):
    bx=PX+12+i*(PW-40)
    put(c,nine('button_square_wood_normal',16,16),bx,PY+128); text(d,bx+4,PY+132,arrow,WHITE)
text(d,0,PY+152,'Prova',MUTED,center=PX+PW//2)
text(d,0,PY+166,'sadece sende',MUTED,center=PX+PW//2)


# identity row under the preview
IY=PY+PH+8
put(c,nine('card',PW,96),PX,IY)
text(d,PX+8,IY+8,'Gövde')
for i,lab in enumerate(['Erkek','Kadın']):
    n='button_wood_normal' if i==0 else 'tab_off'
    put(c,nine(n,46,16),PX+50+i*48,IY+4)
    text(d,0,IY+8,lab,WHITE if i==0 else INK,center=PX+50+i*48+23)
skins=[(250,214,182),(240,190,150),(214,160,120),(180,124,86),(140,92,62),(96,62,42)]
text(d,PX+8,IY+32,'Ten')
for i,col in enumerate(skins):
    x=PX+48+i*16; d.rectangle([x,IY+28,x+12,IY+40],fill=col,outline=INK)
d.rectangle([PX+48+16-2,IY+26,PX+48+16+14,IY+42],outline=(255,255,255))
eyes=[(70,110,170),(80,140,90),(120,80,50),(60,60,60),(150,110,60)]
text(d,PX+8,IY+56,'Göz')
for i,col in enumerate(eyes):
    x=PX+48+i*16; d.rectangle([x,IY+52,x+12,IY+64],fill=col,outline=INK)
text(d,PX+8,IY+78,'Kimlik bedava',MUTED)

# --- right: tabs ---
RX=PX+PW+12; RW=WX+WW-16-RX
tabs=['Üst','Alt','Ayak','Şapka','Saç','Kanat','Takı','Diğer']
tx=RX
for t in tabs:
    w=int(d.textlength(t,font=FONT))+12
    on=t=='Kanat'
    put(c,nine('tab_active' if on else 'tab_off',w,18),tx,PY)
    text(d,tx+6,PY+5,t,INK)
    tx+=w+2
GY=PY+22
put(c,nine('card',RW,152),RX,GY)
wings=[('pixie','rare','own'),('monarch','rare','rent'),('dragonfly','rare','try'),('bat','epic','try'),('feathered','epic','own'),('lunar','legendary','try'),('feathered','mythic','try')]
names={'pixie':'Pixie Wings','monarch':'Monarch Wings','dragonfly':'Dragonfly Wings','bat':'Bat Wings','feathered':'Feathered Wings','lunar':'Lunar Wings'}
cols=6
for i in range(12):
    x=RX+8+(i%cols)*(40+6); y=GY+8+(i//cols)*(40+6)
    if i<len(wings):
        n,tier,state=wings[i]
        put(c,kit('slot_selected' if i==0 else 'slot_tier_'+tier),x,y)
        bgw=L(S+f'/wg/{n}_bg.png').crop((0,128,64,192)); fg=L(S+f'/wg/{n}_fg.png').crop((0,128,64,192))
        th=Image.new('RGBA',(64,64)); th.alpha_composite(bgw); th.alpha_composite(fg)
        bb=th.getbbox() or (0,0,64,64); th=th.crop(bb); th.thumbnail((32,32),Image.NEAREST)
        if tier=='mythic':
            px=th.load()
            for yy in range(th.height):
                for xx in range(th.width):
                    r,g,b,a=px[xx,yy]
                    if a: px[xx,yy]=((r+[255,255,80,80,140][xx*5//th.width])//2,(g+[80,200,255,140,90][xx*5//th.width])//2,(b+[80,60,90,255,255][xx*5//th.width])//2,a)
        put(c,th,x+20-th.width//2,y+20-th.height//2)
        if state=='try':
            put(c,kit('panel_locked').resize((40,40),Image.NEAREST) if False else Image.new('RGBA',(36,36),(60,50,40,90)),x+2,y+2)
            d2=ImageDraw.Draw(c); d2.rectangle([x+28,y+28,x+37,y+37],fill=(58,44,36)); d2.text((x+29,y+29),'?',font=FONT,fill=WHITE)
        if state=='rent':
            d2=ImageDraw.Draw(c); d2.ellipse([x+27,y+27,x+37,y+37],fill=WHITE,outline=INK); d2.line([x+32,y+29,x+32,y+32],fill=INK); d2.line([x+32,y+32,x+35,y+32],fill=INK)
    else:
        put(c,kit('slot_empty'),x,y)
d=ImageDraw.Draw(c)
text(d,RX+8,GY+102,'Sende',INK); d.rectangle([RX+60,GY+102,RX+68,GY+110],outline=INK)
text(d,RX+76,GY+102,'?  Prova',MUTED); 
d.ellipse([RX+150,GY+101,RX+160,GY+111],fill=WHITE,outline=INK); text(d,RX+166,GY+102,'Kiralık',MUTED)
text(d,RX+8,GY+120,'Her parçayı deneyebilirsin.',MUTED)
text(d,RX+8,GY+134,'Kaydet: sadece sendekiler.',MUTED)

# selected part info + colour
IY2=GY+158
put(c,nine('card',RW,112),RX,IY2)
text(d,RX+8,IY2+8,'Pixie Wings',INK); text(d,RX+112,IY2+8,'Rare',(70,120,200))
text(d,RX+8,IY2+22,'Craft · kalıcı · takaslanır',MUTED)
text(d,RX+8,IY2+40,'Renk',INK)
dyes=json.load(open(S+'/ulpc/palette_definitions/cloth/cloth_ulpc.json'))
order=['white','gray','black','red','rose','orange','yellow','tan','brown','green','forest','teal','sky','blue','navy','purple','lavender','pink']
for i,nm in enumerate(order):
    hx=dyes[nm][4]; col=tuple(int(hx[k:k+2],16) for k in (1,3,5))
    x=RX+8+i*16; y=IY2+54
    d.rectangle([x,y,x+12,y+12],fill=col,outline=INK)
    if nm=='blue': d.rectangle([x-2,y-2,x+14,y+14],outline=(255,255,255))
    if i>=10:
        d.line([x+9,y+9,x+12,y+12],fill=INK)
text(d,RX+8,IY2+74,'Başka renk = başka eşya',MUTED)
text(d,RX+8,IY2+90,'Mavi: sende yok, prova',MUTED)

# buttons
BY=WY+WH-34
put(c,nine('button_wood_normal',96,20),RX+RW-206,BY); text(d,0,BY+6,'Geri al',WHITE,center=RX+RW-206+48)
put(c,nine('button_green_normal',104,20),RX+RW-104,BY); text(d,0,BY+6,'Kaydet',WHITE,center=RX+RW-104+52)
text(d,PX,BY+6,'Değişiklik: 1 parça',MUTED)
c.resize((1408,896),Image.NEAREST).convert('RGB').save(sys.argv[2])
