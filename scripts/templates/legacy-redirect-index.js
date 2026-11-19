(function () {
    try {
        var p = window.location.pathname;
        if (p !== '/' && p !== '/index.html') return;
        var t = ctfyLegacyTarget(p, window.location.search, window.location.hash);
        if (t) window.location.replace(t);
    } catch (e) {}
})();
