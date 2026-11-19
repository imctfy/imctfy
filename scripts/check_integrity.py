#!/usr/bin/env python3
"""check_integrity.py — pemeriksaan statis public/: link internal, id unik, handler inline terselesaikan,
H1/canonical/meta/JSON-LD, header & footer identik, sitemap/robots, referensi aset, ukuran. Keluar kode 1 bila ada FAIL."""
import re, json, sys, os, html
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent; PUB = ROOT / 'public'
PAGES = {'/': 'index.html', '/library': 'library.html', '/tools': 'tools.html', '/tentang': 'tentang.html'}
PMODS = json.loads((ROOT / 'baseline' / 'build_manifest.json').read_text())['page_modules']
PAGEKEY = {'/': 'platform', '/library': 'semua', '/tools': 'tools', '/tentang': 'tentang'}
res = []
def chk(name, ok, detail=''):
    res.append((name, ok, detail)); print(('PASS ' if ok else 'FAIL ') + name + (' — ' + detail if detail else ''))
def strip_active(t):  # normalisasi state nav untuk perbandingan header/footer
    t = re.sub(r' active"', '"', t); t = re.sub(r' aria-current="page"', '', t); return t

docs = {u: (PUB / f).read_text(encoding='utf-8') for u, f in PAGES.items()}
allfiles = {str(p.relative_to(PUB)) for p in PUB.rglob('*') if p.is_file()}

# 1. id unik per halaman
for u, t in docs.items():
    ids = re.findall(r'\sid="([^"$]+)"', t); dup = sorted({i for i in ids if ids.count(i) > 1})
    chk('id unik %s' % u, not dup, ','.join(dup))
# 2. H1, title, description, canonical, og:url
for u, t in docs.items():
    chk('tepat 1 <h1> %s' % u, len(re.findall(r'<h1[\s>]', t)) == 1, str(len(re.findall(r'<h1[\s>]', t))))
    title = re.search(r'<title>(.*?)</title>', t, re.S).group(1)
    desc = re.search(r'<meta name="description" content="([^"]*)"', t).group(1)
    can = re.search(r'<link rel="canonical" href="([^"]*)"', t).group(1)
    ogu = re.search(r'<meta property="og:url" content="([^"]*)"', t).group(1)
    exp = 'https://ctfy.my.id' + u
    chk('canonical=og:url=URL halaman %s' % u, can == exp and ogu == exp, can)
    chk('title %s' % u, 0 < len(html.unescape(title)) <= 70, '%d karakter' % len(html.unescape(title)))
    chk('description %s' % u, 50 <= len(html.unescape(desc)) <= 200, '%d karakter' % len(html.unescape(desc)))
    chk('lang=id & viewport %s' % u, '<html lang="id">' in t and 'name="viewport"' in t)
titles = [re.search(r'<title>(.*?)</title>', t, re.S).group(1) for t in docs.values()]
descs = [re.search(r'<meta name="description" content="([^"]*)"', t).group(1) for t in docs.values()]
chk('title unik antar-halaman', len(set(titles)) == 4); chk('description unik antar-halaman', len(set(descs)) == 4)
# 3. JSON-LD valid
for u, t in docs.items():
    blocks = re.findall(r'<script type="application/ld\+json">\s*(.*?)\s*</script>', t, re.S)
    ok = len(blocks) == 1
    try: [json.loads(b) for b in blocks]
    except Exception as e: ok = False
    chk('JSON-LD valid %s' % u, ok)
# 4. link & aset internal
bad = []
for u, t in docs.items():
    for m in re.finditer(r'(?:href|src)="(/[^"#?]*)(?:[?#][^"]*)?"', t):
        p = m.group(1)
        if p in PAGES or p == '/': continue
        if p.lstrip('/') not in allfiles: bad.append((u, p))
chk('semua href/src internal ada di public/', not bad, str(bad[:5]))
bad = [(u, m) for u, t in docs.items() for m in re.findall(r'href="(/\?[^"]*)"', t)]
chk('tidak ada tautan lama /?tab=', not bad, str(bad[:3]))
# 5. handler inline terselesaikan
for u, t in docs.items():
    mods = PMODS[PAGEKEY[u]]
    code = '\n'.join((PUB / 'assets' / (m + '.js')).read_text(encoding='utf-8') for m in mods)
    code += (PUB / 'assets' / 'boot.js').read_text(encoding='utf-8')
    stubs = set(json.loads((ROOT / 'baseline' / 'build_manifest.json').read_text())['stubs'][PAGEKEY[u]])
    names = set(re.findall(r'\bon(?:click|change|input|submit|keydown|keyup)="\s*(?:event\.[\w]+\([^)]*\);\s*)?(?:return\s+)?([A-Za-z_]\w*)\(', t))
    missing = sorted(n for n in names if not re.search(r'(?:function\s+%s\b|window\.%s\s*=)' % (n, n), code) and n not in stubs and n not in ('event', 'confirm', 'alert'))
    chk('handler inline terselesaikan %s (%d nama)' % (u, len(names)), not missing, ','.join(missing))
# 6. header & footer identik antar-halaman (kecuali state aktif)
for tag in ('header', 'footer'):
    parts = [strip_active(re.search(r'<%s[ >].*?</%s>' % (tag, tag), t, re.S).group(0)) for t in docs.values()]
    chk('%s identik di 4 halaman' % tag, len(set(parts)) == 1)
nav = [strip_active(re.search(r'<nav class="bottom-nav".*?</nav>', t, re.S).group(0)) for t in docs.values()]
chk('bottom-nav identik di 4 halaman', len(set(nav)) == 1)
# 7. skrip sesuai kebutuhan halaman, tak ada skrip inline besar
for u, t in docs.items():
    srcs = re.findall(r'<script[^>]*src="([^"]+)"', t)
    chk('skrip halaman %s' % u, all(s.startswith('/assets/') or s.startswith('https://') for s in srcs), ' '.join(s.split('/')[-1] for s in srcs))
    inl = [len(b) for b in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>', t, re.S) if b.strip()]
    chk('skrip inline kecil %s' % u, max(inl or [0]) < 9000, 'terbesar %d byte' % max(inl or [0]))
# 7b. logo = favicon, Dukung terpisah dari navbar umum
for u, t in docs.items():
    chk('logo header memakai /favicon.svg %s' % u, '<img class="logo-mark" src="/favicon.svg"' in t)
    nb = re.search(r'<nav class="bottom-nav".*?</nav>', t, re.S).group(0)
    chk('bottom-nav 4 tab tanpa Dukung %s' % u, len(re.findall(r'class="nav-item', nb)) == 4 and 'Dukung' not in nb and 'id="floatingSupportBtn"' in t)
chk('404 memakai /favicon.svg', '<img class="brand-mark" src="/favicon.svg"' in (PUB / '404.html').read_text())
# 8. robots & sitemap
sm = (PUB / 'sitemap.xml').read_text(); locs = re.findall(r'<loc>(.*?)</loc>', sm)
chk('sitemap memuat 4 URL kanonik', sorted(locs) == sorted('https://ctfy.my.id' + u for u in PAGES), str(locs))
rb = (PUB / 'robots.txt').read_text(); chk('robots.txt menunjuk sitemap, tidak memblokir', 'Sitemap: https://ctfy.my.id/sitemap.xml' in rb and 'Disallow' not in rb)
# 9. 404 & file verifikasi & non-publik
chk('404.html ada & noindex', 'noindex' in (PUB / '404.html').read_text())
chk('google verification tetap di root', 'google47e7b1fe3d496965.html' in allfiles)
chk('README.md / metadata.json tidak publik', 'README.md' not in allfiles and 'metadata.json' not in allfiles)
chk('hanya hash-anchor yang diizinkan', all(re.search(r'href="#', t) is None or set(re.findall(r'href="(#[^"]*)"', t)) <= {'#', '#main-content'} for t in docs.values()), str({u: set(re.findall(r'href="(#[^"]*)"', t)) for u, t in docs.items()}))
# 10. ukuran
for f in ('assets/style.css', 'assets/main.js', 'assets/catalog.js', 'assets/library.js', 'assets/tools.js'):
    print('INFO ukuran %-20s %6.1f KB' % (f, (PUB / f).stat().st_size / 1024))
for u, f in PAGES.items(): print('INFO ukuran %-20s %6.1f KB' % (f, (PUB / f).stat().st_size / 1024))
fails = [r for r in res if not r[1]]
print('\nRINGKASAN: %d cek, %d PASS, %d FAIL' % (len(res), len(res) - len(fails), len(fails)))
sys.exit(1 if fails else 0)
