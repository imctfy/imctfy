#!/usr/bin/env python3
"""make_baseline.py — Fase 2: catat baseline dari baseline/original (sebelum refactor): baseline.json, urls_original.txt, data_fingerprint.txt."""
import re, json, hashlib, html
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent; SRC = ROOT / 'baseline' / 'original'
raw = (SRC / 'index.html').read_text(encoding='utf-8'); L = raw.split('\n')
def sha(s): return hashlib.sha256(s.encode()).hexdigest()
def text_of(h):
    h = re.sub(r'<(script|style)\b.*?</\1>', ' ', h, flags=re.S); h = re.sub(r'<[^>]+>', ' ', h)
    return re.sub(r'\s+', ' ', html.unescape(h)).strip()
def li(p, s=0):
    for i in range(s, len(L)):
        if re.search(p, L[i]): return i
    raise SystemExit('penanda ' + p)
b0 = li(r'^<body>'); s0 = li(r'^\s*<script>\s*$', b0)
panels = {'platform': (li(r'id="tabPlatform"'), li(r'<!-- TAB LIBRARY')), 'semua': (li(r'<!-- TAB LIBRARY'), li(r'<!-- TAB TOOLS')),
          'tools': (li(r'<!-- TAB TOOLS'), li(r'<!-- TAB TENTANG')), 'tentang': (li(r'<!-- TAB TENTANG'), li(r'^\s*</main>') - 1)}
ptext = {k: text_of('\n'.join(L[a:b])) for k, (a, b) in panels.items()}
header = text_of('\n'.join(L[li(r'<header class="header">'):li(r'^\s*</header>')+1]))
footer = text_of('\n'.join(L[li(r'<footer class="footer"'):li(r'FLOATING DOCK')]))
url_re = re.compile(r'(?:https?://[^\s"\'`<>)\\]+|mailto:[^\s"\'`<>)\\]+|tel:[^\s"\'`<>)\\]+)')
urls = sorted({u.rstrip('.,;') for u in url_re.findall(raw)})
ids = sorted(set(re.findall(r'\sid="([^"$]+)"', '\n'.join(L[b0:s0]))))
funcs = sorted(set(re.findall(r'^ {8}(?:async\s+)?function\s+(\w+)', '\n'.join(L[s0:]), re.M)))
css = '\n'.join(L[li(r'^\s*<style>')+1:li(r'^\s*</style>')]) + '\n'
base = {
 'sumber': 'ctfylink-main.zip', 'index_html_bytes': len(raw.encode()), 'index_html_lines': len(L),
 'css_sha256': sha(css), 'css_lines': css.count('\n'),
 'js_function_count': len(funcs), 'js_functions': funcs, 'static_ids_count': len(ids), 'static_ids': ids,
 'panel_text_words': {k: len(v.split()) for k, v in ptext.items()}, 'panel_text_sha256': {k: sha(v) for k, v in ptext.items()},
 'header_text_sha256': sha(header), 'footer_text_sha256': sha(footer), 'external_url_count': len(urls),
 'catatan_data_katalog': 'TIDAK ADA di repo: katalog dimuat runtime dari Google Apps Script (API_URL). Jumlah preset/kategori/URL asset = NOT TESTED / tidak tersedia dari ZIP (temuan F-01).',
 'hash_semua_file': 'lihat baseline/original_hashes.txt',
}
(ROOT / 'baseline' / 'baseline.json').write_text(json.dumps(base, indent=1, ensure_ascii=False), encoding='utf-8')
(ROOT / 'baseline' / 'urls_original.txt').write_text('\n'.join(urls) + '\n', encoding='utf-8')
fp = ['# data_fingerprint.txt — sidik jari konten asli (SHA-256). Data katalog tidak ada di repo (F-01).',
      'css_block ' + sha(css)] + ['panel_%s %s (%d kata)' % (k, sha(v), len(v.split())) for k, v in ptext.items()] + \
     ['header_text ' + sha(header), 'footer_text ' + sha(footer)] + ['js_function_names ' + sha('\n'.join(funcs))]
(ROOT / 'baseline' / 'data_fingerprint.txt').write_text('\n'.join(fp) + '\n', encoding='utf-8')
print('baseline OK:', len(funcs), 'fungsi,', len(ids), 'id statis,', len(urls), 'URL, panel:', base['panel_text_words'])
