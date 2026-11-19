#!/usr/bin/env node
/* serve_local.js — server statis lokal yang MENIRU perilaku Workers Static Assets (html_handling auto-trailing-slash, 404-page,
   _redirects). Ini EMULASI: perilaku nyata Cloudflare tetap harus diverifikasi di preview URL. Pakai: node scripts/serve_local.js [port] */
const http = require('http'), fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'public'), PORT = +process.argv[2] || 8787;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
const rules = fs.readFileSync(path.join(PUB, '_redirects'), 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => { const [from, to, code] = l.split(/\s+/); return { from, to, code: +code || 302 }; });
const hdrs = fs.readFileSync(path.join(PUB, '_headers'), 'utf8');
const extraHeaders = {}; hdrs.split('\n').forEach(l => { const m = l.match(/^\s+([\w-]+):\s*(.+)$/); if (m) extraHeaders[m[1]] = m[2]; });
function applyRedirect(p) {
    for (const r of rules) {
        const names = []; const re = new RegExp('^' + r.from.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
        const m = p.match(re); if (m) { let to = r.to; names.forEach((n, i) => { to = to.replace(':' + n, m[i + 1]); }); return { to, code: r.code }; }
    }
    return null;
}
http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); let p = u.pathname; const send = (code, body, type, extra) => { res.writeHead(code, Object.assign({ 'Content-Type': type || 'text/html; charset=utf-8' }, extraHeaders, extra || {})); res.end(body); };
    const rd = applyRedirect(p); if (rd) { const to = rd.to.includes('?') ? rd.to : rd.to + u.search; return send(rd.code, '', null, { Location: to }); }
    let file = null;
    if (p === '/') file = 'index.html';
    else if (/\.html$/.test(p) && fs.existsSync(path.join(PUB, p))) { return send(308, '', null, { Location: p.replace(/\.html$/, '') + u.search }); }
    else if (fs.existsSync(path.join(PUB, p)) && fs.statSync(path.join(PUB, p)).isFile()) file = p.slice(1);
    else if (fs.existsSync(path.join(PUB, p.replace(/\/$/, '') + '.html'))) file = p.replace(/^\/|\/$/g, '') + '.html';
    if (!file) return send(404, fs.readFileSync(path.join(PUB, '404.html')));
    send(200, fs.readFileSync(path.join(PUB, file)), MIME[path.extname(file)] || 'application/octet-stream');
}).listen(PORT, () => console.log('emulasi lokal di http://localhost:' + PORT));
