#!/usr/bin/env node
/* Uji fungsi ctfyLegacyTarget (diambil dari scripts/templates/legacy-redirect.js) terhadap URL lama. PASS-LOKAL. */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'templates', 'legacy-redirect.js'), 'utf8');
const ctfyLegacyTarget = new Function(src + '\nreturn ctfyLegacyTarget;')();
const T = (p, s, h) => ctfyLegacyTarget(p, s || '', h || '');
const cases = [
  ['/', '?tab=library', '', '/library'], ['/', '?tab=semua', '', '/library'], ['/', '?tab=presets', '', '/library'],
  ['/', '?tab=tools', '', '/tools'], ['/', '?tab=tools&tool=finder', '', '/tools?tool=finder'], ['/', '?tab=tools&tool=analyzer', '', '/tools?tool=analyzer'],
  ['/', '?tool=finder', '', '/tools?tool=finder'], ['/', '?tab=tentang', '', '/tentang'], ['/', '?tab=about', '', '/tentang'],
  ['/', '?tab=dukung', '', '/tentang?support=1'], ['/', '?tab=platform', '', '/'], ['/', '?tab=home', '', '/'],
  ['/', '?code=AM01', '', '/library?code=AM01'], ['/', '?tab=library&code=AM01', '', '/library?code=AM01'], ['/', '?id=AM01', '', '/library?code=AM01'],
  ['/', '?tab=platform&code=AM01', '', '/library?code=AM01'], ['/', '?p=/library/AM01', '', '/library?code=AM01'], ['/', '?p=/tools/finder', '', '/tools?tool=finder'],
  ['/', '', '#library', '/library'], ['/', '', '#/library', '/library'], ['/', '', '#library/AM01', '/library?code=AM01'], ['/', '', '#code=AM01', '/library?code=AM01'],
  ['/', '', '#tab=tools&tool=finder', '/tools?tool=finder'], ['/', '', '#finder', '/tools?tool=finder'], ['/', '', '#analyzer', '/tools?tool=analyzer'],
  ['/', '', '#tentang', '/tentang'], ['/', '', '#dukung', '/tentang?support=1'], ['/', '', '#AM01', '/library?code=AM01'], ['/', '', '#main-content', null],
  ['/', '?utm_source=tiktok', '', null], ['/', '', '', null], ['/index.html', '?tab=tools', '', '/tools'],
  ['/library/AM01', '', '', '/library?code=AM01'], ['/semua', '', '', '/library'], ['/alat', '', '', '/tools'], ['/alat/analyzer', '', '', '/tools?tool=analyzer'],
  ['/tools/link-finder', '', '', '/tools?tool=finder'], ['/about', '', '', '/tentang'], ['/dukung', '', '', '/tentang?support=1'], ['/home', '', '', '/'],
  ['/halaman-ngawur', '', '', null], ['/library', '', '', null],
];
let fail = 0;
for (const [p, s, h, exp] of cases) {
  const got = T(p, s, h);
  const ok = got === exp; if (!ok) fail++;
  console.log((ok ? 'PASS-LOKAL ' : 'FAIL       ') + (p + s + h).padEnd(34) + ' -> ' + String(got).padEnd(26) + (ok ? '' : ' (harusnya ' + exp + ')'));
}
console.log(fail ? 'TOTAL GAGAL: ' + fail : 'SEMUA ' + cases.length + ' KASUS LOLOS (PASS-LOKAL)');
process.exit(fail ? 1 : 0);
