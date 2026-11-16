"""Copies the Universal LPC sprites the wardrobe needs into the Unity project and writes the
client's wardrobe manifest (docs/tasarim/20-gardirop.md, docs/araclar/gardirop-sprite.md).

    python3 tools/wardrobe/import_lpc.py <Universal-LPC-Spritesheet-Character-Generator checkout>

The checkout may be a partial clone (blob:none, sparse): the needed sheets are checked out in
one batch. Every part keeps ONE source sheet per layer, body and animation; the game recolours
it with palette ramps (6 tones, shadow to highlight), the same way the generator does.

Output:
  client/Assets/Art/LPC/Universal/<lpc path><anim>.png         source sheets
  client/Assets/Resources/Wardrobe/lpc.json                     parts, layers, ramps
Needs Pillow and openpyxl.
"""
import json
import os
import csv
import shutil
import subprocess
import sys

from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
CATALOG = os.path.join(ROOT, 'content', 'wardrobe', 'catalog.json')
XLSX = os.path.join(ROOT, 'content', 'wardrobe', 'craft-tablosu.xlsx')
ART = os.path.join(ROOT, 'client', 'Assets', 'Art', 'LPC', 'Universal')
MANIFEST = os.path.join(ROOT, 'client', 'Assets', 'Resources', 'Wardrobe', 'lpc.json')

# Animations the game plays (CharacterView): walk 9 frames (0 = standing), idle, sit.
ANIMS = ['walk', 'idle', 'sit']
BODIES = ['male', 'female']
# Palette that holds each colour kind's ramps, and the material the sprites are drawn in.
KIND_MATERIAL = {'dye': 'cloth', 'hair': 'hair', 'metal': 'metal', 'gem': 'cloth', 'skin': 'body', 'eye': 'eye', 'fx': 'cloth'}
# A variant-only part (no `recolors`) is recoloured from this variant file, by material.
SOURCE_VARIANT = {'cloth': 'white', 'hair': 'orange', 'metal': 'steel'}
# Mythic effects are not drawn yet: until they are, each wears a plain ramp (Öneri).
FX_STANDIN = {
    'fx_rainbow': 'cerise', 'fx_flame': 'red_orange', 'fx_ice': 'ice', 'fx_galaxy': 'indigo', 'fx_deep_sea': 'aegean',
    'fx_forest': 'emerald', 'fx_storm': 'cornflower', 'fx_shadow': 'soot', 'fx_crystal': 'powder', 'fx_aurora': 'mint',
    'fx_sunset': 'apricot', 'fx_gold': 'amber',
}
GEM_STANDIN = {'yellow': 'lemon', 'orange': 'orange', 'purple': 'amethyst', 'green': 'emerald', 'blue': 'royal', 'red': 'garnet'}


def load(path):
    with open(path) as f:
        return json.load(f)


def main(ulpc):
    cat = load(CATALOG)
    pal = {}
    for m in ['cloth', 'hair', 'metal', 'body', 'eye']:
        pal[m] = {
            'meta': load(os.path.join(ulpc, 'palette_definitions', m, f'meta_{m}.json')),
            'ulpc': load(os.path.join(ulpc, 'palette_definitions', m, f'{m}_ulpc.json')),
        }
    all_lpcr = load(os.path.join(ulpc, 'palette_definitions', 'all', 'all_lpcr.json'))
    body_lpcr = load(os.path.join(ulpc, 'palette_definitions', 'body', 'body_lpcr.json'))

    def base_ramp(material, base=None):
        return pal[material]['ulpc'][base or pal[material]['meta']['base']]

    # --- colour ramps for every catalog colour ---
    ramps = {}
    for c in cat['colors']:
        kind, name = c['kind'], c['id'].split('_', 1)[1]
        if kind == 'dye':
            r = all_lpcr[name]
        elif kind == 'hair':
            r = pal['hair']['ulpc'][name]
        elif kind == 'metal':
            r = pal['metal']['ulpc'][name]
        elif kind == 'gem':
            r = all_lpcr[GEM_STANDIN[name]]
        elif kind == 'skin':
            r = body_lpcr[name]
        elif kind == 'eye':
            r = pal['eye']['ulpc'][name]
        else:
            r = all_lpcr[FX_STANDIN[c['id']]]
        ramps[c['id']] = [h.lower() for h in r]

    # --- which sheet definition each part comes from ---
    import openpyxl  # only for the path column
    wb = openpyxl.load_workbook(XLSX, read_only=True)
    rows = [r for r in list(wb['Eşyalar'].iter_rows(values_only=True))[1:] if any(r)]
    def_path = {os.path.basename(r[10])[:-5]: r[10] for r in rows}

    sheets = {}  # id -> (definition, catalog part or None)
    for p in cat['parts']:
        sheets[p['id']] = (load(os.path.join(ulpc, 'sheet_definitions', def_path[p['id']])), p)
    # Identity layers: body, head (with eyes), neutral face.
    sheets['body'] = (load(os.path.join(ulpc, 'sheet_definitions', 'body', 'body.json')), None)
    for b in BODIES:
        sheets['head_' + b] = (load(os.path.join(ulpc, 'sheet_definitions', 'head', 'heads', 'human', f'heads_human_{b}.json')), None)
    face = load(os.path.join(ulpc, 'sheet_definitions', 'head', 'faces', 'face_neutral.json'))
    sheets['face'] = (face, None)

    listing = subprocess.run(['git', '-C', ulpc, 'ls-tree', '-r', '--name-only', 'HEAD', 'spritesheets'], capture_output=True, text=True, check=True).stdout
    have = set(listing.split('\n'))

    def first_path(d):
        layer = d.get('layer_1', {})
        for b in BODIES:
            if layer.get(b):
                return layer[b].replace('${head}', b)
        return None

    def pick_variant(d, part):
        """Variant-only part: the variant to recolour from, and its material.

        Prefer the material's base (cloth white, hair orange, metal steel), then any variant that is
        a ramp of the material's palette (e.g. a leather belt drawn in cloth "brown")."""
        kinds = (part or {}).get('colors') or []
        material = KIND_MATERIAL[kinds[0]] if kinds else None
        path = first_path(d)
        variants = d.get('variants', [])
        exists = lambda v: f'spritesheets/{path}walk/{v}.png' in have
        if material in SOURCE_VARIANT:
            order = [SOURCE_VARIANT[material]] + [v for v in variants if v in pal[material]['ulpc']]
            for v in order:
                if v in variants and exists(v):
                    return v, material
        # Fixed colour: the first variant that exists, not recoloured.
        for v in variants:
            if exists(v):
                return v, None
        return None, None

    def areas_of(d, part):
        """Recolour areas: [{material, base ramp}] in colour order (color, color2)."""
        r = d.get('recolors')
        if r is None:
            v, material = pick_variant(d, part)
            return [{'material': material, 'base': base_ramp(material, v)}] if material else []
        if 'material' in r:
            return [{'material': r['material'], 'base': base_ramp(r['material'], r.get('base'))}]
        out = []
        for k in sorted(x for x in r if x.startswith('color_')):
            out.append({'material': r[k]['material'], 'base': base_ramp(r[k]['material'], r[k].get('base'))})
        return out

    def source_file(d, part, lpc_path, anim):
        if d.get('recolors') is None:
            v, _ = pick_variant(d, part)
            if v:
                f = f'spritesheets/{lpc_path}{anim}/{v}.png'
                return f if f in have else None
        single = f'spritesheets/{lpc_path}{anim}.png'
        return single if single in have else None

    parts_out = {}
    files = set()
    missing = []
    for sid, (d, part) in sheets.items():
        areas = areas_of(d, part)
        layers = []
        for lk in sorted((k for k in d if k.startswith('layer_')), key=lambda k: int(k.split('_')[1])):
            layer = d[lk]
            entry = {'z': layer['zPos'], 'sheets': {}}
            for b in BODIES:
                path = layer.get(b)
                if not path:
                    continue
                if '${head}' in path:
                    path = path.replace('${head}', b)
                per_anim = {}
                for anim in ANIMS:
                    f = source_file(d, part, path, anim)
                    if f:
                        per_anim[anim] = f[len('spritesheets/'):]
                        files.add(f)
                    else:
                        missing.append(f'{sid} {b} {anim}')
                if per_anim:
                    entry['sheets'][b] = per_anim
            if entry['sheets']:
                layers.append(entry)
        parts_out[sid] = {'areas': [a['material'] for a in areas], 'layers': layers}
        if part is None:
            parts_out[sid]['identity'] = True

    # Batch-fetch the sheets (partial clones download missing blobs here).
    todo = sorted(f for f in files if not os.path.exists(os.path.join(ulpc, f)))
    if todo:
        listfile = os.path.join(ulpc, '.wardrobe-paths')
        with open(listfile, 'w') as fh:
            fh.write('\n'.join(todo) + '\n')
        subprocess.run(['git', '-C', ulpc, 'sparse-checkout', 'add', '--skip-checks', '--no-cone'] + sorted({os.path.dirname(f) + '/' for f in todo}), check=False, capture_output=True)
        subprocess.run(['git', '-C', ulpc, 'checkout', 'HEAD', '--pathspec-from-file=.wardrobe-paths'], check=True)
        os.remove(listfile)

    # Recolour maps: source colour -> tone index (0 shadow .. 5 highlight) for each area.
    # Exact when the sheet is drawn in its base ramp. A single-area part drawn in some other
    # palette (robes, jewellery, a few wings) gets a map by brightness: its colours sorted dark
    # to light and split into the ramp's tones; the dark outline is left alone.
    def hexc(c):
        return '#%02x%02x%02x' % c[:3]

    def lum(c):
        return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

    report = []
    for sid, po in parts_out.items():
        d, part = sheets[sid]
        areas = areas_of(d, part)
        maps = [{h.lower(): i for i, h in enumerate(ar['base'])} for ar in areas]
        if areas:
            counts = {}
            for layer in po['layers']:
                for per_anim in layer['sheets'].values():
                    for f in per_anim.values():
                        im = Image.open(os.path.join(ulpc, 'spritesheets', f)).convert('RGBA')
                        for n, c in (im.getcolors(1 << 20) or []):
                            if c[3]:
                                counts[c[:3]] = counts.get(c[:3], 0) + n
            tot = sum(counts.values())
            hit = sum(n for c, n in counts.items() if any(hexc(c) in m for m in maps))
            po['coverage'] = round(hit / tot, 3) if tot else 0
            if tot and hit / tot < 0.5 and len(areas) == 1:
                tones = len(areas[0]['base'])
                cols = sorted((c for c in counts if lum(c) >= 24), key=lum)
                maps = [{hexc(c): min(tones - 1, i * tones // len(cols)) for i, c in enumerate(cols)}] if cols else maps
                report.append(f'{sid}: {hit * 100 // tot}% in its base ramp, recoloured by brightness ({len(cols)} colours)')
        po['maps'] = maps

    # Sheets no longer needed go (with their .meta); the rest are overwritten in place, so Unity's
    # .meta files (GUIDs, import settings) stay.
    wanted = {os.path.normpath(os.path.join(ART, f[len('spritesheets/'):])) for f in files}
    if os.path.isdir(ART):
        for d, _, names in os.walk(ART):
            for n in names:
                full = os.path.normpath(os.path.join(d, n))
                if n.endswith('.png') and full not in wanted:
                    os.remove(full)
                    if os.path.exists(full + '.meta'):
                        os.remove(full + '.meta')
    total = 0
    for f in sorted(files):
        dst = os.path.join(ART, f[len('spritesheets/'):])
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(os.path.join(ulpc, f), dst)
        total += os.path.getsize(dst)

    # Attribution (CC-BY-SA / OGA-BY / GPL): the ULPC credits rows of the sheets we ship.
    with open(os.path.join(ulpc, 'CREDITS.csv'), newline='', encoding='utf-8') as fh:
        rows = list(csv.reader(fh))
    shipped = {f[len('spritesheets/'):] for f in files}
    with open(os.path.join(ART, 'CREDITS.csv'), 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh)
        w.writerow(rows[0])
        w.writerows(r for r in rows[1:] if r and r[0].strip() in shipped)

    # Arrays and strings only, so Unity's JsonUtility reads it. Sheet paths are ArtCatalog paths
    # (relative to Assets/Art/LPC/); "" = no sheet for that animation (the game uses walk's frame 0).
    def sheet_set(per_anim):
        return {a: ('Universal/' + per_anim[a]) if a in per_anim else '' for a in ANIMS}

    manifest = {
        'source': 'Universal LPC, tools/wardrobe/import_lpc.py',
        'ramps': [{'id': k, 'tones': v} for k, v in ramps.items()],
        'parts': [
            {
                'id': sid,
                'layers': [{'z': L['z'], **{b: sheet_set(L['sheets'].get(b, {})) for b in BODIES}} for L in po['layers']],
                'maps': [{'src': list(m.keys()), 'tone': list(m.values())} for m in po['maps']],
            }
            for sid, po in parts_out.items()
        ],
    }
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    with open(MANIFEST, 'w') as fh:
        json.dump(manifest, fh, separators=(',', ':'))
    print(f'{len(parts_out)} parts, {len(files)} sheets, {total // 1024} KB')
    print(f'{len(missing)} part/body/animation combinations have no sheet')
    for line in report:
        print('NOTE', line)
    with open(os.path.join(ROOT, 'tools', 'wardrobe', 'import-missing.txt'), 'w') as fh:
        fh.write('\n'.join(missing) + '\n')


if __name__ == '__main__':
    main(sys.argv[1])
