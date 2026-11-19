/* library.js — UI Library: media kartu, masonry, filter/pencarian, favorit, modal item, popup WhatsApp, pelacakan unduhan. Hanya halaman Library.
   Dibangkitkan oleh scripts/build.py dari index.html asli (blok dipindah byte-exact; perubahan = daftar PATCH di FINAL_REPORT.md). */

        const TIKTOK_THUMB_CACHE = 'ctfy_tiktok_thumbs';
        function getCachedTikTokThumb(id) {
            try {
                const map = JSON.parse(localStorage.getItem(TIKTOK_THUMB_CACHE) || '{}');
                return map[id] || '';
            } catch(e) { return ''; }
        }
        function setCachedTikTokThumb(id, url) {
            try {
                const map = JSON.parse(localStorage.getItem(TIKTOK_THUMB_CACHE) || '{}');
                map[id] = url;
                localStorage.setItem(TIKTOK_THUMB_CACHE, JSON.stringify(map));
            } catch(e) {}
        }
        async function fetchTikTokThumbnail(id, videoUrl) {
            if (!isSafeNumericId(id) || !sanitizeSafeUrl(videoUrl, false) || getCachedTikTokThumb(id)) return;
            try {
                const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`);
                if (res.ok) {
                    const data = await res.json();
                    const safeThumb = data && sanitizeSafeUrl(data.thumbnail_url, false);
                    if (safeThumb) {
                        setCachedTikTokThumb(id, safeThumb);
                        document.querySelectorAll(`img[data-tiktok-id="${escapeCssAttrVal(id)}"]`).forEach(img => {
                            img.src = safeThumb;
                        });
                    }
                }
            } catch(e) {}
        }

        const ANALYZED_RATIO_CACHE = 'ctfy_media_ratios';
        function getCachedAnalyzedRatio(id) {
            try {
                const map = JSON.parse(localStorage.getItem(ANALYZED_RATIO_CACHE) || '{}');
                return map[id] || null;
            } catch(e) { return null; }
        }
        function setCachedAnalyzedRatio(id, ratioData) {
            try {
                const map = JSON.parse(localStorage.getItem(ANALYZED_RATIO_CACHE) || '{}');
                map[id] = ratioData;
                localStorage.setItem(ANALYZED_RATIO_CACHE, JSON.stringify(map));
            } catch(e) {}
        }

        function formatRatio(w, h) {
            if (!w || !h) return { ratioCss: 'auto', ratioLabel: 'Unknown', ratioVal: 0, w: 0, h: 0 };
            const r = w / h;
            let ratioLabel = `${Math.round(w)}:${Math.round(h)}`;
            let ratioCss = `${w} / ${h}`;
            
            // Strictly match real video content ratios
            if (Math.abs(r - 1) < 0.05) { // 1:1 Square (1080x1080, etc.)
                ratioLabel = '1:1';
                ratioCss = '1 / 1';
            } else if (Math.abs(r - 9/16) < 0.05) { // 9:16 Vertical (1080x1920, etc.)
                ratioLabel = '9:16';
                ratioCss = '9 / 16';
            } else if (Math.abs(r - 4/5) < 0.05) { // 4:5 Portrait (1080x1350, etc.)
                ratioLabel = '4:5';
                ratioCss = '4 / 5';
            } else if (Math.abs(r - 3/4) < 0.05) { // 3:4 Vertical
                ratioLabel = '3:4';
                ratioCss = '3 / 4';
            } else if (Math.abs(r - 4/3) < 0.05) { // 4:3 Standard
                ratioLabel = '4:3';
                ratioCss = '4 / 3';
            } else if (Math.abs(r - 5/4) < 0.05) { // 5:4
                ratioLabel = '5:4';
                ratioCss = '5 / 4';
            } else if (Math.abs(r - 16/9) < 0.05) { // 16:9 Landscape (1920x1080, etc.)
                ratioLabel = '16:9';
                ratioCss = '16 / 9';
            } else if (Math.abs(r - 21/9) < 0.06) { // 21:9 Ultrawide
                ratioLabel = '21:9';
                ratioCss = '21 / 9';
            } else {
                const gcd = (a, b) => b ? gcd(b, a % b) : a;
                const g = gcd(Math.round(w), Math.round(h));
                const simW = Math.round(w / g);
                const simH = Math.round(h / g);
                if (simW < 50 && simH < 50) {
                    ratioLabel = `${simW}:${simH}`;
                } else {
                    ratioLabel = `${r.toFixed(2)}:1`;
                }
                ratioCss = `${w} / ${h}`;
            }
            return { ratioCss, ratioLabel, ratioVal: r, w, h };
        }

        function analyzeActiveVideoBounds(img) {
            try {
                const w = img.naturalWidth || img.width;
                const h = img.naturalHeight || img.height;
                if (!w || !h) return null;

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) return null;

                ctx.drawImage(img, 0, 0, w, h);
                const imgData = ctx.getImageData(0, 0, w, h);
                const data = imgData.data;

                const isDark = (r, g, b) => (r <= 22 && g <= 22 && b <= 22);

                // Scan top letterbox
                let top = 0;
                const stepX = Math.max(2, Math.floor(w / 32));
                for (let y = 0; y < Math.floor(h * 0.45); y++) {
                    let dark = 0, total = 0;
                    for (let x = stepX; x < w - stepX; x += stepX) {
                        const idx = (y * w + x) * 4;
                        if (isDark(data[idx], data[idx+1], data[idx+2])) dark++;
                        total++;
                    }
                    if (dark / total >= 0.88) top = y + 1;
                    else break;
                }

                // Scan bottom letterbox
                let bottom = h - 1;
                for (let y = h - 1; y > Math.floor(h * 0.55); y--) {
                    let dark = 0, total = 0;
                    for (let x = stepX; x < w - stepX; x += stepX) {
                        const idx = (y * w + x) * 4;
                        if (isDark(data[idx], data[idx+1], data[idx+2])) dark++;
                        total++;
                    }
                    if (dark / total >= 0.88) bottom = y - 1;
                    else break;
                }

                // Scan left pillarbox
                let left = 0;
                const stepY = Math.max(2, Math.floor(h / 32));
                for (let x = 0; x < Math.floor(w * 0.45); x++) {
                    let dark = 0, total = 0;
                    for (let y = stepY; y < h - stepY; y += stepY) {
                        const idx = (y * w + x) * 4;
                        if (isDark(data[idx], data[idx+1], data[idx+2])) dark++;
                        total++;
                    }
                    if (dark / total >= 0.88) left = x + 1;
                    else break;
                }

                // Scan right pillarbox
                let right = w - 1;
                for (let x = w - 1; x > Math.floor(w * 0.55); x--) {
                    let dark = 0, total = 0;
                    for (let y = stepY; y < h - stepY; y += stepY) {
                        const idx = (y * w + x) * 4;
                        if (isDark(data[idx], data[idx+1], data[idx+2])) dark++;
                        total++;
                    }
                    if (dark / total >= 0.88) right = x - 1;
                    else break;
                }

                const activeW = Math.max(10, right - left + 1);
                const activeH = Math.max(10, bottom - top + 1);

                let croppedThumb = null;
                // If black bars were detected, crop them out for a clean uncropped display
                if (top > 4 || bottom < h - 5 || left > 4 || right < w - 5) {
                    try {
                        const cropCanvas = document.createElement('canvas');
                        cropCanvas.width = activeW;
                        cropCanvas.height = activeH;
                        const cropCtx = cropCanvas.getContext('2d');
                        if (cropCtx) {
                            cropCtx.drawImage(canvas, left, top, activeW, activeH, 0, 0, activeW, activeH);
                            croppedThumb = cropCanvas.toDataURL('image/jpeg', 0.90);
                        }
                    } catch(e) {}
                }

                const info = formatRatio(activeW, activeH);
                if (croppedThumb) info.croppedThumb = croppedThumb;
                return info;
            } catch(e) {
                return null;
            }
        }

        function hasExplicitSheetRatio(itemId) {
            if (!itemId || !allItems || !allItems.length) return null;
            const itm = allItems.find(i => i.Kode === itemId);
            if (itm && (itm.Ratio || itm.Rasio || itm.K || itm.k)) {
                return parseRatioString(itm.Ratio || itm.Rasio || itm.K || itm.k);
            }
            return null;
        }

        function markCardMediaRatio(img, explicitRatio) {
            const wrapper = img && img.closest ? img.closest('.card > .card-media-wrapper') : null;
            if (!wrapper || !img.naturalWidth || !img.naturalHeight) return;
            const ytBars = explicitRatio && /ytimg\.com|youtube\.com/i.test(img.currentSrc || img.src || '');
            wrapper.classList.toggle('is-trimmed', Boolean(ytBars));
            // Rasio dari Sheet (kolom K) dipertahankan untuk thumbnail YouTube agar bilah hitam terpotong.
            if (!ytBars) wrapper.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
            LibraryMasonry.refresh();
        }

        function markCardMediaFailed(img) {
            const wrapper = img && img.closest ? img.closest('.card-media-wrapper') : null;
            if (!wrapper) return;
            wrapper.classList.add('is-fallback');
            if (!wrapper.style.aspectRatio) wrapper.style.aspectRatio = '4 / 3';
            LibraryMasonry.refresh();
        }

        function onMediaImageLoaded(img, itemId, mediaId) {
            if (!img || !img.naturalWidth || !img.naturalHeight) return;
            // Placeholder bawaan (data:svg) bukan gambar asli: jangan dipakai menentukan atau menyimpan rasio.
            if (/^data:image\/svg\+xml/i.test(img.currentSrc || img.src || '')) return;
            const ownWrapper = img.closest ? img.closest('.card-media-wrapper') : null;
            if (ownWrapper && !ownWrapper.classList.contains('is-empty')) ownWrapper.classList.remove('is-fallback');
            if (!itemId) {
                const wrap = img.closest('[data-media-item]');
                if (wrap) itemId = wrap.getAttribute('data-media-item') || '';
            }
            if (!mediaId) {
                mediaId = img.getAttribute('data-media-id') || img.getAttribute('data-tiktok-id') || '';
            }

            const explicit = hasExplicitSheetRatio(itemId);
            if (explicit) {
                const selector = itemId ? `[data-media-item="${escapeCssAttrVal(itemId)}"]` : null;
                const elements = selector ? document.querySelectorAll(selector) : [img.closest('.card-media-wrapper')].filter(Boolean);
                elements.forEach(wrapper => {
                    if (explicit.ratioCss && explicit.ratioCss !== 'auto') {
                        wrapper.style.aspectRatio = explicit.ratioCss;
                    }
                    wrapper.setAttribute('data-ratio', explicit.ratioLabel);
                    const badge = wrapper.querySelector('.media-badge-text');
                    if (badge) badge.textContent = explicit.ratioLabel;
                });
                markCardMediaRatio(img, true);
                return;
            }

            const w = img.naturalWidth;
            const h = img.naturalHeight;

            const isYtThumb = img.src && (img.src.includes('ytimg.com') || img.src.includes('youtube.com'));
            let info = null;

            if (isYtThumb) {
                info = analyzeActiveVideoBounds(img);
            }
            if (!info) {
                info = formatRatio(w, h);
            }

            if (itemId) setCachedAnalyzedRatio(itemId, info);
            if (mediaId) setCachedAnalyzedRatio(mediaId, info);

            const selector = itemId ? `[data-media-item="${escapeCssAttrVal(itemId)}"]` : null;
            const elements = selector ? document.querySelectorAll(selector) : [img.closest('.card-media-wrapper')].filter(Boolean);

            elements.forEach(wrapper => {
                if (info.ratioCss && info.ratioCss !== 'auto') {
                    wrapper.style.aspectRatio = info.ratioCss;
                }
                wrapper.setAttribute('data-ratio', info.ratioLabel);
                const badge = wrapper.querySelector('.media-badge-text');
                if (badge) badge.textContent = info.ratioLabel;

                if (info.croppedThumb) {
                    const cardImg = wrapper.querySelector('.card-media-img');
                    if (cardImg && cardImg.src !== info.croppedThumb) {
                        cardImg.src = info.croppedThumb;
                    }
                }
            });
            // Jika thumbnail baru saja dipotong, rasio final ditentukan saat gambar hasil potongan selesai dimuat.
            if (!info.croppedThumb) markCardMediaRatio(img, false);
        }

        const ytFetchQueue = new Set();
        async function fetchYouTubeMetadata(ytId, itemId) {
            if (!isSafeYouTubeId(ytId) || ytFetchQueue.has(ytId)) return;
            if (hasExplicitSheetRatio(itemId)) return;
            if (getCachedAnalyzedRatio(ytId) || (itemId && getCachedAnalyzedRatio(itemId))) return;
            ytFetchQueue.add(ytId);

            try {
                const offscreenImg = new Image();
                offscreenImg.crossOrigin = 'anonymous';
                offscreenImg.onload = function() {
                    const info = analyzeActiveVideoBounds(offscreenImg);
                    if (info) {
                        if (itemId) setCachedAnalyzedRatio(itemId, info);
                        setCachedAnalyzedRatio(ytId, info);
                        document.querySelectorAll(`[data-media-item="${escapeCssAttrVal(itemId)}"]`).forEach(wrapper => {
                            if (info.ratioCss && info.ratioCss !== 'auto') {
                                wrapper.style.aspectRatio = info.ratioCss;
                            }
                            wrapper.setAttribute('data-ratio', info.ratioLabel);
                            const badge = wrapper.querySelector('.media-badge-text');
                            if (badge) badge.textContent = info.ratioLabel;
                            if (info.croppedThumb) {
                                const cardImg = wrapper.querySelector('.card-media-img');
                                if (cardImg && cardImg.src !== info.croppedThumb) {
                                    cardImg.src = info.croppedThumb;
                                }
                            }
                        });
                    }
                };
                offscreenImg.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
            } catch(e) {}

            try {
                const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(ytId)}&format=json`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.width && data.height) {
                        const info = formatRatio(data.width, data.height);
                        if (itemId && !getCachedAnalyzedRatio(itemId)) setCachedAnalyzedRatio(itemId, info);
                        if (!getCachedAnalyzedRatio(ytId)) setCachedAnalyzedRatio(ytId, info);
                    }
                }
            } catch(e) {}
        }

        function isRatioOnlyString(str) {
            if (!str) return false;
            const s = String(str).trim().toLowerCase();
            return /^(1:1|9:16|16:9|4:3|3:4|4:5|5:4|21:9|1-1|9-16|16-9|4-3|3-4|4-5|5-4|21-9|1x1|9x16|16x9|4x5|3x4|4x3|5x4|21x9|square|portrait|landscape|ultrawide)$/.test(s);
        }

        function parseRatioString(val) {
            if (!val) return null;
            const s = String(val).trim().toLowerCase();
            if (!s || s === '-' || s === '#' || s === 'auto') return null;

            // Direct keywords
            if (s === 'square' || s === 'kotak') return { ratioCss: '1 / 1', ratioLabel: '1:1', ratioVal: 1 };
            if (s === 'portrait' || s === 'vertikal' || s === 'vertical') return { ratioCss: '9 / 16', ratioLabel: '9:16', ratioVal: 9/16 };
            if (s === 'landscape' || s === 'horizontal' || s === 'widescreen') return { ratioCss: '16 / 9', ratioLabel: '16:9', ratioVal: 16/9 };
            if (s === 'ultrawide') return { ratioCss: '21 / 9', ratioLabel: '21:9', ratioVal: 21/9 };

            // Standard ratios
            if (/\b9\s*[:x/\-_*]\s*16\b/.test(s) || s.includes('9:16') || s.includes('9-16') || s.includes('9/16') || s.includes('9x16')) return { ratioCss: '9 / 16', ratioLabel: '9:16', ratioVal: 9/16 };
            if (/\b4\s*[:x/\-_*]\s*5\b/.test(s) || s.includes('4:5') || s.includes('4-5') || s.includes('4/5') || s.includes('4x5')) return { ratioCss: '4 / 5', ratioLabel: '4:5', ratioVal: 4/5 };
            if (/\b3\s*[:x/\-_*]\s*4\b/.test(s) || s.includes('3:4') || s.includes('3-4') || s.includes('3/4') || s.includes('3x4')) return { ratioCss: '3 / 4', ratioLabel: '3:4', ratioVal: 3/4 };
            if (/\b1\s*[:x/\-_*]\s*1\b/.test(s) || s.includes('1:1') || s.includes('1-1') || s.includes('1/1') || s.includes('1x1')) return { ratioCss: '1 / 1', ratioLabel: '1:1', ratioVal: 1 };
            if (/\b4\s*[:x/\-_*]\s*3\b/.test(s) || s.includes('4:3') || s.includes('4-3') || s.includes('4/3') || s.includes('4x3')) return { ratioCss: '4 / 3', ratioLabel: '4:3', ratioVal: 4/3 };
            if (/\b16\s*[:x/\-_*]\s*9\b/.test(s) || s.includes('16:9') || s.includes('16-9') || s.includes('16/9') || s.includes('16x9')) return { ratioCss: '16 / 9', ratioLabel: '16:9', ratioVal: 16/9 };
            if (/\b5\s*[:x/\-_*]\s*4\b/.test(s) || s.includes('5:4') || s.includes('5-4') || s.includes('5/4') || s.includes('5x4')) return { ratioCss: '5 / 4', ratioLabel: '5:4', ratioVal: 5/4 };
            if (/\b21\s*[:x/\-_*]\s*9\b/.test(s) || s.includes('21:9') || s.includes('21-9') || s.includes('21/9') || s.includes('21x9')) return { ratioCss: '21 / 9', ratioLabel: '21:9', ratioVal: 21/9 };

            // Numeric dimensions like 1080x1080, 1080x1920, 1920x1080, 1080:1350, 720/1280
            const dimMatch = s.match(/(\d+(?:\.\d+)?)\s*[:x/\-_*]\s*(\d+(?:\.\d+)?)/);
            if (dimMatch) {
                const w = parseFloat(dimMatch[1]);
                const h = parseFloat(dimMatch[2]);
                if (w > 0 && h > 0) {
                    return formatRatio(w, h);
                }
            }

            return null;
        }

        function getRawMediaUrl(item) {
            if (!item) return '';
            if (typeof item === 'string') return item.trim();
            // Strictly get media URL from Column H (Thumbnail)
            if (item.Thumbnail && typeof item.Thumbnail === 'string') {
                const t = item.Thumbnail.trim();
                if (t !== '' && t !== '#' && !isRatioOnlyString(t)) return t;
            }
            if (item.H && typeof item.H === 'string') {
                const h = item.H.trim();
                if (h !== '' && h !== '#' && !isRatioOnlyString(h)) return h;
            }
            if (Array.isArray(item)) {
                const u = item[7] || '';
                if (u && !isRatioOnlyString(u)) return u;
            }
            return '';
        }

        function detectRatio(item, url) {
            // 1. HIGHEST PRIORITY: Explicit Column K "Ratio" from Google Sheet
            if (item && typeof item === 'object') {
                const sheetRatio = item.Ratio || item.Rasio || item.K || item.k || item.AspectRatio || item.Ukuran || item.Dimensi;
                if (sheetRatio) {
                    const parsed = parseRatioString(sheetRatio);
                    if (parsed) return parsed;
                }
            }

            // 2. Check cached analyzed ratio if available
            const key = (item && item.Kode) ? item.Kode : url;
            if (key) {
                const cached = getCachedAnalyzedRatio(key);
                if (cached) {
                    if (typeof cached === 'object' && cached.ratioCss) return cached;
                    if (typeof cached === 'string') {
                        const parsed = parseRatioString(cached);
                        if (parsed) return parsed;
                    }
                }
            }

            // 3. Check text embedded in Thumbnail or Nama fields
            const combined = `${url || ''} ${(item && item.Thumbnail) || ''} ${(item && item.Nama) || ''}`.toLowerCase();
            const textRatio = parseRatioString(combined);
            if (textRatio) return textRatio;

            // 4. Default dynamic auto
            return { ratioCss: 'auto', ratioLabel: 'Auto', ratioVal: 0 };
        }

        function parseMedia(item) {
            if (!item) return null;
            let url = getRawMediaUrl(item);
            if (!url || url === '#' || url === '-' || url.toLowerCase() === 'null' || url.toLowerCase() === 'undefined') {
                return null;
            }

            const ratioInfo = detectRatio(item, url);

            // 1. YouTube video
            let ytId = null;
            const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/i);
            if (shortsMatch && shortsMatch[1]) {
                ytId = shortsMatch[1].split('?')[0].split('&')[0];
            } else {
                const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
                if (match && match[1]) {
                    ytId = match[1];
                } else if (/^[a-zA-Z0-9_-]{11}$/.test(url) && !/^\d+$/.test(url)) {
                    ytId = url;
                }
            }

            if (ytId) {
                return {
                    type: 'youtube',
                    id: ytId,
                    embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`,
                    thumbUrl: (ratioInfo && ratioInfo.croppedThumb) ? ratioInfo.croppedThumb : `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
                    ratioCss: ratioInfo.ratioCss,
                    ratioLabel: ratioInfo.ratioLabel,
                    originalUrl: url
                };
            }

            // 2. TikTok video
            const tiktokMatch = url.match(/tiktok\.com\/(?:@[^/]+\/video\/|v\/|embed\/v2\/|embed\/)?(\d+)/i) || url.match(/tiktok\.com\/.*[?&]item_id=(\d+)/i);
            if (tiktokMatch && tiktokMatch[1]) {
                const ttId = tiktokMatch[1];
                const cachedThumb = getCachedTikTokThumb(ttId);
                if (!cachedThumb) {
                    fetchTikTokThumbnail(ttId, url);
                }
                return {
                    type: 'tiktok',
                    id: ttId,
                    embedUrl: `https://www.tiktok.com/embed/v2/${ttId}`,
                    thumbUrl: cachedThumb || '',
                    ratioCss: ratioInfo.ratioCss,
                    ratioLabel: ratioInfo.ratioLabel,
                    originalUrl: url
                };
            } else if (url.includes('tiktok.com')) {
                return {
                    type: 'tiktok_link',
                    embedUrl: url,
                    thumbUrl: '',
                    ratioCss: ratioInfo.ratioCss,
                    ratioLabel: ratioInfo.ratioLabel,
                    originalUrl: url
                };
            }

            // 3. Direct Image
            if (/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i.test(url) || url.includes('googleusercontent.com') || url.includes('drive.google.com/uc') || url.includes('imgur.com') || url.includes('tiktokcdn.com')) {
                return {
                    type: 'image',
                    src: url,
                    thumbUrl: url,
                    ratioCss: ratioInfo.ratioCss,
                    ratioLabel: ratioInfo.ratioLabel,
                    originalUrl: url
                };
            }

            // 4. Any other URL
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return {
                    type: 'image',
                    src: url,
                    thumbUrl: url,
                    ratioCss: ratioInfo.ratioCss,
                    ratioLabel: ratioInfo.ratioLabel,
                    originalUrl: url
                };
            }

            return null;
        }

        function playCardMedia(el, embedUrl, ratioCss, e) {
            if (e) e.stopPropagation();
            const safeEmbed = sanitizeSafeUrl(embedUrl, false);
            if (!el || !safeEmbed) return;
            const sep = safeEmbed.includes('?') ? '&' : '?';
            const rStyle = (ratioCss && ratioCss !== 'auto') ? `aspect-ratio:${esc(ratioCss)};` : 'min-height:200px;';
            el.innerHTML = `<iframe class="card-media-iframe" src="${esc(safeEmbed)}${sep}autoplay=1" style="width:100%;${rStyle}border:none;border-radius:10px;display:block;" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        }

        function renderCardMediaHtml(item) {
            const media = parseMedia(item);
            if (!media) return '';

            const iconHtml = media.type === 'youtube' ? '<i class="fab fa-youtube" style="color:#ef4444;"></i> ' : media.type === 'tiktok' ? '<i class="fab fa-tiktok"></i> ' : '';
            const ratioBadge = `<span class="media-badge">${iconHtml}<span class="media-badge-text">${esc(media.ratioLabel)}</span></span>`;
            const rStyle = (media.ratioCss && media.ratioCss !== 'auto') ? `aspect-ratio:${esc(media.ratioCss)};` : '';

            if (media.type === 'youtube' && isSafeYouTubeId(media.id)) {
                fetchYouTubeMetadata(media.id, item.Kode);
                const ytThumb = (media.thumbUrl && media.thumbUrl.startsWith('data:image/jpeg;base64,')) ? media.thumbUrl : sanitizeSafeUrl(media.thumbUrl, false);
                return `<div class="card-media-wrapper" style="${rStyle}" data-media-item="${esc(item.Kode)}" data-action="open-modal" data-code="${esc(item.Kode)}" role="button" tabindex="0" aria-label="Buka detail ${esc(item.Nama)}" title="Lihat detail & preview video ${esc(item.Kode)}">
                    <img class="card-media-img" data-media-id="${esc(media.id)}" data-yt-fallback="https://img.youtube.com/vi/${esc(media.id)}/0.jpg" src="${esc(ytThumb)}" alt="${esc(item.Nama)}" loading="lazy" />
                    <div class="card-media-overlay">
                        <div class="play-icon-badge"><i class="fas fa-play"></i></div>
                        ${ratioBadge}
                    </div>
                </div>`;
            } else if (media.type === 'tiktok' && isSafeNumericId(media.id)) {
                const ttFallback = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23191917"/><circle cx="150" cy="150" r="40" fill="%23252522"/><path d="M165 130v32a18 18 0 1 1-18-18c2 0 4 .3 6 .8v-15a32 32 0 0 0-6-.6 32 32 0 1 0 32 32v-24a25 25 0 0 0 16 6v-14a14 14 0 0 1-14-14h-16z" fill="%23B85D3B"/></svg>';
                const thumbSrc = sanitizeSafeUrl(media.thumbUrl, false) || ttFallback;
                return `<div class="card-media-wrapper" style="${rStyle}" data-media-item="${esc(item.Kode)}" data-action="open-modal" data-code="${esc(item.Kode)}" role="button" tabindex="0" aria-label="Buka detail ${esc(item.Nama)}" title="Lihat detail & preview video ${esc(item.Kode)}">
                    <img class="card-media-img" data-tiktok-id="${esc(media.id)}" data-media-id="${esc(media.id)}" src="${esc(thumbSrc)}" alt="${esc(item.Nama)}" loading="lazy" />
                    <div class="card-media-overlay">
                        <div class="play-icon-badge"><i class="fas fa-play"></i></div>
                        ${ratioBadge}
                    </div>
                </div>`;
            } else if (media.type === 'image') {
                const safeSrc = sanitizeSafeUrl(media.src, false);
                if (!safeSrc) return '';
                return `<div class="card-media-wrapper" style="${rStyle}" data-media-item="${esc(item.Kode)}" data-action="open-modal" data-code="${esc(item.Kode)}" role="button" tabindex="0" aria-label="Buka detail ${esc(item.Nama)}" title="Lihat detail & preview ${esc(item.Kode)}">
                    <img class="card-media-img" src="${esc(safeSrc)}" alt="${esc(item.Nama)}" loading="lazy" />
                    <div class="card-media-overlay">${ratioBadge}</div>
                </div>`;
            }
            return '';
        }

        function loadFavorites(){ try{ const s=localStorage.getItem(FAVORITES_KEY); if(s) favorites=new Set(JSON.parse(s)); }catch(e){} }
        function saveFavorites(){ localStorage.setItem(FAVORITES_KEY,JSON.stringify([...favorites])); }
        function isFav(id){ return favorites.has(id); }
        function syncFavButtons(id){
            const fav = isFav(id);
            const key = String(id||'').trim().toLowerCase();
            document.querySelectorAll('#cardGrid .favorite-btn[data-code]').forEach(btn => {
                if((btn.getAttribute('data-code')||'').trim().toLowerCase() !== key) return;
                btn.classList.toggle('active', fav);
                btn.setAttribute('aria-pressed', fav ? 'true' : 'false');
                btn.title = fav ? 'Hapus dari favorit' : 'Tambah ke favorit';
                const ic = btn.querySelector('i');
                if(ic) ic.className = (fav ? 'fas' : 'far') + ' fa-star';
            });
        }
        function toggleFav(id,e){
            if (e && e.stopPropagation) e.stopPropagation();
            favorites.has(id)?favorites.delete(id):favorites.add(id);
            saveFavorites();
            // Perbarui tombol di tempat: halaman pagination dan susunan masonry tidak ikut berubah.
            syncFavButtons(id);
            renderFeatured();
            renderPaidGrid();
            if(currentFilter === 'fav') applyFilters(true);
            const cleanId = String(id || '').trim().toLowerCase();
            document.querySelectorAll(`.favorite-btn[data-code], .paid-card .favorite-btn`).forEach(btn => {
                const cardCode = (btn.getAttribute('data-code') || btn.closest('.paid-card')?.querySelector('.copy-code-btn')?.textContent || '').trim().toLowerCase();
                if (cardCode === cleanId) {
                    btn.classList.remove('is-popping');
                    void btn.offsetWidth;
                    btn.classList.add('is-popping');
                    setTimeout(() => btn.classList.remove('is-popping'), 300);
                }
            });
            showToast(favorites.has(id)?'<i class="fas fa-heart" style="color:#f43f5e;margin-right:6px;"></i> Ditambahkan ke favorit':'<i class="far fa-heart" style="margin-right:6px;"></i> Dihapus dari favorit');
        }

        function renderFeatured(){
            const newest=allItems.slice(0,3);
            const popular=[...allItems].filter(i=>!isComingSoon(i)).sort((a,b)=>getDownloads(b.Kode)-getDownloads(a.Kode)).slice(0,3);
            function li(item,rank){
                const t=getItemType(item);
                let bc, bl;
                if(t==='paid'){ bc='badge-paid'; bl=getPriceLabel(item); }
                else if(t==='ads' || t==='pro'){ bc='badge-ads'; bl='<i class="fas fa-rectangle-ad" style="font-size:0.65rem;margin-right:3px;"></i> Ads'; }
                else if(t==='coming'){ bc='badge-coming'; bl='<i class="fas fa-clock" style="font-size:0.65rem;margin-right:3px;"></i> Segera'; }
                else { bc='badge-free'; bl='Gratis'; }
                const showDl=!isPaid(item) && t!=='coming';
                const dl=getDownloads(item.Kode);
                const clickable=!isComingSoon(item);
                const media=parseMedia(item);
                const thumbHtml=media ? `
                    <div class="featured-list-thumb">
                        <img src="${media.thumbUrl||media.src}" alt="${esc(item.Nama)}" loading="lazy" onerror="this.src='https://img.youtube.com/vi/${media.id||''}/0.jpg'" />
                        ${(media.type==='youtube'||media.type==='tiktok') ? '<div class="thumb-play-overlay"><i class="fas fa-play" style="font-size:0.65rem;"></i></div>' : ''}
                    </div>` : `
                    <div class="featured-list-thumb">
                        <i class="fas fa-film" style="color:var(--text-muted);font-size:1rem;"></i>
                    </div>`;
                return `<div class="featured-list-item" ${clickable?`onclick="openModalByCode('${esc(item.Kode)}')"`:''} ${!clickable?'style="cursor:default;"':''}>
                    <div class="featured-list-rank${rank<=1?' top':''}">${rank}</div>
                    ${thumbHtml}
                    <div class="featured-list-info">
                        <div class="featured-list-code">${esc(item.Kode||'')}</div>
                        <div class="featured-list-title">${esc(item.Nama||'Untitled')}</div>
                        <div class="featured-list-meta">
                            <span class="featured-list-badge ${bc}">${bl}</span>
                            ${media ? `<span class="featured-list-ratio">${esc(media.ratioLabel)}</span>` : ''}
                            ${showDl?`<span class="featured-dl-tag" data-dl-feat-code="${esc(item.Kode)}">${dl.toLocaleString()} dl</span>`:''}
                        </div>
                    </div>
                    <i class="fas ${isComingSoon(item)?'fa-clock':'fa-chevron-right'}" style="color:var(--text-muted);font-size:0.65rem;"></i>
                </div>`;
            }
            const empty='<div style="text-align:center;padding:28px 0;font-size:0.78rem;color:var(--text-secondary);">Belum ada data</div>';
            const newestEl = document.getElementById('newestList');
            const popularEl = document.getElementById('popularList');
            if(newestEl) newestEl.innerHTML=newest.length?newest.map((i,x)=>li(i,x+1)).join(''):empty;
            if(popularEl) popularEl.innerHTML=popular.length?popular.map((i,x)=>li(i,x+1)).join(''):empty;
        }

        function renderPaidGrid(){
            const el=document.getElementById('paidGrid');
            if(!el) return;
            const paid=allItems.filter(i=>!isComingSoon(i)&&isPaid(i));
            if(!paid.length){ el.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:24px;font-size:0.78rem;color:var(--text-secondary);">Belum ada asset berbayar</div>'; return; }
            el.innerHTML=paid.map(item=>{
                const isPlus = isPaidPlus(item);
                const extraBadge = isPlus ? `<span class="card-badge link-available"><i class="fas fa-link"></i> Link</span>` : '';
                const mediaHtml = renderCardMediaHtml(item);
                const fav = isFav(item.Kode);
                const favBtn = `<button type="button" class="favorite-btn${fav?' active':''}" onclick="event.stopPropagation();toggleFav('${esc(item.Kode)}',event)" title="${fav?'Hapus dari favorit':'Tambah ke favorit'}" aria-label="Favorit"><i class="${fav?'fas':'far'} fa-star"></i></button>`;
                return `<div class="paid-card" onclick="openModalByCode('${esc(item.Kode)}')">
                    <div class="card-top-bar">
                        <span class="card-cat-pill"><i class="fas fa-layer-group"></i> ${esc(item.Kategori||'Preset')}</span>
                        <div class="card-badges">
                            <span class="card-badge paid">${esc(getPriceLabel(item))}</span>
                            ${extraBadge}
                            ${favBtn}
                        </div>
                    </div>
                    ${mediaHtml}
                    <div class="card-body">
                        <div class="card-title">${esc(item.Nama||'Untitled')}</div>
                        <div class="card-meta">
                            <span style="font-size:0.66rem;color:var(--text-secondary);"><i class="far fa-calendar"></i> ${formatDate(item.Tanggal)}</span>
                            <button class="copy-code-btn" onclick="event.stopPropagation();copyCode('${esc(item.Kode)}')"><i class="fas fa-copy"></i> ${esc(item.Kode)}</button>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }

        /* ---------- Library masonry: posisi absolut, kolom terpendek ----------
           Kompatibel semua browser modern (tanpa CSS masonry eksperimental).
           Urutan DOM = urutan data, sehingga urutan tab/keyboard tetap logis. */
        const LibraryMasonry = (function () {
            let grid = null, ro = null, raf = 0, mountToken = 0;

            function gapOf() {
                const v = grid ? parseFloat(getComputedStyle(grid).getPropertyValue('--mason-gap')) : NaN;
                return Number.isFinite(v) ? v : 12;
            }
            function columnsFor(width, gap) {
                const minCol = width < 760 ? 165 : 190;
                return Math.max(2, Math.min(6, Math.floor((width + gap) / (minCol + gap))));
            }
            function layout() {
                raf = 0;
                if (!grid || !grid.isConnected || !grid.classList.contains('is-masonry')) return;
                const cards = grid.querySelectorAll(':scope > .card');
                if (!cards.length) { grid.style.height = ''; return; }
                const width = grid.clientWidth;
                if (!width) return; // tab disembunyikan: layout ulang saat ukuran berubah
                const gap = gapOf();
                const cols = columnsFor(width, gap);
                const colW = Math.floor(((width - gap * (cols - 1)) / cols) * 100) / 100;
                cards.forEach(c => { if (c._mw !== colW) { c.style.width = colW + 'px'; c._mw = colW; } });
                const heights = Array.from(cards, c => c.getBoundingClientRect().height);
                const tops = new Array(cols).fill(0);
                cards.forEach((c, i) => {
                    let k = 0;
                    for (let j = 1; j < cols; j++) if (tops[j] < tops[k] - 0.5) k = j;
                    c.style.left = (k * (colW + gap)) + 'px';
                    c.style.top = tops[k] + 'px';
                    tops[k] += heights[i] + gap;
                });
                grid.style.height = Math.max(0, Math.max.apply(null, tops) - gap) + 'px';
                grid.dataset.cols = String(cols);
            }
            function refresh() { if (grid && !raf) raf = requestAnimationFrame(layout); }
            function layoutNow() { if (raf) { cancelAnimationFrame(raf); raf = 0; } layout(); }

            function imagesSettled(el, limit, timeout) {
                const vh = window.innerHeight || 800;
                const pending = Array.from(el.querySelectorAll('.card-media-img')).filter(img => {
                    if (img.complete) return false;
                    const r = img.getBoundingClientRect();
                    return r.height > 0 && r.top < vh * 1.25; // hanya gambar yang segera dimuat (lazy-load)
                }).slice(0, limit);
                if (!pending.length) return Promise.resolve();
                return new Promise(resolve => {
                    let left = pending.length;
                    const timer = setTimeout(resolve, timeout);
                    const done = () => { if (--left <= 0) { clearTimeout(timer); resolve(); } };
                    pending.forEach(img => {
                        img.addEventListener('load', done, { once: true });
                        img.addEventListener('error', done, { once: true });
                    });
                });
            }

            function unmount() {
                mountToken++;
                if (ro) { ro.disconnect(); ro = null; }
                if (raf) { cancelAnimationFrame(raf); raf = 0; }
                if (grid) {
                    grid.classList.remove('is-masonry', 'is-settling');
                    grid.style.height = '';
                    grid.removeAttribute('data-cols');
                }
                grid = null;
            }
            function mount(el) {
                unmount();
                grid = el;
                const token = ++mountToken;
                grid.classList.add('is-masonry', 'is-settling');
                if ('ResizeObserver' in window) {
                    ro = new ResizeObserver(refresh);
                    ro.observe(grid);
                    grid.querySelectorAll(':scope > .card').forEach(c => ro.observe(c));
                }
                layoutNow();
                // Tahan tampilan sampai gambar di layar pertama selesai (maks. 500ms) agar kartu tidak melompat.
                imagesSettled(grid, 10, 500).then(() => {
                    if (token !== mountToken || grid !== el) return;
                    grid.classList.remove('is-settling');
                    layoutNow();
                    observeMotionReveals(grid, { selector: '.card', reset: true });
                });
            }
            if (!('ResizeObserver' in window)) window.addEventListener('resize', refresh, { passive: true });
            return { mount, unmount, refresh, layoutNow };
        })();

        function renderLibraryMedia(item) {
            const html = renderCardMediaHtml(item);
            if (html) return html;
            // Tanpa media / format tidak didukung: placeholder dengan rasio tetap agar kartu tetap konsisten.
            return `<div class="card-media-wrapper is-fallback is-empty" style="aspect-ratio:4 / 3;" data-action="open-modal" data-code="${esc(item.Kode)}" role="button" tabindex="0" aria-label="Buka detail ${esc(item.Nama)}"></div>`;
        }

        function renderLibraryCardHtml(item){
            const isCS=isComingSoon(item), t=getItemType(item);
            const fav=isFav(item.Kode);
            const favBtn=`<button type="button" class="favorite-btn${fav?' active':''}" data-action="toggle-fav" data-code="${esc(item.Kode)}" title="${fav?'Hapus dari favorit':'Tambah ke favorit'}" aria-label="Favorit" aria-pressed="${fav?'true':'false'}"><i class="${fav?'fas':'far'} fa-star"></i></button>`;

            let chips='';
            if(isCS){
                chips+=`<span class="card-badge coming"><i class="far fa-clock"></i> Segera</span>`;
            } else {
                if(t==='paid') chips+=`<span class="card-badge paid">${esc(getPriceLabel(item))}</span>`;
                else if(t==='ads' || t==='pro' || isAds(item)) chips+=`<span class="card-badge ads"><i class="fas fa-rectangle-ad"></i> Ads</span>`;
                else chips+=`<span class="card-badge free">Gratis</span>`;
                if(getTrending(item.Kode)) chips+=`<span class="card-badge trending" title="Populer" aria-label="Populer"><i class="fas fa-fire-flame-curved"></i></span>`;
                if(t==='paid' && isPaidPlus(item)) chips+=`<span class="card-badge link-available" title="Tersedia link gratis" aria-label="Tersedia link gratis"><i class="fas fa-link"></i></span>`;
            }

            const showDl = !isCS && !isPaid(item);
            const metaLeft = isCS
                ? `<span class="card-date-label"><i class="far fa-clock"></i> Segera hadir</span>`
                : `<span><i class="far fa-calendar"></i> ${esc(formatDate(item.Tanggal))}</span>` +
                  (showDl ? `<span class="card-dl-tag" data-dl-card-code="${esc(item.Kode)}"><i class="fas fa-download"></i> ${getDownloads(item.Kode).toLocaleString()} dl</span>` : '');

            return `<div class="card${isCS ? ' coming-soon' : ''}"${isCS ? '' : ` data-action="open-modal"`} data-code="${esc(item.Kode)}">
                ${renderLibraryMedia(item)}
                <div class="card-chips">${chips}</div>
                ${favBtn}
                <div class="card-body">
                    <div class="card-title">${esc(item.Nama||'Untitled')}</div>
                    <div class="tags"><span class="card-cat-pill"><i class="fas fa-layer-group"></i> ${esc(item.Kategori||'Preset')}</span>${getTags(item).map(tg=>`<span class="tag">#${esc(tg)}</span>`).join('')}</div>
                    <div class="card-meta">
                        <div class="card-meta-left">${metaLeft}</div>
                        <button type="button" class="copy-code-btn" data-action="copy-code" data-code="${esc(item.Kode)}"><i class="fas fa-copy"></i> ${esc(item.Kode)}</button>
                    </div>
                </div>
            </div>`;
        }

        function renderLibraryPagination(){
            const paginationEl = document.getElementById('libraryPagination');
            if(!paginationEl) return;
            if(!currentFilteredList || !currentFilteredList.length){
                paginationEl.style.display = 'none';
                paginationEl.innerHTML = '';
                return;
            }

            const totalCount = currentFilteredList.length;
            const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

            if(totalPages <= 1){
                paginationEl.style.display = 'none';
                paginationEl.innerHTML = '';
                return;
            }

            const prevDisabled = libraryCurrentPage <= 1 ? 'disabled' : '';
            const nextDisabled = libraryCurrentPage >= totalPages ? 'disabled' : '';

            paginationEl.style.display = 'flex';
            paginationEl.innerHTML = `
                <div class="pagination-bar" role="navigation" aria-label="Navigasi Halaman Asset">
                    <button type="button" class="pagination-nav-btn prev-btn" onclick="changeLibraryPage(${libraryCurrentPage - 1})" ${prevDisabled} title="Halaman sebelumnya" aria-label="Halaman sebelumnya">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <span class="pagination-page-numbers">
                        <b>${libraryCurrentPage}</b> <span class="pagination-sep">/</span> <span>${totalPages}</span>
                    </span>
                    <button type="button" class="pagination-nav-btn next-btn" onclick="changeLibraryPage(${libraryCurrentPage + 1})" ${nextDisabled} title="Halaman berikutnya" aria-label="Halaman berikutnya">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            `;
        }

        function renderCurrentPage(scrollToTop = false){
            const grid = document.getElementById('cardGrid');
            if(!grid) return;
            grid.classList.remove('is-loading');
            if(!currentFilteredList || !currentFilteredList.length){
                LibraryMasonry.unmount();
                lastLibrarySig = '';
                grid.innerHTML = `<div class="empty-state">
                    <div class="empty-state-icon"><i class="fas fa-magnifying-glass"></i></div>
                    <h3>Tidak ada asset</h3>
                    <p>Coba kata kunci lain atau reset filter</p>
                    <button class="chip active" onclick="resetFilters()">Reset filter</button>
                </div>`;
                renderLibraryPagination();
                return;
            }

            const totalPages = Math.max(1, Math.ceil(currentFilteredList.length / ITEMS_PER_PAGE));
            if(libraryCurrentPage > totalPages) libraryCurrentPage = totalPages;
            if(libraryCurrentPage < 1) libraryCurrentPage = 1;

            const startIdx = (libraryCurrentPage - 1) * ITEMS_PER_PAGE;
            const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, currentFilteredList.length);
            const pageItems = currentFilteredList.slice(startIdx, endIdx);

            // Isi halaman identik dengan yang sudah tampil: tidak perlu membangun ulang kartu.
            const sig = libraryDataVersion + '|' + libraryCurrentPage + '|' + pageItems.map(i => i.Kode).join(',');
            if (sig !== lastLibrarySig || !grid.querySelector(':scope > .card')) {
                lastLibrarySig = sig;
                grid.innerHTML = pageItems.map(item => renderLibraryCardHtml(item)).join('');
                LibraryMasonry.mount(grid);
            }
            const openModalEl = document.getElementById('modal');
            if (openModalEl && openModalEl.classList.contains('open') && currentItem) {
                setActiveCardHighlight(currentItem.Kode);
            }
            renderLibraryPagination();

            if(scrollToTop){
                const target = document.getElementById('librarySectionTitle') || document.getElementById('cardGrid');
                if(target){
                    const headerOffset = 90;
                    const elementPosition = target.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                    window.scrollTo({
                        top: Math.max(0, offsetPosition),
                        behavior: 'smooth'
                    });
                }
            }
        }

        function renderGrid(items, resetPage = true){
            currentFilteredList = items || [];
            if(resetPage) libraryCurrentPage = 1;
            renderCurrentPage(false);
        }

        function changeLibraryPage(targetPage){
            const totalPages = Math.max(1, Math.ceil(currentFilteredList.length / ITEMS_PER_PAGE));
            if(targetPage < 1 || targetPage > totalPages || targetPage === libraryCurrentPage) return;
            libraryCurrentPage = targetPage;
            renderCurrentPage(true);
        }

        function applyFilters(keepPage){
            const active = document.activeElement;
            const searchEl = document.getElementById('searchInput');
            const assetEl = document.getElementById('assetSearchInput');
            if(active && active===searchEl && assetEl && searchEl) assetEl.value=searchEl.value;
            else if(active && active===assetEl && searchEl && assetEl) searchEl.value=assetEl.value;
            const query = ((searchEl ? searchEl.value : '') || (assetEl ? assetEl.value : '') || '').trim();
            document.querySelectorAll('.asset-search-bar').forEach(bar => bar.classList.toggle('has-query', Boolean(query)));
            sharedQuery=query;
            let f=searchItems(query);

            if(currentFilter==='terbaru'){
                // terbaru (sheet dari bawah ke atas)
                f=f.slice().sort((a,b)=>(b._sheetIndex??0)-(a._sheetIndex??0));
            }
            else if(currentFilter==='terlama'){
                // terlama (sheet dari atas ke bawah)
                f=f.slice().sort((a,b)=>(a._sheetIndex??0)-(b._sheetIndex??0));
            }
            else if(currentFilter==='terpopuler'){
                // terpopuler (yg paling byk di download)
                f=f.slice().filter(i=>!isComingSoon(i)).sort((a,b)=>{
                    const diff = getDownloads(b.Kode) - getDownloads(a.Kode);
                    if(diff !== 0) return diff;
                    return (b._sheetIndex??0) - (a._sheetIndex??0);
                });
            }
            else if(currentFilter==='ads' || currentFilter==='pro'){
                // ads (preset beriklan/sponsor & di sheet harganya 'pro')
                f=f.filter(i=>isAds(i)).sort((a,b)=>(b._sheetIndex??0)-(a._sheetIndex??0));
            }
            else if(currentFilter==='forsale' || currentFilter==='paid'){
                // for sale (asset berbayar/dijual, BUKAN pro, BUKAN ads)
                f=f.filter(i=>isForSale(i)).sort((a,b)=>(b._sheetIndex??0)-(a._sheetIndex??0));
            }
            else if(currentFilter==='free') f=f.filter(i=>!isComingSoon(i)&&!isAds(i)&&!isForSale(i)).sort((a,b)=>(b._sheetIndex??0)-(a._sheetIndex??0));
            else if(currentFilter==='new') f=f.filter(i=>!isComingSoon(i)&&isNew(i.Tanggal)).sort((a,b)=>(b._sheetIndex??0)-(a._sheetIndex??0));
            else if(currentFilter==='coming') f=f.filter(i=>isComingSoon(i)).sort((a,b)=>(b._sheetIndex??0)-(a._sheetIndex??0));
            else if(currentFilter==='fav') f=f.filter(i=>isFav(i.Kode)).sort((a,b)=>(b._sheetIndex??0)-(a._sheetIndex??0));
            else {
                // 'all' default: sheet dari bawah ke atas
                f=f.slice().sort((a,b)=>(b._sheetIndex??0)-(a._sheetIndex??0));
            }

            renderGrid(f, keepPage !== true);
            const sf = document.getElementById('statFiltered');
            if(sf) sf.textContent=f.length;
            const st = document.getElementById('statTotal');
            if(st) st.textContent=allItems.length;

            const titleEl = document.getElementById('librarySectionTitle');
            if(titleEl){
                const titles = {
                    all: '<i class="fas fa-layer-group"></i> Semua Asset',
                    terbaru: '<i class="fas fa-arrow-up-wide-short"></i> Terbaru',
                    terlama: '<i class="fas fa-arrow-down-wide-short"></i> Terlama',
                    terpopuler: '<i class="fas fa-fire"></i> Terpopuler',
                    ads: '<i class="fas fa-rectangle-ad"></i> Ads',
                    forsale: '<i class="fas fa-tag"></i> For Sale',
                    free: '<i class="fas fa-gift"></i> Asset Gratis',
                    paid: '<i class="fas fa-credit-card"></i> Asset Berbayar',
                    new: '<i class="fas fa-sparkles"></i> Asset Baru',
                    coming: '<i class="fas fa-clock"></i> Coming Soon',
                    fav: '<i class="fas fa-star" style="color:#fbbf24;"></i> Asset Favorit'
                };
                titleEl.innerHTML = titles[currentFilter] || '<i class="fas fa-layer-group"></i> Library Asset';
            }

            document.querySelectorAll('#libraryFilterChips .chip[data-filter]').forEach(c=>c.classList.toggle('active',c.dataset.filter===currentFilter));
            document.querySelectorAll('#libraryFilterChips .fav-chip').forEach(c=>c.classList.toggle('active',currentFilter==='fav'));
        }

        function filterByCategory(cat){
            switchTab('semua');
            currentFilter='all';
            const s=document.getElementById('searchInput');
            if(s) s.value=cat;
            const as=document.getElementById('assetSearchInput');
            if(as) as.value=cat;
            sharedQuery=cat;
            applyFilters();
            setTimeout(()=>{
                const target=document.getElementById('librarySectionTitle')||document.getElementById('cardGrid');
                if(target) target.scrollIntoView({behavior:'smooth',block:'start'});
            },80);
        }

        function renderFooterExtras(){
            const catCount={};
            allItems.forEach(i=>{ const c=i.Kategori||'Umum'; catCount[c]=(catCount[c]||0)+1; });
            const topCats=Object.entries(catCount).sort((a,b)=>b[1]-a[1]).slice(0,5);
            const catEl=document.getElementById('footerCategories');
            if(catEl) catEl.innerHTML=topCats.length?topCats.map(([c])=>`<button type="button" onclick="filterByCategory('${esc(c)}')"><i class="fas fa-folder-open" style="font-size:0.7rem;color:var(--accent);"></i> ${esc(c)}</button>`).join(''):'<span style="font-size:0.75rem;color:var(--text-muted);">Belum ada data</span>';

            const popular=[...allItems].filter(i=>!isComingSoon(i)).sort((a,b)=>getDownloads(b.Kode)-getDownloads(a.Kode)).slice(0,5);
            const popEl=document.getElementById('footerPopular');
            if(popEl) popEl.innerHTML=popular.length?popular.map(i=>`<button type="button" onclick="openModalByCode('${esc(i.Kode)}')"><i class="fas fa-play" style="font-size:0.65rem;color:var(--accent);"></i> ${esc(i.Nama||'Untitled')}</button>`).join(''):'<span style="font-size:0.75rem;color:var(--text-muted);">Belum ada data</span>';

            const newest=allItems.slice(0,5);
            const newEl=document.getElementById('footerNewest');
            if(newEl) newEl.innerHTML=newest.length?newest.map(i=>`<button type="button" onclick="openModalByCode('${esc(i.Kode)}')"><i class="fas fa-sparkles" style="font-size:0.65rem;color:var(--accent);"></i> ${esc(i.Nama||'Untitled')}</button>`).join(''):'<span style="font-size:0.75rem;color:var(--text-muted);">Belum ada data</span>';
        }

        function renderAll(){ applyFilters(); renderFeatured(); renderPaidGrid(); updateStats(); renderFooterExtras(); }
        function resetFilters(){
            currentFilter='all';
            const s=document.getElementById('searchInput');
            if(s) s.value='';
            const as=document.getElementById('assetSearchInput');
            if(as) as.value='';
            applyFilters();
            showToast('Filter direset');
        }

        let waCloseTimer = null;
        function showWAPopup(link){
            if(sessionStorage.getItem('wa_prompt_shown')==='true'){ if(link) window.open(link,'_blank','noopener,noreferrer'); return; }
            pendingLink=link;
            const waEl = document.getElementById('waPopup');
            if(waEl){
                if (waCloseTimer) { clearTimeout(waCloseTimer); waCloseTimer = null; }
                waEl.style.display='flex';
                requestAnimationFrame(() => {
                    waEl.classList.add('open');
                });
            }
            document.body.style.overflow='hidden';
            sessionStorage.setItem('wa_prompt_shown','true');
        }
        function hideWAPopup(){
            const waEl = document.getElementById('waPopup');
            if(waEl){
                waEl.classList.remove('open');
                if (waCloseTimer) clearTimeout(waCloseTimer);
                waCloseTimer = setTimeout(() => {
                    if (!waEl.classList.contains('open')) waEl.style.display='none';
                    waCloseTimer = null;
                }, 240);
            }
            document.body.style.overflow='';
            pendingLink=null;
        }
        const waPopupOverlayEl = document.getElementById('waPopup');
        if (waPopupOverlayEl) {
            waPopupOverlayEl.addEventListener('click', (e) => { if (e.target === waPopupOverlayEl) hideWAPopup(); });
        }
        document.getElementById('waJoinBtn').addEventListener('click',()=>{ window.open(WA_CHANNEL,'_blank','noopener,noreferrer'); hideWAPopup(); });
        document.getElementById('waSkipBtn').addEventListener('click',()=>{ hideWAPopup(); });

        function setModalSlide(index, forceDirection = null) {
            const prevIndex = currentModalSlide;
            const nextIndex = Math.max(0, Math.min(2, index));

            // Pause video when switching away from Slide 0 (Preview) to Slide 1 or 2
            if (prevIndex === 0 && nextIndex !== 0) {
                const mediaContainer = document.querySelector('#modalSlide0 .modal-media-container');
                if (mediaContainer) {
                    const ifr = mediaContainer.querySelector('iframe');
                    if (ifr && ifr.contentWindow) {
                        try {
                            ifr.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                        } catch(e) {}
                    }
                }
            } else if (prevIndex !== 0 && nextIndex === 0) {
                const mediaContainer = document.querySelector('#modalSlide0 .modal-media-container');
                if (mediaContainer) {
                    const ifr = mediaContainer.querySelector('iframe');
                    if (ifr && ifr.contentWindow) {
                        try {
                            ifr.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                        } catch(e) {}
                    }
                }
            }

            let direction = forceDirection;
            if (!direction) {
                if (nextIndex > prevIndex) direction = 'forward';
                else if (nextIndex < prevIndex) direction = 'backward';
                else direction = 'initial';
            }

            currentModalSlide = nextIndex;

            for (let i = 0; i < 3; i++) {
                const slide = document.getElementById(`modalSlide${i}`);
                if (slide) {
                    slide.classList.remove('active', 'slide-forward', 'slide-backward', 'slide-initial');
                    if (i === currentModalSlide) {
                        slide.classList.add('active');
                        if (direction === 'forward') slide.classList.add('slide-forward');
                        else if (direction === 'backward') slide.classList.add('slide-backward');
                        else slide.classList.add('slide-initial');
                    }
                }
                const tab = document.getElementById(`modalTabBtn${i}`);
                if (tab) tab.classList.toggle('active', i === currentModalSlide);
            }
            const dots = document.querySelectorAll('.modal-dot');
            dots.forEach((dot, idx) => {
                dot.classList.toggle('active', idx === currentModalSlide);
            });
            const content = document.getElementById('modalContent');
            if (content) {
                content.scrollTop = 0;
            }
            const scrollBody = document.getElementById('modalScrollBody');
            if (scrollBody) {
                scrollBody.scrollTop = 0;
            }
        }

        let modalTouchStartX = 0;
        let modalTouchStartY = 0;
        let modalTouchEndX = 0;
        let modalTouchEndY = 0;

        function initModalSwipeGestures() {
            const track = document.getElementById('modalSlidesTrack');
            if (!track) return;

            track.addEventListener('touchstart', (e) => {
                if (e.touches && e.touches.length === 1) {
                    modalTouchStartX = e.touches[0].clientX;
                    modalTouchStartY = e.touches[0].clientY;
                }
            }, { passive: true });

            track.addEventListener('touchend', (e) => {
                if (e.changedTouches && e.changedTouches.length === 1) {
                    modalTouchEndX = e.changedTouches[0].clientX;
                    modalTouchEndY = e.changedTouches[0].clientY;
                    handleModalSwipe();
                }
            }, { passive: true });
        }

        function handleModalSwipe() {
            const diffX = modalTouchEndX - modalTouchStartX;
            const diffY = modalTouchEndY - modalTouchStartY;
            const minSwipeDist = 45;

            // Ensure clear horizontal swipe gesture
            if (Math.abs(diffX) > minSwipeDist && Math.abs(diffX) > Math.abs(diffY) * 1.35) {
                if (diffX < 0) {
                    // Swiped Left -> go forward
                    if (currentModalSlide < 2) {
                        setModalSlide(currentModalSlide + 1, 'forward');
                    }
                } else {
                    // Swiped Right -> go backward
                    if (currentModalSlide > 0) {
                        setModalSlide(currentModalSlide - 1, 'backward');
                    }
                }
            }
        }

        function renderPreviewSlide(item) {
            const mediaEl = document.getElementById('modalMedia');
            if (!mediaEl) return;
            const media = parseMedia(item);

            let mediaHtml = '';
            if (media && media.type === 'youtube' && isSafeYouTubeId(media.id)) {
                const rStyle = (media.ratioCss && media.ratioCss !== 'auto') ? `aspect-ratio:${esc(media.ratioCss)};` : '';
                mediaHtml = `
                    <div class="modal-media-container" style="${rStyle}" data-media-item="${esc(item.Kode)}">
                        <iframe class="modal-media-iframe" src="${esc(media.embedUrl)}" title="${esc(item.Nama)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="width:100%;height:100%;min-height:220px;border:none;border-radius:10px;display:block;"></iframe>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:0.75rem;color:var(--text-secondary);">
                        <span><i class="fab fa-youtube" style="color:#ef4444;"></i> Video Preview YouTube</span>
                        <span class="card-badge badge-ratio" style="font-size:0.65rem;"><i class="fas fa-vector-square" style="font-size:0.6rem;margin-right:3px;"></i> <span class="media-badge-text">${esc(media.ratioLabel)}</span></span>
                    </div>
                `;
            } else if (media && media.type === 'tiktok' && isSafeNumericId(media.id)) {
                const rStyle = (media.ratioCss && media.ratioCss !== 'auto') ? `aspect-ratio:${esc(media.ratioCss)};` : '';
                mediaHtml = `
                    <div class="modal-media-container" style="${rStyle}" data-media-item="${esc(item.Kode)}">
                        <iframe src="${esc(media.embedUrl)}" title="${esc(item.Nama)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:0.75rem;color:var(--text-secondary);">
                        <span><i class="fab fa-tiktok"></i> TikTok Preview</span>
                        <span class="card-badge badge-ratio" style="font-size:0.65rem;"><i class="fas fa-vector-square" style="font-size:0.6rem;margin-right:3px;"></i> <span class="media-badge-text">${esc(media.ratioLabel)}</span></span>
                    </div>
                `;
            } else if (media && media.type === 'image') {
                const safeImg = sanitizeSafeUrl(media.src, false);
                if (safeImg) {
                    mediaHtml = `
                        <div class="modal-media-container" data-media-item="${esc(item.Kode)}">
                            <img src="${esc(safeImg)}" alt="${esc(item.Nama)}" loading="lazy" />
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:0.75rem;color:var(--text-secondary);">
                            <span><i class="fas fa-image" style="color:var(--primary);"></i> Preview Asset</span>
                            <span class="card-badge badge-ratio" style="font-size:0.65rem;"><i class="fas fa-vector-square" style="font-size:0.6rem;margin-right:3px;"></i> <span class="media-badge-text">${esc(media.ratioLabel)}</span></span>
                        </div>
                    `;
                }
            }
            if (!mediaHtml) {
                mediaHtml = `
                    <div class="modal-media-container" style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg-elevated);padding:32px 24px;text-align:center;min-height:220px;">
                        <i class="fas fa-film" style="font-size:2.5rem;color:var(--text-muted);margin-bottom:10px;"></i>
                        <div style="font-size:0.85rem;font-weight:600;color:var(--text);">${esc(item.Nama || 'Preview Asset')}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">Preset Alight Motion CTFY</div>
                        <span class="card-badge badge-ratio" style="font-size:0.65rem;margin-top:8px;"><i class="fas fa-cubes" style="font-size:0.6rem;margin-right:3px;"></i> Preset Asset</span>
                    </div>
                `;
            }

            let tiktokExtra = '';
            const safeTiktokLink = sanitizeSafeUrl(item.LinkTiktok, false);
            if (safeTiktokLink && (!media || media.type !== 'tiktok')) {
                tiktokExtra = `
                    <div style="margin-top:10px;">
                        <div class="action-card action-tiktok" role="button" tabindex="0" data-action="open-link" data-url="${esc(safeTiktokLink)}" data-skip-dl="1">
                            <div class="action-icon"><i class="fab fa-tiktok"></i></div>
                            <div class="action-body">
                                <div class="action-title">Lihat di TikTok</div>
                                <div class="action-desc">Tonton video preview &amp; tutorial penggunaan di TikTok</div>
                            </div>
                            <div class="action-arrow"><i class="fas fa-arrow-up-right-from-square"></i></div>
                        </div>
                    </div>
                `;
            }

            mediaEl.innerHTML = mediaHtml + tiktokExtra;
        }

        function renderOrderSlide(item) {
            const orderBox = document.getElementById('modalOrderBox');
            if (!orderBox) return;

            const t = getItemType(item);
            const price = getPriceLabel(item);

            if (isForSale(item)) {
                const waText = encodeURIComponent(`Halo Admin CTFY, saya mau order preset for sale berikut:\n\n• Nama: ${item.Nama || ''}\n• Kode: ${item.Kode || ''}\n• Harga: ${price}\n\nMohon info nomor rekening / cara pembayaran. Terima kasih!`);
                const waUrl = `https://wa.me/${WA_NUMBER}?text=${waText}`;

                const emailSubject = encodeURIComponent(`Order Preset [${item.Kode || ''}] - ${item.Nama || ''}`);
                const emailBody = encodeURIComponent(`Halo Admin CTFY,\n\nSaya ingin memesan asset for sale berikut:\n• Nama Asset: ${item.Nama || ''}\n• Kode Asset: ${item.Kode || ''}\n• Harga: ${price}\n\nMohon info rekening atau instruksi pembayaran.\nTerima kasih.`);
                const emailUrl = `mailto:${ORDER_EMAIL}?subject=${emailSubject}&body=${emailBody}`;

                orderBox.innerHTML = `
                    <div class="order-box">
                        <div style="font-size:1.8rem;margin-bottom:4px;color:var(--accent);"><i class="fas fa-bag-shopping"></i></div>
                        <h4 style="font-size:1.05rem;font-weight:700;color:var(--text);margin-bottom:4px;">Order Preset For Sale</h4>
                        <p style="font-size:0.76rem;color:var(--text-secondary);margin-bottom:8px;">Pesan langsung ke Admin resmi CTFY via WhatsApp atau Email untuk mendapatkan link asset penuh.</p>
                        <div class="order-price-badge">${esc(price)}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted);font-family:'JetBrains Mono',monospace;margin-bottom:14px;">Kode: ${esc(item.Kode || '')}</div>
                        
                        <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="order-btn-wa">
                            <i class="fab fa-whatsapp" style="font-size:1.2rem;"></i>
                            <span>Order via WhatsApp (Respon Cepat)</span>
                        </a>
                        <a href="${emailUrl}" class="order-btn-email">
                            <i class="fas fa-envelope"></i>
                            <span>Order via Email</span>
                        </a>
                        <div style="margin-top:12px;font-size:0.68rem;color:var(--text-muted);line-height:1.4;display:flex;align-items:center;justify-content:center;gap:6px;">
                            <i class="fas fa-bolt" style="color:var(--accent);"></i> <span>Pengiriman link Google Drive / XML & panduan import instan setelah konfirmasi.</span>
                        </div>
                    </div>
                `;
            } else if (isAds(item)) {
                const waText = encodeURIComponent(`Halo Admin CTFY, saya mau tanya seputar preset Ads: ${item.Nama || ''} (${item.Kode || ''}) / ingin request versi tanpa sponsor.`);
                const waUrl = `https://wa.me/${WA_NUMBER}?text=${waText}`;
                const mailUrl = `mailto:${ORDER_EMAIL}?subject=${encodeURIComponent('Tanya Preset Ads ' + (item.Kode || ''))}&body=${encodeURIComponent('Halo Admin CTFY,\n\nSaya ingin bertanya seputar preset Ads ' + (item.Nama || '') + ' (' + (item.Kode || '') + ').\n\nTerima kasih.')}`;

                orderBox.innerHTML = `
                    <div class="order-box">
                        <div style="font-size:1.8rem;margin-bottom:4px;color:#f59e0b;"><i class="fas fa-rectangle-ad"></i></div>
                        <h4 style="font-size:1.05rem;font-weight:700;color:var(--text);margin-bottom:4px;">Asset Kategori Ads</h4>
                        <p style="font-size:0.76rem;color:var(--text-secondary);margin-bottom:12px;">Preset ini gratis diunduh setelah melewati tautan sponsor pada <b>Slide 2 (Info & Download)</b>.</p>
                        <button class="slide-nav-btn next-slide-btn" onclick="setModalSlide(1)" style="margin-bottom:12px;">
                            <i class="fas fa-download"></i> <span>Buka Link Download (Slide 2)</span>
                        </button>
                        <hr style="border:none;border-top:1px solid var(--border-subtle);margin:14px 0;">
                        <p style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:10px;">Ingin request custom preset atau ada kendala?</p>
                        <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="order-btn-wa" style="background:var(--primary);box-shadow:0 4px 14px var(--primary-glow);">
                            <i class="fab fa-whatsapp"></i> <span>Hubungi Admin via WA</span>
                        </a>
                        <a href="${mailUrl}" class="order-btn-email">
                            <i class="fas fa-envelope"></i> <span>Kirim Pesan via Email</span>
                        </a>
                    </div>
                `;
            } else {
                const waText = encodeURIComponent(`Halo Admin CTFY, saya mau request custom preset / tanya seputar asset: ${item.Nama || ''} (${item.Kode || ''})`);
                const waUrl = `https://wa.me/${WA_NUMBER}?text=${waText}`;
                const mailUrl = `mailto:${ORDER_EMAIL}?subject=${encodeURIComponent('Request Custom Preset / Tanya Asset ' + (item.Kode || ''))}&body=${encodeURIComponent('Halo Admin CTFY,\n\nSaya ingin bertanya/request seputar preset ' + (item.Nama || '') + ' (' + (item.Kode || '') + ').\n\nTerima kasih.')}`;

                orderBox.innerHTML = `
                    <div class="order-box">
                        <div style="font-size:1.8rem;margin-bottom:4px;color:var(--success);"><i class="fas fa-gift"></i></div>
                        <h4 style="font-size:1.05rem;font-weight:700;color:var(--text);margin-bottom:4px;">Asset Ini Gratis!</h4>
                        <p style="font-size:0.76rem;color:var(--text-secondary);margin-bottom:12px;">Kamu dapat mengunduh preset ini secara gratis di <b>Slide 2 (Info & Download)</b>.</p>
                        <button class="slide-nav-btn next-slide-btn" onclick="setModalSlide(1)" style="margin-bottom:12px;">
                            <i class="fas fa-download"></i> <span>Buka Link Download</span>
                        </button>
                        <hr style="border:none;border-top:1px solid var(--border-subtle);margin:14px 0;">
                        <p style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:10px;">Ingin request custom preset atau ada pertanyaan?</p>
                        <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="order-btn-wa" style="background:var(--primary);box-shadow:0 4px 14px var(--primary-glow);">
                            <i class="fab fa-whatsapp"></i> <span>Hubungi Admin via WA</span>
                        </a>
                        <a href="${mailUrl}" class="order-btn-email">
                            <i class="fas fa-envelope"></i> <span>Kirim Pesan via Email</span>
                        </a>
                    </div>
                `;
            }
        }

        function renderModalLinks(item){
            const el = document.getElementById('modalLinks');
            if (isComingSoon(item)) {
                el.innerHTML = `<div style="text-align:center;padding:24px 0;">
                    <div style="font-size:2.2rem;margin-bottom:10px;color:var(--accent);"><i class="fas fa-hourglass-half"></i></div>
                    <div style="font-weight:600;margin-bottom:6px;">Coming Soon</div>
                    <div style="font-size:0.78rem;color:var(--text-secondary);">Asset ini akan segera hadir. Stay tuned!</div>
                </div>`;
                return;
            }

            const t = getItemType(item);
            const paidPlus = isPaidPlus(item);

            // Build structured action cards for Schema D, E, G, F
            function buildStructuredActionCards() {
                let cards = [];
                const safe5mb = sanitizeSafeUrl(item.Link5MB, true);
                if (safe5mb) {
                    cards.push(`
                        <div class="action-card action-am" role="button" tabindex="0" data-action="open-link" data-url="${esc(safe5mb)}" data-code="${esc(item.Kode)}">
                            <div class="action-icon"><i class="fas fa-bolt"></i></div>
                            <div class="action-body">
                                <div class="action-title">Link 5MB (Alight Motion)</div>
                                <div class="action-desc">Buka &amp; impor otomatis proyek ke aplikasi Alight Motion</div>
                            </div>
                            <div class="action-arrow"><i class="fas fa-arrow-up-right-from-square"></i></div>
                        </div>
                    `);
                }
                const safeDrive = sanitizeSafeUrl(item.LinkDrive, false);
                if (safeDrive) {
                    cards.push(`
                        <div class="action-card action-drive" role="button" tabindex="0" data-action="open-link" data-url="${esc(safeDrive)}" data-code="${esc(item.Kode)}">
                            <div class="action-icon"><i class="fab fa-google-drive"></i></div>
                            <div class="action-body">
                                <div class="action-title">Link Google Drive (XML)</div>
                                <div class="action-desc">Download file XML &amp; impor lewat aplikasi Alight Motion</div>
                            </div>
                            <div class="action-arrow"><i class="fas fa-download"></i></div>
                        </div>
                    `);
                }
                const safeAsset = sanitizeSafeUrl(item.LinkAsset, false);
                if (safeAsset) {
                    cards.push(`
                        <div class="action-card action-asset" role="button" tabindex="0" data-action="open-link" data-url="${esc(safeAsset)}" data-code="${esc(item.Kode)}">
                            <div class="action-icon"><i class="fas fa-box-open"></i></div>
                            <div class="action-body">
                                <div class="action-title">Link Aset Tambahan</div>
                                <div class="action-desc">Font, SFX audio, atau footage pelengkap</div>
                            </div>
                            <div class="action-arrow"><i class="fas fa-download"></i></div>
                        </div>
                    `);
                }
                const safeTt = sanitizeSafeUrl(item.LinkTiktok, false);
                if (safeTt) {
                    cards.push(`
                        <div class="action-card action-tiktok" role="button" tabindex="0" data-action="open-link" data-url="${esc(safeTt)}" data-skip-dl="1">
                            <div class="action-icon"><i class="fab fa-tiktok"></i></div>
                            <div class="action-body">
                                <div class="action-title">Video TikTok</div>
                                <div class="action-desc">Tonton contoh hasil &amp; panduan video di TikTok</div>
                            </div>
                            <div class="action-arrow"><i class="fas fa-arrow-up-right-from-square"></i></div>
                        </div>
                    `);
                }
                return cards;
            }

            if (t === 'ads' || t === 'pro' || isAds(item)) {
                const done = sessionStorage.getItem('ad_done_'+item.Kode) === 'true';
                if (done) {
                    const cards = buildStructuredActionCards();
                    el.innerHTML = cards.length ? `<div class="action-links-stack">${cards.join('')}</div>` :
                        '<div style="text-align:center;padding:20px;font-size:0.8rem;color:var(--text-secondary);">Link segera tersedia</div>';
                } else {
                    const rawAdLink = (item.Link5MB && item.Link5MB !== '#') ? item.Link5MB : (item.LinkDrive || '');
                    const safeAdLink = sanitizeSafeUrl(rawAdLink, true);
                    el.innerHTML = `<div style="text-align:center;margin-bottom:10px;font-size:0.76rem;color:var(--text-secondary);"><i class="fas fa-rectangle-ad" style="color:var(--warning);margin-right:4px;"></i> Asset Ads — link terbuka setelah melewati tautan sponsor</div>
                        <button type="button" class="ad-button" data-action="open-ad" data-code="${esc(item.Kode)}" data-url="${esc(safeAdLink)}"><i class="fas fa-lock-open" style="margin-right:6px;"></i> Buka Link Asset (Lewati Sponsor)</button>`;
                }
                return;
            }

            if (paidPlus) {
                const cards = buildStructuredActionCards();
                let html = `
                    <div class="ad-info-box" style="margin-bottom:12px;">
                        <i class="fas fa-triangle-exclamation" style="color:var(--warning);"></i>
                        <div><b>Info Download Gratis:</b> Lewati <b>2 sponsor</b> untuk membuka file gratis, atau langsung order versi tanpa sponsor di Slide 3.</div>
                    </div>
                `;
                if (cards.length) {
                    html += `<div class="action-links-stack">${cards.join('')}</div>`;
                } else {
                    html += '<div style="text-align:center;padding:10px;font-size:0.8rem;color:var(--text-secondary);">Link belum tersedia</div>';
                }
                html += `<div style="margin-top:12px;text-align:center;">
                    <button type="button" class="slide-nav-btn next-slide-btn" onclick="setModalSlide(2)">
                        <i class="fas fa-bag-shopping"></i> <span>Order Versi Penuh (Tanpa Iklan)</span> <i class="fas fa-arrow-right"></i>
                    </button>
                </div>`;
                el.innerHTML = html;
                return;
            }

            if (t === 'paid') {
                el.innerHTML = `<div style="text-align:center;padding:16px 8px;">
                    <div style="font-size:1.6rem;margin-bottom:6px;color:var(--primary);"><i class="fas fa-credit-card"></i></div>
                    <div style="font-size:0.92rem;font-weight:700;color:var(--text);margin-bottom:4px;">Asset Berbayar (${esc(getPriceLabel(item))})</div>
                    <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:14px;">Pemesanan langsung diproses cepat oleh Admin CTFY via WhatsApp / Email.</div>
                    <button type="button" class="slide-nav-btn next-slide-btn" onclick="setModalSlide(2)">
                        <i class="fas fa-cart-shopping"></i> <span>Buka Halaman Order</span> <i class="fas fa-arrow-right"></i>
                    </button>
                </div>`;
                return;
            }

            const cards = buildStructuredActionCards();
            el.innerHTML = cards.length ? `<div class="action-links-stack">${cards.join('')}</div>` :
                '<div style="text-align:center;padding:20px;font-size:0.8rem;color:var(--text-secondary);">Link download belum tersedia</div>';
        }

        function handleLinkClick(url, code, skipDownload=false){
            const safeUrl = sanitizeSafeUrl(url, true);
            if (!safeUrl) {
                showToast('<i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i> Tautan tidak valid atau tidak aman.');
                return;
            }
            if(code && !skipDownload) trackDownload(code);
            window.open(safeUrl,'_blank','noopener,noreferrer');
            showWAPopup(null);
        }
        
        function handleAdClick(code, adLink){
            const safeAdLink = sanitizeSafeUrl(adLink, true);
            if(safeAdLink){
                // Klik sponsor belum berarti unduhan: hitungan dicatat saat link unduhan sebenarnya dibuka.
                window.open(safeAdLink, '_blank', 'noopener,noreferrer');
            }
            sessionStorage.setItem('ad_done_'+code, 'true');
            if(currentItem && currentItem.Kode === code) renderModalLinks(currentItem);
        }

        function openModal(item, updateUrl = true, pushHistory = true){
            if(!item) return;
            currentItem=item;
            const isCS=isComingSoon(item);
            document.getElementById('modalTitle').innerHTML=(isCS?'<i class="fas fa-clock" style="color:var(--primary);margin-right:6px;"></i>':'') + esc(item.Nama||'Detail Asset');
            document.getElementById('modalTags').innerHTML=isCS?'<span class="tag" style="color:var(--primary);">Coming Soon</span>':getTags(item).map(t=>`<span class="tag">#${esc(t)}</span>`).join('');

            const t=getItemType(item);
            let priceLabel;
            if(t==='paid') priceLabel=getPriceLabel(item);
            else if(t==='ads' || t==='pro') priceLabel='Ads';
            else priceLabel='Gratis';
            const showDl=!isForSale(item);

            const tab3Label = document.getElementById('modalTabOrderLabel');
            const tab3Btn = document.getElementById('modalTabBtn2');
            const slide1ToOrderText = document.getElementById('slide1ToOrderText');
            if (isForSale(item)) {
                if (tab3Label) tab3Label.textContent = `Order (${priceLabel})`;
                if (tab3Btn) tab3Btn.classList.add('tab-order-highlight');
                if (slide1ToOrderText) slide1ToOrderText.textContent = `Order (${priceLabel})`;
            } else {
                if (tab3Label) tab3Label.textContent = 'Order / Bantuan';
                if (tab3Btn) tab3Btn.classList.remove('tab-order-highlight');
                if (slide1ToOrderText) slide1ToOrderText.textContent = 'Order / Bantuan';
            }

            renderPreviewSlide(item);
            document.getElementById('modalDetails').innerHTML=`
                <div class="modal-detail-row"><span>Kategori</span><span>${esc(item.Kategori||'Preset')}</span></div>
                <div class="modal-detail-row"><span>Status / Harga</span><span style="font-weight:700;color:var(--primary);">${isCS?'Coming Soon':esc(priceLabel)}</span></div>
                ${showDl?`<div class="modal-detail-row"><span>Total Unduhan</span><span id="modalDownloadCount" data-dl-modal-code="${esc(item.Kode)}"><i class="fas fa-download" style="color:var(--primary);margin-right:5px;"></i><b>${getDownloads(item.Kode).toLocaleString()}</b> kali</span></div>`:''}
                <div class="modal-detail-row">
                    <span>Tanggal Rilis</span>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span>${esc(formatDate(item.Tanggal))}</span>
                        <button type="button" class="copy-code-btn" data-action="copy-code" data-code="${esc(item.Kode)}" style="font-size:0.65rem;padding:2px 8px;"><i class="fas fa-copy"></i> ${esc(item.Kode||'—')}</button>
                    </div>
                </div>
            `;
            renderModalLinks(item);
            renderOrderSlide(item);

            // Configure Code Badge in Modal Header
            const codeBadge = document.getElementById('modalCodeBadge');
            if (codeBadge) {
                codeBadge.innerHTML = `<i class="fas fa-barcode"></i> <span>${esc(item.Kode || '—')}</span>`;
            }

            // Reset to Slide 1 (Preview)
            setModalSlide(0);

            const scrollBody = document.getElementById('modalScrollBody');
            if (scrollBody) {
                scrollBody.scrollTop = 0;
            }

            const modal = document.getElementById('modal');
            if (typeof modalCloseTimer !== 'undefined' && modalCloseTimer) {
                clearTimeout(modalCloseTimer);
                modalCloseTimer = null;
            }
            modal.style.display = 'flex';
            requestAnimationFrame(() => {
                modal.classList.add('open');
            });
            setActiveCardHighlight(item.Kode);
            document.body.style.overflow = 'hidden';

            updatePageTitle(currentTab || 'semua', currentToolsSubTab, item.Nama || item.Kode);
            if (updateUrl) {
                const targetUrl = buildAppUrl(currentTab || 'semua', item.Kode);
                const currentFull = window.location.pathname + window.location.search;
                if (currentFull !== targetUrl) {
                    if (pushHistory) {
                        window.history.pushState({ tab: currentTab || 'semua', code: item.Kode }, '', targetUrl);
                    } else {
                        window.history.replaceState({ tab: currentTab || 'semua', code: item.Kode }, '', targetUrl);
                    }
                }
            }
        }

        function openModalByCode(code, updateUrl = true, pushHistory = true){
            if(!code) return;
            if(!allItems.length) {
                pendingCardCode = code;
                return;
            }
            const cleanCode = String(code).trim().toLowerCase();
            const item = allItems.find(i => {
                if (!i || !i.Kode) return false;
                const k = String(i.Kode).trim().toLowerCase();
                return k === cleanCode || k === cleanCode.replace(/^#/, '');
            });
            if(item) {
                openModal(item, updateUrl, pushHistory);
            } else {
                showToast('Asset tidak ditemukan: ' + esc(code));
            }
        }

        let modalCloseTimer = null;
        function closeModal(updateUrl = true){
            const modal = document.getElementById('modal');
            if (!modal) return;
            // Stop any playing video/audio immediately
            const mediaEl = document.getElementById('modalMedia');
            if (mediaEl) {
                const iframes = mediaEl.querySelectorAll('iframe');
                iframes.forEach(ifr => {
                    try { ifr.src = 'about:blank'; } catch(e){}
                });
            }
            modal.classList.remove('open');
            setActiveCardHighlight(null);
            if (modalCloseTimer) clearTimeout(modalCloseTimer);
            modalCloseTimer = setTimeout(() => {
                if (!modal.classList.contains('open')) {
                    if (mediaEl) mediaEl.innerHTML = '';
                    modal.style.display = 'none';
                    document.body.style.overflow = '';
                    setModalSlide(0);
                }
                modalCloseTimer = null;
            }, 240);

            updatePageTitle(currentTab || 'platform', currentToolsSubTab);
            if (updateUrl) {
                const targetUrl = buildAppUrl(currentTab || 'platform');
                const currentFull = window.location.pathname + window.location.search;
                if (currentFull !== targetUrl) {
                    window.history.replaceState({ tab: currentTab || 'platform' }, '', targetUrl);
                }
            }
        }
        document.getElementById('modal').addEventListener('click', function(e){
            if (e.target === this) closeModal();
        });

        // Mobile touch & swipe navigation
        (function initModalSwipe() {
            const content = document.getElementById('modalContent');
            if (!content) return;

            let startX = 0, startY = 0, startTime = 0;
            content.addEventListener('touchstart', e => {
                if (e.touches && e.touches.length === 1) {
                    startX = e.touches[0].clientX;
                    startY = e.touches[0].clientY;
                    startTime = Date.now();
                }
            }, { passive: true });

            content.addEventListener('touchend', e => {
                if (!startX || !startY) return;
                if (e.changedTouches && e.changedTouches.length === 1) {
                    const endX = e.changedTouches[0].clientX;
                    const endY = e.changedTouches[0].clientY;
                    const diffX = endX - startX;
                    const diffY = endY - startY;
                    const elapsed = Date.now() - startTime;

                    // Only trigger on clear, fast horizontal swipe (not during vertical scrolling)
                    if (elapsed < 400 && Math.abs(diffX) > 65 && Math.abs(diffX) > Math.abs(diffY) * 2.2) {
                        if (diffX < 0) {
                            setModalSlide(currentModalSlide + 1);
                        } else {
                            setModalSlide(currentModalSlide - 1);
                        }
                    }
                }
                startX = 0;
                startY = 0;
            }, { passive: true });
        })();

        function copyAssetLink(btn){
            if(currentItem){
                flashCopiedButton(btn, 'Tersalin');
                const targetPath = buildAppUrl(currentTab || 'semua', currentItem.Kode);
                const shareUrl = window.location.origin + targetPath;
                safeCopyToClipboard(shareUrl, '<i class="fas fa-link" style="margin-right:6px;"></i> Link disalin: ' + esc(shareUrl));
            }
        }
        function shareAsset(){
            if(currentItem){
                const targetPath = buildAppUrl(currentTab || 'semua', currentItem.Kode);
                const shareUrl = window.location.origin + targetPath;
                if(navigator.share){
                    navigator.share({title: currentItem.Nama, url: shareUrl}).catch(()=>copyAssetLink());
                } else {
                    copyAssetLink();
                }
            }
        }

        function paintDownloadCount(cleanId, count, bump){
            const label = Number(count).toLocaleString();
            const modalDlEl = document.getElementById('modalDownloadCount');
            if(modalDlEl && modalDlEl.getAttribute('data-dl-modal-code') === cleanId){
                modalDlEl.innerHTML = `<i class="fas fa-download" style="color:#10b981;margin-right:5px;"></i><b>${label}</b> kali${bump ? ' <span class="dl-increment-badge">+1</span>' : ''}`;
                if(bump){ modalDlEl.classList.add('dl-count-bump'); setTimeout(() => modalDlEl.classList.remove('dl-count-bump'), 800); }
            }
            document.querySelectorAll(`.card-dl-tag[data-dl-card-code="${escapeCssAttrVal(cleanId)}"]`).forEach(el => {
                el.innerHTML = `<i class="fas fa-download"${bump ? ' style="color:#10b981;"' : ''}></i> <b>${label}</b> dl`;
                if(bump){ el.classList.add('dl-count-bump'); setTimeout(() => el.classList.remove('dl-count-bump'), 800); }
            });
            document.querySelectorAll(`.featured-dl-tag[data-dl-feat-code="${escapeCssAttrVal(cleanId)}"]`).forEach(el => {
                el.innerHTML = `<b>${label}</b> dl`;
                if(bump){ el.classList.add('dl-count-bump'); setTimeout(() => el.classList.remove('dl-count-bump'), 800); }
            });
            updateStats();
        }

        async function trackDownload(id){
            if(!id) return;
            const cleanId = String(id).trim();
            const key = 'dl_' + cleanId;
            if(downloadSession.has(key)) return;
            downloadSession.add(key);

            // Pembaruan optimistis agar tampilan terasa instan; dibatalkan bila server tidak mengonfirmasi.
            let d = {};
            try{ d = JSON.parse(localStorage.getItem(DOWNLOADS_KEY)||'{}'); }catch(e){}
            const cur = Number(d[cleanId] !== undefined ? d[cleanId] : getDownloads(cleanId));
            const nextCount = cur + 1;
            d[cleanId] = nextCount;
            try{ localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(d)); }catch(e){}
            paintDownloadCount(cleanId, nextCount, true);

            const confirmed = await incrementFB(cleanId);
            if(confirmed){
                showToast('<i class="fas fa-circle-check" style="color:#10b981;margin-right:6px;"></i> Unduhan dicatat (+1)!');
                return;
            }
            // Gagal/timeout: kembalikan hitungan dan izinkan dicoba lagi pada klik berikutnya.
            let back = {};
            try{ back = JSON.parse(localStorage.getItem(DOWNLOADS_KEY)||'{}'); }catch(e){}
            back[cleanId] = cur;
            try{ localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(back)); }catch(e){}
            downloadSession.delete(key);
            paintDownloadCount(cleanId, cur, false);
            showToast('<i class="fas fa-triangle-exclamation" style="color:var(--warning);margin-right:6px;"></i> Hitungan unduhan belum tercatat (server tidak terjangkau).');
        }

        window.openModal = openModal;
        window.openModalByCode = openModalByCode;
        window.closeModal = closeModal;
        window.toggleFav=toggleFav;
        window.copyAssetLink=copyAssetLink;
        window.shareAsset=shareAsset;
        window.resetFilters=resetFilters;
        window.trackDownload=trackDownload;
        window.handleAdClick=handleAdClick;
        window.handleLinkClick=handleLinkClick;
        window.changeLibraryPage=changeLibraryPage;
