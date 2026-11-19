"""
Builds mpfb/catalog.json from the MPFB asset library (plain python, no Blender needed):

    python3 mpfb/catalog.py

Each entry: {id, dir, rel, slot, category, name, author, license, genders}
`slot` is the equipment slot used by the character creator; assets without a slot (weapons, nails ...) are skipped.
"""
import glob, json, os, re
from collections import Counter
from asset_slots import is_sock_asset, is_armsleeve_asset, SLOT_OVERRIDES

DATA = os.path.expanduser('~/Library/Application Support/Blender/5.2/mpfb/data')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'catalog.json')

CATEGORY_SLOT = {
    'Uniform/Armor': 'outfit', 'Gown/Robe': 'outfit', 'Shirt/T-shirt/Sweater': 'top', 'Pants': 'pants', 'Skirt': 'skirt',
    'Shoes/Boots/Socks': 'shoes', 'Hat/Helmet': 'hat', 'Jewelry': 'jewelry', 'Accessory': 'accessory',
    'Facialhair': 'beard', 'Underwear': 'underwear_top', 'Gloves': 'gloves', 'Nails': 'nails', 'Eyebrows': 'eyebrows', 'Eyelashes': 'eyelashes',
}
SKIP = set()
# "Unsorted/other" pack items that are suits, armour and swimwear: slot by name (wings, tails and diving gear get their own slots)
UNSORTED_SLOT = [
    (r'wings', 'wings'),
    (r'_tail', 'tail'),
    (r'scuba_rig', 'accessory'),
    (r'bikini.*(bra|top)|bandeau_bikini_bra|frill_bikini_top', 'top'),
    (r'bikini.*(slip|bottom)|bandeau_bikini_slip|frill_bikini_bottom|swimming_trunks', 'pants'),
    (r'suit|armor|bikini|swimwear|swimsuit|wetsuit|dress|pantsuit', 'outfit'),
]
DIR_SLOT = {'hair': 'hair', 'eyebrows': 'eyebrows', 'eyelashes': 'eyelashes', 'teeth': 'teeth'}


def meta():
    out = {}
    for f in glob.glob(os.path.join(DATA, 'packs', '*.json')):
        try:
            out.update(json.load(open(f)))
        except Exception:
            pass
    return out


def pretty(name):
    n = re.sub(r'^(elvs|toigo|callharvey3d|culturalibre|cortu|mindfront|jujube|donitz|aethelraed|punkduck|joepal|mhstyle|vit|rwiz|wp|tinus|ruvenn|dwp)[_-]', '', name, flags=re.I)
    n = re.sub(r'[_-]+', ' ', n).strip()
    return n[:1].upper() + n[1:]


def genders_of(mhclo_path, name):
    tags = set()
    try:
        for line in open(mhclo_path, encoding='utf-8', errors='ignore'):
            if line.startswith('tag '):
                tags.add(line[4:].strip().lower())
            if line.startswith('verts'):
                break
    except Exception:
        pass
    n = name.lower()
    female = 'female' in tags or 'woman' in tags or n.startswith('female') or 'female' in n or 'heroine' in n or 'ladies' in n
    male = (('male' in tags) or n.startswith('male') or '_male' in n) and 'female' not in n and 'female' not in tags
    if female and not male:
        return ['female']
    if male and not female:
        return ['male']
    return ['female', 'male']


def main():
    m = meta()
    entries = []
    for d in ('hair', 'eyebrows', 'eyelashes', 'teeth', 'clothes'):
        for folder in sorted(glob.glob(os.path.join(DATA, d, '*'))):
            name = os.path.basename(folder)
            mh = glob.glob(os.path.join(folder, '*.mhclo'))
            if not mh:
                continue
            mhclo = sorted(mh)[0]
            if d == 'teeth' and name == 'teeth_base':
                continue  # the body already carries the base teeth
            info = m.get(name, {})
            cat = info.get('category', '')
            slot = DIR_SLOT.get(d)
            if d == 'clothes':
                slot = CATEGORY_SLOT.get(cat)
                if cat == 'Unsorted/other':
                    slot = next((sl for rx, sl in UNSORTED_SLOT if re.search(rx, name)), None)
                if cat == '':
                    if name.startswith(('female_', 'male_')):
                        slot = 'outfit'
                    elif name.startswith('shoes'):
                        slot = 'shoes'
                    elif name.startswith('fedora'):
                        slot = 'hat'
            if cat == 'Bodyparts' or slot == 'hat':
                if re.search(r'horn|antler', name) and 'helmet' not in name:
                    slot = 'horns'
                elif re.search(r'tail', name):
                    slot = 'tail'
            if slot == 'accessory' and re.search(r'glass|goggle', name):
                slot = 'glasses'
            if slot == 'underwear_top' and re.search(r'panty|panties|brief|thong|string|bootyshorts|stocking|pantyhose|suspender', name):
                slot = 'underwear_bottom'
            if d == 'clothes' and is_sock_asset(name):
                slot = 'socks'
            if d == 'clothes' and is_armsleeve_asset(name):
                slot = 'gloves'
            if d == 'clothes':
                slot = SLOT_OVERRIDES.get(name, slot)
            if not slot or name in SKIP:
                continue
            entries.append({
                'id': name, 'dir': d, 'rel': os.path.relpath(mhclo, DATA), 'slot': slot, 'category': cat,
                'name': ('Răng kiểu ' + name[-2:].lstrip('0')) if d == 'teeth' else pretty(name), 'author': info.get('author', 'MakeHuman'), 'license': info.get('license', 'CC0'),
                'genders': genders_of(mhclo, name),
            })
    json.dump(entries, open(OUT, 'w'), ensure_ascii=False, indent=1)
    print(len(entries), dict(Counter(e['slot'] for e in entries)))
    print('licenses', dict(Counter(e['license'] for e in entries)))
    print('genders', dict(Counter(tuple(e['genders']) for e in entries)))


if __name__ == '__main__':
    main()
