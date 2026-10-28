#!/usr/bin/env python3
"""Собирает assets/skus.json: артикул -> страница детали. Нужен для подбора по фото.
Запуск из корня сайта: python3 tools/build_skus.py"""
import html, json, os, re
out = {}
for d in sorted(os.listdir('zapchasti')):
    p = os.path.join('zapchasti', d, 'index.html')
    if not os.path.isfile(p):
        continue
    s = open(p, encoding='utf8').read()
    t = re.search(r'<title>(.*?)(?: \| GeniLift)?</title>', s)
    own = re.search(r'<th scope="row">Артикул</th><td>(.*?)</td>', s)
    if own and t:                                           # одиночная деталь: артикул из собственной карточки
        out[html.unescape(own.group(1)).strip()] = [d, '', html.unescape(t.group(1))]
    for m in re.finditer(r"data-add='([^']+)'", s):
        try:
            j = json.loads(html.unescape(m.group(1)))
        except ValueError:
            continue
        a = str(j.get('a', '')).strip()
        if a:
            out.setdefault(a, [j.get('s') or d, j.get('b', ''), j.get('n', '')])
json.dump(out, open('assets/skus.json', 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'артикулов')
