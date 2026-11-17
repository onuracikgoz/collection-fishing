"""Adds the craft table's materials, family ladders and recipes to content/wardrobe/catalog.json.

    python3 tools/wardrobe/craft_recipes.py        # updates catalog.json in place (no LPC checkout needed)

build_catalog.py calls add_craft() too. The recipes are the seed: once the admin panel saves the
wardrobe, the stored content wins (docs/tasarim/20-gardirop.md 6). Needs openpyxl.
"""
import json
import os
import re

import openpyxl

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
XLSX = os.path.join(ROOT, 'content', 'wardrobe', 'craft-tablosu.xlsx')
CATALOG = os.path.join(ROOT, 'content', 'wardrobe', 'catalog.json')

TIERS = {'Common': 'common', 'Rare': 'rare', 'Epic': 'epic', 'Legendary': 'legendary', 'Mythic': 'mythic'}
KINDS = {'Temel': 'base', 'Aile merdiveni': 'ladder', 'Detay': 'detail', 'Eşyaya özel': 'special', 'Efekt rengi katalizörü': 'catalyst'}
SOURCES = {
    'Olta': 'fishing', 'Olta (gece)': 'fishing_night', 'Olta (sabah)': 'fishing_morning', 'Olta (akşam)': 'fishing_evening',
    'Olta (kış)': 'fishing_winter', 'Olta (derin)': 'fishing_deep', 'Maden': 'mining', 'Maden (mağara)': 'mining_cave',
}
EFFECTS = {
    'Gökkuşağı': 'fx_rainbow', 'Alev': 'fx_flame', 'Buz': 'fx_ice', 'Galaksi': 'fx_galaxy', 'Derin deniz': 'fx_deep_sea',
    'Orman': 'fx_forest', 'Fırtına': 'fx_storm', 'Gölge': 'fx_shadow', 'Kristal': 'fx_crystal', 'Kutup ışığı': 'fx_aurora',
    'Gün batımı': 'fx_sunset', 'Altın ışıltı': 'fx_gold',
}
FAMILY_NAMES = {
    'UST': 'Tops', 'CEKET': 'Jackets', 'ELBISE': 'Dresses', 'ALT': 'Bottoms', 'AYAK': 'Shoes', 'PELERIN': 'Capes', 'SAPKA': 'Hats',
    'BASORTU': 'Headwear', 'MIGFER': 'Helmets', 'ZIRH': 'Armour', 'KEMER': 'Belts', 'CANTA': 'Bags', 'TAKI': 'Jewellery',
    'GOZ': 'Eyewear', 'BOYUN': 'Neckwear', 'KANAT': 'Wings', 'SAC': 'Hair',
}
# Item and material names in the game are English (docs/araclar/admin-paneli.md Çeviriler).
NAMES = {
    'Yosun lifi': 'Seaweed Fibre', 'Balık derisi': 'Fish Leather', 'Ham demir': 'Raw Iron', 'Kuvars kırığı': 'Quartz Shard',
    'Yosun özü': 'Seaweed Essence', 'Kuş tüyü': 'Bird Feather', 'Midye düğme': 'Mussel Button', 'Ağ ipi': 'Net Twine',
    'Yumuşak yosun': 'Soft Moss', 'Yelken bezi': 'Sailcloth', 'Mantar taban': 'Cork Sole', 'Yırtık yelken': 'Torn Sail',
    'Kamış hasırı': 'Reed Straw', 'Bez şerit': 'Cloth Strip', 'Perçin': 'Rivet', 'Zincir halka': 'Chain Link', 'Halat': 'Rope',
    'Ağ çantası': 'Net Pouch', 'İnce zincir': 'Fine Chain', 'Deniz camı': 'Sea Glass', 'Kurdele': 'Ribbon', 'Tarak dişi': 'Comb Tooth',
    'Deniz ipeği': 'Sea Silk', 'Fosil düğme': 'Fossil Button', 'Denizanası tülü': 'Jellyfish Tulle', 'Denizci perçini': 'Sailor Rivet',
    'Köpekbalığı derisi': 'Shark Leather', 'Gece kadifesi': 'Night Velvet', 'Martı tüyü': 'Gull Feather', 'Rün taşı': 'Rune Stone',
    'Fosil boynuz': 'Fossil Horn', 'Sertleşmiş deri': 'Hardened Leather', 'Pirinç toka': 'Brass Buckle', 'Fıçı çemberi': 'Barrel Hoop',
    'İnci': 'Pearl', 'Mercek': 'Lens', 'Dantel': 'Lace', 'Yusufçuk zarı': 'Dragonfly Membrane', 'Deniz tuzu': 'Sea Salt',
    'Sedef düğme': 'Nacre Button', 'Kehribar toka': 'Amber Clasp', 'Mercan dantel': 'Coral Lace', 'Örgü tül': 'Woven Tulle',
    'Obsidyen toka': 'Obsidian Buckle', 'Kuzgun tüyü': 'Raven Feather', 'Kadife kurdele': 'Velvet Ribbon', 'Sis tülü': 'Mist Tulle',
    'Savaşçı arması': 'Warrior Crest', 'Ay çeliği': 'Moon Steel', 'Su yılanı derisi': 'Water Snake Skin', 'Dişli çark': 'Cogwheel',
    'Kristal yuva': 'Crystal Setting', 'Gece camı (obsidyen)': 'Night Glass', 'Mercan iğne': 'Coral Pin', 'Pegasus tüyü': 'Pegasus Feather',
    'İnci toka': 'Pearl Clip', 'Ay ipeği': 'Moon Silk', 'Kraliyet sırması': 'Royal Gold Thread', 'Kutup ışığı tülü': 'Aurora Tulle',
    'Yıldız kırığı': 'Star Fragment', 'Yıldız işlemesi': 'Star Embroidery', 'Titan boynuzu': 'Titan Horn', 'Ejder pulu': 'Dragon Scale',
    'Buhar çekirdeği': 'Steam Core', 'Kraliyet mührü': 'Royal Seal', 'Ay tüyü': 'Moon Feather', 'Kemik düğme': 'Bone Button',
    'Fermuar': 'Zipper', 'Metal toka': 'Metal Buckle', 'Fiyonk': 'Bow Knot', 'Deri yama': 'Leather Patch', 'İnce kordon': 'Thin Cord',
    'Kuşak bağı': 'Sash Tie', 'Cep astarı': 'Pocket Lining', 'Yaka kumaşı': 'Collar Cloth', 'Bağcık': 'Lace Cord', 'Deniz yünü': 'Sea Wool',
    'Kenar şeridi': 'Edge Trim', 'Kauçuk taban': 'Rubber Sole', 'Cam boncuk': 'Glass Bead', 'Tel çerçeve': 'Wire Frame',
    'Dolgu astar': 'Padded Lining', 'Sepet sazı': 'Basket Reed', 'Saç lastiği': 'Hair Tie', 'Saç tokası': 'Hair Clip',
    'Sakal yağı': 'Beard Oil', 'Ustura köpüğü': 'Shaving Foam', 'Tül peçe': 'Tulle Veil', 'Kalın keçe': 'Thick Felt',
    'Esnek iplik': 'Stretch Thread', 'Küpe kancası': 'Earring Hook', 'Deri kayış': 'Leather Strap', 'Peluş yaka': 'Plush Collar',
    'Pul payet': 'Sequins', 'Renkli tüy': 'Coloured Feather', 'Çizgili kumaş': 'Striped Cloth', 'Nakış ipliği': 'Embroidery Thread',
    'Kafes örgü': 'Lattice Weave', 'Metal burun': 'Metal Toecap', 'Füme cam': 'Smoked Glass', 'Parlatma kumu': 'Polishing Sand',
    'Vizör menteşesi': 'Visor Hinge', 'Ok tüyü': 'Arrow Fletching', 'Bigudi': 'Hair Curler', 'Sert jöle': 'Strong Gel',
    'Örgü kurdelesi': 'Braid Ribbon', 'Bıyık mumu': 'Moustache Wax', 'Kolalı kumaş': 'Starched Cloth', 'Yaldız': 'Gilding',
    'Çiy damlası': 'Dewdrop', 'Parlak serum': 'Shine Serum', 'Işıltılı sim': 'Glitter', 'Kelebek pulu': 'Butterfly Scale',
    'Kafatası arması': 'Skull Emblem', 'Koç boynuzu': 'Ram Horn', 'Kar tanesi': 'Snowflake', 'Yarasa zarı': 'Bat Membrane',
    'Kertenkele pulu': 'Lizard Scale', 'Tavus tüyü': 'Peacock Feather', 'Kartal tüyü': 'Eagle Feather', 'Rüzgar gülü': 'Wind Vane',
    'Ay taşı': 'Moonstone', 'Magma taşı': 'Magma Stone', 'Buzul kristali': 'Glacier Crystal', 'Göktaşı parçası': 'Meteorite Shard',
    'Derin su incisi': 'Deep Water Pearl', 'Kadim yaprak': 'Ancient Leaf', 'Şimşek camı': 'Lightning Glass',
    'Mürekkep balığı mürekkebi': 'Squid Ink', 'Prizma kristali': 'Prism Crystal', 'Işık damlası': 'Light Drop',
    'Gün batımı mercanı': 'Sunset Coral',
}


def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')


def rows(wb, sheet):
    return [r for r in list(wb[sheet].iter_rows(values_only=True))[1:] if any(r)]


def parse_recipe(text, mat_ids):
    """'X kalıbı (Rare) ×1 + Yosun lifi ×4 + ... + Boya ×1' -> [{mat, count}]. The pattern and the colours are implied."""
    mats = []
    for t in text.split(' + '):
        m = re.match(r'(.*?) ×(\d+)', t.strip())
        if not m:
            raise ValueError(f'bad recipe part: {t!r}')
        name, n = m.group(1), int(m.group(2))
        if 'kalıbı' in name:
            continue
        if name not in mat_ids:
            continue
        # A family without a Legendary material lists its Epic one twice ("aile L malzemesi yok"): one stack.
        same = [m for m in mats if m['mat'] == mat_ids[name]]
        if same:
            same[0]['count'] += n
        else:
            mats.append({'mat': mat_ids[name], 'count': n})
    return mats


def add_craft(doc):
    wb = openpyxl.load_workbook(XLSX, read_only=True)
    materials, mat_ids = [], {}
    for name, tier, source, kind, _used, note in [r[:6] for r in rows(wb, 'Malzemeler')]:
        mid = 'wmat_' + slug(NAMES[name])
        mat_ids[name] = mid
        m = {'id': mid, 'name': NAMES[name], 'tier': TIERS[tier], 'kind': KINDS[kind], 'source': SOURCES[source], 'active': True}
        m['note'] = name + (' · ' + note if note else '')
        materials.append(m)

    family_code = {}
    families = []
    for r in rows(wb, 'Aileler'):
        code, full, base = r[0], r[1], r[2]
        family_code[full] = code
        ladder = {}
        for tier, cell in zip(('common', 'rare', 'epic', 'legendary'), r[3:7]):
            name = re.split(r' \((?=Olta|Maden)', cell)[0] if cell and cell != '-' else None
            ladder[tier] = mat_ids[name] if name else None
        families.append({'id': code, 'name': FAMILY_NAMES[code], 'base': mat_ids[base], 'ladder': ladder})

    parts = {p['id']: p for p in doc['parts']}
    by_name = {}
    for r in rows(wb, 'Eşyalar'):
        full, name, _tier, _size, _detail, _kind, _second, _n, recipe, _merged, path = r[:11]
        pid = os.path.basename(path)[:-5]
        p = parts.get(pid)
        if p is None:
            continue
        by_name[(family_code[full], name)] = p
        p.pop('recipe', None)
        p.pop('mythic', None)
        if not p['free'] and recipe and 'craft yok' not in recipe:
            p['recipe'] = {'mats': parse_recipe(recipe, mat_ids)}

    for r in rows(wb, 'Mitik'):
        effect, fam_name, full_name, _tier, recipe = r[:5]
        fam = next(code for full, code in family_code.items() if full.startswith(fam_name))
        p = by_name.get((fam, full_name[len(effect) + 1:]))
        if p is None:
            continue
        p.setdefault('mythic', {})[EFFECTS[effect]] = {'mats': parse_recipe(recipe, mat_ids)}

    doc['materials'] = materials
    doc['families'] = families
    return doc


def main():
    doc = json.load(open(CATALOG))
    add_craft(doc)
    with open(CATALOG, 'w') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write('\n')
    n = sum(1 for p in doc['parts'] if 'recipe' in p)
    print(f"{len(doc['materials'])} materials, {len(doc['families'])} families, {n} recipes -> {os.path.relpath(CATALOG, ROOT)}")


if __name__ == '__main__':
    main()
