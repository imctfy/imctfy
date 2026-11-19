/* Alihkan URL lama (SPA ?tab=, ?code=, ?tool=, ?p=, #hash, /library/KODE, dst.) ke clean URL baru. */
function ctfyLegacyTarget(pathname, search, hash) {
    var PAGES = { platform: '/', semua: '/library', tools: '/tools', tentang: '/tentang' };
    function canon(t) {
        t = String(t || '').toLowerCase().trim();
        if (/^(semua|asset|aset|library|presets)$/.test(t)) return 'semua';
        if (/^(tools|alat|analyzer)$/.test(t)) return 'tools';
        if (/^(tentang|about)$/.test(t)) return 'tentang';
        return 'platform';
    }
    function sub(s) {
        s = String(s || '').toLowerCase();
        if (/^(finder|link-finder|tiktok-finder)$/.test(s)) return 'finder';
        if (/^(analyzer|video-analyzer)$/.test(s)) return 'analyzer';
        return null;
    }
    function dec(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
    var path = String(pathname || '/').replace(/\/index\.html$/i, '');
    if (path.length > 1) path = path.replace(/\/+$/, '');
    if (!path) path = '/';
    var sp = new URLSearchParams(search || '');
    var tab = null, code = null, tool = null, support = false, m;

    // 1. Parameter query (?tab=, ?code=, ?tool=, ?p=)
    var qp = sp.get('p') || sp.get('page'), pTab = null, pSub = null, pCode = null;
    if (qp) {
        var pn = (qp.charAt(0) === '/' ? qp : '/' + qp).replace(/\/index\.html$/i, '').replace(/\/+$/, '');
        if (/^\/(library|semua|presets)$/i.test(pn)) pTab = 'semua';
        else if (/^\/tools\/(link-finder|finder)$/i.test(pn)) { pTab = 'tools'; pSub = 'finder'; }
        else if (/^\/tools\/analyzer$/i.test(pn)) { pTab = 'tools'; pSub = 'analyzer'; }
        else if (pn === '/tools') pTab = 'tools';
        else if (/^\/(tentang|about)$/i.test(pn)) pTab = 'tentang';
        else if (/^\/(dukung|support|donasi)$/i.test(pn)) { pTab = 'tentang'; support = true; }
        else if (pn === '/platform') pTab = 'platform';
        m = pn.match(/^\/(?:library|semua|presets|platform)\/([^\/?#]+)/i);
        if (m && m[1] !== 'index.html') pCode = dec(m[1]);
    }
    var qTab = sp.get('tab') || pTab;
    var qCode = sp.get('code') || sp.get('id') || sp.get('c') || pCode;
    var qSub = sp.get('tool') || sp.get('sub') || sp.get('subTool') || pSub;
    var from = null;
    if (qTab || qCode || qSub) {
        var supp = /^(dukung|support|donasi)$/i.test(String(qTab || '').trim());
        tab = supp ? 'tentang' : (qTab ? canon(qTab) : (qSub ? 'tools' : (qCode ? 'semua' : 'platform')));
        support = support || supp;
        code = qCode ? String(qCode).trim() : null;
        tool = sub(qSub);
        from = 'query';
    }
    // 2. Hash (#library, #/tools/finder, #code=AM01, #AM01)
    if (!from) {
        var hr = String(hash || '').replace(/^#\/?/, '').trim();
        if (hr && hr !== 'main-content') {
            var hp = null;
            if (hr.indexOf('=') !== -1) { try { hp = new URLSearchParams(hr); } catch (e) { hp = null; } }
            var hTab = hp && (hp.get('tab') || hp.get('page')), hCode = hp && (hp.get('code') || hp.get('id')), hSub = hp && (hp.get('tool') || hp.get('sub'));
            if (hTab || hCode || hSub) {
                tab = hTab ? canon(hTab) : (hSub ? 'tools' : 'semua');
                code = hCode ? String(hCode).trim() : null; tool = sub(hSub); from = 'hash';
            } else if ((m = hr.match(/^(?:library|platform)\/([^\/?#]+)/i))) { tab = 'semua'; code = dec(m[1]).trim(); from = 'hash'; }
            else if (/^(library|semua|presets|aset|asset)$/i.test(hr)) { tab = 'semua'; from = 'hash'; }
            else if (/^(link-finder|finder|tiktok-finder)$/i.test(hr)) { tab = 'tools'; tool = 'finder'; from = 'hash'; }
            else if (/^(analyzer|video-analyzer)$/i.test(hr)) { tab = 'tools'; tool = 'analyzer'; from = 'hash'; }
            else if (/^(tools|alat)$/i.test(hr)) { tab = 'tools'; from = 'hash'; }
            else if (/^(tentang|about)$/i.test(hr)) { tab = 'tentang'; from = 'hash'; }
            else if (/^(dukung|support|donasi)$/i.test(hr)) { tab = 'tentang'; support = true; from = 'hash'; }
            else if (/^(platform|home|beranda)$/i.test(hr)) { tab = 'platform'; from = 'hash'; }
            else if (hr.length >= 2 && hr.indexOf('/') === -1 && hr.indexOf('=') === -1) { tab = 'semua'; code = dec(hr).trim(); from = 'hash'; }
        }
    }
    // 3. Path lama (dipakai oleh 404.html): /library/KODE, /semua, /alat, /about, /dukung, ...
    if (!from && path !== '/') {
        if ((m = path.match(/^\/(?:library|semua|presets|platform)\/([^\/?#]+)/i)) && m[1] !== 'index.html') { tab = 'semua'; code = dec(m[1]).trim(); from = 'path'; }
        else if (/^\/(semua|presets)$/i.test(path)) { tab = 'semua'; from = 'path'; }
        else if (/^\/(tools|alat)\/(link-finder|finder|tiktok-link-finder|tiktok-finder)/i.test(path)) { tab = 'tools'; tool = 'finder'; from = 'path'; }
        else if (/^\/(tools|alat)\/(analyzer|video-analyzer)/i.test(path)) { tab = 'tools'; tool = 'analyzer'; from = 'path'; }
        else if (/^\/(alat|analyzer)$/i.test(path)) { tab = 'tools'; from = 'path'; }
        else if (/^\/about$/i.test(path)) { tab = 'tentang'; from = 'path'; }
        else if (/^\/(dukung|support|donasi)$/i.test(path)) { tab = 'tentang'; support = true; from = 'path'; }
        else if (/^\/(platform|home|beranda)$/i.test(path)) { tab = 'platform'; from = 'path'; }
    }
    if (!from) return null;
    if (code) tab = 'semua';   // modal item hanya ada di halaman Library
    var qs = new URLSearchParams();
    if (tab === 'semua' && code) qs.set('code', code);
    if (tab === 'tools' && tool) qs.set('tool', tool);
    if (tab === 'tentang' && support) qs.set('support', '1');
    var q = qs.toString();
    var target = PAGES[tab] + (q ? '?' + q : '');
    if (target === path + (search || '')) return null;
    return target;
}
