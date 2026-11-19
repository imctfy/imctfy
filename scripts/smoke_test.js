#!/usr/bin/env node
/* smoke_test.js — uji asap dengan DOM tiruan (BUKAN browser nyata): memuat skrip tiap halaman sesuai urutan di HTML,
   menjalankan boot + event dasar, dan melaporkan ReferenceError/TypeError. Status hasil: PASS-LOKAL. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const PUB = process.env.PUB || path.join(__dirname, '..', 'public');
const PAGES = { 'index.html': 'platform', 'library.html': 'semua', 'tools.html': 'tools', 'tentang.html': 'tentang' };
const SAMPLE = [{ Kode: 'AM01', Nama: 'Preset Uji', Kategori: 'Preset', Link: 'https://example.com/x', Preview: 'https://example.com/p.jpg', Harga: '', Downloads: 0 }];

function runPage(file, scenario, search) {
    const html = fs.readFileSync(path.join(PUB, file), 'utf8');
    const page = PAGES[file];
    const ids = new Set([...html.matchAll(/\bid="([^"$]+)"/g)].map(m => m[1]));
    const errors = [], navs = [], listeners = {};
    const mkEl = (id) => {
        const store = { id, style: {}, dataset: {}, innerHTML: '', textContent: '', value: '', children: [], tagName: 'DIV', offsetWidth: 0, offsetHeight: 0, scrollLeft: 0, classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } } };
        return new Proxy(store, {
            get(t, p) {
                if (p in t) return t[p];
                if (typeof p === 'symbol') return undefined;
                if (p === 'querySelectorAll') return () => [];
                if (p === 'getBoundingClientRect') return () => ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 });
                if (p === 'getAttribute' || p === 'closest' || p === 'hasAttribute' || p === 'querySelector' || p === 'matches') return () => null;
                if (/^(add|remove|append|insert|scroll|focus|blur|click|dispatch|reset|select|play|pause|load|set|replace|before|after|prepend|toggle)/.test(p)) return () => undefined;
                return undefined;
            }, set(t, p, v) { t[p] = v; return true; }
        });
    };
    const cache = {};
    const getEl = (id) => ids.has(id) ? (cache[id] = cache[id] || mkEl(id)) : null;
    const storage = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() }; };
    const body = mkEl('body'); body.getAttribute = (n) => n === 'data-page' ? page : null; body.hasAttribute = (n) => n === 'data-page';
    const metaDesc = mkEl('metaDesc'); let descVal = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || ''; metaDesc.getAttribute = () => descVal; metaDesc.setAttribute = (k, v) => { descVal = v; };
    const doc = {
        getElementById: getEl, body, documentElement: mkEl('html'), title: (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '', readyState: 'loading', hidden: false,
        querySelector: (s) => { if (s === 'meta[name="description"]') return metaDesc; const m = s.match(/^#([\w-]+)$/); return m ? getEl(m[1]) : null; },
        querySelectorAll: () => [], createElement: () => mkEl('new'), createTextNode: () => mkEl('t'), head: mkEl('head'), activeElement: null,
        addEventListener: (t, f) => { (listeners['doc:' + t] = listeners['doc:' + t] || []).push(f); }, removeEventListener() {}, execCommand: () => false,
    };
    const loc = { pathname: '/', search: search || '', hash: '', href: 'https://ctfy.my.id/', hostname: 'ctfy.my.id', protocol: 'https:', origin: 'https://ctfy.my.id', assign: u => navs.push(['assign', u]), replace: u => navs.push(['replace', u]) };
    const sb = {
        console: { log() {}, warn() {}, info() {}, error: (...a) => errors.push(a.map(x => (x && x.stack) ? x.stack.split('\n').slice(0, 2).join(' | ') : String(x)).join(' ')) },
        URL, URLSearchParams, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, Promise, TextEncoder, TextDecoder, Blob: function () {}, FileReader: function () {}, Image: function () { return mkEl('img'); },
        document: doc, location: loc, history: { pushState: (...a) => navs.push(['pushState', a[2]]), replaceState: (...a) => navs.push(['replaceState', a[2]]), state: null },
        localStorage: storage(), sessionStorage: storage(), navigator: { clipboard: { writeText: async () => {} }, userAgent: 'node-smoke', share: undefined, language: 'id' },
        requestAnimationFrame: f => setTimeout(f, 0), cancelAnimationFrame() {}, IntersectionObserver: function () { this.observe = () => {}; this.disconnect = () => {}; this.unobserve = () => {}; },
        ResizeObserver: function () { this.observe = () => {}; this.disconnect = () => {}; }, MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
        matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }), CSS: { escape: s => s }, getComputedStyle: () => ({ getPropertyValue: () => '' }),
        scrollTo() {}, addEventListener: (t, f) => { (listeners['win:' + t] = listeners['win:' + t] || []).push(f); }, removeEventListener() {}, dispatchEvent() {}, CustomEvent: function () {}, Event: function () {},
        fetch: scenario === 'ok' ? async () => ({ ok: true, status: 200, json: async () => SAMPLE, text: async () => JSON.stringify(SAMPLE) }) : async () => { throw new Error('offline'); },
        pageYOffset: 0, scrollY: 0, innerWidth: 1200, innerHeight: 800, open() {}, alert() {}, confirm: () => false, prompt: () => null,
    };
    sb.window = sb; sb.self = sb; sb.globalThis = sb;
    vm.createContext(sb);
    const scripts = [...html.matchAll(/<script defer src="\/assets\/([\w-]+\.js)"><\/script>/g)].map(m => m[1]);
    for (const s of scripts) {
        try { vm.runInContext(fs.readFileSync(path.join(PUB, 'assets', s), 'utf8'), sb, { filename: s }); }
        catch (e) { errors.push('LOAD ' + s + ': ' + (e.stack || e).split('\n').slice(0, 2).join(' | ')); }
    }
    return new Promise(res => setTimeout(() => {
        const fire = (key, ev) => (listeners[key] || []).forEach(f => { try { f(ev); } catch (e) { errors.push(key + ': ' + String(e.stack || e).split('\n').slice(0, 2).join(' | ')); } });
        doc.readyState = 'complete';
        fire('doc:DOMContentLoaded', {});
        fire('doc:keydown', { key: 'Escape', target: mkEl('x') }); fire('doc:keydown', { key: '/', target: mkEl('x'), preventDefault() {} }); fire('doc:keydown', { key: 'ArrowRight', target: mkEl('x') });
        fire('doc:click', { target: mkEl('x'), stopPropagation() {} });
        // navigasi lintas halaman
        const before = navs.length;
        try { sb.switchTab('semua'); sb.switchTab('tools'); sb.switchTab('tentang'); sb.switchTab('platform'); } catch (e) { errors.push('switchTab: ' + e.message); }
        const navTo = navs.slice(before).map(n => n[0] + ':' + n[1]);
        try { sb.toggleSupportPopup(true); sb.toggleSupportPopup(false); } catch (e) { errors.push('toggleSupportPopup: ' + e.message); }
        try { sb.openModalByCode('AM01'); sb.closeModal(); } catch (e) { errors.push('modal: ' + e.message); }
        setTimeout(() => res({ file, scenario, errors, navTo, bootNavs: navs.slice(0, before).map(n => n[0] + ':' + n[1]) }), 80);
    }, 120));
}
(async () => {
    let fail = 0;
    const cases = [['ok', ''], ['offline', ''], ['ok', '?code=AM01'], ['ok', '?tool=finder'], ['ok', '?tool=analyzer'], ['ok', '?support=1']];
    for (const f of Object.keys(PAGES)) for (const [sc, q] of cases) {
        if (q === '?code=AM01' && f !== 'library.html') continue;
        if ((q === '?tool=finder' || q === '?tool=analyzer') && f !== 'tools.html') continue;
        if (q === '?support=1' && f !== 'tentang.html') continue;
        const r = await runPage(f, sc, q);
        const ok = r.errors.length === 0; if (!ok) fail++;
        console.log((ok ? 'PASS-LOKAL ' : 'FAIL       ') + f.padEnd(13) + sc.padEnd(8) + (q || '(tanpa query)').padEnd(16) + (r.navTo.length ? ' nav=' + r.navTo.join(',') : ''));
        r.errors.slice(0, 4).forEach(e => console.log('     ! ' + e.slice(0, 260)));
    }
    console.log(fail ? 'TOTAL GAGAL: ' + fail : 'SEMUA SKENARIO LOLOS (PASS-LOKAL, DOM tiruan)');
    process.exit(fail ? 1 : 0);
})();
