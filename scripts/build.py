#!/usr/bin/env python3
"""
build.py — merakit public/ dari baseline/original (index.html monolit).
Prinsip: CSS dan blok JS dipindah BYTE-EXACT lewat skrip (model tidak mengetik ulang);
perubahan hanya lewat daftar PATCH di bawah (tiap patch di-assert cocok tepat 1x).
Jalankan:  python3 scripts/build.py
"""
import re, json, os, sys, shutil, html, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'baseline' / 'original'
OUT = ROOT / 'public'
TPL = ROOT / 'scripts' / 'templates'
SITE = 'https://ctfy.my.id'

def sha(s): return hashlib.sha256(s.encode('utf-8')).hexdigest()
def die(msg): print('BUILD GAGAL:', msg); sys.exit(1)

raw = (SRC / 'index.html').read_text(encoding='utf-8')
L = raw.split('\n')

# ---------------------------------------------------------------- penanda
def find_line(pattern, start=0):
    for i in range(start, len(L)):
        if re.search(pattern, L[i]): return i
    die('penanda tidak ditemukan: ' + pattern)

I_STYLE0 = find_line(r'^\s*<style>\s*$'); I_STYLE1 = find_line(r'^\s*</style>\s*$', I_STYLE0)
I_BODY = find_line(r'^<body>')
I_SCRIPT0 = find_line(r'^\s*<script>\s*$', I_BODY); I_SCRIPT1 = find_line(r'^\s*</script>\s*$', I_SCRIPT0)
I_HEAD_MODULE0 = find_line(r'<script type="module">'); I_HEAD_MODULE1 = find_line(r'^\s*</script>\s*$', I_HEAD_MODULE0)
I_JSONLD0 = find_line(r'<script type="application/ld\+json">'); I_JSONLD1 = find_line(r'^\s*</script>\s*$', I_JSONLD0)
I_FONTS = find_line(r'fonts\.googleapis\.com/css2'); I_FA = find_line(r'font-awesome')
print('style', I_STYLE0+1, I_STYLE1+1, '| script', I_SCRIPT0+1, I_SCRIPT1+1, '| module', I_HEAD_MODULE0+1, I_HEAD_MODULE1+1)

# ---------------------------------------------------------------- CSS (byte-exact)
css_orig = '\n'.join(L[I_STYLE0+1:I_STYLE1]) + '\n'
css_out = css_orig + (TPL / 'style-additions.css').read_text(encoding='utf-8')

# ---------------------------------------------------------------- blok JS
js_lines = L[I_SCRIPT0+1:I_SCRIPT1]; JS_FIRST = I_SCRIPT0 + 2   # nomor baris 1-based baris pertama isi script
start_re = re.compile(r'^ {8}(?:async\s+function\s+(\w+)|function\s+(\w+)|(?:const|let|var)\s+(\w+)|window\.(\w+)\s*=|(\w+)\(\);)')
blocks = []
for i, s in enumerate(js_lines):
    m = start_re.match(s)
    if m:
        name = next(g for g in m.groups() if g)
        kind = 'stmt' if m.group(5) else ('winassign' if m.group(4) else 'decl')
        blocks.append({'name': name, 'kind': kind, 'start': JS_FIRST + i, 'lines': [s]})
    elif blocks:
        blocks[-1]['lines'].append(s)
    else:
        die('baris JS sebelum blok pertama: ' + s)
for b in blocks:
    b['text'] = '\n'.join(b['lines']); b['orig_sha'] = sha(b['text']); b['patched'] = None

stmts = [b['name'] for b in blocks if b['kind'] == 'stmt']
EXPECT_STMTS = ['initTheme','initMotionReveals','loadFavorites','initEvents','initVideoAnalyzer','initFinderTool','loadData']
if stmts != EXPECT_STMTS: die('stmt top-level tak terduga: %s' % stmts)

BREAKS = [(0,'main'),(6251,'catalog'),(6375,'library'),(6936,'main'),(7141,'catalog'),(7258,'library'),
          (7295,'catalog'),(7311,'library'),(7698,'catalog'),(7721,'library'),(8463,'catalog'),(8547,'main'),(9259,'tools')]
HOIST_MAIN = {'currentModalSlide', 'pendingCardCode', 'currentToolsSubTab'}
WIN_OWNER_EXTRA = {'openTool': 'tools'}

def region(start):
    mod = 'main'
    for s, m in BREAKS:
        if start >= s: mod = m
    return mod

decl_mod = {}
for b in blocks:
    if b['kind'] == 'decl':
        b['module'] = 'main' if b['name'] in HOIST_MAIN else region(b['start'])
        decl_mod[b['name']] = b['module']
for b in blocks:
    if b['kind'] == 'winassign':
        b['module'] = decl_mod.get(b['name'], WIN_OWNER_EXTRA.get(b['name']))
        if not b['module'] and b['start'] < 11637: b['module'] = region(b['start'])   # window.x = function(){...} di tengah file
        if not b['module']: die('pemilik window.%s tidak diketahui' % b['name'])
    elif b['kind'] == 'stmt':
        b['module'] = 'drop'

by_name = {b['name']: b for b in blocks if b['kind'] == 'decl'}
PATCHES = []   # (id, blok, deskripsi)

def patch(bid, name, old, new, desc, count=1):
    b = by_name[name]
    if b['text'].count(old) != count: die('patch %s: "%s..." cocok %d kali (butuh %d) di %s' % (bid, old[:40], b['text'].count(old), count, name))
    b['text'] = b['text'].replace(old, new); b['patched'] = True
    PATCHES.append((bid, name, desc))

def replace_block(bid, name, new_text, desc):
    b = by_name[name]; b['text'] = new_text; b['patched'] = True; PATCHES.append((bid, name, desc))

# ---- P01 buildAppUrl -> clean URL
replace_block('P01', 'buildAppUrl', '''        function buildAppUrl(tab, code = null, subTool = null){
            // REFACTOR: URL bersih per halaman (/, /library, /tools, /tentang); parameter hanya ?code= (library) dan ?tool= (tools)
            const cTab = getCanonicalTab(tab);
            const params = new URLSearchParams();
            let path = '/';
            if (cTab === 'semua') {
                path = '/library';
                if (code) params.set('code', code);
            } else if (cTab === 'tools') {
                path = '/tools';
                const activeTool = subTool || (typeof currentToolsSubTab !== 'undefined' ? currentToolsSubTab : null);
                if (activeTool === 'finder') params.set('tool', 'finder');
                else if (activeTool === 'analyzer') params.set('tool', 'analyzer');
            } else if (cTab === 'tentang') {
                path = '/tentang';
            }
            const qs = params.toString();
            return qs ? (path + '?' + qs) : path;
        }
''', 'URL berbasis ?tab= diganti clean URL per halaman')

# ---- P02 parseCurrentRoute -> berbasis halaman
replace_block('P02', 'parseCurrentRoute', '''        function parseCurrentRoute(){
            // REFACTOR: tab ditentukan oleh halaman (body[data-page]); URL lama dialihkan oleh skrip legacy di index.html / 404.html
            const page = getCanonicalTab(document.body ? document.body.getAttribute('data-page') : null);
            const sp = new URLSearchParams(window.location.search || '');
            let code = null, subTool = 'menu';
            if (page === 'semua') {
                code = sp.get('code') || sp.get('id') || sp.get('c');
            } else if (page === 'tools') {
                const t = String(sp.get('tool') || sp.get('sub') || sp.get('subTool') || '').toLowerCase();
                if (t === 'finder' || t === 'link-finder' || t === 'tiktok-finder') subTool = 'finder';
                else if (t === 'analyzer' || t === 'video-analyzer') subTool = 'analyzer';
            }
            return { tab: page, subTool: subTool, code: code ? String(code).trim() : null, openSupport: sp.get('support') === '1' };
        }
''', 'parser rute SPA diganti parser berbasis halaman')

# ---- P03 switchTab -> navigasi lintas halaman
patch('P03', 'switchTab', '''            const cTab = getCanonicalTab(tab);
            currentTab = cTab;''', '''            const cTab = getCanonicalTab(tab);
            // REFACTOR: tab = halaman sendiri. Bila tab tujuan bukan halaman ini, pindah halaman.
            if (typeof ctfyPageTab === 'function' && cTab !== ctfyPageTab()) {
                window.location.assign(buildAppUrl(cTab));
                return;
            }
            currentTab = cTab;''', 'switchTab berpindah halaman bila tab tujuan bukan halaman aktif')

# ---- P04 updatePageTitle -> pertahankan metadata statis halaman
b = by_name['updatePageTitle']
i_cut = b['text'].index('const cTab = getCanonicalTab(tab);')
finder_t = re.search(r"subTool === 'finder'\) \{\s*document\.title = '([^']*)';\s*updateMetaDescription\('([^']*)'\);", b['text'])
analyz_t = re.search(r"subTool === 'analyzer'\) \{\s*document\.title = '([^']*)';\s*updateMetaDescription\('([^']*)'\);", b['text'])
if not (finder_t and analyz_t): die('judul finder/analyzer tak ditemukan')
replace_block('P04', 'updatePageTitle', b['text'][:i_cut] + '''const cTab = getCanonicalTab(tab);
            // REFACTOR: judul/deskripsi tiap halaman statis di HTML; hanya sub-tool Tools dan modal item yang mengubahnya.
            if (cTab === 'tools' && subTool === 'finder') {
                document.title = '%s';
                updateMetaDescription('%s');
            } else if (cTab === 'tools' && subTool === 'analyzer') {
                document.title = '%s';
                updateMetaDescription('%s');
            } else if (window.__ctfyPageMeta) {
                document.title = window.__ctfyPageMeta.title;
                updateMetaDescription(window.__ctfyPageMeta.desc);
            }
        }
''' % (finder_t.group(1), finder_t.group(2), analyz_t.group(1), analyz_t.group(2)), 'judul/deskripsi dinamis per-tab diganti metadata statis per halaman')
TITLES = re.findall(r"document\.title = '((?:[^'\\]|\\.)*)'", raw[raw.index('function updatePageTitle'):raw.index('function getCanonicalTab')])
DESCS = re.findall(r"updateMetaDescription\('((?:[^'\\]|\\.)*)'\)", raw[raw.index('function updatePageTitle'):raw.index('function getCanonicalTab')])
# urutan asli: semua, finder, analyzer, tools-menu, tentang, default(home)
if len(TITLES) != 6 or len(DESCS) != 6: die('jumlah judul/deskripsi asli tak terduga %d/%d' % (len(TITLES), len(DESCS)))
META = {'platform': (TITLES[5], DESCS[5]), 'semua': (TITLES[0], DESCS[0]), 'tools': (TITLES[3], DESCS[3]), 'tentang': (TITLES[4], DESCS[4])}

# ---- P05/P06 initEvents
patch('P05', 'initEvents', "if(document.getElementById('modal').style.display==='flex'){",
      "if((document.getElementById('modal')||{style:{}}).style.display==='flex'){", 'guard null untuk #modal (tidak ada di halaman non-Library)')
nav_old = "document.querySelectorAll('.nav-item[data-tab]').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));"
patch('P06', 'initEvents', nav_old, "/* REFACTOR: navigasi memakai <a href> asli; listener tombol-tab dihapus */", 'listener klik .nav-item dihapus (anchor menavigasi sendiri)')

# ---- P07 loadData
patch('P07', 'loadData', 'renderAll();', 'ctfyAfterCatalog();', 'render pasca-muat lewat hook yang sadar halaman', count=2)
patch('P08', 'loadData', "document.getElementById('cardGrid').classList.remove('is-loading');",
      "{ const _cg0 = document.getElementById('cardGrid'); if (_cg0) _cg0.classList.remove('is-loading'); }", 'guard null #cardGrid')
patch('P09', 'loadData', "document.getElementById('cardGrid').innerHTML=", "(document.getElementById('cardGrid') || {}).innerHTML=", 'guard null #cardGrid')

# ---------------------------------------------------------------- rakit modul JS
MODS = ['main', 'catalog', 'library', 'tools']
mod_text = {m: [] for m in MODS}
for b in blocks:
    if b['module'] in mod_text: mod_text[b['module']].append(b)

SHIM = '''
        /* ============================================================
           REFACTOR — SHIM MULTI-HALAMAN (kode baru, bukan bagian JS asli)
           ============================================================ */
        function ctfyPageTab(){
            return getCanonicalTab(document.body ? document.body.getAttribute('data-page') : null);
        }
        function ctfyAfterCatalog(){
            // Dipanggil setelah katalog dimuat (menggantikan renderAll() langsung pada loadData).
            if (typeof renderAll === 'function' && document.getElementById('cardGrid')) { renderAll(); return; }
            updateStats();
            if (ctfyPageTab() === 'tools' && typeof renderCtfyPresetsFinder === 'function') renderCtfyPresetsFinder();
        }
'''
HEAD = {
 'main': 'Inti bersama semua halaman: konstanta, helper, toast, clipboard, tema, rute/navigasi, popup dukungan, FAQ, filter platform, event global.',
 'catalog': 'Lapisan data katalog (Apps Script + cache), normalisasi item, counter unduhan Firebase, statistik. Dipakai halaman Library, Tools, Tentang.',
 'library': 'UI Library: media kartu, masonry, filter/pencarian, favorit, modal item, popup WhatsApp, pelacakan unduhan. Hanya halaman Library.',
 'tools': 'TikTok Video Analyzer dan TikTok Project Link Finder (+ penyimpanan project AM lokal). Hanya halaman Tools.',
}
js_out = {}
for m in MODS:
    parts = ['/* %s.js — %s\n   Dibangkitkan oleh scripts/build.py dari index.html asli (blok dipindah byte-exact; perubahan = daftar PATCH di FINAL_REPORT.md). */\n' % (m, HEAD[m])]
    parts += [b['text'] for b in mod_text[m]]
    if m == 'main': parts.append(SHIM)
    js_out[m] = '\n'.join(parts).rstrip('\n') + '\n'

# ---------------------------------------------------------------- stub per halaman
PAGE_MODS = {'platform': ['main'], 'semua': ['main', 'catalog', 'library'], 'tools': ['main', 'catalog', 'tools'], 'tentang': ['main', 'catalog']}
func_decl = {b['name'] for b in blocks if b['kind'] == 'decl' and re.match(r'\s*(async\s+)?function\b', b['text'])}
STUBS = {}; WARN_STATE = {}
for page, mods in PAGE_MODS.items():
    loaded = '\n'.join(js_out[m] for m in mods)
    unloaded = [b for b in blocks if b['kind'] == 'decl' and b['module'] in MODS and b['module'] not in mods]
    STUBS[page] = sorted(b['name'] for b in unloaded if b['name'] in func_decl and re.search(r'\b%s\b' % re.escape(b['name']), loaded))
    WARN_STATE[page] = sorted(b['name'] for b in unloaded if b['name'] not in func_decl and re.search(r'\b%s\b' % re.escape(b['name']), loaded))

boot = '''/* boot.js — inisialisasi per halaman (menggantikan blok pemanggilan di akhir <script> inline asli).
   Dibangkitkan oleh scripts/build.py. Kode baru. */
(function () {
    var PAGE = document.body.getAttribute('data-page') || 'platform';
    // Stub no-op untuk fungsi modul yang tidak dimuat di halaman ini (dipanggil dari handler global yang dipakai bersama).
    var STUBS = %s;
    (STUBS[PAGE] || []).forEach(function (n) { if (typeof window[n] !== 'function') window[n] = function () {}; });
    var dm = document.querySelector('meta[name="description"]');
    window.__ctfyPageMeta = { title: document.title, desc: dm ? dm.getAttribute('content') : '' };
    function run(name) {
        var f = window[name];
        if (typeof f !== 'function') return;
        try { f.apply(null, Array.prototype.slice.call(arguments, 1)); }
        catch (e) { console.error('[boot] ' + name + ':', e); }
    }
    run('initTheme');
    run('initMotionReveals');
    if (PAGE === 'semua') run('loadFavorites');
    run('initEvents');
    if (PAGE === 'tools') { run('initVideoAnalyzer'); run('initFinderTool'); }
    run('handleRouteFromLocation', true);
    if (PAGE !== 'platform') run('loadData');
})();
''' % json.dumps(STUBS, indent=2, ensure_ascii=False)

firebase_js = '\n'.join(L[I_HEAD_MODULE0+1:I_HEAD_MODULE1]) + '\n'

# ---------------------------------------------------------------- potongan HTML
def seg(a_pat, b_pat, start=0):
    a = find_line(a_pat, start); b = find_line(b_pat, a + 1); return a, b
h0, h1 = seg(r'<header class="header">', r'^\s*</header>')
HEADER = '\n'.join(L[h0:h1+1])
e0, e1 = seg(r'<!-- ERROR BANNER -->', r'^\s*</div>\s*$')
ERROR_BANNER = '\n'.join(L[e0+1:e1+1])
p0 = find_line(r'<div class="tab-page active" id="tabPlatform">')
s0 = find_line(r'<!-- TAB LIBRARY \(SEMUA\) -->'); t0 = find_line(r'<!-- TAB TOOLS -->'); a0 = find_line(r'<!-- TAB TENTANG -->')
end_main = find_line(r'^\s*</main>')
PANELS = {
 'platform': '\n'.join(L[p0:s0]).rstrip(),
 'semua': '\n'.join(L[s0+1:t0]).rstrip(),
 'tools': '\n'.join(L[t0+1:a0]).rstrip(),
 'tentang': '\n'.join(L[a0+1:end_main-1]).rstrip(),
}
f0 = find_line(r'<!-- STREAMLINED COMPACT FOOTER -->'); d0 = find_line(r'<!-- FLOATING DOCK CONTAINER'); sp0 = find_line(r'<!-- MODERN SUPPORT POPUP')
wa0 = find_line(r'<div class="wa-popup-overlay" id="waPopup">'); md0 = find_line(r'<!-- PREVIEW & DOWNLOAD MODAL -->')
FOOTER = '\n'.join(L[f0+1:d0]).rstrip(); DOCK = '\n'.join(L[d0+1:sp0]).rstrip()
# REFACTOR (T09): tab "Dukung" dikeluarkan dari navbar umum; tombol .floating-support (sudah ada di markup) menjadi tombol terpisah
DOCK, _n = re.subn(r'[ \t]*<button type="button" class="nav-item" id="navItemDukung"[^>]*>.*?</button>\n', '', DOCK, flags=re.S)
if _n != 1: die('tab Dukung di dock tidak ditemukan')
SUPPORT = '\n'.join(L[sp0:wa0]).rstrip(); WAPOP = '\n'.join(L[wa0:md0]).rstrip(); MODAL = '\n'.join(L[md0:I_SCRIPT0]).rstrip()
hs = re.search(r'[ \t]*<!-- Hidden elements for script safety -->\n[ \t]*<div style="display:none;">.*?\n[ \t]*</div>', PANELS['platform'], re.S)
if not hs: die('blok hidden-script-safety tidak ditemukan')
SAFETY = hs.group(0)

URL = {'platform': '/', 'semua': '/library', 'tools': '/tools', 'tentang': '/tentang'}

def nav_transform(text, page):
    # desktop nav
    def d(m):
        act = ' active' if m.group(2) == page else ''; cur = ' aria-current="page"' if m.group(2) == page else ''
        return '<a class="desktop-nav-btn%s" href="%s" data-tab="%s"%s>%s</a>' % (act, URL[m.group(2)], m.group(2), cur, m.group(3))
    text, n1 = re.subn(r'<button type="button" class="desktop-nav-btn( active)?" data-tab="(\w+)" onclick="switchTab\(\'\w+\'\)">(.*?)</button>', d, text, flags=re.S)
    # dock
    def k(m):
        act = ' active' if m.group(2) == page else ''; cur = ' aria-current="page"' if m.group(2) == page else ''
        return '<a class="nav-item%s" href="%s" data-tab="%s" id="%s" aria-label="%s"%s>%s</a>' % (act, URL[m.group(2)], m.group(2), m.group(3), m.group(4), cur, m.group(5))
    text, n2 = re.subn(r'<button type="button" class="nav-item( active)?" data-tab="(\w+)" id="(\w+)" aria-label="([^"]+)">(.*?)</button>', k, text, flags=re.S)
    # footer
    text, n3 = re.subn(r'<button type="button" onclick="switchTab\(\'(\w+)\'\)">(.*?)</button>', lambda m: '<a href="%s">%s</a>' % (URL[m.group(1)], m.group(2)), text, flags=re.S)
    # logo
    text, n4 = re.subn(r' onclick="event\.preventDefault\(\); switchTab\(\'platform\'\);"', '', text)
    # tautan hero antar-halaman
    text, n5 = re.subn(r'href="/\?tab=(library|tools)"([^>]*?)\s+onclick="event\.preventDefault\(\); switchTab\(\'\w+\'\);"', lambda m: 'href="/%s"%s' % (m.group(1), m.group(2)), text)
    return text, (n1, n2, n3, n4, n5)

def pagify(text, page):
    n = {}
    text, n['nav'] = nav_transform(text, page)
    return text, n

# ---------------------------------------------------------------- JSON-LD
jl = json.loads('\n'.join(L[I_JSONLD0+1:I_JSONLD1]))
nodes = {n['@type']: n for n in jl['@graph']}
def ld_for(page, title, desc):
    if page == 'platform': return jl
    person = json.loads(json.dumps(nodes['Person'])); person.pop('mainEntityOfPage', None)
    site = nodes['WebSite']
    typ = {'semua': 'CollectionPage', 'tools': 'WebPage', 'tentang': 'AboutPage'}[page]
    web = {'@type': typ, '@id': SITE + URL[page] + '#webpage', 'url': SITE + URL[page], 'name': html.unescape(title), 'description': html.unescape(desc),
           'inLanguage': 'id-ID', 'isPartOf': {'@id': SITE + '/#website'}, 'about': {'@id': SITE + '/#creator'}, 'primaryImageOfPage': nodes['WebPage']['primaryImageOfPage']}
    return {'@context': jl['@context'], '@graph': [person, site, web]}

# ---------------------------------------------------------------- head
mon = '\n'.join(L[find_line(r'quge5\.com'):find_line(r'name="monetag"')+1])
THEME_INIT = '\n'.join(L[find_line(r"localStorage\.getItem\('ctfy_theme'\)")-3:find_line(r"localStorage\.getItem\('ctfy_theme'\)")+8])
def esc_attr(s): return html.escape(html.unescape(s), quote=True)
def head(page):
    title, desc = META[page]; url = SITE + URL[page]
    t = esc_attr(title); d = esc_attr(desc)
    og_img = SITE + '/assets/images/og-image.png'
    ld = json.dumps(ld_for(page, title, desc), indent=2, ensure_ascii=False)
    host_guard = (TPL / 'host-guard.js').read_text(encoding='utf-8').rstrip()
    leg = (TPL / 'legacy-redirect.js').read_text(encoding='utf-8').rstrip() if page == 'platform' else None
    parts = ['<!DOCTYPE html>', '<html lang="id">', '<head>', mon,
      '    <meta charset="UTF-8" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />',
      '    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />',
      '    <meta name="author" content="CTFY (imctfy)" />',
      '    <title>%s</title>' % t,
      '    <meta name="description" content="%s" />' % d,
      '    <meta name="theme-color" content="#F3F0E8" id="themeColorMeta" />',
      '    <meta name="mobile-web-app-capable" content="yes" />',
      '    <meta property="og:title" content="%s" />' % t, '    <meta property="og:description" content="%s" />' % d,
      '    <meta property="og:type" content="website" />', '    <meta property="og:image" content="%s" />' % og_img,
      '    <meta property="og:image:width" content="1200" />', '    <meta property="og:image:height" content="630" />',
      '    <meta property="og:image:alt" content="CTFY (imctfy) — Motion Graphic Creator &amp; Creative Resources" />',
      '    <meta property="og:url" content="%s" />' % url, '    <meta property="og:site_name" content="CTFY" />', '    <meta property="og:locale" content="id_ID" />',
      '    <meta name="twitter:card" content="summary_large_image" />', '    <meta name="twitter:title" content="%s" />' % t,
      '    <meta name="twitter:description" content="%s" />' % d, '    <meta name="twitter:image" content="%s" />' % og_img,
      '    <link rel="canonical" href="%s" />' % url,
      '    <link rel="icon" href="/favicon.ico" sizes="any" />', '    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
      '    <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32x32.png" />',
      '    <link rel="icon" type="image/png" sizes="16x16" href="/assets/images/favicon-16x16.png" />',
      '    <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/apple-touch-icon.png" />',
      '    <link rel="manifest" href="/site.webmanifest" />',
      '    <link rel="preconnect" href="https://fonts.googleapis.com" />', '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
      '    <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin />',
      THEME_INIT, '    <script>\n' + host_guard + '\n    </script>']
    if leg: parts.append('    <script>\n' + leg + '\n' + (TPL / 'legacy-redirect-index.js').read_text(encoding='utf-8').rstrip() + '\n    </script>')
    parts += ['    <script type="application/ld+json">\n' + ld + '\n    </script>', L[I_FONTS], L[I_FA], '    <link rel="stylesheet" href="/assets/style.css" />']
    scripts = []
    if page == 'semua': scripts.append('    <script defer src="https://cdn.jsdelivr.net/npm/fuse.js@7.0.0"></script>')
    for m in PAGE_MODS[page]: scripts.append('    <script defer src="/assets/%s.js"></script>' % m)
    scripts.append('    <script defer src="/assets/boot.js"></script>')
    if page != 'platform': scripts.append('    <script type="module" src="/assets/firebase-init.js"></script>')
    parts += scripts + ['</head>']
    return '\n'.join(parts)

# ---------------------------------------------------------------- halaman
SEO_INTRO = {'semua': '<p class="seo-intro">%s</p>' % esc_attr(META['semua'][1])}
def page_html(page):
    panel, n = pagify(PANELS[page], page)
    if page != 'platform': panel = panel.replace('class="tab-page"', 'class="tab-page active"', 1)
    if page == 'semua':
        panel = re.sub(r'<h2 class="section-title" id="librarySectionTitle">(.*?)</h2>', r'<h1 class="section-title" id="librarySectionTitle">\1</h1>', panel, count=1, flags=re.S)
        panel = panel.replace('<div class="asset-search-bar">', SEO_INTRO['semua'] + '\n                <div class="asset-search-bar">', 1)
    if page == 'tools':
        panel = panel.replace('<h2 class="hero-heading">Koleksi Tools</h2>', '<h1 class="hero-heading">Koleksi Tools</h1>', 1)
    if page == 'tentang':
        panel = re.sub(r'<h2 class="hero-heading">(Motion graphic &amp; creative resources, tanpa ribet\.)</h2>', r'<h1 class="hero-heading">\1</h1>', panel, count=1)
    header, _ = pagify(HEADER, page); footer, _ = pagify(FOOTER, page); dock, _ = pagify(DOCK, page)
    if '<span class="logo-mark" aria-hidden="true"></span>' not in header: die('logo-mark tidak ditemukan')
    header = header.replace('<span class="logo-mark" aria-hidden="true"></span>', '<img class="logo-mark" src="/favicon.svg" width="30" height="30" alt="" decoding="async" />')
    out = [head(page), '<body data-page="%s">' % page, '    <a class="skip-link" href="#main-content">Lewati ke konten utama</a>', header, '',
           '    <main id="main-content">', '        <div class="container">']
    if page != 'platform': out.append(ERROR_BANNER)
    out += ['', panel]
    if page != 'platform': out += ['', '            ' + SAFETY.strip()]
    out += ['        </div>', '    </main>', '', '    <!-- STREAMLINED COMPACT FOOTER -->', footer, '', '    <!-- FLOATING DOCK CONTAINER: NAVIGATION + DONATION -->', dock, '', SUPPORT]
    if page == 'semua': out += ['', WAPOP, '', MODAL]
    out += ['</body>', '</html>', '']
    text = '\n'.join(out)
    if 'switchTab(' in re.sub(r'<script.*?</script>', '', text, flags=re.S): die('switchTab inline tersisa di %s' % page)
    return text

# ---------------------------------------------------------------- 404
n404 = (SRC / '404.html').read_text(encoding='utf-8')
m404 = re.search(r'    <script>\n(?:(?!</script>).)*?rawPath(?:(?!</script>).)*?</script>\n', n404, re.S)
if not m404: die('blok skrip redirect 404.html tidak ditemukan')
n404 = n404.replace(m404.group(0), '    <script>\n' + (TPL / 'legacy-redirect.js').read_text(encoding='utf-8').rstrip() + '''
    (function () {
        try {
            var t = ctfyLegacyTarget(window.location.pathname, window.location.search, window.location.hash);
            if (t) window.location.replace(t);
        } catch (e) {}
    })();
    </script>
''')
_bm = '<span class="brand-mark" aria-hidden="true"></span>'
_bc = '        .brand-mark {\n            width: 10px;\n            height: 10px;\n            border-radius: 2px;\n            background: var(--accent);\n        }'
if _bm not in n404 or _bc not in n404: die('brand-mark 404 tidak ditemukan')
n404 = n404.replace(_bm, '<img class="brand-mark" src="/favicon.svg" width="24" height="24" alt="" />').replace(_bc, '        .brand-mark {\n            width: 24px;\n            height: 24px;\n            border-radius: 6px;\n        }')
n404 = n404.replace('<a class="secondary" href="/?tab=library">Library Asset</a>', '<a class="secondary" href="/library">Library Asset</a>')
n404 = n404.replace('<a class="secondary" href="/?tab=tools">Tools TikTok</a>', '<a class="secondary" href="/tools">Tools TikTok</a>\n            <a class="secondary" href="/tentang">Tentang CTFY</a>')

# ---------------------------------------------------------------- tulis
def w(path, text, mode='w'):
    p = OUT / path; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(text, encoding='utf-8')

if OUT.exists(): shutil.rmtree(OUT)
OUT.mkdir()
w('assets/style.css', css_out)
for m in MODS: w('assets/%s.js' % m, js_out[m])
w('assets/boot.js', boot); w('assets/firebase-init.js', '/* firebase-init.js — modul Firebase asli dari <head> index.html (dipindah byte-exact). */\n' + firebase_js)
for page, fn in (('platform', 'index.html'), ('semua', 'library.html'), ('tools', 'tools.html'), ('tentang', 'tentang.html')): w(fn, page_html(page))
w('404.html', n404)
for f in ['favicon.ico', 'favicon.svg', 'site.webmanifest', 'google47e7b1fe3d496965.html', 'pinterest-09ec2.html', 'sw.js', 'firebase-messaging-sw.js']:
    shutil.copy2(SRC / f, OUT / f)
shutil.copytree(SRC / 'assets' / 'images', OUT / 'assets' / 'images')
w('robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: https://ctfy.my.id/sitemap.xml\n')
w('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join('  <url><loc>%s</loc></url>\n' % (SITE + u) for u in URL.values()) + '</urlset>\n')
w('_headers', '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n')
w('_redirects', '''/index.html / 301
/library.html /library 301
/tools.html /tools 301
/tentang.html /tentang 301
/semua /library 301
/presets /library 301
/alat /tools 301
/analyzer /tools 301
/about /tentang 301
/dukung /tentang?support=1 301
/support /tentang?support=1 301
/donasi /tentang?support=1 301
/platform / 301
/home / 301
/beranda / 301
/tools/finder /tools?tool=finder 301
/tools/link-finder /tools?tool=finder 301
/tools/analyzer /tools?tool=analyzer 301
/library/:code /library?code=:code 301
''')
w('.assetsignore', '.DS_Store\nThumbs.db\n*.map\n*.bak\n')

manifest = {'blocks': [{'name': b['name'], 'kind': b['kind'], 'module': b['module'], 'orig_start': b['start'], 'orig_sha256': b['orig_sha'], 'patched': bool(b['patched'])} for b in blocks],
            'patches': PATCHES, 'stubs': STUBS, 'warn_unloaded_state_refs': WARN_STATE, 'page_modules': PAGE_MODS,
            'css_orig_sha256': sha(css_orig), 'meta': META, 'modules_sizes': {m: len(js_out[m].encode()) for m in MODS}}
(ROOT / 'baseline' / 'build_manifest.json').write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding='utf-8')
print('OK. modul:', {m: len(js_out[m]) for m in MODS}, '| patches:', [p[0] for p in PATCHES])
print('stubs:', {k: len(v) for k, v in STUBS.items()}, '| state-refs tak-termuat:', {k: v for k, v in WARN_STATE.items() if v})
