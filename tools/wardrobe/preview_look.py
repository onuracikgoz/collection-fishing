"""Draws looks the way the game does (client/Assets/Scripts/Wardrobe/LpcLook.cs), without Unity.

    python3 tools/wardrobe/preview_look.py out.png                 # the NPCs in Resources/Npcs.json
    python3 tools/wardrobe/preview_look.py out.png looks.json      # [{ "body", "skin", "eyes", "parts": [...] }]

Each look is drawn facing up, left, down and right (walk, standing frame), 3x. Uses the manifest
and sheets written by tools/wardrobe/import_lpc.py, so it checks those too.
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
ART = os.path.join(ROOT, 'client', 'Assets', 'Art', 'LPC')
MANIFEST = os.path.join(ROOT, 'client', 'Assets', 'Resources', 'Wardrobe', 'lpc.json')
FRAME = 64

M = json.load(open(MANIFEST))
PARTS = {p['id']: p for p in M['parts']}
RAMPS = {r['id']: r['tones'] for r in M['ramps']}
_sheets = {}


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def sheet(path, maps, colors):
    key = (path, tuple(colors))
    if key in _sheets:
        return _sheets[key]
    im = Image.open(os.path.join(ART, path)).convert('RGBA')
    lut = {}
    for m, c in zip(maps, colors):
        ramp = RAMPS.get(c)
        if not ramp:
            continue
        for src, tone in zip(m['src'], m['tone']):
            lut[rgb(src)] = rgb(ramp[min(max(tone, 0), len(ramp) - 1)])
    if lut:
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if a and (r, g, b) in lut:
                    px[x, y] = lut[(r, g, b)] + (a,)
    _sheets[key] = im
    return im


def layers(look):
    body = 'female' if look.get('body') == 'female' else 'male'
    out = []

    def add(pid, *colors):
        part = PARTS.get(pid)
        if not part:
            print('unknown part', pid)
            return
        for L in part['layers']:
            s = L[body]
            if s['walk']:
                out.append((L['z'], len(out), s, part['maps'], list(colors)))

    add('body', look['skin'])
    add('head_' + body, look['skin'], look['eyes'])
    add('face', look['skin'], look['eyes'])
    for p in look.get('parts', []):
        add(p['part'], p.get('color', ''), p.get('color2', ''))
    out.sort(key=lambda t: (t[0], t[1]))
    return out


def frame(look, row, anim='walk', col=0):
    img = Image.new('RGBA', (FRAME, FRAME))
    for _z, _o, s, maps, colors in layers(look):
        path = s.get(anim) or s['walk']
        c = col if s.get(anim) else 0
        im = sheet(path, maps, colors)
        if (c + 1) * FRAME > im.width:
            c = 0
        img.alpha_composite(im.crop((c * FRAME, row * FRAME, c * FRAME + FRAME, row * FRAME + FRAME)))
    return img


def main(out, looks_file=None):
    if looks_file:
        looks = json.load(open(looks_file))
    else:
        looks = [n['look'] for n in json.load(open(os.path.join(ROOT, 'client', 'Assets', 'Resources', 'Npcs.json')))['npcs']]
    S = 3
    img = Image.new('RGBA', (len(looks) * FRAME * S, 4 * FRAME * S), (92, 140, 96, 255))
    for i, look in enumerate(looks):
        for row in range(4):
            img.alpha_composite(frame(look, row).resize((FRAME * S, FRAME * S), Image.NEAREST), (i * FRAME * S, row * FRAME * S))
    img.save(out)


if __name__ == '__main__':
    main(*sys.argv[1:])
