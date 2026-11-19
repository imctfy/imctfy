/* catalog.js — Lapisan data katalog (Apps Script + cache), normalisasi item, counter unduhan Firebase, statistik. Dipakai halaman Library, Tools, Tentang.
   Dibangkitkan oleh scripts/build.py dari index.html asli (blok dipindah byte-exact; perubahan = daftar PATCH di FINAL_REPORT.md). */

        function isComingSoon(item){ const t=(item.Tanggal||'').toString().toLowerCase().trim(); return t==='comingsoon'||t==='coming soon'||t==='coming_soon'; }
        
        function normalizeItem(raw) {
            if (!raw) return null;
            let item = {};
            if (Array.isArray(raw)) {
                item.Kode = raw[0] || '';
                item.Nama = raw[1] || '';
                item.Kategori = raw[2] || '';
                item.Link5MB = raw[3] || '';
                item.LinkDrive = raw[4] || '';
                item.LinkTiktok = raw[5] || '';
                item.LinkAsset = raw[6] || '';
                item.Thumbnail = raw[7] || '';
                item.Tanggal = raw[8] || '';
                item.Harga = raw[9] !== undefined ? raw[9] : '';
                item.Ratio = raw[10] || ''; // Column K (11th column in Sheet, index 10)
            } else if (typeof raw === 'object') {
                const getField = (keys, fallback = '') => {
                    for (const k of keys) {
                        if (raw[k] !== undefined && raw[k] !== null && String(raw[k]).trim() !== '') {
                            return String(raw[k]).trim();
                        }
                    }
                    return fallback;
                };

                // A = Kode (Unique Identifier)
                item.Kode = getField(['Kode', 'kode', 'A', 'a', 'Code', 'code', 'id', 'ID', 'Id']);
                // B = Nama (Title / Name)
                item.Nama = getField(['Nama', 'nama', 'B', 'b', 'Name', 'name', 'Title', 'title']);
                // C = Kategori (Category)
                item.Kategori = getField(['Kategori', 'kategori', 'C', 'c', 'Category', 'category'], 'Preset');
                // D = Link5MB (Alight Motion deep link)
                item.Link5MB = getField(['Link5MB', 'link5mb', 'Link_5MB', 'link_5mb', 'Link5mb', 'D', 'd', 'LinkXML', 'linkxml']);
                // E = LinkDrive (Google Drive link)
                item.LinkDrive = getField(['LinkDrive', 'linkdrive', 'Link_Drive', 'link_drive', 'Linkdrive', 'E', 'e', 'Drive', 'drive']);
                // F = LinkTiktok (TikTok video preview)
                item.LinkTiktok = getField(['LinkTiktok', 'linktiktok', 'Link_Tiktok', 'link_tiktok', 'Linktiktok', 'F', 'f', 'Tiktok', 'tiktok']);
                // G = LinkAsset (Additional asset link)
                item.LinkAsset = getField(['LinkAsset', 'linkasset', 'Link_Asset', 'link_asset', 'Linkasset', 'G', 'g', 'Asset', 'asset']);
                // H = Thumbnail (URL preview image / video)
                item.Thumbnail = getField(['Thumbnail', 'thumbnail', 'Thumb', 'thumb', 'H', 'h', 'LinkYT', 'linkyt', 'Link_YT', 'Link_Youtube', 'Youtube', 'youtube', 'YT', 'yt', 'Video', 'video', 'Preview', 'preview']);
                // I = Tanggal (Date added)
                item.Tanggal = getField(['Tanggal', 'tanggal', 'I', 'i', 'Date', 'date']);
                // J = Harga (Price in Rupiah)
                item.Harga = getField(['Harga', 'harga', 'J', 'j', 'Price', 'price', 'Tarif', 'tarif']);
                // K = Ratio (Aspect Ratio from Google Sheet Column K)
                item.Ratio = getField(['Ratio', 'ratio', 'RATIO', 'Rasio', 'rasio', 'RASIO', 'K', 'k', 'KolomK', 'kolom_k', 'KategoriK', 'kategori_k', 'Aspect', 'aspect', 'AspectRatio', 'aspect_ratio', 'Ukuran', 'ukuran', 'Dimensi', 'dimensi']);
            }

            for (const key in item) {
                if (typeof item[key] === 'string') {
                    item[key] = item[key].trim();
                }
            }
            if (raw && raw._sheetIndex !== undefined) {
                item._sheetIndex = Number(raw._sheetIndex);
            }
            return item;
        }

        function isAds(item){
            if(!item || isComingSoon(item)) return false;
            const h = (item.Harga || '').toString().trim().toLowerCase();
            // Jika di sheet kolom Harga bertuliskan "pro" -> ini adalah ADS (bukan for sale)
            if(h === 'pro' || h.includes('pro')) return true;
            if(h.includes('ad') || h.includes('iklan') || h.includes('sponsor')) return true;
            const k = (item.Kategori || '').toString().toLowerCase();
            if(k.includes('ad') || k.includes('iklan') || k.includes('sponsor')) return true;
            const allLinks = `${item.Link5MB || ''} ${item.LinkDrive || ''} ${item.LinkAsset || ''}`.toLowerCase();
            const adPatterns = ['semawur', 'linkvertise', 'adfly', 'sfile', 'safelink', 'ouo.io', 'ouo.press', 'shrink', 'shortlink', 'realslink', 'droplink', 'exe.io', 'adpay'];
            return adPatterns.some(p => allLinks.includes(p));
        }

        function isForSale(item){
            if(!item || isComingSoon(item)) return false;
            if(isAds(item)) return false; // Ads bukan for sale, ada sendiri!
            const h = (item.Harga || '').toString().trim().toLowerCase();
            if(!h) return false;
            if(h === 'free' || h === 'gratis' || h === '0' || h === '-' || h === 'pro' || h.includes('pro')) return false;
            return true;
        }

        function getItemType(item){
            if(isComingSoon(item)) return 'coming';
            if(isAds(item)) return 'ads';
            if(isForSale(item)) return 'paid';
            return 'free';
        }
        function isPaidPlus(item) {
            if(!isForSale(item)) return false;
            return (item.Harga || '').toString().includes('+');
        }
        function getPriceLabel(item){ 
            if(!item) return 'Gratis';
            if(isComingSoon(item)) return 'Coming Soon';
            if(isAds(item)) return 'Ads';
            const h=(item.Harga||'').toString().trim(); 
            if(!h) return 'Gratis';
            if(h.toLowerCase() === 'pro') return 'Ads';
            if(/^\d+$/.test(h)) return 'Rp ' + Number(h).toLocaleString('id-ID');
            return h;
        }
        function isPaid(item){ return isForSale(item); }
        function isPro(item){ return isAds(item); }
        function hasAds(item){ return isAds(item); }
        function hasPrice(item){ return isForSale(item); }
        function getDownloads(id){
            if(!id) return 0;
            try{
                const dl = JSON.parse(localStorage.getItem(DOWNLOADS_KEY)||'{}');
                if(dl[id] !== undefined) return Number(dl[id]) || 0;
                const lower = String(id).toLowerCase().trim();
                for(const k in dl){
                    if(String(k).toLowerCase().trim() === lower) return Number(dl[k]) || 0;
                }
                return 0;
            }catch(e){ return 0; }
        }
        function isNew(d){ if(!d||isComingSoon({Tanggal:d})) return false; try{ const dt=new Date(d); if(isNaN(dt)) return false; return dt>(new Date(Date.now()-7*864e5)); }catch(e){return false;} }
        function formatDate(d){ if(!d) return '—'; if(isComingSoon({Tanggal:d})) return 'Coming Soon'; try{ const dt=new Date(d); if(isNaN(dt)) return d; return dt.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}); }catch(e){return d;} }
        function getTrending(id){ return getDownloads(id)>50; }

        function waitForFB(timeout=3000){
            return new Promise(resolve=>{
                if(window.__fb && window.__fb.ready) return resolve(window.__fb);
                if(window.__fb_ready) return resolve(window.__fb || {ready:false});
                const t=setTimeout(()=>resolve(window.__fb||{ready:false}), timeout);
                window.addEventListener('fb-ready', ()=>{ clearTimeout(t); resolve(window.__fb||{ready:false}); }, {once:true});
            });
        }

        // Mengembalikan true hanya bila Firestore benar-benar mengonfirmasi penulisan.
        async function incrementFB(id){
            if(!id) return false;
            const fb = await waitForFB();
            if(!fb || !fb.ready) return false;
            try{
                await Promise.race([
                    fb.setDoc(fb.doc(fb.db,'downloads',String(id).trim()), {count: fb.increment(1)}, {merge:true}),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000))
                ]);
                return true;
            }catch(e){
                console.warn('Firestore increment error:', e);
                return false;
            }
        }

        function applyDownloadsUpdate(dlMap){
            if(!dlMap || typeof dlMap !== 'object') return;
            let current = {};
            try{ current = JSON.parse(localStorage.getItem(DOWNLOADS_KEY)||'{}'); }catch(e){}
            const merged = { ...current, ...dlMap };
            try{ localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(merged)); }catch(e){}
            
            updateStats();

            // 1. Update open modal download count if open
            if(currentItem && currentItem.Kode){
                const modalDl = document.getElementById('modalDownloadCount');
                if(modalDl){
                    const cnt = getDownloads(currentItem.Kode);
                    modalDl.innerHTML = `<i class="fas fa-download" style="color:var(--accent);margin-right:5px;"></i><b>${cnt.toLocaleString()}</b> kali`;
                }
            }

            // 2. Update all library cards rendered on page
            document.querySelectorAll('.card-dl-tag[data-dl-card-code]').forEach(el=>{
                const c = el.getAttribute('data-dl-card-code');
                if(c){
                    const cnt = getDownloads(c);
                    el.innerHTML = `<i class="fas fa-download"></i> ${cnt.toLocaleString()} dl`;
                }
            });

            // 3. Update all featured items on homepage
            document.querySelectorAll('.featured-dl-tag[data-dl-feat-code]').forEach(el=>{
                const c = el.getAttribute('data-dl-feat-code');
                if(c){
                    const cnt = getDownloads(c);
                    el.textContent = `${cnt.toLocaleString()} dl`;
                }
            });

            // 4. If items loaded, re-render featured & footer popular so ranking reflects Firestore
            if(allItems && allItems.length > 0){
                renderFeatured();
                const popEl = document.getElementById('footerPopular');
                if(popEl){
                    const popular = [...allItems].filter(i=>!isComingSoon(i)).sort((a,b)=>getDownloads(b.Kode)-getDownloads(a.Kode)).slice(0,5);
                    popEl.innerHTML = popular.length ? popular.map(i=>`<button type="button" onclick="openModalByCode('${esc(i.Kode)}')"><i class="fas fa-play" style="font-size:0.65rem;color:var(--accent);"></i> ${esc(i.Nama||'Untitled')}</button>`).join('') : '<span style="font-size:0.75rem;color:var(--text-muted);">Belum ada data</span>';
                }
            }

            // 5. If currently viewing 'terpopuler' filter in library, re-render grid
            if(currentFilter === 'terpopuler'){
                applyFilters(true);
            }
        }

        let fbUnsub = null;
        async function listenFBDownloads(){
            // Real-time listener via Firebase Firestore client SDK
            const fb = await waitForFB();
            if(!fb || !fb.ready) return;
            try{
                if(fbUnsub) {
                    try { fbUnsub(); } catch(e){}
                    fbUnsub = null;
                }
                if(fb.onSnapshot){
                    fbUnsub = fb.onSnapshot(fb.collection(fb.db, 'downloads'), (snap) => {
                        const dl = {};
                        snap.forEach(d => { dl[d.id] = d.data().count || 0; });
                        applyDownloadsUpdate(dl);
                    }, (err) => {
                        console.warn('Firestore onSnapshot error, fallback to getDocs:', err);
                        fallbackGetDocs(fb);
                    });
                } else {
                    fallbackGetDocs(fb);
                }
            }catch(e){
                fallbackGetDocs(fb);
            }
        }

        async function fallbackGetDocs(fb){
            if(!fb || !fb.ready) return;
            try{
                const snap = await fb.getDocs(fb.collection(fb.db,'downloads'));
                const dl = {};
                snap.forEach(d => { dl[d.id] = d.data().count || 0; });
                applyDownloadsUpdate(dl);
            }catch(e){
                console.warn('Firestore fallback getDocs error:', e);
            }
        }

        function initFuse(){
            // Fuse.js dimuat dari CDN; bila gagal dimuat, pencarian tetap berjalan lewat basicSearch().
            fuseInstance = (typeof Fuse === 'function') ? new Fuse(allItems,{keys:['Nama','Kategori','Kode'],threshold:0.35,ignoreLocation:true}) : null;
        }
        function basicSearch(q){
            const n = q.toLowerCase();
            return allItems.filter(i => ['Nama','Kategori','Kode'].some(k => String(i[k]||'').toLowerCase().includes(n)));
        }
        function searchItems(q){
            q = (q||'').trim();
            if(!q) return allItems;
            if(q.length < 2 || !fuseInstance) return basicSearch(q);
            // Tanpa hasil = daftar kosong (empty state), bukan seluruh aset.
            return fuseInstance.search(q).map(r => r.item);
        }

        function updateStats(){
            const cats=new Set(allItems.map(i=>i.Kategori||'Umum'));
            let totalDl = 0;
            try {
                totalDl = Object.values(JSON.parse(localStorage.getItem(DOWNLOADS_KEY)||'{}')).reduce((a,b)=>a+(Number(b)||0), 0);
            } catch(e){}
            const sc = document.getElementById('statCategories');
            if(sc) sc.textContent=cats.size;
            const sd = document.getElementById('statDownloads');
            if(sd) sd.textContent=totalDl.toLocaleString();
            const aa = document.getElementById('aboutAssets');
            if(aa) aa.textContent=allItems.length;
            const ac = document.getElementById('aboutCategories');
            if(ac) ac.textContent=cats.size;
            const ad = document.getElementById('aboutDownloads');
            if(ad) ad.textContent=totalDl.toLocaleString();
            const af = document.getElementById('aboutFreeAssets');
            if(af && allItems.length) {
                const freeCount = allItems.filter(i => !isForSale(i)).length;
                af.textContent = Math.round((freeCount / allItems.length) * 100) + '%';
            }
        }

        async function fetchAPI(retries=2){
            // Google Apps Script (static hosting: tanpa backend proxy)
            for(let i=0; i<=retries; i++){
                let tid = null;
                try{
                    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
                    if (ctrl) {
                        tid = setTimeout(() => {
                            try { ctrl.abort(); } catch(e){}
                        }, 18000); // 18s timeout
                    }
                    const res = await fetch(API_URL + (API_URL.includes('?') ? '&' : '?') + 't=' + Date.now(), {
                        method: 'GET',
                        redirect: 'follow',
                        signal: ctrl ? ctrl.signal : undefined
                    });
                    if (tid) clearTimeout(tid);
                    if(!res.ok) throw new Error('HTTP '+res.status);
                    const text=await res.text();
                    if(!text||!text.trim()) throw new Error('Empty response');
                    let parsed; try{ parsed=JSON.parse(text); } catch(e){ throw new Error('Invalid JSON'); }
                    let items=null;
                    if(Array.isArray(parsed)) items=parsed;
                    else if(parsed && Array.isArray(parsed.data)) items=parsed.data;
                    else if(parsed && Array.isArray(parsed.values)) items=parsed.values;
                    else if(parsed && typeof parsed === 'object'){ const arr=Object.values(parsed).find(v=>Array.isArray(v)); if(arr) items=arr; }
                    if(!items||!items.length) throw new Error('Data kosong');
                    return items.filter(i=>i&&typeof i==='object');
                } catch(e){
                    if (tid) clearTimeout(tid);
                    console.warn(`fetchAPI attempt ${i+1} gagal:`, e.message || e);
                    if(i===retries) throw e;
                    await new Promise(r=>setTimeout(r,1200*(i+1)));
                }
            }
        }

        function getCachedData(){ try{ const raw=localStorage.getItem(CACHE_KEY); if(!raw) return null; const {data,ts}=JSON.parse(raw); if(!data||!data.length) return null; if(Date.now()-ts>CACHE_TTL) return null; return data; }catch(e){ return null; } }
        function setCachedData(data){ try{ localStorage.setItem(CACHE_KEY,JSON.stringify({data,ts:Date.now()})); }catch(e){} }

        async function loadData(){
            if(isLoading) return;
            isLoading=true;
            hideError();
            listenFBDownloads();
            const cached=getCachedData();
            if(cached && Array.isArray(cached)){
                allItems=cached.map((raw, idx) => {
                    const it = normalizeItem(raw);
                    if(it && it._sheetIndex === undefined){
                        it._sheetIndex = (raw && raw._sheetIndex !== undefined) ? Number(raw._sheetIndex) : (cached.length - 1 - idx);
                    }
                    return it;
                }).filter(Boolean);
                libraryDataVersion++;
                initFuse();
                ctfyAfterCatalog();
                openAssetFromURL();
            }
            try{
                const items=await fetchAPI();
                const normalized = items.map((raw, idx) => {
                    const it = normalizeItem(raw);
                    if(it) it._sheetIndex = idx;
                    return it;
                }).filter(Boolean);
                allItems=normalized.slice().reverse();
                libraryDataVersion++;
                initFuse();
                setCachedData(allItems);
                ctfyAfterCatalog();
                openAssetFromURL();
                if(!cached) showToast(`<i class="fas fa-circle-check" style="color:#10b981;margin-right:6px;"></i> ${allItems.length} asset dimuat`);
            } catch(e){
                console.error('Gagal fetch:', e);
                if(!allItems.length){
                    showError('Gagal memuat data. Cek koneksi kamu.');
                    { const _cg0 = document.getElementById('cardGrid'); if (_cg0) _cg0.classList.remove('is-loading'); }
                    (document.getElementById('cardGrid') || {}).innerHTML=`<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-wifi-slash"></i></div><h3>Tidak bisa memuat asset</h3><p>Pastikan koneksi internet aktif, lalu coba lagi.</p><button class="chip active" onclick="loadData()"><i class="fas fa-redo"></i> Coba Lagi</button></div>`;
                }
            }
            isLoading=false;
        }

        window.loadData=loadData;
