"""Draws the pixel UI kit (Resurrect 64, wood frame + sage linen theme) into client/Assets/Art/UI.

Run from the repo root:  python3 tools/ui-kit/make_ui_kit.py
Writes one PNG per piece, ui-borders.json (9-slice borders, read by PixelArtImporter)
and a preview at docs/gorsel/ui-kit-onizleme.png. Needs Pillow.
"""
import json, os, random
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "client", "Assets", "Art", "UI")
PREVIEW = os.path.join(ROOT, "docs", "gorsel", "ui-kit-onizleme.png")
SAMPLE = os.path.join(ROOT, "docs", "gorsel", "ornek-ekran.png")

def c(h, a=255): return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)
CLR = (0, 0, 0, 0)
INK = c("2e222f")
# wood ramp: deep, shade, face, light, shine
WD, WM, W, WL, WH = map(c, ["45293f", "7a3045", "9e4539", "cd683d", "e6904e"])
PAPER, PAPER_S, PAPER_D = c("fdcbb0"), c("fca790"), c("e6904e")
# sage: linen fill of windows, slot / field faces, flat bottom bar
LINEN, LINEN_W = c("b2ba90"), c("92a984")
SAGE_L, SAGE, SAGE_M, SAGE_D = c("c7dcd0"), c("92a984"), c("547e64"), c("374e4a")
NAIL, NAIL_D = c("f9c22b"), c("4c3e24")
GREY_D, GREY, GREY_L = c("625565"), c("7f708a"), c("9babb2")
WHITE = c("ffffff")

pieces, borders = {}, {}
def put(name, im, border=None):
    pieces[name] = im
    if border is not None:
        borders[name] = [border] * 4 if isinstance(border, int) else list(border)  # left, top, right, bottom

def new(w, h): return Image.new("RGBA", (w, h), CLR)
def r(im, x0, y0, x1, y1, col): ImageDraw.Draw(im).rectangle((x0, y0, x1, y1), fill=col)
def round_corners(im, n=1):
    w, h = im.size
    for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        im.putpixel((x, y), CLR)
def speckle(im, x0, y0, x1, y1, colors, density=18, seed=3):
    rnd = random.Random(seed)
    for _ in range(max(1, (x1 - x0 + 1) * (y1 - y0 + 1) // density)):
        im.putpixel((rnd.randint(x0, x1), rnd.randint(y0, y1)), rnd.choice(colors))
def linen(im, x0, y0, x1, y1):
    """Woven linen, period 4 px, so a Tiled center repeats without seams."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            dx, dy = x - x0, y - y0
            im.putpixel((x, y), LINEN_W if (dx // 2 + dy // 2) % 2 == 0 and (dx + dy) % 4 == 0 else LINEN)
def from_ascii(rows, colors):
    im = new(len(rows[0]), len(rows))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in colors: im.putpixel((x, y), colors[ch])
    return im

# ---------- buttons ----------
RAMPS = {  # deep, shade, face, light, shine
    "wood":  (WD, WM, W, WL, WH),
    "green": (c("165a4c"), c("239063"), c("1ebc73"), c("91db69"), c("cddf6c")),
    "red":   (c("6e2727"), c("ae2334"), c("e83b3b"), c("f68181"), c("fca790")),
}
GREY_RAMP = (INK, GREY_D, GREY, GREY_L, c("c7dcd0"))

def button(ramp, state, w, h):
    deep, shade, face, light, shine = ramp
    if state == "hover": deep, shade, face, light = shade, face, light, shine
    im = new(w, h)
    r(im, 0, 0, w - 1, h - 1, INK)
    if state == "pressed":
        r(im, 1, 1, w - 2, h - 2, shade)
        r(im, 1, 1, w - 2, 2, deep)                   # shadow on top, face looks pushed in
        r(im, 4, h // 2 + 1, w - 5, h // 2 + 1, deep)
    else:
        r(im, 1, 1, w - 2, h - 2, face)
        r(im, 1, 1, w - 2, 1, light)                  # light top edge
        r(im, 1, h - 3, w - 2, h - 2, shade)          # 2 px bottom shadow
        r(im, 4, h // 2 - 1, w - 5, h // 2 - 1, shade)  # one grain line
        if w > 16:
            im.putpixel((2, 3), NAIL); im.putpixel((w - 3, 3), NAIL)  # pegs
    round_corners(im)
    return im

for variant, ramp in RAMPS.items():
    for state in ("normal", "hover", "pressed", "disabled"):
        rp = GREY_RAMP if state == "disabled" else ramp
        st = "normal" if state == "disabled" else state
        put(f"button_{variant}_{state}", button(rp, st, 32, 16), 4)
        put(f"button_square_{variant}_{state}", button(rp, st, 16, 16), 4)

X = ["..........", ".x......x.", ".xx....xx.", "..xx..xx..", "...xxxx...",
     "....xx....", "...xxxx...", "..xx..xx..", ".xx....xx.", ".x......x."]
for state in ("normal", "hover", "pressed"):
    im = button(RAMPS["red"], state, 12, 12)
    cross = from_ascii(X, {"x": WHITE if state != "pressed" else c("f68181")})
    im.alpha_composite(cross, (1, 1 + (1 if state == "pressed" else 0)) if state == "pressed" else (1, 0))
    put(f"button_close_{state}", im)

# ---------- window: plank frame, sage linen, drop shadow ----------
def window(s=50, f=8, sh=2):
    im = new(s, s)
    r(im, sh, sh, s - 1, s - 1, c("2e222f", 110))      # baked drop shadow
    n = s - sh
    r(im, 0, 0, n - 1, n - 1, INK)
    r(im, 1, 1, n - 2, n - 2, W)
    for y in (3, 5): r(im, f, y, n - 1 - f, y, WM); r(im, f, n - 1 - y, n - 1 - f, n - 1 - y, WM)
    for x in (3, 5): r(im, x, f, x, n - 1 - f, WM); r(im, n - 1 - x, f, n - 1 - x, n - 1 - f, WM)
    for x in range(f + 8, n - f, 16): r(im, x, 1, x, f - 2, WD); r(im, x, n - f + 1, x, n - 2, WD)
    for y in range(f + 8, n - f, 16): r(im, 1, y, f - 2, y, WD); r(im, n - f + 1, y, n - 2, y, WD)
    r(im, 1, 1, n - 2, 1, WL); r(im, 1, 1, 1, n - 2, WL)
    r(im, 1, n - 2, n - 2, n - 2, WM); r(im, n - 2, 1, n - 2, n - 2, WM)
    for x, y in [(1, 1), (n - f, 1), (1, n - f), (n - f, n - f)]:   # corner blocks, brass nails
        r(im, x, y, x + f - 2, y + f - 2, W); r(im, x, y, x + f - 2, y, WL)
        r(im, x + 2, y + 2, x + 4, y + 4, NAIL_D); r(im, x + 2, y + 2, x + 3, y + 3, NAIL)
    r(im, f - 1, f - 1, n - f, n - f, WD)               # inner lip
    linen(im, f, f, n - 1 - f, n - 1 - f)
    r(im, f, f, n - 1 - f, f, SAGE)                     # shade under the top frame
    im.putpixel((0, 0), CLR); im.putpixel((n - 1, 0), CLR); im.putpixel((0, n - 1), CLR)
    return im, (f + 1, f + 1, f + 1 + sh, f + 1 + sh)
put("window", *window(s=52))

# ---------- box C: translucent dark (chat, HUD, server info) ----------
im = new(16, 16)
r(im, 0, 0, 15, 15, c("625565", 200)); r(im, 1, 1, 14, 14, c("2e222f", 190)); r(im, 1, 1, 14, 1, c("3e3546", 200))
round_corners(im); put("box_dark", im, 3)

# ---------- paper card, tooltip, name tag, chat bubble ----------
im = new(24, 24)   # light card inside a window (friend row, server row, rule row)
r(im, 0, 0, 23, 23, SAGE); r(im, 1, 1, 22, 22, SAGE_L)
round_corners(im); put("card", im, 3)

# ---------- flat bottom bar (opaque sage) + its buttons ----------
im = new(8, 16); r(im, 0, 0, 7, 15, SAGE_D); r(im, 0, 0, 7, 0, INK)
put("hud_bar", im, (0, 2, 0, 0))
def flat(face):
    im = new(16, 16); r(im, 0, 0, 15, 15, INK); r(im, 1, 1, 14, 14, face); return im
put("button_flat_normal", flat(SAGE_M), 3); put("button_flat_hover", flat(c("6a9a7a")), 3)
put("button_flat_pressed", flat(SAGE), 3)

# ---------- context menu (right click), list highlight ----------
im = new(12, 12)
r(im, 0, 0, 11, 11, INK); r(im, 1, 1, 10, 10, c("3e3546")); r(im, 1, 1, 10, 1, GREY_D)
put("menu", im, 3)
im = new(8, 8); r(im, 0, 0, 7, 7, SAGE_M); put("menu_highlight", im, 1)

im = new(12, 12)
r(im, 0, 0, 11, 11, INK); r(im, 1, 1, 10, 10, c("3e3546")); r(im, 1, 1, 10, 1, c("625565"))
round_corners(im); put("tooltip", im, 3)

im = new(8, 8)
r(im, 0, 0, 7, 7, c("2e222f", 210)); round_corners(im); put("nametag", im, 2)

im = new(16, 12)
r(im, 0, 0, 15, 11, INK); r(im, 1, 1, 14, 10, WHITE); r(im, 1, 10, 14, 10, c("c7dcd0"))
round_corners(im); put("bubble", im, 4)
put("bubble_tail", from_ascii(["xwwwwwx", ".xwwwx.", "..xwx..", "...x..."], {"x": INK, "w": WHITE}))

# ---------- tabs ----------
def tab(active):
    im = new(24, 16)
    r(im, 0, 0, 23, 15, INK)
    if active: linen(im, 1, 1, 22, 15); r(im, 1, 1, 22, 1, SAGE_L)
    else: r(im, 1, 1, 22, 15, W); r(im, 1, 1, 22, 1, WL); r(im, 1, 15, 22, 15, INK)                     # inactive tab is closed at the bottom
    im.putpixel((0, 0), CLR); im.putpixel((23, 0), CLR)
    return im
put("tab_active", tab(True), (4, 4, 4, 1)); put("tab_inactive", tab(False), (4, 4, 4, 1))

# ---------- input field ----------
def field(focus):
    im = new(32, 16)
    r(im, 0, 0, 31, 15, NAIL if focus else WD); r(im, 1, 1, 30, 14, WHITE)
    r(im, 1, 1, 30, 1, SAGE_L); r(im, 1, 1, 1, 14, SAGE_L)   # sunken
    return im
put("input_normal", field(False), 3); put("input_focus", field(True), 3)

# ---------- bars ----------
def bar(fill):
    im = new(16, 8)
    r(im, 0, 0, 15, 7, INK)
    if fill: d, m, l = fill; r(im, 1, 1, 14, 6, m); r(im, 1, 1, 14, 1, l); r(im, 1, 6, 14, 6, d)
    else: r(im, 1, 1, 14, 6, WD); r(im, 1, 1, 14, 1, c("2e222f"))
    round_corners(im); return im
put("bar_back", bar(None), 2)
put("bar_fill_green", bar((c("239063"), c("1ebc73"), c("91db69"))), 2)
put("bar_fill_yellow", bar((c("f79617"), NAIL, c("fbff86"))), 2)
put("bar_fill_red", bar((c("ae2334"), c("e83b3b"), c("f68181"))), 2)

# ---------- scroll bar, checkbox, divider ----------
im = new(8, 16); r(im, 0, 0, 7, 15, WD); r(im, 1, 1, 6, 14, c("45293f")); r(im, 1, 1, 6, 1, INK)
round_corners(im); put("scroll_track", im, 3)
im = new(8, 16); r(im, 0, 0, 7, 15, INK); r(im, 1, 1, 6, 14, WL); r(im, 1, 1, 1, 14, WH); r(im, 6, 1, 6, 14, W)
r(im, 2, 6, 5, 6, W); r(im, 2, 9, 5, 9, W); round_corners(im); put("scroll_thumb", im, 3)

def checkbox(on):
    im = new(12, 12)
    r(im, 0, 0, 11, 11, INK); r(im, 1, 1, 10, 10, WHITE); r(im, 1, 1, 10, 1, SAGE_L); r(im, 1, 1, 1, 10, SAGE_L)
    if on:
        im.alpha_composite(from_ascii(["......g", ".....gg", "g...gg.", "gg.gg..", ".ggg...", "..g...."],
                                      {"g": c("239063")}), (3, 3))
    round_corners(im); return im
put("checkbox_off", checkbox(False)); put("checkbox_on", checkbox(True))

im = new(16, 4); r(im, 0, 1, 15, 1, SAGE); r(im, 0, 2, 15, 2, SAGE_L); im.putpixel((0, 1), CLR); im.putpixel((15, 1), CLR)
put("divider", im, (2, 0, 2, 0))

# ---------- item slots (40x40 holds a 32 px icon) ----------
TIERS = {"common": "9babb2", "rare": "4d9be6", "epic": "a884f3", "legendary": "f79617", "mythic": "e83b3b"}
def slot(outline=WM, fill=SAGE_L, inner=SAGE):
    im = new(40, 40)
    r(im, 0, 0, 39, 39, outline); r(im, 1, 1, 38, 38, fill)
    r(im, 1, 1, 38, 2, inner); r(im, 1, 1, 2, 38, inner)      # sunken top-left
    round_corners(im); return im
put("slot_empty", slot(), 4)
put("slot_selected", slot(outline=NAIL, inner=NAIL), 4)
lock = from_ascii(["..xxxx..", ".x....x.", ".x....x.", "xxxxxxxx", "xggggggx", "xgg..ggx", "xggg.ggx", "xggggggx", "xxxxxxxx"],
                  {"x": INK, "g": GREY_L})
im = slot(outline=GREY_D, fill=GREY, inner=GREY_D); im.alpha_composite(lock, (16, 15)); put("slot_locked", im)
for t, h in TIERS.items():
    im = slot(outline=c(h)); r(im, 1, 37, 38, 38, c(h)); r(im, 1, 1, 38, 1, c(h))  # tier color top + bottom band
    round_corners(im); put(f"slot_tier_{t}", im, 4)

# ---------- cursors (hot spot top-left) ----------
CUR = {"x": INK, "w": WHITE, "s": GREY_L, "b": c("cd683d"), "r": c("e83b3b"), "l": c("8fd3ff")}
put("cursor_arrow", from_ascii([
    "x...........", "xx..........", "xwx.........", "xwwx........", "xwwwx.......", "xwwwwx......",
    "xwwwwwx.....", "xwwwwwwx....", "xwwwwwwwx...", "xwwwwxxxxx..", "xwwxwx......", "xwx.xwx.....",
    "xx..xwx.....", "x....xwx....", ".....xwx....", "......x....."], CUR))
put("cursor_hand", from_ascii([
    "....xx......", "...xwwx.....", "...xwwx.....", "...xwwxxx...", "...xwwxwwxx.", ".xxxwwxwwxwx",
    "xwwxwwwwwxwx", "xwwwwwwwwwwx", ".xwwwwwwwwwx", ".xwwwwwwwwwx", "..xwwwwwwwx.", "..xwwwwwwwx.",
    "...xwwwwwx..", "...xxxxxxx.."], CUR))
put("cursor_rod", from_ascii([
    "x...........", "xx..........", "xbx.........", ".xbx........", "..xbx.......", "...xbx......",
    "....xbx.....", ".....xbx....", "......xbxl..", ".......xx.l.", "..........l.", ".........xrx",
    ".........xwx", "..........x."], CUR))

# ---------- language flags 16x11 ----------
put("flag_tr", from_ascii([
    "xxxxxxxxxxxxxxxx", "xrrrrrrrrrrrrrrx", "xrrrwwwrrrrrrrrx", "xrrwwrrrrrwrrrrx", "xrrwrrrrrwwwrrrx",
    "xrrwrrrrrrwrrrrx", "xrrwwrrrrrrrrrrx", "xrrrwwwrrrrrrrrx", "xrrrrrrrrrrrrrrx", "xrrrrrrrrrrrrrrx",
    "xxxxxxxxxxxxxxxx"], {"x": INK, "r": c("e83b3b"), "w": WHITE}))
put("flag_en", from_ascii([
    "xxxxxxxxxxxxxxxx", "xwbbbbbwrwbbbbwx", "xbwbbbbwrwbbbwbx", "xbbwbbbwrwbbwbbx", "xwwwwwwwrwwwwwwx",
    "xrrrrrrrrrrrrrrx", "xwwwwwwwrwwwwwwx", "xbbwbbbwrwbbwbbx", "xbwbbbbwrwbbbwbx", "xwbbbbbwrwbbbbwx",
    "xxxxxxxxxxxxxxxx"], {"x": INK, "r": c("e83b3b"), "w": WHITE, "b": c("4d65b4")}))

# ---------- write ----------
os.makedirs(OUT, exist_ok=True)
for name, im in pieces.items():
    im.save(os.path.join(OUT, name + ".png"))
with open(os.path.join(OUT, "ui-borders.json"), "w") as f:
    json.dump({"items": [{"name": k, "l": v[0], "t": v[1], "r": v[2], "b": v[3]} for k, v in sorted(borders.items())]}, f, indent=1)
    f.write("\n")

# ---------- preview: Unity "Tiled" draw over the sample screen ----------
def tiled(name, w, h):
    im = pieces[name]; L, T, R, B = borders.get(name, [0, 0, 0, 0]); W_, H_ = im.size; out = new(w, h)
    def tile(src, x0, y0, dw, dh):
        if dw <= 0 or dh <= 0: return
        sw, sh = src.size
        for y in range(y0, y0 + dh, sh):
            for x in range(x0, x0 + dw, sw):
                out.paste(src.crop((0, 0, min(sw, x0 + dw - x), min(sh, y0 + dh - y))), (x, y))
    for sx0, sx1, dx, dw in [(0, L, 0, L), (L, W_ - R, L, w - L - R), (W_ - R, W_, w - R, R)]:
        for sy0, sy1, dy, dh in [(0, T, 0, T), (T, H_ - B, T, h - T - B), (H_ - B, H_, h - B, B)]:
            tile(im.crop((sx0, sy0, sx1, sy1)), dx, dy, dw, dh)
    return out

pv = Image.open(SAMPLE).convert("RGBA").resize((384, 224), Image.NEAREST)
def at(img, x, y): pv.alpha_composite(img, (x, y))
# HUD box C
at(tiled("box_dark", 110, 34), 6, 6)
at(tiled("bar_back", 70, 8), 12, 12); at(tiled("bar_fill_yellow", 50, 8), 12, 12)
at(tiled("bar_back", 70, 8), 12, 24); at(tiled("bar_fill_green", 30, 8), 12, 24)
at(pieces["flag_tr"], 88, 11)
# window A with tabs, slots, buttons
at(tiled("window", 250, 150), 128, 46)
at(tiled("tab_inactive", 40, 14), 140, 34); at(tiled("tab_active", 40, 16), 182, 33)
x0, y0 = 140, 58
for i, n in enumerate(["slot_tier_common", "slot_tier_rare", "slot_tier_epic", "slot_tier_legendary", "slot_tier_mythic"]):
    at(pieces[n], x0 + i * 42, y0)
for i, n in enumerate(["slot_empty", "slot_selected", "slot_locked"]):
    at(pieces[n], x0 + i * 42, y0 + 42)
at(tiled("divider", 196, 4), x0, y0 + 86)
at(tiled("input_focus", 80, 16), x0, y0 + 94)
at(tiled("button_green_normal", 56, 16), x0 + 86, y0 + 94)
at(tiled("button_red_normal", 52, 16), x0 + 146, y0 + 94)
at(pieces["checkbox_on"], x0 + 130, y0 + 46); at(pieces["checkbox_off"], x0 + 146, y0 + 46)
at(tiled("scroll_track", 8, 84), 358, 58); at(tiled("scroll_thumb", 8, 24), 358, 66)
at(pieces["button_close_normal"], 362, 40)
# button states column
for i, st in enumerate(["normal", "hover", "pressed", "disabled"]):
    at(tiled(f"button_wood_{st}", 40, 16), 6, 50 + i * 20)
    at(pieces[f"button_square_wood_{st}"], 50, 50 + i * 20)
# chat bubble, name tag, tooltip, card, cursors
at(tiled("bubble", 70, 14), 70, 140); at(pieces["bubble_tail"], 90, 153)
at(tiled("nametag", 30, 9), 6, 140)
at(tiled("tooltip", 60, 20), 6, 160); at(tiled("card", 60, 36), 70, 176)
at(tiled("hud_bar", 120, 20), 264, 204)
for i, st in enumerate(["normal", "hover", "pressed"]): at(pieces[f"button_flat_{st}"], 300 + i * 20, 206)
for i, n in enumerate(["cursor_arrow", "cursor_hand", "cursor_rod"]): at(pieces[n], 8 + i * 16, 190)
at(pieces["flag_en"], 56, 192)
pv.resize((pv.width * 3, pv.height * 3), Image.NEAREST).save(PREVIEW)
print(f"{len(pieces)} pieces -> {os.path.relpath(OUT, ROOT)}, preview -> {os.path.relpath(PREVIEW, ROOT)}")
