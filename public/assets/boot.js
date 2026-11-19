/* boot.js — inisialisasi per halaman (menggantikan blok pemanggilan di akhir <script> inline asli).
   Dibangkitkan oleh scripts/build.py. Kode baru. */
(function () {
    var PAGE = document.body.getAttribute('data-page') || 'platform';
    // Stub no-op untuk fungsi modul yang tidak dimuat di halaman ini (dipanggil dari handler global yang dipakai bersama).
    var STUBS = {
  "platform": [
    "applyFilters",
    "closeModal",
    "copyFinderUrl",
    "handleAdClick",
    "handleLinkClick",
    "hideWAPopup",
    "initModalSwipeGestures",
    "loadData",
    "markCardMediaFailed",
    "onMediaImageLoaded",
    "openModalByCode",
    "renderAll",
    "renderCtfyPresetsFinder",
    "resetFilters",
    "saveAmProjectToStorage",
    "setModalSlide",
    "switchToolsSubTab",
    "toggleFav",
    "updateStats"
  ],
  "semua": [
    "copyFinderUrl",
    "renderCtfyPresetsFinder",
    "saveAmProjectToStorage",
    "switchToolsSubTab"
  ],
  "tools": [
    "applyFilters",
    "closeModal",
    "handleAdClick",
    "handleLinkClick",
    "hideWAPopup",
    "initModalSwipeGestures",
    "markCardMediaFailed",
    "onMediaImageLoaded",
    "openModalByCode",
    "renderAll",
    "renderFeatured",
    "resetFilters",
    "setModalSlide",
    "toggleFav"
  ],
  "tentang": [
    "applyFilters",
    "closeModal",
    "copyFinderUrl",
    "handleAdClick",
    "handleLinkClick",
    "hideWAPopup",
    "initModalSwipeGestures",
    "markCardMediaFailed",
    "onMediaImageLoaded",
    "openModalByCode",
    "renderAll",
    "renderCtfyPresetsFinder",
    "renderFeatured",
    "resetFilters",
    "saveAmProjectToStorage",
    "setModalSlide",
    "switchToolsSubTab",
    "toggleFav"
  ]
};
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
