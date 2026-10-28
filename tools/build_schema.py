#!/usr/bin/env python3
"""Микроразметка schema.org для всех страниц сайта (идемпотентно: свои блоки помечены data-gl).
Запуск из корня сайта:  python3 tools/build_schema.py
Данные организации — в schema-org.json. Пустые поля в разметку не попадают, поэтому заглушки (ООО «Название», ИНН из нулей)
в поисковики не уйдут: адрес, ИНН и часы работы появятся, как только вы их заполните."""
import html, json, os, re
from urllib.parse import urljoin

ROOT = os.getcwd()
ORG = json.load(open('schema-org.json', encoding='utf8'))
BASE = ORG['url'].rstrip('/')
OID = BASE + '/#org'
SKIP = ('./admin', './assets', './tools', './.git', './holl', './_leads', './brendy', './razdely')   # страницы марок собирает админка (PHP) со своей разметкой

def clean(d):
    if isinstance(d, dict):
        r = {k: clean(v) for k, v in d.items() if not k.startswith('_')}
        return {k: v for k, v in r.items() if v not in ('', None, [], {})}
    if isinstance(d, list):
        return [clean(x) for x in d if x not in ('', None)]
    return d

def org_ld(full=True):
    o = clean(ORG)
    addr = o.get('address', {})
    has_addr = bool(addr.get('streetAddress'))
    if not has_addr: o.pop('address', None)
    if not (o.get('geo') or {}).get('latitude'): o.pop('geo', None)
    t = ['Organization', 'LocalBusiness'] if has_addr else 'Organization'
    ld = {'@context': 'https://schema.org', '@type': t, '@id': OID, 'name': o['name']}
    for k in ('legalName', 'url', 'logo', 'image', 'description', 'telephone', 'email', 'sameAs', 'areaServed', 'taxID', 'address', 'geo', 'openingHours'):
        if k in o: ld[k] = o[k]
    if 'address' in ld:
        a = dict(ld['address']); a['@type'] = 'PostalAddress'; ld['address'] = a
    if 'geo' in ld:
        g = dict(ld['geo']); g['@type'] = 'GeoCoordinates'; ld['geo'] = g
    ld['contactPoint'] = [{'@type': 'ContactPoint', 'telephone': o.get('telephone', ''), 'contactType': 'customer service', 'areaServed': 'RU', 'availableLanguage': 'ru'}]
    if not o.get('telephone'): ld.pop('contactPoint')
    return ld

def script(kind, data):
    return '<script type="application/ld+json" data-gl="%s">%s</script>' % (kind, json.dumps(data, ensure_ascii=False, separators=(',', ':')))

def text(s):
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s))).strip()

def page_url(path):
    d = os.path.dirname(path).lstrip('./').replace(os.sep, '/')
    return BASE + '/' + (d + '/' if d else '')

def breadcrumbs(h, url):
    m = re.search(r'<ol class="crumbs">(.*?)</ol>', h, re.S)
    if not m: return None
    items = re.findall(r'<li[^>]*>(.*?)</li>', m.group(1), re.S)
    out = []
    for i, li in enumerate(items):
        a = re.search(r'<a href="([^"]*)"[^>]*>(.*?)</a>', li, re.S)
        name = text(a.group(2) if a else li)
        item = urljoin(url, a.group(1)) if a else url
        out.append({'@type': 'ListItem', 'position': i + 1, 'name': name, 'item': item})
    if len(out) < 2: return None
    return {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': out}

def faq(h):
    qs = re.findall(r'<div class="qa-a"><p class="qa-qt">(.*?)</p><p>(.*?)</p>', h, re.S)
    if not qs: return None
    return {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
        {'@type': 'Question', 'name': text(q), 'acceptedAnswer': {'@type': 'Answer', 'text': text(a)}} for q, a in qs]}

def meta_desc(h):
    m = re.search(r'<meta name="description" content="([^"]*)"', h)
    return html.unescape(m.group(1)) if m else ''

def h1(h):
    m = re.search(r'<h1[^>]*class="ps-t"[^>]*>(.*?)</h1>', h, re.S) or re.search(r'<h1[^>]*>(.*?)</h1>', h, re.S)
    return text(m.group(1)) if m else ''

def product(h, url):
    m = re.search(r'<script type="application/ld\+json"(?: data-gl="product")?>(\{.*?"@type": ?"Product".*?\})</script>', h, re.S)
    if not m: return None, None
    try: p = json.loads(m.group(1))
    except ValueError: return None, None
    img = re.search(r'<div class="tag-img"><img src="([^"]+)"', h)
    sub = re.search(r'<p class="mx-sub">(.*?)</p>', h, re.S)
    p['url'] = url
    if img: p['image'] = urljoin(url, html.unescape(img.group(1)))
    if sub: p['description'] = text(sub.group(1))
    p['brand'] = p.get('brand') or {}
    return m, p

def process(path):
    h = open(path, encoding='utf8').read()
    o = h
    url = page_url(path)
    rel = path[2:]
    h = re.sub(r'\s*<script type="application/ld\+json" data-gl="(?!product)[^"]*">.*?</script>', '', h, flags=re.S)
    if rel == 'index.html':      # старый блок LocalBusiness без адреса и с круглосуточным графиком заменяется общей организацией
        h = re.sub(r'\s*<script type="application/ld\+json">\{[^<]*"@type": ?"LocalBusiness"[^<]*\}</script>', '', h)
    blocks = []
    if rel == 'index.html':
        blocks.append(('org', org_ld()))
        blocks.append(('site', {'@context': 'https://schema.org', '@type': 'WebSite', '@id': BASE + '/#website', 'url': BASE + '/', 'name': ORG['name'], 'inLanguage': 'ru',
                                'publisher': {'@id': OID},
                                'potentialAction': {'@type': 'SearchAction', 'target': {'@type': 'EntryPoint', 'urlTemplate': BASE + '/zapchasti/?q={search_term_string}'}, 'query-input': 'required name=search_term_string'}}))
    if rel == 'kontakty/index.html':
        blocks.append(('org', org_ld()))
        blocks.append(('contact', {'@context': 'https://schema.org', '@type': 'ContactPage', 'name': h1(h) or 'Контакты', 'url': url, 'mainEntity': {'@id': OID}}))
    b = breadcrumbs(h, url)
    if b: blocks.append(('breadcrumbs', b))
    if rel in ('kontakty/index.html', 'dostavka/index.html'):
        f = faq(h)
        if f: blocks.append(('faq', f))
    if rel.startswith('servis/') and rel.count('/') == 2:
        blocks.append(('service', {'@context': 'https://schema.org', '@type': 'Service', 'name': h1(h), 'serviceType': h1(h), 'description': meta_desc(h), 'url': url,
                                   'provider': {'@type': 'Organization', '@id': OID, 'name': ORG['name'], 'url': BASE + '/'}, 'areaServed': ORG.get('areaServed', '')}))
    m, p = product(h, url) if rel.startswith('zapchasti/') and rel.count('/') == 2 else (None, None)
    if m and p:
        h = h[:m.start()] + h[m.end():]
        h = re.sub(r'<script type="application/ld\+json">\s*</script>\s*', '', h)
        blocks.append(('product', p))
    if blocks:
        ins = '\n'.join(script(k, d) for k, d in blocks) + '\n'
        i = h.find('</head>')
        if i < 0: return False
        h = h[:i] + ins + h[i:]
    if h != o:
        open(path, 'w', encoding='utf8').write(h); return True
    return False

n = 0
for d, _, fs in os.walk('.'):
    if any(d == s or d.startswith(s + os.sep) for s in SKIP): continue
    for f in fs:
        if f.endswith('.html') and process(os.path.join(d, f)): n += 1
print('страниц обновлено:', n)
