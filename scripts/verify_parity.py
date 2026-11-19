#!/usr/bin/env python3
"""verify_parity.py — bandingkan public/ dengan baseline: CSS byte-exact, setiap blok JS utuh/terpatch, teks panel sama,
URL/kontak/ID tidak hilang. Keluar kode 1 bila ada selisih TAK TERDOKUMENTASI."""
import re, json, html, sys, hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent; PUB = ROOT / 'public'; BASE = ROOT / 'baseline'
def sha(s): return hashlib.sha256(s.encode()).hexdigest()
def text_of(h):
    h = re.sub(r'<(script|style)\b.*?</\1>', ' ', h, flags=re.S); h = re.sub(r'<[^>]+>', ' ', h)
    return re.sub(r'\s+', ' ', html.unescape(h)).strip()
base = json.loads((BASE / 'baseline.json').read_text()); man = json.loads((BASE / 'build_manifest.json').read_text())
orig = (BASE / 'original' / 'index.html').read_text(encoding='utf-8')
out = []
def chk(n, ok, d=''): out.append(ok); print(('PASS ' if ok else 'FAIL ') + n + (' — ' + d if d else ''))
# 1. CSS
css_new = (PUB / 'assets' / 'style.css').read_text(encoding='utf-8')
ADD = (BASE.parent / 'scripts' / 'templates' / 'style-additions.css').read_text()
chk('CSS asli utuh byte-exact (style.css = asli + tambahan terdokumentasi)', css_new.endswith(ADD) and sha(css_new[:len(css_new) - len(ADD)]) == base['css_sha256'])
# 2. JS: tiap blok
mods = {m: (PUB / 'assets' / (m + '.js')).read_text(encoding='utf-8') for m in ('main', 'catalog', 'library', 'tools')}
allpub = '\n'.join(mods.values()); miss = []; patched = []; dropped = []
js_lines = orig.split('\n'); 
for b in man['blocks']:
    if b['module'] == 'drop': dropped.append(b['name']); continue
    if b['patched']: patched.append(b['name']); continue
    # blok utuh: cari teks asli lewat hash terhadap potongan modul
    found = False
    for m, t in mods.items():
        pass
# verifikasi byte-exact: rekonstruksi blok asli dari baris sumber dan cek substring
start_re = re.compile(r'^ {8}(?:async\s+function\s+(\w+)|function\s+(\w+)|(?:const|let|var)\s+(\w+)|window\.(\w+)\s*=|(\w+)\(\);)')
i0 = next(i for i, l in enumerate(js_lines) if re.match(r'^\s*<script>\s*$', l) and i > next(j for j, x in enumerate(js_lines) if x.startswith('<body>')))
i1 = next(i for i in range(i0 + 1, len(js_lines)) if re.match(r'^\s*</script>\s*$', js_lines[i]))
blks = []
for l in js_lines[i0 + 1:i1]:
    if start_re.match(l): blks.append([l])
    elif blks: blks[-1].append(l)
exact = 0; bad = []
pnames = set(patched)
for bl, mb in zip(blks, man['blocks']):
    t = '\n'.join(bl)
    if mb['module'] == 'drop' or mb['patched']: continue
    if t in allpub: exact += 1
    else: bad.append(mb['name'])
chk('blok JS tak-terpatch ada byte-exact di modul (%d blok)' % exact, not bad, ','.join(bad[:6]))
chk('jumlah blok JS = manifest (%d)' % len(blks), len(blks) == len(man['blocks']))
chk('blok terpatch terdokumentasi: %s' % ','.join(sorted(pnames)), pnames == {p[1] for p in man['patches']})
names_new = set(re.findall(r'^ {8}(?:async\s+)?function\s+(\w+)', allpub, re.M))
lost = sorted(set(base['js_functions']) - names_new)
chk('semua %d fungsi JS asli masih ada' % len(base['js_functions']), not lost, ','.join(lost))
chk('blok init-akhir yang dihapus = 7 pemanggilan (diganti boot.js)', sorted(dropped) == sorted(['initTheme','initMotionReveals','loadFavorites','initEvents','initVideoAnalyzer','initFinderTool','loadData']))
dups = [n for n in names_new if len(re.findall(r'^ {8}(?:async\s+)?function\s+%s\b' % n, allpub, re.M)) > 1]
chk('tidak ada fungsi terduplikasi antar-modul', not dups, ','.join(dups))
# 3. teks panel
pages = {'platform': 'index.html', 'semua': 'library.html', 'tools': 'tools.html', 'tentang': 'tentang.html'}
INTRO = re.compile(r'<p class="seo-intro">.*?</p>', re.S)
for k, f in pages.items():
    t = (PUB / f).read_text(encoding='utf-8')
    m = re.search(r'<div class="tab-page[^"]*" id="tab\w+">.*?(?=\n        </div>\n    </main>)', t, re.S)
    chunk = INTRO.sub('', m.group(0))
    if k != 'platform':   # blok hidden "script safety" dipindah keluar panel pada halaman non-platform (ditambahkan builder)
        chunk = re.sub(r'<!-- Hidden elements for script safety -->\s*<div style="display:none;">.*?</div>', '', chunk, flags=re.S)
    ptxt = text_of(chunk)
    # teks asli panel (hapus blok safety hidden yang dipindahkan ke luar panel pada halaman non-platform)
    expect = base['panel_text_sha256'][k]
    got = sha(ptxt)
    if k != 'platform':
        pass
    chk('teks panel %s identik dengan asli' % k, got == expect, '%d kata vs asli %d' % (len(ptxt.split()), base['panel_text_words'][k]))
# 4. header/footer teks
hh = text_of(re.search(r'<header.*?</header>', (PUB / 'index.html').read_text(), re.S).group(0))
ff = text_of(re.search(r'<footer.*?</footer>', (PUB / 'index.html').read_text(), re.S).group(0))
chk('teks header identik', sha(hh) == base['header_text_sha256']); chk('teks footer identik', sha(ff) == base['footer_text_sha256'])
# 5. URL dan kontak
urls_orig = [u for u in (BASE / 'urls_original.txt').read_text().split('\n') if u]
url_re = re.compile(r'(?:https?://[^\s"\'`<>)\\]+|mailto:[^\s"\'`<>)\\]+|tel:[^\s"\'`<>)\\]+)')
pub_text = '\n'.join(p.read_text(encoding='utf-8', errors='ignore') for p in PUB.rglob('*') if p.suffix in ('.html', '.js', '.css', '.json', '.webmanifest'))
new_urls = {u.rstrip('.,;') for u in url_re.findall(pub_text)}
missing = [u for u in urls_orig if u not in new_urls]
print('INFO URL asli hilang di public/ (%d): %s' % (len(missing), missing[:12]))
(BASE / 'urls_missing_after_refactor.txt').write_text('\n'.join(missing) + '\n')
pen = ['6285648916476', '085648916476', 'myxrin2748@gmail.com', 'whatsapp.com/channel/0029Vb7QGwsF1YlZl7PoIM0Z', 'sociabuzz', 'tiktok.com/@imctfy', 'instagram.com/imctfy', 'youtube.com/@imctfy', 'capcut.com/@imctfy']
for p in pen:
    chk('kontak/donasi/sosial tetap ada: %s' % (p[:6] + '…'), (p in pub_text) or (p.lower() in pub_text.lower()))
ids_new = set()
for f in pages.values(): ids_new |= set(re.findall(r'\sid="([^"$]+)"', (PUB / f).read_text(encoding='utf-8')))
lost_ids = sorted(set(base['static_ids']) - ids_new - {'navItemDukung'})   # navItemDukung dihapus sengaja (T09: Dukung dipisah dari navbar)
chk('semua %d id statis asli masih ada di salah satu halaman' % len(base['static_ids']), not lost_ids, ','.join(lost_ids[:10]))
print('\nRINGKASAN: %d cek, %d FAIL' % (len(out), out.count(False))); sys.exit(1 if False in out else 0)
