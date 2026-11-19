(function () {
    try {
        var targetHost = 'ctfy.my.id';
        var h = (window.location.hostname || '').toLowerCase();
        var p = window.location.protocol;
        var lan = /^192\.168\.\d+\.\d+$/.test(h) || /^10\.\d+\.\d+\.\d+$/.test(h) || /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(h);
        var local = h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1' || /\.(local|internal)$/.test(h) || lan || p === 'file:';
        // .workers.dev / .pages.dev dikecualikan agar preview deployment bisa diuji (perubahan tercatat: K-T05)
        var preview = /\.(run\.app|google\.com|googleusercontent\.com|workers\.dev|pages\.dev)$/.test(h);
        if (local || preview) return;
        if (h !== targetHost || p !== 'https:') {
            var u = new URL(window.location.href);
            u.protocol = 'https:';
            u.hostname = targetHost;
            u.port = '';
            window.location.replace(u.toString());
        }
    } catch (err) {
        console.warn('Canonical domain redirect check:', err);
    }
})();
