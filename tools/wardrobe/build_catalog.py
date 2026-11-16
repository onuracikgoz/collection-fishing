"""Builds content/wardrobe/catalog.json from the craft table and the Universal LPC sheet definitions.

    python3 tools/wardrobe/build_catalog.py <Universal-LPC-Spritesheet-Character-Generator checkout>

The catalog is the server's starting wardrobe (parts and colours, docs/tasarim/20-gardirop.md); once
the admin panel saves, the stored content wins. Needs openpyxl.
"""
import json
import os
import re
import sys

import openpyxl

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
XLSX = os.path.join(ROOT, 'content', 'wardrobe', 'craft-tablosu.xlsx')
OUT = os.path.join(ROOT, 'content', 'wardrobe', 'catalog.json')

TIERS = {'Common': 'common', 'Rare': 'rare', 'Epic': 'epic', 'Legendary': 'legendary', 'Mythic': 'mythic'}
KINDS = {
    'Boya (74)': (['dye'], None),
    'Saç boyası (26)': (['hair'], None),
    'Külçe (7)': (['metal'], None),
    'Mücevher (6)': (['gem'], None),
    'Sabit (tek renk)': ([], None),
    'Külçe (7) + Mücevher (6)': (['metal'], ['gem']),
    'Külçe (7) veya Boya (74)': (['metal', 'dye'], None),
}
EFFECTS = {
    'Gökkuşağı': 'fx_rainbow', 'Alev': 'fx_flame', 'Buz': 'fx_ice', 'Galaksi': 'fx_galaxy', 'Derin deniz': 'fx_deep_sea',
    'Orman': 'fx_forest', 'Fırtına': 'fx_storm', 'Gölge': 'fx_shadow', 'Kristal': 'fx_crystal', 'Kutup ışığı': 'fx_aurora',
    'Gün batımı': 'fx_sunset', 'Altın ışıltı': 'fx_gold',
}
EFFECT_NAMES = {
    'fx_rainbow': 'Rainbow', 'fx_flame': 'Flame', 'fx_ice': 'Ice', 'fx_galaxy': 'Galaxy', 'fx_deep_sea': 'Deep Sea',
    'fx_forest': 'Forest', 'fx_storm': 'Storm', 'fx_shadow': 'Shadow', 'fx_crystal': 'Crystal', 'fx_aurora': 'Aurora',
    'fx_sunset': 'Sunset', 'fx_gold': 'Golden Glow',
}
# Skin and eye tones are identity: always free (lpcr body palette, ulpc eye palette).
SKINS = ['ivory', 'porcelain', 'peach', 'tan', 'tawny', 'honey', 'bronze', 'brown', 'coffee']
EYES = ['blue', 'green', 'purple', 'red', 'orange', 'yellow', 'brown', 'gray']


def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')


def rows(wb, sheet):
    return [r for r in list(wb[sheet].iter_rows(values_only=True))[1:] if any(r)]


def main(ulpc):
    wb = openpyxl.load_workbook(XLSX, read_only=True)
    family = {r[1]: r[0] for r in rows(wb, 'Aileler')}

    colors = []
    for kind_tr, name, tier_tr, *_ in [(r[0], r[2], r[3]) for r in rows(wb, 'Renkler')]:
        tier = TIERS[tier_tr]
        if kind_tr == 'Boya':
            cid, kind = 'dye_' + slug(name), 'dye'
        elif kind_tr == 'Saç boyası':
            cid, kind = 'hair_' + slug(name), 'hair'
        elif kind_tr in ('Külçe', 'Mücevher'):
            kind = 'metal' if kind_tr == 'Külçe' else 'gem'
            cid = kind + '_' + slug(re.search(r'\((.*)\)', name).group(1))
        else:
            cid, kind = EFFECTS[name], 'fx'
        colors.append({'id': cid, 'kind': kind, 'tier': tier, 'free': kind in ('dye', 'hair') and tier == 'common'})
    colors += [{'id': 'skin_' + s, 'kind': 'skin', 'tier': None, 'free': True} for s in SKINS]
    colors += [{'id': 'eye_' + s, 'kind': 'eye', 'tier': None, 'free': True} for s in EYES]

    parts = []
    by_name = {}
    for r in rows(wb, 'Eşyalar'):
        fam_name, name, tier_tr, _size, _detail, kind_tr, second, _n, _recipe, _merged, path = r[:11]
        sheet = json.load(open(os.path.join(ulpc, 'sheet_definitions', path)))
        pid = os.path.basename(path)[:-5]
        layer = sheet.get('layer_1', {})
        bodies = [b for b in ('male', 'female') if b in layer]
        kinds, kinds2 = KINDS[kind_tr]
        if second == 'Evet' and kinds2 is None:
            kinds2 = kinds if kinds else ['dye']
        free = tier_tr.startswith('Başlangıç')
        part = {
            'id': pid,
            'name': name,
            'slot': sheet.get('type_name') or slug(name),
            'family': family[fam_name],
            'tier': None if free else TIERS[tier_tr],
            'colors': kinds,
            'effects': [],
            'bodies': bodies,
            'free': free,
            # A part drawn for neither adult body (child or muscular only) cannot be worn yet.
            'active': bool(bodies),
        }
        if not bodies:
            print(f'No male/female sprites, left inactive: {pid} ({name})')
        if kinds2:
            part['color2'] = kinds2
        parts.append(part)
        by_name[(family[fam_name], name)] = part

    missing = []
    for r in rows(wb, 'Mitik'):
        effect, fam_name = r[0], r[1]
        fam = next(code for full, code in family.items() if full.startswith(fam_name))
        base = r[2][len(effect) + 1:]
        part = by_name.get((fam, base))
        if part is None:
            missing.append(r[2])
            continue
        part['effects'].append(EFFECTS[effect])

    doc = {'source': 'content/wardrobe/craft-tablosu.xlsx + Universal LPC sheet_definitions', 'parts': parts, 'colors': colors,
           'effectNames': EFFECT_NAMES}
    with open(OUT, 'w') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'{len(parts)} parts, {len(colors)} colours -> {os.path.relpath(OUT, ROOT)}')
    if missing:
        print('Mythic rows without a base part:', ', '.join(missing))


if __name__ == '__main__':
    main(sys.argv[1])
