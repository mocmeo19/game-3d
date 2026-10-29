import re


SOCK_PATTERN = re.compile(r'stocking|pantyhose|hosiery|(?:^|[_\s-])socks?(?:$|[_\s-])', re.I)
SOCK_ASSET_IDS = {'punkduck_french_lingerie_suspender_belt'}
SLOT_OVERRIDES = {
    'tiomegamanx_skintight_body_suit_female': 'outfit',
    'matcreator_mc-skinsuit_2022': 'outfit',
}


def is_sock_asset(asset_id, name=''):
    return asset_id in SOCK_ASSET_IDS or bool(SOCK_PATTERN.search(f'{asset_id} {name}'))


def is_armsleeve_asset(asset_id, name=''):
    return bool(re.search(r'arm[_\s-]*sleeves?', f'{asset_id} {name}', re.I))
