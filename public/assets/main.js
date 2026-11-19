/* main.js — Inti bersama semua halaman: konstanta, helper, toast, clipboard, tema, rute/navigasi, popup dukungan, FAQ, filter platform, event global.
   Dibangkitkan oleh scripts/build.py dari index.html asli (blok dipindah byte-exact; perubahan = daftar PATCH di FINAL_REPORT.md). */

        const firebaseConfig = null; // dikelola oleh modular Firebase module di <head>

        const WA_NUMBER = '6285648916476';
        const ORDER_EMAIL = 'myxrin2748@gmail.com';
        const WA_CHANNEL = 'https://whatsapp.com/channel/0029Vb7QGwsF1YlZl7PoIM0Z';
        const API_URL = 'https://script.google.com/macros/s/AKfycbxuS-JQt74F9nXakjAZexGcqZ8_m9SLgT2V2K5r4Ko2rKVr1tw8YCoLMcOgcpZZ1kBD/exec';
        const CACHE_KEY = 'ctfy_v94_data';
        const CACHE_TTL = 10 * 60 * 1000;
        const FAVORITES_KEY = 'ctfy_favorites';
        const DOWNLOADS_KEY = 'ctfy_downloads';
        const ITEMS_PER_PAGE = 20;
        let lastLibrarySig = '';
        let libraryDataVersion = 0;

        let allItems = [], favorites = new Set(), currentItem = null;
        let currentFilter = 'all', fuseInstance = null, searchTimer = null, currentTab = 'platform';
        let pendingLink = null, downloadSession = new Set(), isLoading = false;
        let sharedQuery = '';
        let libraryCurrentPage = 1, currentFilteredList = [];

        function esc(s){ if(s === null || s === undefined) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
        function sanitizeSafeUrl(raw, allowAlightSchemes = true) {
            if (!raw || typeof raw !== 'string') return '';
            const val = raw.trim();
            if (!val || val === '#' || val === '-') return '';
            if (val.startsWith('/') && !val.startsWith('//')) return val;
            if (val.startsWith('blob:')) return val;
            try {
                const parsed = new URL(val);
                const proto = parsed.protocol.toLowerCase();
                if (proto === 'https:' || proto === 'http:' || proto === 'mailto:') return parsed.href;
                if (allowAlightSchemes && proto === 'alightmotion:') return parsed.href;
            } catch (e) {}
            return '';
        }
        function isSafeYouTubeId(id) { return typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id); }
        function isSafeNumericId(id) { return typeof id === 'string' && /^\d+$/.test(id); }
        function escapeCssAttrVal(v) { return (window.CSS && typeof CSS.escape === 'function') ? CSS.escape(String(v)) : String(v).replace(/["\\]/g, '\\$&'); }
        function showToast(msg, dur=2500){
            document.querySelectorAll('.toast').forEach(t => {
                if (t._exitTimer) clearTimeout(t._exitTimer);
                if (t._rmTimer) clearTimeout(t._rmTimer);
                t.remove();
            });
            const t = document.createElement('div');
            t.className = 'toast';
            t.innerHTML = msg;
            document.body.appendChild(t);
            requestAnimationFrame(() => {
                if (t.isConnected) t.classList.add('show');
            });
            const stayMs = Math.max(300, dur - 240);
            t._exitTimer = setTimeout(() => {
                t.classList.remove('show');
                t._rmTimer = setTimeout(() => {
                    if (t.isConnected) t.remove();
                }, 260);
            }, stayMs);
        }

        function flashCopiedButton(btn, successLabel = 'Disalin') {
            let target = btn;
            if (!target && typeof window !== 'undefined' && window.event && window.event.target) {
                const evTarget = window.event.target;
                target = evTarget.closest ? evTarget.closest('button') : null;
            }
            if (!target) return;
            if (!target.dataset.origHtml) {
                target.dataset.origHtml = target.innerHTML;
            }
            if (target._copyTimer) clearTimeout(target._copyTimer);
            target.classList.add('is-copied');
            target.innerHTML = `<i class="fas fa-check"></i> <span>${esc(successLabel)}</span>`;
            target._copyTimer = setTimeout(() => {
                target.classList.remove('is-copied');
                if (target.dataset.origHtml !== undefined) {
                    target.innerHTML = target.dataset.origHtml;
                    delete target.dataset.origHtml;
                }
                target._copyTimer = null;
            }, 1500);
        }

        function setActiveCardHighlight(code) {
            document.querySelectorAll('.is-active-card').forEach(el => el.classList.remove('is-active-card'));
            if (!code) return;
            const norm = String(code).trim().toLowerCase();
            document.querySelectorAll('#cardGrid .card[data-code], #paidGrid .paid-card').forEach(el => {
                const c = (el.getAttribute('data-code') || el.querySelector('.copy-code-btn')?.getAttribute('data-code') || '').trim().toLowerCase();
                if (c && c === norm) el.classList.add('is-active-card');
            });
        }

        let motionRevealObserver = null;
        function prefersReducedMotion() {
            return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        }

        function initMotionReveals() {
            if (motionRevealObserver || !('IntersectionObserver' in window) || prefersReducedMotion()) return;
            motionRevealObserver = new IntersectionObserver((entries) => {
                let batchIdx = 0;
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    const el = entry.target;
                    el.style.setProperty('--reveal-delay', Math.min(batchIdx++, 4) * 35 + 'ms');
                    el.classList.remove('reveal-pending');
                    el.classList.add('is-visible');
                    motionRevealObserver.unobserve(el);
                });
            }, { threshold: 0.04, rootMargin: '0px 0px -16px 0px' });
        }

        function observeMotionReveals(container, opts = {}) {
            const root = container || document;
            const selector = opts.selector || '.platform-card, .tool-hub-card, .about-section, #cardGrid .card';
            const els = root.querySelectorAll ? root.querySelectorAll(selector) : [];
            if (!els.length) return;

            if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
                els.forEach(el => {
                    el.classList.remove('reveal-pending');
                    el.classList.add('reveal-item', 'is-visible');
                });
                return;
            }

            initMotionReveals();
            const vh = window.innerHeight || document.documentElement.clientHeight || 800;
            let visibleBatch = 0;

            els.forEach(el => {
                if (opts.reset) {
                    el.classList.remove('is-visible', 'reveal-pending');
                }
                if (el.classList.contains('is-visible') && !opts.reset) return;
                el.classList.add('reveal-item', 'reveal-pending');
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && rect.top < vh * 0.98 && rect.bottom > 0) {
                    el.style.setProperty('--reveal-delay', Math.min(visibleBatch++, 4) * 35 + 'ms');
                    requestAnimationFrame(() => {
                        el.classList.remove('reveal-pending');
                        el.classList.add('is-visible');
                    });
                    setTimeout(() => el.style.removeProperty('--reveal-delay'), 800);
                    if (motionRevealObserver) motionRevealObserver.unobserve(el);
                } else if (motionRevealObserver) {
                    motionRevealObserver.observe(el);
                }
            });
        }
        function showError(msg){ document.getElementById('errorMsg').textContent=msg; document.getElementById('errorBanner').style.display='flex'; }
        function hideError(){ document.getElementById('errorBanner').style.display='none'; }

        function triggerLogoPopAnimation(){
            const logo = document.getElementById('headerLogo');
            if(!logo) return;
            logo.classList.remove('is-animating');
            void logo.offsetWidth;
            logo.classList.add('is-animating');
            setTimeout(() => {
                if(logo) logo.classList.remove('is-animating');
            }, 900);
        }
        window.triggerLogoPopAnimation = triggerLogoPopAnimation;

        const TAG_MAP = {
            'Motion Graphic':['motion','animation','after effects'],
            'Template':['template','premiere pro'],
            'Sound Effect':['sfx','audio'],
            'Transition':['transition','glitch','cinematic'],
            'Logo':['logo','reveal','intro']
        };
        function getTags(item){
            let tags=[];
            const n=(item.Nama||'').toLowerCase();
            for(const[cat,ct] of Object.entries(TAG_MAP)){ if((item.Kategori||'').includes(cat)||n.includes(cat.toLowerCase())) tags.push(...ct); }
            if(n.includes('gaming')) tags.push('gaming');
            if(n.includes('velocity')) tags.push('velocity');
            return [...new Set(tags)].slice(0,4);
        }
        function safeCopyToClipboard(text, successToastHtml){
            if (!text && text !== 0) return Promise.resolve(false);
            const strText = String(text);

            try {
                if (typeof window.focus === 'function') window.focus();
            } catch(e){}

            function fallbackCopy(val){
                try {
                    const ta = document.createElement('textarea');
                    ta.value = val;
                    ta.setAttribute('readonly', '');
                    ta.style.position = 'fixed';
                    ta.style.left = '-9999px';
                    ta.style.top = (window.pageYOffset || document.documentElement.scrollTop || 0) + 'px';
                    ta.style.opacity = '0';
                    ta.style.pointerEvents = 'none';
                    document.body.appendChild(ta);
                    ta.focus({ preventScroll: true });
                    ta.select();
                    ta.setSelectionRange(0, val.length);
                    const successful = document.execCommand('copy');
                    document.body.removeChild(ta);
                    if (successful) {
                        if (successToastHtml) showToast(successToastHtml);
                        return true;
                    }
                } catch(err){
                    console.warn('Fallback copy failed:', err);
                }
                if (successToastHtml) showToast(successToastHtml);
                return false;
            }

            const canUseClipboardAPI = Boolean(
                navigator.clipboard && 
                typeof navigator.clipboard.writeText === 'function' && 
                document.hasFocus && 
                document.hasFocus()
            );

            if (canUseClipboardAPI) {
                return navigator.clipboard.writeText(strText)
                    .then(() => {
                        if (successToastHtml) showToast(successToastHtml);
                        return true;
                    })
                    .catch(() => {
                        return fallbackCopy(strText);
                    });
            } else {
                return Promise.resolve(fallbackCopy(strText));
            }
        }
        window.safeCopyToClipboard = safeCopyToClipboard;

        function copyCode(code, btn){
            flashCopiedButton(btn, esc(code));
            safeCopyToClipboard(code, '<i class="fas fa-copy" style="margin-right:6px;"></i> Kode <b>'+esc(code)+'</b> disalin!');
        }

        let currentModalSlide = 0;

        let pendingCardCode = null;

        function updateMetaDescription(text){
            const descMeta = document.querySelector('meta[name="description"]');
            if (descMeta && text) descMeta.setAttribute('content', text);
        }

        function updatePageTitle(tab, subTool = 'menu', itemName = null){
            if (itemName) {
                document.title = `${itemName} | CTFY (imctfy)`;
                updateMetaDescription(`Akses project file, preset, dan detail aset "${itemName}" dari CTFY (imctfy) di website resmi ctfy.my.id.`);
                return;
            }
            const cTab = getCanonicalTab(tab);
            // REFACTOR: judul/deskripsi tiap halaman statis di HTML; hanya sub-tool Tools dan modal item yang mengubahnya.
            if (cTab === 'tools' && subTool === 'finder') {
                document.title = 'TikTok Project Link Finder | CTFY (imctfy)';
                updateMetaDescription('Temukan tautan project Alight Motion langsung dari video TikTok menggunakan tools gratis di ctfy.my.id oleh CTFY (imctfy).');
            } else if (cTab === 'tools' && subTool === 'analyzer') {
                document.title = 'TikTok Video Analyzer | CTFY (imctfy)';
                updateMetaDescription('Periksa resolusi, aspect ratio, FPS, dan bitrate video TikTok langsung di browser lewat tools ctfy.my.id oleh CTFY (imctfy).');
            } else if (window.__ctfyPageMeta) {
                document.title = window.__ctfyPageMeta.title;
                updateMetaDescription(window.__ctfyPageMeta.desc);
            }
        }

        function getCanonicalTab(tab){
            if (!tab) return 'platform';
            const t = String(tab).toLowerCase().trim();
            if (t === 'semua' || t === 'asset' || t === 'aset' || t === 'library' || t === 'presets') return 'semua';
            if (t === 'tools' || t === 'alat' || t === 'analyzer') return 'tools';
            if (t === 'tentang' || t === 'about') return 'tentang';
            if (t === 'platform' || t === 'home' || t === 'beranda') return 'platform';
            return 'platform';
        }

        function buildAppUrl(tab, code = null, subTool = null){
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

        function parseCurrentRoute(){
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

        function handleRouteFromLocation(isInitial = false){
            const route = parseCurrentRoute();
            switchTab(route.tab, false, false);
            if (route.tab === 'tools') {
                switchToolsSubTab(route.subTool || 'menu', false, false);
            }
            if (route.openSupport) {
                toggleSupportPopup(true);
            }
            if (route.code) {
                if (allItems && allItems.length) {
                    openModalByCode(route.code, false, false);
                } else {
                    pendingCardCode = route.code;
                }
            } else {
                closeModal(false);
            }

            // If user arrived via an old clean path (e.g. /library or /tools) or hash,
            // normalize address bar to the safe parameter URL (e.g. /?tab=library)
            // so subsequent page refreshes never return HTTP 404 from static servers!
            if (isInitial && (route.fromPath || route.fromHash)) {
                try {
                    const safeUrl = buildAppUrl(route.tab, route.code, route.subTool);
                    window.history.replaceState({ tab: route.tab, subTool: route.subTool, code: route.code }, '', safeUrl);
                } catch(e) {}
            }
        }

        function openAssetFromURL(){
            if (pendingCardCode && allItems.length) {
                const codeToOpen = pendingCardCode;
                pendingCardCode = null;
                openModalByCode(codeToOpen, false, false);
                return;
            }
            const route = parseCurrentRoute();
            if (route.code && allItems.length) {
                openModalByCode(route.code, false, false);
            }
        }

        function switchTab(tab, updateUrl = true, pushHistory = true){
            const cTab = getCanonicalTab(tab);
            // REFACTOR: tab = halaman sendiri. Bila tab tujuan bukan halaman ini, pindah halaman.
            if (typeof ctfyPageTab === 'function' && cTab !== ctfyPageTab()) {
                window.location.assign(buildAppUrl(cTab));
                return;
            }
            currentTab = cTab;

            let targetId = 'tabPlatform';
            if (cTab === 'semua') targetId = 'tabSemua';
            else if (cTab === 'tools') targetId = 'tabTools';
            else if (cTab === 'tentang') targetId = 'tabTentang';
            else targetId = 'tabPlatform';

            const targetEl = document.getElementById(targetId) || document.getElementById('tabPlatform');

            // Hide other tab pages
            document.querySelectorAll('.tab-page').forEach(el => {
                if (el !== targetEl) {
                    el.classList.remove('active');
                }
            });
            document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
            document.querySelectorAll('.desktop-nav-btn').forEach(el=>el.classList.remove('active'));

            if (targetEl) {
                // If scrolled down, reset scroll position cleanly so the slide-up entrance begins from the top
                if (window.scrollY > 0) {
                    window.scrollTo(0, 0);
                }
                // Reset active and force reflow to reliably play the smooth fade-in and slide-up animation
                targetEl.classList.remove('active');
                void targetEl.offsetWidth;
                targetEl.classList.add('active');
            }

            const navBtn = document.querySelector(`.nav-item[data-tab="${cTab}"]`) ||
                           document.querySelector(`.nav-item[data-tab="${tab}"]`) ||
                           ((cTab === 'semua') ? document.getElementById('navItemLibrary') : null) ||
                           ((cTab === 'tools') ? document.getElementById('navItemTools') : null) ||
                           ((cTab === 'tentang') ? document.getElementById('navItemTentang') : null) ||
                           document.getElementById('navItemPlatform');
            if(navBtn) navBtn.classList.add('active');

            // Synchronize desktop nav
            const desktopNavBtn = document.querySelector(`.desktop-nav-btn[data-tab="${cTab}"]`);
            if(desktopNavBtn) desktopNavBtn.classList.add('active');

            const searchEl=document.getElementById('searchInput');
            const assetEl=document.getElementById('assetSearchInput');
            if(searchEl) searchEl.value=sharedQuery;
            if(assetEl) assetEl.value=sharedQuery;
            document.querySelectorAll('.asset-search-bar').forEach(bar => bar.classList.toggle('has-query', Boolean(sharedQuery && sharedQuery.trim())));
            if(cTab === 'tentang') {
                updateStats();
                initAboutFaq();
            }
            if(cTab === 'tools') {
                if (!currentToolsSubTab || currentToolsSubTab === 'menu') {
                    switchToolsSubTab('menu', false, false);
                }
            }
            if (targetEl) {
                observeMotionReveals(targetEl);
            }

            // Close modal if open without resetting URL
            const modal = document.getElementById('modal');
            if (modal && modal.style.display === 'flex') {
                closeModal(false);
            }

            updatePageTitle(cTab, currentToolsSubTab);
            if (updateUrl) {
                const targetUrl = buildAppUrl(cTab);
                const currentFull = window.location.pathname + window.location.search;
                if (currentFull !== targetUrl) {
                    if (pushHistory) {
                        window.history.pushState({ tab: cTab }, '', targetUrl);
                    } else {
                        window.history.replaceState({ tab: cTab }, '', targetUrl);
                    }
                }
            }
        }

        function scrollAboutSection(e, targetId){
            if(e && e.preventDefault) e.preventDefault();
            if(currentTab !== 'tentang') switchTab('tentang');
            const target = document.getElementById(targetId);
            if(!target) return;
            const headerOffset = 90;
            const elPos = target.getBoundingClientRect().top;
            const offsetPos = elPos + window.pageYOffset - headerOffset;
            window.scrollTo({ top: Math.max(0, offsetPos), behavior: 'smooth' });
        }

        // ============================================================
        // FAQ ACCORDION SYSTEM
        // ============================================================
        function initAboutFaq(){
            // Reserved hook for tab initialization
        }

        function toggleAboutFaq(btn){
            const item = btn.closest('.about-faq-item');
            if(!item) return;
            const wasActive = item.classList.contains('active');
            const answer = item.querySelector('.about-faq-answer');
            if(wasActive){
                item.classList.remove('active');
                if(answer) answer.style.maxHeight = '0px';
            } else {
                item.classList.add('active');
                if(answer) answer.style.maxHeight = (answer.scrollHeight + 40) + 'px';
            }
        }

        function setupTouchSafeChipScroll(container){
            if(!container) return;
            let isDown = false, startX = 0, scrollLeft = 0, hasDragged = false;
            let touchStartX = 0, touchStartY = 0, isTouchScrolling = false;

            // Desktop mouse drag
            container.addEventListener('mousedown', (e)=>{
                isDown = true;
                hasDragged = false;
                startX = e.pageX - container.offsetLeft;
                scrollLeft = container.scrollLeft;
                container.style.cursor = 'grabbing';
            });
            window.addEventListener('mouseup', ()=>{
                if(!isDown) return;
                isDown = false;
                if(container) container.style.cursor = 'grab';
            });
            container.addEventListener('mousemove', (e)=>{
                if(!isDown) return;
                e.preventDefault();
                const x = e.pageX - container.offsetLeft;
                const walk = (x - startX);
                if(Math.abs(walk) > 4) hasDragged = true;
                container.scrollLeft = scrollLeft - walk;
            });

            // Mobile touch sensitivity: detect horizontal/vertical scroll swipes
            container.addEventListener('touchstart', (e)=>{
                if(e.touches && e.touches.length === 1){
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].clientY;
                    isTouchScrolling = false;
                }
            }, { passive: true });

            container.addEventListener('touchmove', (e)=>{
                if(e.touches && e.touches.length === 1){
                    const diffX = Math.abs(e.touches[0].clientX - touchStartX);
                    const diffY = Math.abs(e.touches[0].clientY - touchStartY);
                    if(diffX > 6 || diffY > 6){
                        isTouchScrolling = true;
                    }
                }
            }, { passive: true });

            container.addEventListener('touchend', ()=>{
                if(isTouchScrolling){
                    setTimeout(()=>{ isTouchScrolling = false; }, 200);
                }
            }, { passive: true });

            // Capture phase click interceptor: prevent accidental chip clicks while scrolling
            container.addEventListener('click', (e)=>{
                if(hasDragged || isTouchScrolling){
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    hasDragged = false;
                    return false;
                }
            }, true);
        }

        function initPlatformFilter(){
            const searchInput = document.getElementById('platformSearchInput');
            const searchBar = searchInput ? searchInput.closest('.platform-search-bar') : null;
            const chips = document.querySelectorAll('#platformFilterChips [data-pfilter]');
            const cards = document.querySelectorAll('.platform-card');
            const scrollContainer = document.getElementById('platformChipsScroll');

            function filterCards(animateMatches = false){
                const q = (searchInput ? searchInput.value : '').toLowerCase().trim();
                if (searchBar) searchBar.classList.toggle('has-query', Boolean(q));
                const activeChip = document.querySelector('#platformFilterChips [data-pfilter].active');
                const cat = activeChip ? activeChip.dataset.pfilter : 'all';

                cards.forEach(card=>{
                    const title = (card.querySelector('.platform-name')?.textContent || '').toLowerCase();
                    const handle = (card.querySelector('.platform-handle')?.textContent || '').toLowerCase();
                    const desc = (card.querySelector('.platform-desc')?.textContent || '').toLowerCase();
                    const cardCat = card.dataset.cat || '';

                    const matchesQuery = !q || title.includes(q) || handle.includes(q) || desc.includes(q);
                    const matchesCat = cat === 'all' || cardCat === cat;
                    const shouldShow = matchesQuery && matchesCat;
                    const wasHidden = card.style.display === 'none';

                    card.style.display = shouldShow ? 'flex' : 'none';
                    if (shouldShow && (animateMatches || wasHidden)) {
                        card.classList.remove('reveal-pending', 'is-filtered-in');
                        card.classList.add('is-visible');
                        void card.offsetWidth;
                        card.classList.add('is-filtered-in');
                    }
                });
            }

            if(searchInput){
                searchInput.addEventListener('input', () => filterCards(false));
            }
            chips.forEach(chip=>{
                chip.addEventListener('click', ()=>{
                    chips.forEach(c=>c.classList.remove('active'));
                    chip.classList.add('active');
                    chip.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
                    filterCards(true);
                });
            });

            if(scrollContainer){
                setupTouchSafeChipScroll(scrollContainer);
            }
        }

        window.copyPlatformLink = function(url, name, btn){
            flashCopiedButton(btn, 'Disalin');
            safeCopyToClipboard(url, '<i class="fas fa-circle-check" style="color:var(--success);margin-right:6px;"></i> Link <b>'+esc(name)+'</b> disalin!');
        };

        function toggleToolDesc(toolKey){
            const descEl = document.getElementById(toolKey === 'analyzer' ? 'toolDescAnalyzer' : 'toolDescFinder');
            const btnEl = document.getElementById(toolKey === 'analyzer' ? 'btnToggleDescAnalyzer' : 'btnToggleDescFinder');
            if(!descEl || !btnEl) return;

            const isHidden = descEl.style.display === 'none';
            if(isHidden){
                descEl.style.display = 'block';
                descEl.classList.remove('is-open');
                void descEl.offsetWidth;
                descEl.classList.add('is-open');
                btnEl.setAttribute('aria-expanded', 'true');
                const textSpan = btnEl.querySelector('.toggle-text');
                if(textSpan) textSpan.textContent = 'Tutup deskripsi';
                const icon = btnEl.querySelector('.toggle-icon');
                if(icon) icon.className = 'fas fa-chevron-up toggle-icon';
            } else {
                descEl.classList.remove('is-open');
                descEl.style.display = 'none';
                btnEl.setAttribute('aria-expanded', 'false');
                const textSpan = btnEl.querySelector('.toggle-text');
                if(textSpan) textSpan.textContent = 'Selengkapnya';
                const icon = btnEl.querySelector('.toggle-icon');
                if(icon) icon.className = 'fas fa-chevron-down toggle-icon';
            }
        }
        window.toggleToolDesc = toggleToolDesc;

        function syncThemeMeta(isDark){
            const meta = document.getElementById('themeColorMeta');
            if(meta) meta.setAttribute('content', isDark ? '#191917' : '#F3F0E8');
        }

        function initTheme(){
            const saved = localStorage.getItem('ctfy_theme') || 'light';
            const toggleBtn = document.getElementById('themeToggle');
            const icon = toggleBtn ? toggleBtn.querySelector('i') : null;
            if (saved === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
                if (icon) icon.className = 'fas fa-sun';
                syncThemeMeta(true);
            } else {
                document.documentElement.removeAttribute('data-theme');
                if (icon) icon.className = 'fas fa-moon';
                syncThemeMeta(false);
            }
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    toggleBtn.classList.remove('is-toggling');
                    void toggleBtn.offsetWidth;
                    toggleBtn.classList.add('is-toggling');
                    setTimeout(() => toggleBtn.classList.remove('is-toggling'), 260);
                    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                    const ic = toggleBtn.querySelector('i');
                    if (isDark) {
                        document.documentElement.removeAttribute('data-theme');
                        localStorage.setItem('ctfy_theme', 'light');
                        if (ic) ic.className = 'fas fa-moon';
                        syncThemeMeta(false);
                    } else {
                        document.documentElement.setAttribute('data-theme', 'dark');
                        localStorage.setItem('ctfy_theme', 'dark');
                        if (ic) ic.className = 'fas fa-sun';
                        syncThemeMeta(true);
                    }
                });
            }
        }

        function handleDelegatedAction(e) {
            const target = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
            if (!target) return;
            const action = target.getAttribute('data-action');
            if (!action) return;

            if (action === 'toggle-fav') {
                e.stopPropagation();
                toggleFav(target.getAttribute('data-code') || '', e);
            } else if (action === 'copy-code') {
                e.stopPropagation();
                copyCode(target.getAttribute('data-code') || '', target);
            } else if (action === 'open-modal') {
                openModalByCode(target.getAttribute('data-code') || '');
            } else if (action === 'open-link') {
                e.stopPropagation();
                const url = target.getAttribute('data-url') || '';
                const code = target.getAttribute('data-code') || null;
                const skipDl = target.getAttribute('data-skip-dl') === '1';
                handleLinkClick(url, code, skipDl);
            } else if (action === 'open-ad') {
                e.stopPropagation();
                handleAdClick(target.getAttribute('data-code') || '', target.getAttribute('data-url') || '');
            } else if (action === 'copy-finder-url') {
                e.stopPropagation();
                copyFinderUrl(target.getAttribute('data-url') || '', target);
            } else if (action === 'save-am-project') {
                e.stopPropagation();
                saveAmProjectToStorage(target.getAttribute('data-url') || '', target.getAttribute('data-title') || 'Project Alight Motion', 'Tersimpan dari Hasil Analisis', 'finder');
            }
        }

        function initEvents(){
            document.addEventListener('click', handleDelegatedAction);
            document.addEventListener('keydown', (e) => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.hasAttribute && e.target.hasAttribute('data-action')) {
                    if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
                        e.preventDefault();
                        handleDelegatedAction(e);
                    }
                }
            });
            document.addEventListener('load', (e) => {
                const el = e.target;
                if (el && el.classList && el.classList.contains('card-media-img')) {
                    onMediaImageLoaded(el);
                }
            }, true);
            document.addEventListener('error', (e) => {
                const el = e.target;
                if (el && el.classList && el.classList.contains('card-media-img')) {
                    const fallback = el.getAttribute('data-yt-fallback');
                    if (fallback && !el.dataset.ytFallbackApplied) {
                        el.dataset.ytFallbackApplied = '1';
                        el.src = fallback;
                    } else {
                        markCardMediaFailed(el);
                    }
                }
            }, true);

            const searchInput = document.getElementById('searchInput');
            if(searchInput){
                searchInput.addEventListener('focus', function(){ switchTab('semua'); });
                searchInput.addEventListener('input',()=>{
                    document.querySelectorAll('.asset-search-bar').forEach(b => b.classList.toggle('has-query', Boolean(searchInput.value.trim())));
                    clearTimeout(searchTimer); searchTimer=setTimeout(applyFilters,250);
                });
            }
            const assetSearchInput = document.getElementById('assetSearchInput');
            if(assetSearchInput) assetSearchInput.addEventListener('input',()=>{
                document.querySelectorAll('.asset-search-bar').forEach(b => b.classList.toggle('has-query', Boolean(assetSearchInput.value.trim())));
                clearTimeout(searchTimer); searchTimer=setTimeout(applyFilters,250);
            });
            const resetBtn = document.getElementById('resetFiltersBtn');
            if(resetBtn) resetBtn.addEventListener('click',resetFilters);
            /* REFACTOR: navigasi memakai <a href> asli; listener tombol-tab dihapus */
            document.querySelectorAll('.fav-chip').forEach(btn=>btn.addEventListener('click',()=>{ currentFilter=currentFilter==='fav'?'all':'fav'; applyFilters(); }));
            document.querySelectorAll('.chip[data-filter]').forEach(chip=>chip.addEventListener('click',()=>{
                if(chip.dataset.filter===currentFilter) return;
                currentFilter=chip.dataset.filter;
                chip.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
                applyFilters();
            }));

            const libScroll = document.getElementById('libraryChipsScroll');
            if(libScroll){
                setupTouchSafeChipScroll(libScroll);
            }
            initPlatformFilter();
            window.addEventListener('popstate', () => {
                handleRouteFromLocation(false);
            });
            document.addEventListener('keydown',e=>{
                if(e.key==='Escape') {
                    closeModal();
                    toggleSupportPopup(false);
                    hideWAPopup();
                }
                if((document.getElementById('modal')||{style:{}}).style.display==='flex'){
                    if(e.key==='ArrowRight') setModalSlide(currentModalSlide + 1);
                    if(e.key==='ArrowLeft') setModalSlide(currentModalSlide - 1);
                }
                if(e.key==='/'&&document.activeElement!==document.getElementById('searchInput')&&document.activeElement!==document.getElementById('assetSearchInput')&&document.activeElement!==document.getElementById('platformSearchInput')&&document.activeElement?.tagName!=='INPUT'){
                    e.preventDefault();
                    const targetSearch = (currentTab==='platform') ? document.getElementById('platformSearchInput') :
                                         document.getElementById('assetSearchInput');
                    if(targetSearch) targetSearch.focus();
                }
            });
        }

        let supportCloseTimer = null;
        function toggleSupportPopup(show){
            const popup = document.getElementById('supportPopup');
            if (!popup) return;
            const shouldOpen = show === undefined ? !(popup.classList.contains('open') || popup.style.display === 'flex') : !!show;
            if (shouldOpen) {
                if (supportCloseTimer) { clearTimeout(supportCloseTimer); supportCloseTimer = null; }
                popup.style.display = 'flex';
                requestAnimationFrame(() => {
                    popup.classList.add('open');
                });
                document.body.style.overflow = 'hidden';
            } else {
                popup.classList.remove('open');
                if (supportCloseTimer) clearTimeout(supportCloseTimer);
                supportCloseTimer = setTimeout(() => {
                    if (!popup.classList.contains('open')) popup.style.display = 'none';
                    supportCloseTimer = null;
                }, 240);
                document.body.style.overflow = '';
            }
        }

        function copyDanaNumber(e){
            const number = '085648916476';
            safeCopyToClipboard(number, '<i class="fas fa-circle-check" style="color:#10b981;margin-right:6px;"></i> Nomor DANA disalin: ' + number);
            
            const targetBtn = (e && e.currentTarget) ? e.currentTarget : document.getElementById('danaCopyBtn');
            if (targetBtn) {
                const originalHtml = targetBtn.innerHTML;
                targetBtn.classList.add('copied');
                targetBtn.innerHTML = '<i class="fas fa-check"></i> <span>Tersalin!</span>';
                setTimeout(function(){
                    targetBtn.classList.remove('copied');
                    targetBtn.innerHTML = originalHtml;
                }, 2000);
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
            initModalSwipeGestures();
            initAboutFaq();
            const floatBtn = document.getElementById('floatingSupportBtn');
            if (floatBtn) {
                floatBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    toggleSupportPopup(true);
                });
            }
            const closeBtn = document.getElementById('closeSupportPopup');
            if (closeBtn) closeBtn.addEventListener('click', function() { toggleSupportPopup(false); });
            const supportPopup = document.getElementById('supportPopup');
            if (supportPopup) supportPopup.addEventListener('click', function(e) { if (e.target === this) toggleSupportPopup(false); });
        });

        // ============================================================
        // CLIENT-SIDE TIKTOK & VIDEO METADATA ANALYZER ENGINE
        // (Runs 100% in browser, zero server.js dependency)
        // ============================================================
        let currentToolsSubTab = 'menu';
        window.copyCode=copyCode;
        window.switchTab=switchTab;
        window.toggleSupportPopup=toggleSupportPopup;
        window.handleRouteFromLocation=handleRouteFromLocation;
        window.parseCurrentRoute=parseCurrentRoute;
        window.buildAppUrl=buildAppUrl;
        window.copyDanaNumber=copyDanaNumber;
        window.scrollAboutSection=scrollAboutSection;
        window.toggleAboutFaq=toggleAboutFaq;

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
