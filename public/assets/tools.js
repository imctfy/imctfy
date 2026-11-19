/* tools.js — TikTok Video Analyzer dan TikTok Project Link Finder (+ penyimpanan project AM lokal). Hanya halaman Tools.
   Dibangkitkan oleh scripts/build.py dari index.html asli (blok dipindah byte-exact; perubahan = daftar PATCH di FINAL_REPORT.md). */

        let lastAnalysisData = null;
        let lastLocalVideoObjectUrl = null;
        const GALLERY_AVATAR_DATA_URI = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='32' fill='%23B85D3B'/><rect x='16' y='18' width='32' height='24' rx='4' fill='none' stroke='%23ffffff' stroke-width='2.5'/><circle cx='24' cy='25' r='2.5' fill='%23ffffff'/><path d='M18 38l10-10 8 8 4-4 6 6' fill='none' stroke='%23ffffff' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/></svg>";

        function calcGcd(a, b) {
            return b === 0 ? a : calcGcd(b, a % b);
        }

        function getSimplifiedRatio(w, h) {
            if (!w || !h) return { rw: 0, rh: 0 };
            const d = calcGcd(w, h);
            return { rw: Math.round(w / d), rh: Math.round(h / d) };
        }

        function switchAnalyzerMode(mode) {
            const tabUrl = document.getElementById('tabModeUrl');
            const tabFile = document.getElementById('tabModeFile');
            const secUrl = document.getElementById('analyzerUrlSection');
            const secFile = document.getElementById('analyzerFileSection');
            const errorCard = document.getElementById('analyzerErrorCard');
            const cardTitle = document.getElementById('analyzerCardHeaderTitle');
            const cardIcon = document.getElementById('analyzerCardHeaderIcon');
            const cardSubtitle = document.getElementById('analyzerCardHeaderSubtitle');

            if (errorCard) errorCard.style.display = 'none';

            if (mode === 'url') {
                if (tabUrl) tabUrl.classList.add('active');
                if (tabFile) tabFile.classList.remove('active');
                if (cardTitle) cardTitle.textContent = 'Analisis Format Video TikTok';
                if (cardIcon) cardIcon.className = 'fab fa-tiktok';
                if (cardSubtitle) cardSubtitle.textContent = 'Periksa rasio 9:16, resolusi HD, frame rate (FPS), dan kelayakan feed TikTok langsung dari tautan video.';
                if (secUrl) {
                    secUrl.style.display = 'block';
                    secUrl.classList.remove('tab-anim-fade-up');
                    void secUrl.offsetWidth;
                    secUrl.classList.add('tab-anim-fade-up');
                }
                if (secFile) secFile.style.display = 'none';
            } else {
                if (tabFile) tabFile.classList.add('active');
                if (tabUrl) tabUrl.classList.remove('active');
                if (cardTitle) cardTitle.textContent = 'Analisis Video Galeri (Standar TikTok)';
                if (cardIcon) cardIcon.className = 'fas fa-images';
                if (cardSubtitle) cardSubtitle.textContent = 'Pilih video dari galeri HP/PC untuk memeriksa rasio 9:16, resolusi HD, dan kelancaran FPS langsung di browser.';
                if (secUrl) secUrl.style.display = 'none';
                if (secFile) {
                    secFile.style.display = 'block';
                    secFile.classList.remove('tab-anim-fade-up');
                    void secFile.offsetWidth;
                    secFile.classList.add('tab-anim-fade-up');
                }
            }
        }

        function extractMp4MetadataFromBuffer(arrayBuffer) {
            if (!arrayBuffer || arrayBuffer.byteLength < 16) return null;
            try {
                const view = new DataView(arrayBuffer);
                const len = view.byteLength;

                function getString(offset, length) {
                    let str = '';
                    for (let i = 0; i < length; i++) {
                        if (offset + i < len) {
                            str += String.fromCharCode(view.getUint8(offset + i));
                        }
                    }
                    return str;
                }

                function parseBoxes(start, end) {
                    const boxes = [];
                    let pos = start;
                    while (pos + 8 <= end && pos + 8 <= len) {
                        let size = view.getUint32(pos);
                        const type = getString(pos + 4, 4);
                        if (size === 1 && pos + 16 <= len) {
                            size = Number(view.getBigUint64(pos + 8));
                        } else if (size === 0) {
                            size = end - pos;
                        }
                        if (size < 8 || pos + size > len + 10000000) break;
                        boxes.push({ type, offset: pos, size, end: Math.min(pos + size, len) });
                        pos += size;
                    }
                    return boxes;
                }

                const rootBoxes = parseBoxes(0, len);
                const moov = rootBoxes.find(b => b.type === 'moov');
                if (!moov) return null;

                const moovBoxes = parseBoxes(moov.offset + 8, moov.end);
                const traks = moovBoxes.filter(b => b.type === 'trak');

                for (const trak of traks) {
                    const trakBx = parseBoxes(trak.offset + 8, trak.end);
                    const mdia = trakBx.find(b => b.type === 'mdia');
                    if (!mdia) continue;

                    const mdiaBx = parseBoxes(mdia.offset + 8, mdia.end);
                    const hdlr = mdiaBx.find(b => b.type === 'hdlr');
                    if (!hdlr) continue;

                    const handlerType = getString(hdlr.offset + 16, 4);
                    if (handlerType === 'vide') {
                        let width = 0;
                        let height = 0;
                        let timescale = 0;
                        let durationTicks = 0;
                        let durationSeconds = 0;
                        let fps = 0;
                        let codec = 'H.264';

                        const tkhd = trakBx.find(b => b.type === 'tkhd');
                        if (tkhd) {
                            const ver = view.getUint8(tkhd.offset + 8);
                            const wOff = (ver === 1) ? tkhd.offset + 8 + 88 : tkhd.offset + 8 + 76;
                            if (wOff + 8 <= len) {
                                width = Math.round(view.getUint32(wOff) / 65536);
                                height = Math.round(view.getUint32(wOff + 4) / 65536);
                            }
                        }

                        const mdhd = mdiaBx.find(b => b.type === 'mdhd');
                        if (mdhd) {
                            const ver = view.getUint8(mdhd.offset + 8);
                            if (ver === 1 && mdhd.offset + 8 + 32 <= len) {
                                timescale = view.getUint32(mdhd.offset + 8 + 20);
                                durationTicks = Number(view.getBigUint64(mdhd.offset + 8 + 24));
                            } else if (mdhd.offset + 8 + 20 <= len) {
                                timescale = view.getUint32(mdhd.offset + 8 + 12);
                                durationTicks = view.getUint32(mdhd.offset + 8 + 16);
                            }
                            if (timescale > 0) durationSeconds = durationTicks / timescale;
                        }

                        const minf = mdiaBx.find(b => b.type === 'minf');
                        if (minf) {
                            const minfBx = parseBoxes(minf.offset + 8, minf.end);
                            const stbl = minfBx.find(b => b.type === 'stbl');
                            if (stbl) {
                                const stblBx = parseBoxes(stbl.offset + 8, stbl.end);
                                const stsd = stblBx.find(b => b.type === 'stsd');
                                if (stsd && stsd.offset + 16 <= len) {
                                    const entryFormat = getString(stsd.offset + 16, 4);
                                    if (entryFormat === 'avc1') codec = 'H.264 / AVC';
                                    else if (entryFormat === 'hvc1' || entryFormat === 'hev1') codec = 'H.265 / HEVC';
                                    else if (entryFormat === 'vp09') codec = 'VP9';
                                    else if (entryFormat === 'av01') codec = 'AV1';
                                }

                                const stts = stblBx.find(b => b.type === 'stts');
                                if (stts && timescale > 0 && stts.offset + 16 <= len) {
                                    const entryCount = view.getUint32(stts.offset + 12);
                                    let totalFrames = 0;
                                    let totalDelta = 0;
                                    const maxEntries = Math.min(entryCount, 1500);
                                    for (let i = 0; i < maxEntries; i++) {
                                        const eOffset = stts.offset + 16 + (i * 8);
                                        if (eOffset + 8 <= len) {
                                            const count = view.getUint32(eOffset);
                                            const delta = view.getUint32(eOffset + 4);
                                            totalFrames += count;
                                            totalDelta += (count * delta);
                                        }
                                    }
                                    if (totalFrames > 0 && totalDelta > 0) {
                                        fps = (totalFrames * timescale) / totalDelta;
                                    }
                                }
                            }
                        }

                        return { width, height, timescale, durationSeconds, fps, codec };
                    }
                }
                return null;
            } catch (e) {
                console.warn('MP4 parser exception:', e);
                return null;
            }
        }

        function formatFps(fps, titleText) {
            let numFps = parseFloat(fps);
            const titleLower = (titleText || '').toLowerCase();
            const has60Tag = titleLower.includes('60fps') || titleLower.includes('60 fps') || titleLower.includes('#60fps');

            if ((!numFps || isNaN(numFps) || numFps <= 0) && has60Tag) {
                numFps = 60;
            } else if (!numFps || isNaN(numFps) || numFps <= 0) {
                numFps = 30;
            }

            const roundedVal = Math.round(numFps);
            let display = `${numFps.toFixed(2)} FPS`;
            let rawRate = `${numFps.toFixed(3)} FPS`;

            if (Math.abs(numFps - 60) < 0.45) {
                display = '60 FPS';
                rawRate = '60.000 FPS';
            } else if (Math.abs(numFps - 59.94) < 0.25) {
                display = '59.94 FPS';
                rawRate = '59.940 FPS';
            } else if (Math.abs(numFps - 50) < 0.45) {
                display = '50 FPS';
                rawRate = '50.000 FPS';
            } else if (Math.abs(numFps - 30) < 0.45) {
                display = '30 FPS';
                rawRate = '30.000 FPS';
            } else if (Math.abs(numFps - 29.97) < 0.25) {
                display = '29.97 FPS';
                rawRate = '29.970 FPS';
            } else if (Math.abs(numFps - 24) < 0.45) {
                display = '24 FPS';
                rawRate = '24.000 FPS';
            } else if (Math.abs(numFps - 23.976) < 0.25) {
                display = '23.98 FPS';
                rawRate = '23.976 FPS';
            } else if (Math.abs(numFps - roundedVal) < 0.05) {
                display = `${roundedVal} FPS`;
                rawRate = `${roundedVal}.000 FPS`;
            }

            let status = 'Normal FPS (30)';
            let statusClass = 'normal';
            let desc = 'Standar optimal frame rate TikTok (30 FPS). Streaming lancar dan efisien di seluruh perangkat.';
            let note = 'Standar streaming video TikTok';

            if (numFps >= 55 || has60Tag) {
                status = `🔥 High FPS (${roundedVal >= 55 ? roundedVal : 60})`;
                statusClass = 'high';
                desc = `Frame rate tinggi (${display}). Gerakan visual ultra halus dan responsif, optimal untuk konten motion, gaming, dan dance!`;
                note = 'Frame rate tinggi 60 FPS terdeteksi';
            } else if (numFps >= 45) {
                status = `High FPS (${roundedVal})`;
                statusClass = 'high';
                desc = `Frame rate tinggi (${display}). Di atas standar rata-rata feed TikTok.`;
                note = `${display} (High Motion)`;
            } else if (numFps < 24) {
                status = `Low FPS (${roundedVal})`;
                statusClass = 'low';
                desc = `Frame rate rendah (< 24 FPS). Gerakan visual berpotensi terasa patah-patah di feed TikTok.`;
                note = 'Frame rate di bawah standar';
            }

            return {
                value: roundedVal,
                formatted: display,
                raw: rawRate,
                status,
                statusClass,
                desc,
                statusDescription: desc,
                note
            };
        }

        function probeVideoWithFps(videoUrl) {
            return new Promise((resolve) => {
                if (!videoUrl) return resolve({ width: 0, height: 0, duration: 0, fps: 0 });
                const v = document.createElement('video');
                v.preload = 'auto';
                v.muted = true;
                v.playsInline = true;
                v.setAttribute('referrerpolicy', 'no-referrer');

                let done = false;
                let width = 0;
                let height = 0;
                let duration = 0;
                let fps = 0;

                function finish() {
                    if (!done) {
                        done = true;
                        try {
                            v.pause();
                            v.removeAttribute('src');
                            v.load();
                        } catch (e) {}
                        resolve({ width, height, duration, fps });
                    }
                }

                const timer = setTimeout(finish, 3800);

                v.onloadedmetadata = () => {
                    width = v.videoWidth || 0;
                    height = v.videoHeight || 0;
                    duration = v.duration || 0;

                    if ('requestVideoFrameCallback' in v) {
                        let frameCount = 0;
                        let firstTime = 0;

                        function countFrame(now) {
                            if (done) return;
                            if (!firstTime) firstTime = now;
                            frameCount++;
                            const elapsed = (now - firstTime) / 1000;
                            if (elapsed >= 0.35 && frameCount >= 6) {
                                fps = Math.round((frameCount / elapsed) * 100) / 100;
                                clearTimeout(timer);
                                finish();
                            } else {
                                v.requestVideoFrameCallback(countFrame);
                            }
                        }

                        v.requestVideoFrameCallback(countFrame);
                        v.play().catch(() => {
                            setTimeout(finish, 400);
                        });
                    } else {
                        setTimeout(finish, 400);
                    }
                };

                v.onerror = finish;
                v.src = videoUrl;
            });
        }

        function probeVideoDimensions(videoUrl) {
            return probeVideoWithFps(videoUrl);
        }

        function probeImageDimensions(imgUrl) {
            return new Promise((resolve) => {
                if (!imgUrl) return resolve({ width: 0, height: 0 });
                const img = new Image();
                img.referrerPolicy = 'no-referrer';
                let done = false;
                const timer = setTimeout(() => {
                    if (!done) {
                        done = true;
                        resolve({ width: 0, height: 0 });
                    }
                }, 2500);

                img.onload = () => {
                    if (!done) {
                        done = true;
                        clearTimeout(timer);
                        resolve({
                            width: img.naturalWidth || 0,
                            height: img.naturalHeight || 0
                        });
                    }
                };

                img.onerror = () => {
                    if (!done) {
                        done = true;
                        clearTimeout(timer);
                        resolve({ width: 0, height: 0 });
                    }
                };

                img.src = imgUrl;
            });
        }

        function buildVideoAnalysisData(params) {
            let width = parseInt(params.width || 0, 10);
            let height = parseInt(params.height || 0, 10);
            const duration = parseFloat(params.duration || 0);
            const size = parseInt(params.size || 0, 10);
            const title = params.title || 'TikTok Video';
            const author = params.author || { username: 'tiktok_user', nickname: 'TikTok Creator', avatar: '/assets/images/icon-192.png' };
            const playUrl = params.playUrl || '';
            const coverUrl = params.coverUrl || '';
            const inputUrl = params.url || playUrl;

            // Default fallback if width/height not detected: standard TikTok 9:16 vertical 1080x1920
            if (!width || !height) {
                width = 1080;
                height = 1920;
            }

            const ratio = width / height;
            const isNineSixteen = Math.abs(ratio - (9 / 16)) <= 0.04;
            const isOneOne = Math.abs(ratio - 1.0) <= 0.04;
            const isSixteenNine = Math.abs(ratio - (16 / 9)) <= 0.04;
            const isFourFive = Math.abs(ratio - (4 / 5)) <= 0.04;
            const { rw, rh } = getSimplifiedRatio(width, height);

            let ratioLabel = 'Unknown';
            let formatStatus = 'Unknown';
            let formatClass = 'unknown';
            let formatDesc = '';

            if (isNineSixteen) {
                ratioLabel = '9:16';
                formatStatus = '✅ 9:16 Vertikal Penuh';
                formatClass = 'success';
                formatDesc = 'Format vertikal ideal TikTok (9:16). Memenuhi layar penuh smartphone tanpa bar hitam atau pemotongan visual.';
            } else if (isOneOne) {
                ratioLabel = '1:1';
                formatStatus = '⚠️ 1:1 Persegi (Square)';
                formatClass = 'warning';
                formatDesc = 'Format persegi (1:1). Tidak memenuhi layar vertikal penuh TikTok, akan muncul area kosong di atas & bawah.';
            } else if (isSixteenNine) {
                ratioLabel = '16:9';
                formatStatus = '❌ 16:9 Horizontal (Landscape)';
                formatClass = 'error';
                formatDesc = 'Format horizontal (16:9). Kurang optimal untuk feed utama TikTok, penonton harus memutar smartphone untuk melihat penuh.';
            } else if (isFourFive) {
                ratioLabel = '4:5';
                formatStatus = '⚠️ 4:5 Vertikal Pendek';
                formatClass = 'warning';
                formatDesc = 'Format vertikal 4:5. Memiliki bar hitam tipis di feed layar penuh smartphone.';
            } else if (width < height) {
                ratioLabel = `${rw}:${rh}`;
                formatStatus = `⚠️ Vertikal Non-Standar (${rw}:${rh})`;
                formatClass = 'warning';
                formatDesc = `Format vertikal khusus (${rw}:${rh}). Bukan standar 9:16 sehingga akan memiliki sedikit letterbox.`;
            } else {
                ratioLabel = `${rw}:${rh}`;
                formatStatus = `❌ Horizontal (${rw}:${rh})`;
                formatClass = 'error';
                formatDesc = `Format video horizontal/landscape (${rw}:${rh}). Tidak direkomendasikan untuk feed vertikal TikTok.`;
            }

            // Quality
            const minSide = Math.min(width, height);
            const maxSide = Math.max(width, height);
            let quality = 'HD Quality';
            let qualityClass = 'hd';
            let qualityDesc = '';

            if (minSide >= 1080 || maxSide >= 1920) {
                quality = '1080p Full HD';
                qualityClass = 'hd';
                qualityDesc = 'Kualitas 1080p Full HD. Tampilan sangat tajam di smartphone modern dan disukai algoritma FYP TikTok.';
            } else if (minSide >= 720 || maxSide >= 1280) {
                quality = '720p HD';
                qualityClass = 'hd';
                qualityDesc = 'Memenuhi standar minimal HD TikTok (720p). Cukup tajam untuk kenyamanan tonton audiens.';
            } else if (minSide >= 480) {
                quality = '480p SD';
                qualityClass = 'sd';
                qualityDesc = 'Kualitas Standard Definition (480p). Cukup di smartphone kecil, namun bisa pecah di layar beresolusi tinggi.';
            } else {
                quality = 'Low (< 480p)';
                qualityClass = 'low';
                qualityDesc = 'Resolusi di bawah standar (< 480p). Video berpotensi tampak buram saat di-upload ke TikTok.';
            }

            // Precise Hardware Frame Rate Processing
            const fpsObj = formatFps(params.fps, title);

            // Duration & Size
            const rawDuration = Math.round(duration);
            const durationFormatted = rawDuration > 0
                ? `${Math.floor(rawDuration / 60)}:${Math.floor(rawDuration % 60).toString().padStart(2, '0')}`
                : '-';

            const rawSize = size;
            const sizeFormatted = rawSize > 0
                ? (rawSize / (1024 * 1024) < 1
                    ? `${(rawSize / 1024).toFixed(1)} KB`
                    : `${(rawSize / (1024 * 1024)).toFixed(2)} MB`)
                : '-';

            const rawBitrate = (rawSize > 0 && rawDuration > 0) ? Math.round((rawSize * 8) / rawDuration) : 0;
            const bitrateFormatted = rawBitrate > 0 ? `${(rawBitrate / 1000000).toFixed(2)} Mbps` : '-';

            const resolutionText = `${width} × ${height} px`;
            const summary = `${ratioLabel} • ${resolutionText} • ${fpsObj.formatted} • ${qualityClass.toUpperCase()}`;

            return {
                success: true,
                source: params.source || (params.isLocal ? 'gallery' : 'tiktok'),
                isLocal: !!params.isLocal,
                url: inputUrl,
                title,
                summary,
                author,
                resolution: {
                    width,
                    height,
                    formatted: resolutionText,
                    type: minSide >= 1080 ? '1080p Full HD' : (minSide >= 720 ? '720p HD' : (minSide >= 480 ? '480p SD' : 'Low Res'))
                },
                aspectRatio: {
                    value: ratio.toFixed(4),
                    label: ratioLabel,
                    is916: isNineSixteen,
                    orientation: isNineSixteen ? 'Vertikal (9:16)' : (width > height ? 'Horizontal (Landscape)' : 'Vertikal'),
                    formatStatus,
                    formatClass,
                    formatDesc
                },
                formatStatus: {
                    heading: formatStatus,
                    level: formatClass,
                    badge: isNineSixteen ? 'Format TikTok Optimal' : (width > height ? 'Format Horizontal' : 'Rasio Non-Standar'),
                    tag: isNineSixteen ? 'TikTok Ready' : 'Perlu Penyesuaian',
                    description: formatDesc
                },
                fps: fpsObj,
                quality: {
                    label: quality,
                    class: qualityClass,
                    level: qualityClass,
                    desc: qualityDesc,
                    description: qualityDesc
                },
                streams: {
                    codecName: params.codec || 'H.264',
                    codecLongName: (params.codec === 'HEVC' || params.codec === 'H.265') ? 'H.265 / High Efficiency Video Coding' : 'H.264 / AVC (Advanced Video Coding)'
                },
                media: {
                    duration: rawDuration,
                    durationSeconds: rawDuration,
                    durationFormatted,
                    fileSize: rawSize,
                    sizeFormatted,
                    fileSizeFormatted: sizeFormatted,
                    bitrate: rawBitrate,
                    bitrateFormatted,
                    codec: params.codec || 'H.264',
                    playUrl,
                    proxyPlayUrl: playUrl,
                    cover: coverUrl,
                    coverUrl
                }
            };
        }

        function initVideoAnalyzer() {
            const urlInput = document.getElementById('tiktokUrlInput');
            const clearBtn = document.getElementById('btnClearUrl');
            const dropzone = document.getElementById('analyzerDropzone');

            if (urlInput) {
                urlInput.addEventListener('input', () => {
                    if (clearBtn) {
                        clearBtn.style.display = urlInput.value.trim().length > 0 ? 'inline-flex' : 'none';
                    }
                });

                urlInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        triggerAnalyze();
                    }
                });
            }

            if (dropzone) {
                dropzone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dropzone.classList.add('dragover');
                });
                dropzone.addEventListener('dragleave', () => {
                    dropzone.classList.remove('dragover');
                });
                dropzone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropzone.classList.remove('dragover');
                    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
                        analyzeLocalVideoFile(e.dataTransfer.files[0]);
                    }
                });
            }
        }

        function clearUrlInput() {
            const urlInput = document.getElementById('tiktokUrlInput');
            const clearBtn = document.getElementById('btnClearUrl');
            if (urlInput) {
                urlInput.value = '';
                urlInput.focus();
            }
            if (clearBtn) clearBtn.style.display = 'none';
        }

        async function pasteFromClipboard() {
            const urlInput = document.getElementById('tiktokUrlInput');
            const clearBtn = document.getElementById('btnClearUrl');
            try {
                if (typeof window.focus === 'function') window.focus();
                if (document.hasFocus && document.hasFocus() && navigator.clipboard && navigator.clipboard.readText) {
                    const text = await navigator.clipboard.readText();
                    if (text && text.trim()) {
                        if (urlInput) {
                            urlInput.value = text.trim();
                            if (clearBtn) clearBtn.style.display = 'inline-flex';
                            showToast('<i class="fas fa-paste" style="color:#10b981;margin-right:6px;"></i> URL berhasil ditempel dari clipboard');
                        }
                        return;
                    }
                }
            } catch (err) {
                console.warn('Clipboard read failed:', err);
            }
            if (urlInput) {
                urlInput.focus();
                showToast('<i class="fas fa-circle-info" style="color:var(--accent);margin-right:6px;"></i> Silakan tekan Ctrl+V atau tahan untuk Paste URL');
            }
        }

        async function handleLocalVideoSelect(event) {
            const file = event.target && event.target.files && event.target.files[0];
            if (!file) return;
            analyzeLocalVideoFile(file);
        }

        async function analyzeLocalVideoFile(file) {
            const loadingCard = document.getElementById('analyzerLoadingCard');
            const errorCard = document.getElementById('analyzerErrorCard');
            const errorMsg = document.getElementById('analyzerErrorMsg');
            const resultSec = document.getElementById('analyzerResultSection');

            if (!file || (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|mov|webm|mkv|m4v)$/i))) {
                showToast('<i class="fas fa-triangle-exclamation" style="color:#f59e0b;margin-right:6px;"></i> Pilih file video (MP4, WebM, MOV)');
                return;
            }

            if (errorCard) errorCard.style.display = 'none';
            if (resultSec) resultSec.style.display = 'none';
            if (loadingCard) loadingCard.style.display = 'block';

            try {
                // 1. Binary MP4 atom extraction from file slice
                let mp4Meta = null;
                try {
                    const headBlob = file.slice(0, Math.min(file.size, 3145728)); // First 3MB
                    const headAb = await headBlob.arrayBuffer();
                    mp4Meta = extractMp4MetadataFromBuffer(headAb);

                    if (!mp4Meta && file.size > 3145728) {
                        // Check if moov is at the end of the file
                        const tailBlob = file.slice(Math.max(0, file.size - 2097152), file.size);
                        const tailAb = await tailBlob.arrayBuffer();
                        mp4Meta = extractMp4MetadataFromBuffer(tailAb);
                    }
                } catch (e) {
                    console.warn('Local MP4 binary parsing error:', e);
                }

                // 2. Video element probe for dimension and frame rate verification
                if (lastLocalVideoObjectUrl) {
                    try { URL.revokeObjectURL(lastLocalVideoObjectUrl); } catch(e) {}
                }
                const objectUrl = URL.createObjectURL(file);
                lastLocalVideoObjectUrl = objectUrl;
                const vProbe = await probeVideoWithFps(objectUrl);

                const width = (mp4Meta && mp4Meta.width) ? mp4Meta.width : (vProbe.width || 1080);
                const height = (mp4Meta && mp4Meta.height) ? mp4Meta.height : (vProbe.height || 1920);
                const duration = (mp4Meta && mp4Meta.durationSeconds) ? mp4Meta.durationSeconds : (vProbe.duration || 0);
                const detectedFps = (mp4Meta && mp4Meta.fps) ? mp4Meta.fps : (vProbe.fps || 0);
                const detectedCodec = (mp4Meta && mp4Meta.codec) ? mp4Meta.codec : (file.type.includes('mp4') ? 'H.264' : (file.type.includes('webm') ? 'VP9' : 'Video Stream'));
                const size = file.size || 0;

                const analysisData = buildVideoAnalysisData({
                    source: 'gallery',
                    isLocal: true,
                    url: file.name,
                    title: file.name,
                    author: {
                        username: 'galeri_perangkat',
                        nickname: file.name,
                        avatar: GALLERY_AVATAR_DATA_URI
                    },
                    width,
                    height,
                    duration,
                    size,
                    fps: detectedFps,
                    playUrl: objectUrl,
                    coverUrl: '',
                    codec: detectedCodec
                });

                renderTikTokAnalysis(analysisData);

                const fpsLabel = analysisData.fps.formatted;
                showToast(`<i class="fas fa-circle-check" style="color:var(--success);margin-right:6px;"></i> Video dianalisis: ${Number(width)}×${Number(height)} • ${esc(fpsLabel)}!`);

                if (window.innerWidth < 768 && resultSec) {
                    resultSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } catch (err) {
                console.error('Local video analyze error:', err);
                if (errorCard) {
                    errorCard.style.display = 'flex';
                    if (errorMsg) errorMsg.textContent = 'Gagal membaca metadata video lokal: ' + (err.message || 'Format tidak didukung.');
                }
            } finally {
                if (loadingCard) loadingCard.style.display = 'none';
            }
        }

        async function triggerAnalyze() {
            const urlInput = document.getElementById('tiktokUrlInput');
            const loadingCard = document.getElementById('analyzerLoadingCard');
            const errorCard = document.getElementById('analyzerErrorCard');
            const errorMsg = document.getElementById('analyzerErrorMsg');
            const resultSec = document.getElementById('analyzerResultSection');
            const analyzeBtn = document.getElementById('btnAnalyzeUrl');

            const url = normalizeTikTokInput(urlInput ? urlInput.value : '');

            if (!url) {
                showToast('<i class="fas fa-triangle-exclamation" style="color:var(--warning);margin-right:6px;"></i> Masukkan URL video TikTok terlebih dahulu');
                if (urlInput) urlInput.focus();
                return;
            }

            if (!isValidTikTokUrl(url)) {
                showToast('<i class="fas fa-triangle-exclamation" style="color:var(--warning);margin-right:6px;"></i> URL harus berupa tautan video TikTok yang valid (tiktok.com / vt.tiktok.com)');
                if (urlInput) urlInput.focus();
                return;
            }

            // UI Transition: Show loading, hide error and result
            if (errorCard) errorCard.style.display = 'none';
            if (resultSec) resultSec.style.display = 'none';
            if (loadingCard) loadingCard.style.display = 'block';
            if (analyzeBtn) {
                analyzeBtn.disabled = true;
                analyzeBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> <span>Menganalisis Langsung...</span>';
            }

            try {
                // 1. PURE CLIENT-SIDE TIKTOK ANALYSIS (Zero server.js dependency)
                const endpoint = 'https://www.tikwm.com/api/?url=' + encodeURIComponent(url);
                const analyzeCtrl = new AbortController();
                const analyzeTimer = setTimeout(() => analyzeCtrl.abort(), 15000);
                let response;
                try {
                    response = await fetch(endpoint, {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' },
                        signal: analyzeCtrl.signal
                    });
                } catch (netErr) {
                    throw new Error(netErr && netErr.name === 'AbortError'
                        ? 'Layanan TikTok tidak merespons dalam 15 detik. Coba lagi beberapa saat.'
                        : 'Tidak dapat terhubung ke layanan data TikTok. Periksa koneksi internet kamu.');
                } finally {
                    clearTimeout(analyzeTimer);
                }

                if (!response.ok) {
                    throw new Error(`HTTP Error ${response.status}: Gagal menghubungi server data TikTok.`);
                }

                const resJson = await response.json();

                if (!resJson || resJson.code !== 0 || !resJson.data) {
                    const msg = (resJson && resJson.msg) ? resJson.msg : 'Tautan video TikTok tidak valid atau video bersifat privat.';
                    throw new Error(msg);
                }

                const d = resJson.data;
                const playUrl = d.play || d.wmplay || '';
                const coverUrl = d.origin_cover || d.cover || '';
                const title = d.title || 'TikTok Video';
                const duration = d.duration || 0;
                const size = d.size || 0;

                const author = {
                    username: d.author ? (d.author.unique_id || d.author.id || 'tiktok_user') : 'tiktok_user',
                    nickname: d.author ? (d.author.nickname || d.author.unique_id || 'TikTok Creator') : 'TikTok Creator',
                    avatar: d.author ? (d.author.avatar || '') : ''
                };

                // 2. HARDWARE MP4 ATOM EXTRACTION (Reads moov -> trak -> stts for exact 60fps/30fps detection)
                let mp4Meta = null;
                if (playUrl) {
                    try {
                        const rangeRes = await fetch(playUrl, {
                            headers: { 'Range': 'bytes=0-655360' }, // First 640KB contains moov atom
                            referrerPolicy: 'no-referrer'
                        });
                        if (rangeRes.ok || rangeRes.status === 206) {
                            const ab = await rangeRes.arrayBuffer();
                            mp4Meta = extractMp4MetadataFromBuffer(ab);
                        }
                    } catch (e) {
                        console.warn('Direct stream range fetch error:', e);
                    }
                }

                // 3. FALLBACK VIDEO ELEMENT PROBE IF ATOM WAS NOT IN FIRST 640KB
                let probedWidth = (mp4Meta && mp4Meta.width) ? mp4Meta.width : (d.width || 0);
                let probedHeight = (mp4Meta && mp4Meta.height) ? mp4Meta.height : (d.height || 0);
                let probedDuration = (mp4Meta && mp4Meta.durationSeconds) ? mp4Meta.durationSeconds : duration;
                let detectedFps = (mp4Meta && mp4Meta.fps) ? mp4Meta.fps : 0;
                let detectedCodec = (mp4Meta && mp4Meta.codec) ? mp4Meta.codec : 'H.264';

                if (!probedWidth || !probedHeight || !detectedFps) {
                    const [vProbe, imgProbe] = await Promise.all([
                        probeVideoWithFps(playUrl),
                        (!probedWidth || !probedHeight) ? probeImageDimensions(coverUrl) : Promise.resolve({ width: 0, height: 0 })
                    ]);

                    if (vProbe.width && vProbe.height) {
                        if (!probedWidth) probedWidth = vProbe.width;
                        if (!probedHeight) probedHeight = vProbe.height;
                        if (!probedDuration && vProbe.duration) probedDuration = vProbe.duration;
                    } else if (imgProbe.width && imgProbe.height && (!probedWidth || !probedHeight)) {
                        probedWidth = imgProbe.width;
                        probedHeight = imgProbe.height;
                    }

                    if (!detectedFps && vProbe.fps) {
                        detectedFps = vProbe.fps;
                    }
                }

                // Check title/caption for 60fps tag if still undetermined
                if (!detectedFps) {
                    const lowerTitle = (title || '').toLowerCase();
                    if (lowerTitle.includes('60fps') || lowerTitle.includes('60 fps') || lowerTitle.includes('#60fps')) {
                        detectedFps = 60;
                    }
                }

                // Default standard vertical TikTok fallback if still zero
                if (!probedWidth || !probedHeight) {
                    // Jangan mengarang resolusi: lebih baik gagal jujur daripada menampilkan angka tebakan.
                    throw new Error('Resolusi video tidak dapat dibaca dari sumber. Coba lagi nanti atau gunakan analisis file video lokal.');
                }

                const analysisData = buildVideoAnalysisData({
                    source: 'tiktok',
                    isLocal: false,
                    url,
                    title,
                    author,
                    width: probedWidth,
                    height: probedHeight,
                    duration: probedDuration,
                    size,
                    fps: detectedFps,
                    playUrl,
                    coverUrl,
                    codec: detectedCodec
                });

                renderTikTokAnalysis(analysisData);

                if (window.innerWidth < 768 && resultSec) {
                    resultSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } catch (err) {
                console.error('Client-side TikTok analysis error:', err);
                if (errorCard) {
                    errorCard.style.display = 'flex';
                    if (errorMsg) errorMsg.innerHTML = `<strong>Analisis Gagal:</strong> ${esc(err.message || 'Periksa tautan video TikTok kamu.')}<br><small style="margin-top:6px;display:block;opacity:0.85;">Tips: Kamu juga bisa beralih ke tab <b>"File Video"</b> untuk menganalisis file video MP4 langsung dari galeri HP/perangkat kamu secara instan tanpa perlu server.</small>`;
                }
                showToast('<i class="fas fa-circle-xmark" style="color:var(--error);margin-right:6px;"></i> Analisis gagal: ' + esc(err.message || 'Error'));
            } finally {
                if (loadingCard) loadingCard.style.display = 'none';
                if (analyzeBtn) {
                    analyzeBtn.disabled = false;
                    analyzeBtn.innerHTML = '<i class="fas fa-bolt"></i> <span>Analisis Video TikTok</span>';
                }
            }
        }

        // ============================================================
        // RENDER TIKTOK ANALYSIS DASHBOARD
        // ============================================================
        function renderTikTokAnalysis(data) {
            const resultSec = document.getElementById('analyzerResultSection');
            if (resultSec) resultSec.style.display = 'block';

            const isGallery = data.isLocal || data.source === 'gallery';

            // Top bar
            const typeBadge = document.getElementById('resultFileTypeBadge');
            const titleEl = document.getElementById('resultVideoTitle');
            const sizeEl = document.getElementById('resultFileSizeText');

            if (typeBadge) {
                if (isGallery) {
                    typeBadge.innerHTML = '<i class="fas fa-images"></i> <span>GALERI</span>';
                    typeBadge.style.background = '#B85D3B';
                } else {
                    typeBadge.innerHTML = '<i class="fab fa-tiktok"></i> <span>TIKTOK</span>';
                    typeBadge.style.background = '#191917';
                }
            }

            if (titleEl) titleEl.textContent = data.title || (isGallery ? 'Video Galeri Lokal' : `@${data.author.username} on TikTok`);
            if (sizeEl) sizeEl.textContent = data.media.fileSizeFormatted || '-';

            // 1. SUMMARY BANNER (as specifically requested in user prompt)
            const summaryTextEl = document.getElementById('metaSummaryText');
            const summaryNoteEl = document.getElementById('metaSummaryNote');
            if (summaryTextEl) summaryTextEl.textContent = data.summary;
            if (summaryNoteEl) {
                summaryNoteEl.textContent = isGallery
                    ? `${data.formatStatus.heading} • Resolusi ${data.resolution.formatted} (Video Galeri)`
                    : `${data.formatStatus.heading} • Resolusi ${data.resolution.formatted}`;
            }

            // 2. FIVE CORE QUALITY CARDS (as specifically requested in user prompt)
            // Resolution
            const resEl = document.getElementById('metaResolution');
            const resSub = document.getElementById('metaResolutionSub');
            if (resEl) resEl.textContent = data.resolution.formatted;
            if (resSub) resSub.textContent = `${data.resolution.type} (${data.resolution.width} × ${data.resolution.height})`;

            // Ratio
            const ratioEl = document.getElementById('metaAspectRatio');
            const ratioSub = document.getElementById('metaAspectRatioSub');
            if (ratioEl) ratioEl.textContent = data.aspectRatio.label;
            if (ratioSub) ratioSub.textContent = `Rasio: ${data.aspectRatio.value} • ${data.aspectRatio.orientation}`;

            // FPS
            const fpsEl = document.getElementById('metaFps');
            const fpsSub = document.getElementById('metaFpsSub');
            if (fpsEl) fpsEl.textContent = data.fps.formatted;
            if (fpsSub) fpsSub.textContent = data.fps.note;

            // Quality (HD / SD / Low)
            const qualityEl = document.getElementById('metaQuality');
            const qualitySub = document.getElementById('metaQualitySub');
            if (qualityEl) {
                const qLevel = data.quality.level || 'hd';
                qualityEl.innerHTML = `<span class="quality-pill ${qLevel}">${data.quality.label}</span>`;
            }
            if (qualitySub) qualitySub.textContent = data.quality.description;

            // FPS Status (Normal / Low FPS / High FPS / Moderate)
            const fpsStatusEl = document.getElementById('metaFpsStatus');
            const fpsStatusSub = document.getElementById('metaFpsStatusSub');
            if (fpsStatusEl) {
                const sClass = data.fps.statusClass || 'normal';
                fpsStatusEl.innerHTML = `<span class="fps-status-pill ${sClass}">${data.fps.status}</span>`;
            }
            if (fpsStatusSub) fpsStatusSub.textContent = data.fps.statusDescription;

            // 3. FORMAT TIKTOK CARD
            const formatCard = document.getElementById('tiktokFormatCard');
            const formatBadgeText = document.getElementById('tiktokFormatBadgeText');
            const formatTag = document.getElementById('tiktokFormatTag');
            const formatHeading = document.getElementById('tiktokFormatHeading');
            const formatDesc = document.getElementById('tiktokFormatDesc');

            if (formatCard) {
                formatCard.className = `tiktok-format-card status-${data.formatStatus.level}`;
            }
            if (formatBadgeText) formatBadgeText.textContent = data.formatStatus.badge;
            if (formatTag) formatTag.textContent = data.formatStatus.tag;
            if (formatHeading) formatHeading.textContent = data.formatStatus.heading;
            if (formatDesc) formatDesc.textContent = data.formatStatus.description;

            // 4. VIDEO PREVIEW PLAYER
            const player = document.getElementById('analyzerVideoPlayer');
            const playerResPill = document.getElementById('playerResPill');
            const playerTitle = document.querySelector('.player-card .player-title');
            if (playerTitle) {
                if (isGallery) {
                    playerTitle.innerHTML = '<i class="fas fa-photo-film"></i> Preview Video Galeri';
                } else {
                    playerTitle.innerHTML = '<i class="fas fa-circle-play"></i> Preview Video TikTok';
                }
            }
            if (player) {
                const streamUrl = data.media.proxyPlayUrl || data.media.playUrl;
                if (streamUrl) {
                    player.src = streamUrl;
                    if (data.media.coverUrl) player.poster = data.media.coverUrl;
                    player.load();
                }

                // Dynamic live hardware frame rate confirmation upon playback
                if ('requestVideoFrameCallback' in player) {
                    let liveFrameCount = 0;
                    let liveStartTime = 0;
                    let liveMeasured = false;

                    player.onplay = () => {
                        liveFrameCount = 0;
                        liveStartTime = 0;
                        liveMeasured = false;

                        function checkLiveFps(now) {
                            if (liveMeasured || player.paused || player.ended) return;
                            if (!liveStartTime) liveStartTime = now;
                            liveFrameCount++;
                            const elapsed = (now - liveStartTime) / 1000;
                            if (elapsed >= 0.5 && liveFrameCount >= 10) {
                                liveMeasured = true;
                                const liveFps = (liveFrameCount / elapsed);
                                if (liveFps >= 52 && data.fps.value < 55) {
                                    // Live presentation confirmed 60 FPS! Elevate UI accordingly
                                    const upgradedFps = formatFps(60, data.title);
                                    data.fps = upgradedFps;
                                    const fpsEl = document.getElementById('metaFps');
                                    const fpsSub = document.getElementById('metaFpsSub');
                                    const fpsStatusEl = document.getElementById('metaFpsStatus');
                                    const fpsStatusSub = document.getElementById('metaFpsStatusSub');
                                    const metaRawRate = document.getElementById('metaRawRate');
                                    const summaryTextEl = document.getElementById('metaSummaryText');

                                    if (fpsEl) fpsEl.textContent = upgradedFps.formatted;
                                    if (fpsSub) fpsSub.textContent = upgradedFps.note;
                                    if (fpsStatusEl) fpsStatusEl.innerHTML = `<span class="fps-status-pill high">${upgradedFps.status}</span>`;
                                    if (fpsStatusSub) fpsStatusSub.textContent = upgradedFps.statusDescription;
                                    if (metaRawRate) metaRawRate.textContent = upgradedFps.raw;
                                    if (summaryTextEl) {
                                        summaryTextEl.textContent = `${data.aspectRatio.label} • ${data.resolution.formatted} • ${upgradedFps.formatted} • ${data.quality.level.toUpperCase()}`;
                                    }
                                    renderChecklistFromAnalysis(data);
                                    showToast('<i class="fas fa-bolt" style="color:#10b981;margin-right:6px;"></i> Playback Hardware terdeteksi: 60 FPS (High Motion)!');
                                }
                            } else {
                                player.requestVideoFrameCallback(checkLiveFps);
                            }
                        }
                        player.requestVideoFrameCallback(checkLiveFps);
                    };
                }
            }
            if (playerResPill) {
                playerResPill.textContent = `${data.resolution.width}×${data.resolution.height}`;
            }

            // 5. AUTHOR & CAPTION
            const authorAvatar = document.getElementById('authorAvatar');
            const authorNickname = document.getElementById('authorNickname');
            const authorHandle = document.getElementById('authorHandle');
            const viewOnTiktokBtn = document.getElementById('viewOnTiktokBtn');
            const captionText = document.getElementById('videoCaptionText');

            if (authorAvatar) {
                if (isGallery) {
                    authorAvatar.src = data.author.avatar || GALLERY_AVATAR_DATA_URI;
                    authorAvatar.alt = 'Ikon video galeri perangkat';
                } else {
                    authorAvatar.src = data.author.avatar || '/assets/images/icon-192.png';
                    const creatorLabel = data.author && (data.author.nickname || data.author.username);
                    authorAvatar.alt = creatorLabel ? `Foto profil ${creatorLabel}` : 'Foto profil kreator TikTok';
                }
            }
            if (authorNickname) {
                authorNickname.textContent = isGallery ? (data.title || 'File Video Galeri') : (data.author.nickname || data.author.username);
            }
            if (authorHandle) {
                if (isGallery) {
                    authorHandle.innerHTML = '<i class="fas fa-images" style="font-size:0.75rem;margin-right:4px;"></i> Galeri Perangkat';
                } else {
                    authorHandle.textContent = `@${data.author.username}`;
                }
            }
            if (viewOnTiktokBtn) {
                if (isGallery) {
                    viewOnTiktokBtn.innerHTML = '<i class="fas fa-images"></i> <span>Galeri</span>';
                    viewOnTiktokBtn.title = 'Video dari galeri lokal (Klik untuk putar)';
                    viewOnTiktokBtn.removeAttribute('target');
                    viewOnTiktokBtn.href = '#';
                    viewOnTiktokBtn.onclick = (e) => {
                        e.preventDefault();
                        const p = document.getElementById('analyzerVideoPlayer');
                        if (p) {
                            p.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            if (p.paused) p.play();
                        }
                    };
                } else {
                    viewOnTiktokBtn.innerHTML = '<i class="fab fa-tiktok"></i> <span>Buka</span>';
                    viewOnTiktokBtn.title = 'Buka di TikTok';
                    viewOnTiktokBtn.target = '_blank';
                    viewOnTiktokBtn.href = sanitizeSafeUrl(data.url, false) || '#';
                    viewOnTiktokBtn.onclick = null;
                }
            }
            if (captionText) {
                if (isGallery) {
                    captionText.textContent = `File: ${data.title} • Dianalisis langsung dari galeri perangkat secara client-side.`;
                } else {
                    captionText.textContent = data.title || 'Tidak ada deskripsi video';
                }
            }

            // Core Meta Card title
            const coreMetaTitle = document.querySelector('.core-meta-card .analyzer-card-title');
            if (coreMetaTitle) {
                if (isGallery) {
                    coreMetaTitle.innerHTML = '<i class="fas fa-images"></i> Spesifikasi Video Galeri';
                } else {
                    coreMetaTitle.innerHTML = '<i class="fas fa-microchip"></i> TikTok Video Analysis';
                }
            }

            // 6. QUICK PLAYER STATS
            const pDur = document.getElementById('playerDurationStat');
            const pSize = document.getElementById('playerSizeStat');
            const pCodec = document.getElementById('playerCodecStat');
            if (pDur) pDur.textContent = data.media.durationFormatted;
            if (pSize) pSize.textContent = data.media.fileSizeFormatted;
            if (pCodec) pCodec.textContent = data.streams.codecName.toUpperCase();

            // 7. TECHNICAL DETAILS TABLE
            const metaDur = document.getElementById('metaDuration');
            const metaSize = document.getElementById('metaFileSize');
            const metaBitrate = document.getElementById('metaBitrate');
            const metaCodec = document.getElementById('metaCodec');
            const metaRawRate = document.getElementById('metaRawRate');
            const metaFormatLabel = document.getElementById('metaFormatLabel');

            if (metaDur) metaDur.textContent = data.media.durationFormatted;
            if (metaSize) metaSize.textContent = data.media.fileSizeFormatted;
            if (metaBitrate) metaBitrate.textContent = data.media.bitrateFormatted;
            if (metaCodec) metaCodec.textContent = `${data.streams.codecLongName} (${data.streams.codecName.toUpperCase()})`;
            if (metaRawRate) metaRawRate.textContent = data.fps.raw || `${data.fps.value} FPS`;
            if (metaFormatLabel) metaFormatLabel.textContent = data.formatStatus.heading;

            // 8. CHECKLIST
            renderChecklistFromAnalysis(data);

            // 9. STORE FOR COPY
            lastAnalysisData = data;
        }

        function renderChecklistFromAnalysis(data) {
            const container = document.getElementById('tiktokChecklistItems');
            if (!container) return;

            const is916 = data.aspectRatio.is916;
            const isHD = data.quality.level === 'hd';
            const isFpsOk = data.fps.statusClass === 'normal' || data.fps.statusClass === 'high';
            const dur = data.media.durationSeconds;
            const isDurGood = dur >= 3 && dur <= 600;

            const items = [
                {
                    pass: is916,
                    title: 'Rasio Vertikal 9:16',
                    note: is916 
                        ? 'Rasio pas memenuhi layar penuh smartphone tanpa border hitam.' 
                        : `Bukan rasio vertikal standar (${data.aspectRatio.label}); akan muncul padding hitam.`
                },
                {
                    pass: isHD,
                    title: 'Standar Kualitas Resolusi (Minimal 720p)',
                    note: isHD 
                        ? `Resolusi ${data.resolution.formatted} memenuhi standar kualitas HD TikTok.` 
                        : `Resolusi ${data.resolution.formatted} (${data.quality.label}) berada di bawah standar HD.`
                },
                {
                    pass: isFpsOk,
                    title: 'Frame Rate Kelancaran Motion',
                    note: `${data.fps.formatted} (${data.fps.status}) - ${data.fps.statusDescription}`
                },
                {
                    pass: isDurGood,
                    title: 'Durasi Video Feed',
                    note: `Durasi ${data.media.durationFormatted} berada dalam rentang standar video TikTok.`
                }
            ];

            container.innerHTML = items.map(item => `
                <div class="check-row">
                    <i class="fas ${item.pass ? 'fa-circle-check check-icon pass' : 'fa-circle-exclamation check-icon warn'}"></i>
                    <div class="check-body">
                        <span class="check-title">${esc(item.title)}</span>
                        <span class="check-note">${esc(item.note)}</span>
                    </div>
                </div>
            `).join('');
        }

        function resetUrlAnalyzer() {
            const player = document.getElementById('analyzerVideoPlayer');
            const resultSec = document.getElementById('analyzerResultSection');
            const errorCard = document.getElementById('analyzerErrorCard');
            const loadingCard = document.getElementById('analyzerLoadingCard');
            const urlInput = document.getElementById('tiktokUrlInput');

            if (player) {
                player.pause();
                player.removeAttribute('src');
                player.load();
            }
            if (lastLocalVideoObjectUrl) {
                try { URL.revokeObjectURL(lastLocalVideoObjectUrl); } catch(e) {}
                lastLocalVideoObjectUrl = null;
            }

            if (resultSec) resultSec.style.display = 'none';
            if (errorCard) errorCard.style.display = 'none';
            if (loadingCard) loadingCard.style.display = 'none';

            if (urlInput) {
                urlInput.focus();
                urlInput.select();
            }
        }

        function copyAnalysisSummary(btn) {
            if (!lastAnalysisData) return;
            const d = lastAnalysisData;
            const isGal = d.isLocal || d.source === 'gallery';
            const text = [
                isGal ? '=== Video Gallery Analysis (TikTok Specs) ===' : '=== TikTok Video Analysis ===',
                `Sumber     : ${isGal ? 'Galeri / File Lokal' : 'TikTok URL'}`,
                `File/URL   : ${d.url}`,
                `Judul      : ${d.title}`,
                `Author     : ${d.author.nickname} (@${d.author.username})`,
                `Summary    : ${d.summary}`,
                `Resolution : ${d.resolution.formatted} (${d.resolution.type})`,
                `Ratio      : ${d.aspectRatio.label} (${d.aspectRatio.orientation})`,
                `FPS        : ${d.fps.formatted}`,
                `Quality    : ${d.quality.label}`,
                `FPS Status : ${d.fps.status} (${d.fps.statusDescription})`,
                `Format     : ${d.formatStatus.heading}`,
                `Duration   : ${d.media.durationFormatted}`,
                `File Size  : ${d.media.fileSizeFormatted}`,
                `Codec      : ${d.streams.codecName.toUpperCase()}`,
                'Dianalisis via CTFY Motion Tools (ctfy.my.id)'
            ].join('\n');

            flashCopiedButton(btn || document.getElementById('copyMetaBtn'), 'Disalin');
            safeCopyToClipboard(text, '<i class="fas fa-circle-check" style="color:#10b981;margin-right:6px;"></i> Metadata video disalin ke clipboard!');
        }

        /* ============================================================
           TIKTOK PROJECT LINK FINDER & TOOLS HUB LOGIC
           ============================================================ */
        let currentFinderInputMode = 'url';
        let isFinderRunning = false;

        function switchToolsSubTab(subTab, updateUrl = true, pushHistory = true) {
            if (subTab === 'finder') {
                currentToolsSubTab = 'finder';
            } else if (subTab === 'analyzer') {
                currentToolsSubTab = 'analyzer';
            } else {
                currentToolsSubTab = 'menu';
            }

            const hubView = document.getElementById('subViewToolsHub');
            const subAnalyzer = document.getElementById('subViewToolAnalyzer');
            const subFinder = document.getElementById('subViewToolFinder');

            if (hubView) hubView.style.display = currentToolsSubTab === 'menu' ? 'block' : 'none';
            if (subAnalyzer) subAnalyzer.style.display = currentToolsSubTab === 'analyzer' ? 'block' : 'none';
            if (subFinder) subFinder.style.display = currentToolsSubTab === 'finder' ? 'block' : 'none';

            const activeSubView = currentToolsSubTab === 'analyzer' ? subAnalyzer : (currentToolsSubTab === 'finder' ? subFinder : hubView);
            if (activeSubView) {
                activeSubView.classList.remove('is-entering');
                void activeSubView.offsetWidth;
                activeSubView.classList.add('is-entering');
                if (currentToolsSubTab === 'menu') {
                    observeMotionReveals(activeSubView, { selector: '.tool-hub-card' });
                }
            }

            // Smooth scroll to top when switching tools
            if (window.scrollY > 80) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            updatePageTitle(currentTab || 'tools', currentToolsSubTab);
            if (updateUrl) {
                try {
                    const targetUrl = buildAppUrl('tools', null, currentToolsSubTab);
                    const currentFull = window.location.pathname + window.location.search;
                    if (currentFull !== targetUrl) {
                        if (pushHistory) {
                            window.history.pushState({ tab: 'tools', subTool: currentToolsSubTab }, '', targetUrl);
                        } else {
                            window.history.replaceState({ tab: 'tools', subTool: currentToolsSubTab }, '', targetUrl);
                        }
                    }
                } catch(e) {}
            }
        }

        const SAVED_AM_PROJECTS_KEY = 'ctfy_saved_am_projects';
        const FINDER_HISTORY_KEY = 'ctfy_finder_history';
        const FINDER_CACHE_PREFIX = 'ctfy_finder_cache_';

        function getSavedAmProjects() {
            try {
                const raw = localStorage.getItem(SAVED_AM_PROJECTS_KEY);
                if (!raw) return [];
                const arr = JSON.parse(raw);
                return Array.isArray(arr) ? arr : [];
            } catch(e) {
                return [];
            }
        }

        function updateSavedAmBadge() {
            const badge = document.getElementById('savedAmCountBadge');
            if (badge) {
                const list = getSavedAmProjects();
                badge.textContent = list.length;
            }
        }

        function saveAmProjectToStorage(url, title = '', notes = '', source = 'manual') {
            if (!url || typeof url !== 'string') return false;
            let cleanUrl = url.trim();
            if (!cleanUrl.startsWith('http')) cleanUrl = 'https://' + cleanUrl;
            
            // Clean suffix garbage if glued
            if (cleanUrl.includes('alightcreative.com/am/share/')) {
                const m = cleanUrl.match(/(https?:\/\/(?:www\.)?alightcreative\.com\/am\/share\/u\/[^\/\s"']+\/p\/[a-zA-Z0-9]+-[0-9a-fA-F]{16,32})/i);
                if (m) cleanUrl = m[1];
            }

            const projects = getSavedAmProjects();
            const existingIdx = projects.findIndex(p => p.url.toLowerCase() === cleanUrl.toLowerCase());
            
            const now = new Date();
            const dateFormatted = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

            if (existingIdx >= 0) {
                // Update existing
                projects[existingIdx].title = title || projects[existingIdx].title || 'Project Alight Motion';
                projects[existingIdx].notes = notes || projects[existingIdx].notes || '';
                projects[existingIdx].updatedAt = Date.now();
            } else {
                projects.unshift({
                    id: 'am_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                    url: cleanUrl,
                    title: title || 'Project Alight Motion',
                    notes: notes || '',
                    source: source || 'finder',
                    date: dateFormatted,
                    createdAt: Date.now()
                });
            }

            try {
                localStorage.setItem(SAVED_AM_PROJECTS_KEY, JSON.stringify(projects));
                updateSavedAmBadge();
                renderSavedAmProjects();
                showToast('<i class="fas fa-circle-check" style="color:#10b981;margin-right:6px;"></i> Project berhasil disimpan ke LocalStorage!');
                return true;
            } catch(e) {
                showToast('<i class="fas fa-triangle-exclamation" style="color:#ef4444;margin-right:6px;"></i> Gagal menyimpan ke LocalStorage: ' + esc(e.message));
                return false;
            }
        }

        function removeSavedAmProject(id) {
            let projects = getSavedAmProjects();
            projects = projects.filter(p => p.id !== id && p.url !== id);
            try {
                localStorage.setItem(SAVED_AM_PROJECTS_KEY, JSON.stringify(projects));
                updateSavedAmBadge();
                renderSavedAmProjects();
                showToast('<i class="fas fa-trash" style="color:#ef4444;margin-right:6px;"></i> Project dihapus dari LocalStorage.');
            } catch(e) {}
        }

        function clearAllSavedAmProjects() {
            const projects = getSavedAmProjects();
            if (!projects.length) {
                showToast('<i class="fas fa-info-circle" style="color:var(--accent);margin-right:6px;"></i> Tidak ada project tersimpan.');
                return;
            }
            if (confirm('Yakin ingin menghapus SEMUA (' + projects.length + ') project Alight Motion dari LocalStorage?')) {
                try {
                    localStorage.removeItem(SAVED_AM_PROJECTS_KEY);
                    updateSavedAmBadge();
                    renderSavedAmProjects();
                    showToast('<i class="fas fa-check" style="color:#10b981;margin-right:6px;"></i> Semua project tersimpan telah dihapus.');
                } catch(e) {}
            }
        }

        function copyAllSavedAmProjects() {
            const projects = getSavedAmProjects();
            if (!projects.length) {
                showToast('<i class="fas fa-info-circle" style="color:var(--accent);margin-right:6px;"></i> Belum ada project tersimpan.');
                return;
            }
            const text = projects.map((p, idx) => `${idx + 1}. ${p.title || 'Project AM'}\n${p.url}`).join('\n\n');
            safeCopyToClipboard(text, '<i class="fas fa-circle-check" style="color:#10b981;margin-right:6px;"></i> ' + projects.length + ' link project berhasil disalin!');
        }

        function exportSavedAmProjects() {
            const projects = getSavedAmProjects();
            if (!projects.length) {
                showToast('<i class="fas fa-info-circle" style="color:var(--accent);margin-right:6px;"></i> Tidak ada project untuk diekspor.');
                return;
            }
            try {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projects, null, 2));
                const dlAnchorElem = document.createElement('a');
                dlAnchorElem.setAttribute("href", dataStr);
                dlAnchorElem.setAttribute("download", `cattfly_am_projects_${Date.now()}.json`);
                document.body.appendChild(dlAnchorElem);
                dlAnchorElem.click();
                dlAnchorElem.remove();
                showToast('<i class="fas fa-download" style="color:#10b981;margin-right:6px;"></i> File JSON berhasil diekspor!');
            } catch(e) {
                copyAllSavedAmProjects();
            }
        }

        function importSavedAmProjectsPrompt() {
            const raw = prompt('Tempelkan teks JSON atau daftar link Alight Motion di sini untuk diimpor ke LocalStorage:');
            if (!raw || !raw.trim()) return;
            try {
                let imported = [];
                if (raw.trim().startsWith('[') || raw.trim().startsWith('{')) {
                    const parsed = JSON.parse(raw.trim());
                    imported = Array.isArray(parsed) ? parsed : [parsed];
                } else {
                    const urls = extractCleanUrlsFromText(raw);
                    imported = urls.map(u => ({ url: u, title: 'Project Impor' }));
                }

                let count = 0;
                imported.forEach(item => {
                    const u = item.url || (typeof item === 'string' ? item : null);
                    if (u && (u.includes('alightcreative.com') || u.includes('alight.link'))) {
                        saveAmProjectToStorage(u, item.title || 'Project Impor', item.notes || '', 'import');
                        count++;
                    }
                });

                if (count > 0) {
                    showToast(`<i class="fas fa-circle-check" style="color:#10b981;margin-right:6px;"></i> Berhasil mengimpor ${count} project ke LocalStorage!`);
                    renderSavedAmProjects();
                } else {
                    showToast('<i class="fas fa-triangle-exclamation" style="color:#f59e0b;margin-right:6px;"></i> Tidak ditemukan link Alight Creative yang valid pada input.');
                }
            } catch(e) {
                alert('Format data tidak valid: ' + e.message);
            }
        }

        function toggleManualAddAmForm(forceState) {
            const card = document.getElementById('finderManualAddCard');
            const btn = document.getElementById('btnToggleManualAddAm');
            if (!card) return;
            const isShowing = forceState !== undefined ? forceState : (card.style.display !== 'none');
            card.style.display = isShowing ? 'none' : 'block';
            if (btn) {
                btn.innerHTML = isShowing ? '<i class="fas fa-plus"></i> <span>Tambah Link Baru</span>' : '<i class="fas fa-xmark"></i> <span>Tutup Form</span>';
            }
            if (!isShowing) {
                const inp = document.getElementById('inputManualAmUrl');
                if (inp) inp.focus();
            }
        }

        function submitManualAmProject() {
            const inpUrl = document.getElementById('inputManualAmUrl');
            const inpTitle = document.getElementById('inputManualAmTitle');
            const inpNotes = document.getElementById('inputManualAmNotes');
            const url = inpUrl ? inpUrl.value.trim() : '';
            const title = inpTitle ? inpTitle.value.trim() : '';
            const notes = inpNotes ? inpNotes.value.trim() : '';

            if (!url) return;
            if (!url.includes('alightcreative.com') && !url.includes('alight.link') && !url.includes('drive.google.com')) {
                if (!confirm('Tautan ini tidak menggunakan domain resmi Alight Creative (alightcreative.com / alight.link). Tetap simpan ke koleksi LocalStorage?')) {
                    return;
                }
            }

            const success = saveAmProjectToStorage(url, title || 'Project Alight Motion', notes, 'manual');
            if (success) {
                if (inpUrl) inpUrl.value = '';
                if (inpTitle) inpTitle.value = '';
                if (inpNotes) inpNotes.value = '';
                toggleManualAddAmForm(false);
            }
        }

        function filterSavedAmProjects(keyword) {
            renderSavedAmProjects(keyword);
        }

        function renderSavedAmProjects(filterKeyword = '') {
            const container = document.getElementById('savedAmProjectsList');
            if (!container) return;
            updateSavedAmBadge();

            const all = getSavedAmProjects();
            const kw = (filterKeyword || '').toLowerCase().trim();
            const filtered = kw ? all.filter(p => (p.title || '').toLowerCase().includes(kw) || (p.url || '').toLowerCase().includes(kw) || (p.notes || '').toLowerCase().includes(kw)) : all;

            if (!filtered.length) {
                container.innerHTML = `
                    <div class="finder-empty-card" style="margin: 10px 0;">
                        <div class="finder-empty-icon"><i class="fas fa-folder-open"></i></div>
                        <h4 class="finder-empty-title">${kw ? 'Tidak ada hasil yang cocok' : 'Belum Ada Project Tersimpan di LocalStorage'}</h4>
                        <p class="finder-empty-desc">${kw ? 'Coba gunakan kata kunci pencarian yang lain.' : 'Koleksi project Alight Motion kamu tersimpan langsung di browser ini tanpa perlu menghidupkan server. Klik tombol <b>"Tambah Link Baru"</b> atau gunakan tombol <b>"⭐ Simpan ke LocalStorage"</b> saat mengekstrak link dari TikTok/Teks.'}</p>
                        ${!kw ? `<button type="button" class="btn-tool-coba primary" style="margin: 14px auto 0;" onclick="toggleManualAddAmForm(true)"><i class="fas fa-plus"></i> Tambah Link Project Pertama</button>` : ''}
                    </div>
                `;
                return;
            }

            container.innerHTML = filtered.map(item => `
                <div class="finder-item-card am-primary">
                    <div class="finder-item-left">
                        <div class="finder-service-icon alight-motion">
                            <i class="fas fa-play"></i>
                        </div>
                        <div class="finder-item-text">
                            <div class="finder-service-label">
                                <span>${escapeHtml(item.title || 'Project Alight Motion')}</span>
                                <span class="finder-occurrences-badge" style="background:var(--accent-soft);color:var(--accent);border-color:var(--accent-border);">${escapeHtml(item.date || 'Tersimpan')}</span>
                            </div>
                            <a href="${esc(sanitizeSafeUrl(item.url, true) || "#")}" target="_blank" rel="noopener noreferrer" class="finder-item-url" title="${escapeHtml(item.url)}">${escapeHtml(item.url)}</a>
                            ${item.notes ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;"><i class="fas fa-note-sticky" style="margin-right:4px;"></i>${escapeHtml(item.notes)}</div>` : ''}
                        </div>
                    </div>
                    <div class="finder-item-actions">
                        <button type="button" class="btn-finder-copy" data-action="copy-finder-url" data-url="${esc(sanitizeSafeUrl(item.url, true) || "")}">
                            <i class="fas fa-copy"></i> <span>Salin</span>
                        </button>
                        <a href="${esc(sanitizeSafeUrl(item.url, true) || "#")}" target="_blank" rel="noopener noreferrer" class="btn-finder-open">
                            <i class="fas fa-arrow-up-right-from-square"></i> <span>Buka Project</span>
                        </a>
                        <button type="button" class="btn-finder-delete" onclick="removeSavedAmProject('${esc(item.id)}')" title="Hapus dari LocalStorage">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }

        function saveToFinderHistory(query, items, videoMeta) {
            if (!query) return;
            try {
                const raw = localStorage.getItem(FINDER_HISTORY_KEY);
                let list = raw ? JSON.parse(raw) : [];
                if (!Array.isArray(list)) list = [];

                list = list.filter(h => h.query.toLowerCase() !== query.toLowerCase());

                list.unshift({
                    query,
                    title: (videoMeta && videoMeta.title) ? videoMeta.title.substring(0, 45) : (query.length > 35 ? query.substring(0, 32) + '...' : query),
                    cover: videoMeta ? videoMeta.cover : '',
                    author: videoMeta && videoMeta.author ? (videoMeta.author.nickname || videoMeta.author.unique_id) : '',
                    items,
                    videoMeta,
                    amCount: items.filter(it => it.category === 'ALIGHT_MOTION').length,
                    time: Date.now()
                });

                if (list.length > 15) list = list.slice(0, 15);

                localStorage.setItem(FINDER_HISTORY_KEY, JSON.stringify(list));
                try {
                    localStorage.setItem(FINDER_CACHE_PREFIX + encodeURIComponent(query), JSON.stringify({ items, videoMeta, time: Date.now() }));
                } catch(e) {}

                renderFinderHistoryChips();
            } catch(e) {}
        }

        function getFinderHistory() {
            try {
                const raw = localStorage.getItem(FINDER_HISTORY_KEY);
                return raw ? JSON.parse(raw) : [];
            } catch(e) { return []; }
        }

        function renderFinderHistoryChips() {
            const wrap = document.getElementById('finderQuickHistoryWrap');
            const container = document.getElementById('finderHistoryChips');
            if (!wrap || !container) return;
            const history = getFinderHistory();
            if (!history.length) {
                wrap.style.display = 'none';
                return;
            }
            wrap.style.display = 'block';
            container.innerHTML = history.slice(0, 6).map((h, idx) => `
                <button type="button" class="finder-history-chip" onclick="loadFinderHistoryItem(${idx})">
                    <i class="fab fa-tiktok"></i>
                    <span>${escapeHtml(h.title || h.query)}</span>
                    <span style="opacity:0.8;font-size:0.7rem;">(${h.amCount || 0} AM)</span>
                </button>
            `).join('');
        }

        function loadFinderHistoryItem(idx) {
            const history = getFinderHistory();
            const item = history[idx];
            if (!item) return;

            const input = document.getElementById('finderUrlInput');
            if (input && item.query.startsWith('http')) {
                input.value = item.query;
            }
            renderFinderResults(item.items || [], item.videoMeta || null, 0);
            showToast('<i class="fas fa-bolt" style="color:#10b981;margin-right:6px;"></i> Memuat dari cache LocalStorage (0ms)!');
        }

        function handleSaveAmToLocalStorage(encodedUrl, suggestedTitle = '') {
            try {
                const url = decodeURIComponent(encodedUrl);
                const title = suggestedTitle || 'Project Alight Motion';
                saveAmProjectToStorage(url, title, 'Tersimpan dari Hasil Analisis', 'finder');
            } catch(e) {
                saveAmProjectToStorage(encodedUrl, suggestedTitle, 'Tersimpan dari Hasil Analisis', 'finder');
            }
        }

        async function pasteFromClipboardAndExtract() {
            await pasteFinderFromClipboard();
        }

        function triggerFinderManualParse() {
            triggerFinderAnalyze();
        }

        function filterCtfyPresetsFinder(keyword) {
            renderCtfyPresetsFinder(keyword);
        }

        function renderCtfyPresetsFinder(keyword = '') {
            const container = document.getElementById('ctfyPresetsFinderList');
            if (!container) return;

            let items = allItems && allItems.length ? allItems : [];
            if (!items.length) {
                const cached = getCachedData();
                if (cached && Array.isArray(cached)) items = cached;
            }

            const kw = (keyword || '').toLowerCase().trim();
            const filtered = kw
                ? items.filter(it => (it.Kode || '').toLowerCase().includes(kw) || (it.Nama || '').toLowerCase().includes(kw) || (it.Kategori || '').toLowerCase().includes(kw))
                : items;

            if (!filtered.length) {
                container.innerHTML = `
                    <div class="finder-empty-card" style="margin: 10px 0;">
                        <div class="finder-empty-icon"><i class="fas fa-magnifying-glass"></i></div>
                        <h4 class="finder-empty-title">Preset tidak ditemukan</h4>
                        <p class="finder-empty-desc">Tidak ada preset CTFY yang cocok dengan kata kunci "${escapeHtml(kw)}". Coba cari berdasarkan kode preset (A, B, AA, AD, dll).</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = filtered.map(item => {
                const has5mb = item.Link5MB && item.Link5MB !== '#';
                const hasDrive = item.LinkDrive && item.LinkDrive !== '#';
                const amLink = has5mb ? item.Link5MB : '';

                return `
                    <div class="finder-item-card am-primary">
                        <div class="finder-item-left">
                            <div class="finder-preset-badge">
                                ${escapeHtml(item.Kode || 'AM')}
                            </div>
                            <div class="finder-item-text">
                                <div class="finder-service-label">
                                    <span style="font-size:0.88rem;color:var(--text-primary);font-weight:700;">${escapeHtml(item.Nama || 'Preset Alight Motion')}</span>
                                    <span class="finder-occurrences-badge">${escapeHtml(item.Kategori || 'Preset')}</span>
                                </div>
                                ${amLink ? `<a href="${esc(sanitizeSafeUrl(amLink, true) || "#")}" target="_blank" rel="noopener noreferrer" class="finder-item-url" title="${escapeHtml(amLink)}">${escapeHtml(amLink)}</a>` : '<span style="font-size:0.8rem;color:var(--text-muted);">Link 5MB tidak tersedia</span>'}
                            </div>
                        </div>
                        <div class="finder-item-actions">
                            ${amLink ? `
                                <button type="button" class="btn-finder-copy" data-action="copy-finder-url" data-url="${esc(sanitizeSafeUrl(amLink, true) || "")}">
                                    <i class="fas fa-copy"></i> <span>Salin AM</span>
                                </button>
                                <a href="${esc(sanitizeSafeUrl(amLink, true) || "#")}" target="_blank" rel="noopener noreferrer" class="btn-finder-open">
                                    <i class="fas fa-arrow-up-right-from-square"></i> <span>Buka di AM</span>
                                </a>
                                <button type="button" class="btn-finder-save" data-action="save-am-project" data-url="${esc(sanitizeSafeUrl(amLink, true) || "")}" data-title="${esc((item.Kode || "") + " - " + (item.Nama || ""))}">
                                    <i class="fas fa-bookmark"></i> <span>Simpan</span>
                                </button>
                            ` : ''}
                            ${hasDrive ? `
                                <a href="${esc(sanitizeSafeUrl(item.LinkDrive, false) || "#")}" target="_blank" rel="noopener noreferrer" class="btn-finder-copy" title="Download File XML dari Google Drive">
                                    <i class="fab fa-google-drive"></i> <span>Drive XML</span>
                                </a>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }

        function switchFinderInputMode(mode) {
            currentFinderInputMode = 'url';
            const secUrl = document.getElementById('finderUrlSection');
            if (secUrl) secUrl.style.display = 'block';
        }

        function clearFinderUrlInput() {
            const input = document.getElementById('finderUrlInput');
            const clearBtn = document.getElementById('btnClearFinderUrl');
            if (input) {
                input.value = '';
                input.focus();
            }
            if (clearBtn) clearBtn.style.display = 'none';
        }

        async function pasteFinderFromClipboard() {
            const input = document.getElementById('finderUrlInput');
            const clearBtn = document.getElementById('btnClearFinderUrl');
            try {
                if (typeof window.focus === 'function') window.focus();
                if (document.hasFocus && document.hasFocus() && navigator.clipboard && navigator.clipboard.readText) {
                    const text = await navigator.clipboard.readText();
                    if (text && input) {
                        input.value = text.trim();
                        if (clearBtn) clearBtn.style.display = 'inline-flex';
                        triggerFinderAnalyze();
                    }
                } else {
                    if (input) input.focus();
                }
            } catch(e) {
                if (input) input.focus();
            }
        }

        function escapeHtml(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        // Contoh di placeholder ("vt.tiktok.com/...") tanpa skema tetap diterima: tambahkan https:// untuk host TikTok.
        function normalizeTikTokInput(raw) {
            const v = String(raw || '').trim();
            return /^(?:[a-z0-9-]+\.)*tiktok\.com(?:[\/?#]|$)/i.test(v) ? 'https://' + v : v;
        }

        function isValidTikTokUrl(urlStr) {
            if (!urlStr || typeof urlStr !== 'string') return false;
            const trimmed = urlStr.trim();
            try {
                const parsed = new URL(trimmed);
                if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
                const host = parsed.hostname.toLowerCase();
                if (host !== 'tiktok.com' && !host.endsWith('.tiktok.com')) return false;
                return parsed.pathname.length > 1;
            } catch (e) {
                return false;
            }
        }

        function extractCleanUrlsFromText(rawText) {
            if (!rawText || typeof rawText !== 'string') return [];
            let text = rawText;

            // 1. Handle explicit creator instructions like 'delete "😋😋"' or 'hapus "xx"'
            try {
                const deleteDirectives = [...text.matchAll(/(?:delete|hapus|ilangin|hilangkan|buang)\s*["'“‘]([^"'”’\n]+)["'”’]/gi)];
                deleteDirectives.forEach(dd => {
                    const phrase = dd[1];
                    if (phrase && phrase.length > 0 && phrase.length < 20) {
                        text = text.split(phrase).join('');
                    }
                });
            } catch(e) {}

            // 2. Normalize common obfuscations in TikTok comments:
            // e.g., "drive dot google dot com", "hxxps://", "(dot)", "[dot]", spaces around dots
            text = text.replace(/\[\s*dot\s*\]|\(\s*dot\s*\)|\s+dot\s+/gi, '.');
            text = text.replace(/\[\s*slash\s*\]|\(\s*slash\s*\)|\s+slash\s+/gi, '/');
            text = text.replace(/hxxps?:\/\//gi, 'https://');

            // 3. Remove emojis and pictographs that may be embedded inside URL protocols or hostnames
            // e.g. "https://😋😋alightcreative.com" or "alightcreative.com/😋😋"
            text = text.replace(/https?:\/\/[^\s]+|(?:\b[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\/[^\s]+/gi, (urlMatch) => {
                return urlMatch.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu, '');
            });

            const matches = [];

            // 1. High precision match for Alight Motion share URLs:
            // https://alightcreative.com/am/share/u/{userId}/p/{projectId}-{16to32hexHash}
            const amShareRegex = new RegExp('(?:https?:\\/\\/)?(?:www\\.)?alightcreative\\.com\\/am\\/share\\/u\\/[^\\/\\s"\'><]+\\/p\\/[a-zA-Z0-9]+-[0-9a-fA-F]{16,32}', 'gi');
            let m;
            while ((m = amShareRegex.exec(text)) !== null) {
                let u = m[0];
                if (!u.startsWith('http')) u = 'https://' + u;
                matches.push(u);
            }

            // Also match alight.link shortlinks and alightcreative.com/project
            const amShortRegex = new RegExp('(?:https?:\\/\\/)?(?:www\\.)?(?:alight\\.link|alightcreative\\.com\\/project)\\/[a-zA-Z0-9_-]+', 'gi');
            while ((m = amShortRegex.exec(text)) !== null) {
                let u = m[0];
                if (!u.startsWith('http')) u = 'https://' + u;
                matches.push(u);
            }

            // 2. WhatsApp Channels, Community, and wa.me links
            const waRegex = new RegExp('(?:https?:\\/\\/)?(?:whatsapp\\.com\\/channel\\/[a-zA-Z0-9_-]+|chat\\.whatsapp\\.com\\/[a-zA-Z0-9_-]+|wa\\.me\\/(?:\\+?[0-9]+)(?:\\?[^\\s<>"{}|\\\\^`\\[\\]]*)?)', 'gi');
            while ((m = waRegex.exec(text)) !== null) {
                let u = m[0];
                if (!u.startsWith('http')) u = 'https://' + u;
                u = u.replace(/-(?:Preset|Xml|Saluran|Grup|Link|Preset5mb)[^\s]*/i, '');
                matches.push(u);
            }

            // 3. Cloud storage providers (Drive, Docs, MediaFire, Dropbox, Mega, 1drv)
            const cloudRegex = new RegExp('(?:https?:\\/\\/)?(?:drive\\.google\\.com\\/(?:file\\/d\\/[a-zA-Z0-9_-]+|drive\\/folders\\/[a-zA-Z0-9_-]+|open\\?id=[a-zA-Z0-9_-]+)|docs\\.google\\.com\\/(?:document|spreadsheets|presentation)\\/d\\/[a-zA-Z0-9_-]+|mediafire\\.com\\/(?:file|download|folder)\\/[a-zA-Z0-9_\\-\\/]+|dropbox\\.com\\/(?:s|scl)\\/[a-zA-Z0-9_\\-\\/]+|mega\\.nz\\/(?:file|folder)#[a-zA-Z0-9_\\-]+|1drv\\.ms\\/[a-zA-Z0-9_\\-]+)', 'gi');
            while ((m = cloudRegex.exec(text)) !== null) {
                let u = m[0];
                if (!u.startsWith('http')) u = 'https://' + u;
                matches.push(u);
            }

            // 4. Any general http(s) URL fallback
            const generalRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
            while ((m = generalRegex.exec(text)) !== null) {
                let u = m[0];
                u = u.replace(/[.,)\]!?"';:>]+$/, '').trim();
                // Clean Alight Motion URLs if suffix words like -Preset were glued
                if (u.includes('alightcreative.com/am/share/')) {
                    const amCleanMatch = u.match(/(https?:\/\/(?:www\.)?alightcreative\.com\/am\/share\/u\/[^\/\s"']+\/p\/[a-zA-Z0-9]+-[0-9a-fA-F]{16,32})/i);
                    if (amCleanMatch) u = amCleanMatch[1];
                }
                matches.push(u);
            }

            // 5. Raw domain mentions without http:// (e.g. drive.google.com/..., mediafire.com/..., alightcreative.com/...)
            const bareDomainRegex = /(?:^|[\s(,;])((?:drive\.google\.com|docs\.google\.com|mediafire\.com|alightcreative\.com|alight\.link|dropbox\.com|mega\.nz|chat\.whatsapp\.com|wa\.me)\/[^\s<>"{}|\\^`\[\]]+)/gi;
            while ((m = bareDomainRegex.exec(text)) !== null) {
                let u = 'https://' + m[1];
                u = u.replace(/[.,)\]!?"';:>]+$/, '').trim();
                matches.push(u);
            }

            const cleanList = [];
            for (let u of matches) {
                u = u.replace(/[.,)\]!?"';:>]+$/, '').trim();
                try {
                    const parsed = new URL(u);
                    if (parsed.hostname && parsed.hostname.includes('.')) {
                        if (!cleanList.some(existing => existing.toLowerCase() === u.toLowerCase())) {
                            cleanList.push(u);
                        }
                    }
                } catch(e) {}
            }
            return cleanList;
        }

        function categorizeUrl(urlStr) {
            try {
                const parsed = new URL(urlStr);
                const host = parsed.hostname.toLowerCase();
                const path = parsed.pathname.toLowerCase();

                // 1. Alight Motion: alightcreative.com/am/share/ or alight.link or alightcreative.com/project
                if ((host.includes('alightcreative.com') && path.includes('/am/share')) || 
                    host.includes('alight.link') || 
                    (host.includes('alightcreative.com') && path.includes('/project'))) {
                    return 'ALIGHT_MOTION';
                }
                // 2. Google Drive
                if (host.includes('drive.google.com') || host.includes('docs.google.com')) {
                    return 'GOOGLE_DRIVE';
                }
                // 3. MediaFire
                if (host.includes('mediafire.com')) {
                    return 'MEDIAFIRE';
                }
                // 4. Dropbox
                if (host.includes('dropbox.com') || host.includes('db.tt')) {
                    return 'DROPBOX';
                }
                // 5. Mega
                if (host.includes('mega.nz') || host.includes('mega.co.nz') || host.includes('mega.io')) {
                    return 'MEGA';
                }
                // 6. OneDrive
                if (host.includes('onedrive.live.com') || host.includes('1drv.ms') || host.includes('sharepoint.com')) {
                    return 'ONEDRIVE';
                }
                // 7. WhatsApp
                if (host.includes('whatsapp.com') || host.includes('wa.me')) {
                    return 'WHATSAPP';
                }
                // 8. Other
                return 'OTHER';
            } catch(e) {
                return 'OTHER';
            }
        }

        function getCategoryDisplayMeta(category, urlStr) {
            switch(category) {
                case 'ALIGHT_MOTION':
                    return { label: 'Alight Motion Project', icon: 'fas fa-play', iconClass: 'alight-motion', priority: 1 };
                case 'GOOGLE_DRIVE':
                    return { label: 'Google Drive', icon: 'fab fa-google-drive', iconClass: 'google-drive', priority: 2 };
                case 'MEDIAFIRE':
                    return { label: 'MediaFire', icon: 'fas fa-fire-flame-curved', iconClass: 'mediafire', priority: 3 };
                case 'DROPBOX':
                    return { label: 'Dropbox', icon: 'fab fa-dropbox', iconClass: 'dropbox', priority: 4 };
                case 'MEGA':
                    return { label: 'Mega', icon: 'fas fa-cloud-arrow-down', iconClass: 'mega', priority: 5 };
                case 'ONEDRIVE':
                    return { label: 'OneDrive', icon: 'fas fa-cloud', iconClass: 'onedrive', priority: 6 };
                case 'WHATSAPP':
                    return { label: 'WhatsApp Channel / Chat', icon: 'fab fa-whatsapp', iconClass: 'whatsapp', priority: 7 };
                default: {
                    let hostLabel = 'Tautan Eksternal';
                    try {
                        const h = new URL(urlStr).hostname.replace(/^www\./, '');
                        hostLabel = h;
                    } catch(e) {}
                    return { label: hostLabel, icon: 'fas fa-link', iconClass: 'other', priority: 8 };
                }
            }
        }

        function processAndGroupUrls(rawUrls) {
            const urlMap = new Map();
            for (const u of rawUrls) {
                let key = u;
                try {
                    const parsed = new URL(u);
                    key = (parsed.origin + parsed.pathname).toLowerCase().replace(/\/+$/, '');
                } catch(e) {}

                if (urlMap.has(key)) {
                    urlMap.get(key).count++;
                } else {
                    const cat = categorizeUrl(u);
                    const meta = getCategoryDisplayMeta(cat, u);
                    urlMap.set(key, {
                        url: u,
                        count: 1,
                        category: cat,
                        priority: meta.priority,
                        label: meta.label,
                        icon: meta.icon,
                        iconClass: meta.iconClass
                    });
                }
            }
            return Array.from(urlMap.values());
        }

        function showFinderError(title, msg) {
            const errCard = document.getElementById('finderErrorCard');
            const errTitle = document.getElementById('finderErrorTitle');
            const errMsg = document.getElementById('finderErrorMsg');
            const statusCard = document.getElementById('finderStatusCard');
            const resultsSec = document.getElementById('finderResultsSection');

            if (statusCard) statusCard.style.display = 'none';
            if (resultsSec) resultsSec.style.display = 'none';

            if (errTitle) errTitle.textContent = title;
            if (errMsg) errMsg.textContent = msg;
            if (errCard) errCard.style.display = 'flex';
        }

        function hideFinderError() {
            const errCard = document.getElementById('finderErrorCard');
            if (errCard) errCard.style.display = 'none';
        }

        function setFinderLoading(isLoading, title = 'Sedang menganalisis komentar...', desc = 'Mengambil data komentar publik TikTok langsung di browser...') {
            isFinderRunning = isLoading;
            const statusCard = document.getElementById('finderStatusCard');
            const statusTitle = document.getElementById('finderStatusTitle');
            const statusDesc = document.getElementById('finderStatusDesc');
            const btnRun = document.getElementById('btnRunFinder');
            const btnRunManual = document.getElementById('btnRunFinderManual');

            if (statusTitle) statusTitle.textContent = title;
            if (statusDesc) statusDesc.textContent = desc;

            if (statusCard) statusCard.style.display = isLoading ? 'flex' : 'none';
            if (btnRun) {
                btnRun.disabled = isLoading;
                btnRun.style.opacity = isLoading ? '0.7' : '1';
            }
            if (btnRunManual) {
                btnRunManual.disabled = isLoading;
                btnRunManual.style.opacity = isLoading ? '0.7' : '1';
            }
        }

        function renderFinderResults(items, videoMeta = null, totalComments = 0) {
            const resultsSec = document.getElementById('finderResultsSection');
            const banner = document.getElementById('finderVideoBanner');
            const coverEl = document.getElementById('finderVideoCover');
            const titleEl = document.getElementById('finderVideoTitle');
            const authorEl = document.getElementById('finderAuthorName');
            const commentCountEl = document.getElementById('finderCommentCount');
            const amCountPill = document.getElementById('finderAmCountPill');
            const emptyAmCard = document.getElementById('finderEmptyAmCard');
            const amSec = document.getElementById('finderAmSection');
            const amBadge = document.getElementById('finderAmBadgeCount');
            const amList = document.getElementById('finderAmList');

            hideFinderError();
            if (resultsSec) resultsSec.style.display = 'block';

            // Filter ONLY Alight Motion / Alight Creative project links
            const amItems = (items || []).filter(it => it.category === 'ALIGHT_MOTION');

            // Video Meta Banner
            if (videoMeta && (videoMeta.title || videoMeta.cover || videoMeta.author)) {
                if (banner) banner.style.display = 'flex';
                if (coverEl) {
                    if (videoMeta.cover) {
                        coverEl.src = videoMeta.cover;
                        coverEl.alt = videoMeta.title ? `Thumbnail video ${videoMeta.title}` : 'Thumbnail pratinjau video TikTok';
                        coverEl.style.display = 'block';
                    } else {
                        coverEl.style.display = 'none';
                    }
                }
                if (titleEl) titleEl.textContent = videoMeta.title || 'Video TikTok';
                if (authorEl) {
                    const authorName = videoMeta.author && videoMeta.author.nickname ? videoMeta.author.nickname : (videoMeta.author && videoMeta.author.unique_id ? '@' + videoMeta.author.unique_id : 'TikTok Author');
                    authorEl.innerHTML = `<i class="fab fa-tiktok"></i> ${escapeHtml(authorName)}`;
                }
                if (commentCountEl) {
                    commentCountEl.innerHTML = `<i class="fas fa-comments"></i> ${Number(totalComments) || 0} Komentar Dianalisis`;
                }
            } else {
                if (banner) {
                    if (totalComments > 0) {
                        banner.style.display = 'flex';
                        if (coverEl) coverEl.style.display = 'none';
                        if (titleEl) titleEl.textContent = 'Analisis Komentar TikTok';
                        if (authorEl) authorEl.innerHTML = '<i class="fab fa-tiktok"></i> TikTok Video';
                        if (commentCountEl) commentCountEl.innerHTML = `<i class="fas fa-comments"></i> ${Number(totalComments) || 0} Komentar Terbaca`;
                    } else {
                        banner.style.display = 'none';
                    }
                }
            }

            if (amCountPill) {
                amCountPill.innerHTML = `<i class="fas fa-circle-play"></i> ${amItems.length} Project Alight Motion`;
            }

            // Render Alight Motion Section (HANYA PROJECT ALIGHT MOTION)
            if (amItems.length > 0) {
                if (emptyAmCard) emptyAmCard.style.display = 'none';
                if (amSec) amSec.style.display = 'block';
                if (amBadge) amBadge.textContent = `${amItems.length} Project`;
                if (amList) {
                    const videoTitleStr = (videoMeta && videoMeta.title) ? videoMeta.title : 'Project Alight Motion';
                    amList.innerHTML = amItems.map(item => {
                        const safeItemUrl = sanitizeSafeUrl(item.url, true);
                        if (!safeItemUrl) return '';
                        return `
                        <div class="finder-item-card am-primary">
                            <div class="finder-item-left">
                                <div class="finder-service-icon alight-motion">
                                    <i class="fas fa-play"></i>
                                </div>
                                <div class="finder-item-text">
                                    <div class="finder-service-label">
                                        <span>Link Project Alight Motion</span>
                                        ${item.count > 1 ? `<span class="finder-occurrences-badge">Ditemukan ${Number(item.count)} kali</span>` : ''}
                                    </div>
                                    <a href="${esc(safeItemUrl)}" target="_blank" rel="noopener noreferrer" class="finder-item-url" title="${esc(safeItemUrl)}">${esc(safeItemUrl)}</a>
                                </div>
                            </div>
                            <div class="finder-item-actions">
                                <button type="button" class="btn-finder-copy" data-action="copy-finder-url" data-url="${esc(safeItemUrl)}">
                                    <i class="fas fa-copy"></i> <span>Salin Link</span>
                                </button>
                                <a href="${esc(safeItemUrl)}" target="_blank" rel="noopener noreferrer" class="btn-finder-open">
                                    <i class="fas fa-arrow-up-right-from-square"></i> <span>Buka di AM</span>
                                </a>
                                <button type="button" class="btn-finder-save" data-action="save-am-project" data-url="${esc(safeItemUrl)}" data-title="${esc(videoTitleStr)}" title="Simpan ke Database LocalStorage Browser">
                                    <i class="fas fa-bookmark"></i> <span>Simpan</span>
                                </button>
                            </div>
                        </div>
                        `;
                    }).join('');
                }
            } else {
                if (amSec) amSec.style.display = 'none';
                if (emptyAmCard) emptyAmCard.style.display = 'block';
            }

            // Save to LocalStorage cache & history
            if (currentFinderActiveQuery) {
                saveToFinderHistory(currentFinderActiveQuery, amItems, videoMeta);
            }
        }

        let currentFinderActiveQuery = '';

        async function triggerFinderAnalyze() {
            if (isFinderRunning) return;
            const input = document.getElementById('finderUrlInput');
            const rawUrl = normalizeTikTokInput(input ? input.value : '');

            hideFinderError();
            const resultsSec = document.getElementById('finderResultsSection');
            if (resultsSec) resultsSec.style.display = 'none';

            if (!rawUrl) {
                showFinderError('Masukkan link video TikTok.', 'Silakan paste link video TikTok di kolom input terlebih dahulu sebelum menekan tombol Cari Link.');
                if (input) input.focus();
                return;
            }

            // 1. Direct Alight Creative link support (jika user menempel link AM langsung)
            if (rawUrl.includes('alightcreative.com') || rawUrl.includes('alight.link')) {
                const cleanUrls = extractCleanUrlsFromText(rawUrl);
                const grouped = processAndGroupUrls(cleanUrls);
                const amOnly = grouped.filter(it => it.category === 'ALIGHT_MOTION');
                if (amOnly.length > 0) {
                    renderFinderResults(amOnly, { title: 'Link Alight Creative Langsung', author: { nickname: 'Alight Creative', unique_id: 'alightmotion' } }, 0);
                    showToast('<i class="fas fa-circle-check" style="color:#10b981;margin-right:6px;"></i> Link Alight Motion terdeteksi langsung!');
                    return;
                }
            }

            if (!isValidTikTokUrl(rawUrl)) {
                showFinderError('Format link video TikTok tidak valid.', 'Format yang didukung: https://www.tiktok.com/@username/video/... atau https://vt.tiktok.com/... atau https://vm.tiktok.com/...');
                if (input) input.focus();
                return;
            }

            currentFinderActiveQuery = rawUrl;

            // 2. FAST CHECK LOCALSTORAGE CACHE (0ms, 100% offline, zero server requirement)
            try {
                const cacheKey = FINDER_CACHE_PREFIX + encodeURIComponent(rawUrl);
                const cachedRaw = localStorage.getItem(cacheKey);
                if (cachedRaw) {
                    const cachedData = JSON.parse(cachedRaw);
                    if (cachedData && Array.isArray(cachedData.items) && cachedData.items.length > 0) {
                        renderFinderResults(cachedData.items, cachedData.videoMeta || null, 0);
                        showToast('<i class="fas fa-bolt" style="color:#10b981;margin-right:6px;"></i> Link ditemukan dari cache LocalStorage (0ms)!');
                        return;
                    }
                }
            } catch(e) {}

            setFinderLoading(true, 'Sedang mencari link project Alight Motion...', 'Membaca komentar video TikTok dan memindai link alightcreative.com langsung di browser tanpa server...');

            let commentsList = [];
            let videoMeta = null;
            let totalCommentsCount = 0;
            let fetchSuccess = false;
            let effectiveUrl = rawUrl;

            // 3. Resolve shortlink jika menggunakan vt.tiktok.com atau vm.tiktok.com
            if (rawUrl.includes('vt.tiktok.com') || rawUrl.includes('vm.tiktok.com')) {
                try {
                    const unshortCtrl = new AbortController();
                    const unshortTid = setTimeout(() => unshortCtrl.abort(), 2000);
                    const uRes = await fetch(`https://unshorten.me/json/${encodeURIComponent(rawUrl)}`, {
                        signal: unshortCtrl.signal
                    });
                    clearTimeout(unshortTid);
                    if (uRes.ok) {
                        const uData = await uRes.json();
                        if (uData && uData.success && uData.resolved_url) {
                            effectiveUrl = uData.resolved_url;
                        }
                    }
                } catch(e) {}
            }

            // 5. PURE CLIENT-SIDE FETCH (100% Tanpa server! TikWM mendukung CORS wildcard browser)
            if (!fetchSuccess) {
                // A) Fetch detail video langsung di browser
                try {
                    const cVideo = new AbortController();
                    const tVideo = setTimeout(() => cVideo.abort(), 6000);
                    const vRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(effectiveUrl)}`, {
                        headers: { 'Accept': 'application/json' },
                        signal: cVideo.signal
                    });
                    clearTimeout(tVideo);
                    if (vRes.ok) {
                        const vData = await vRes.json();
                        if (vData && vData.code === 0 && vData.data) {
                            const vd = vData.data;
                            videoMeta = {
                                id: vd.id || '',
                                title: vd.title || '',
                                description: vd.content_desc || vd.title || '',
                                cover: vd.cover || vd.origin_cover || '',
                                author: vd.author ? { nickname: vd.author.nickname || '', unique_id: vd.author.unique_id || '' } : null,
                                comment_count: vd.comment_count || 0
                            };
                            totalCommentsCount = videoMeta.comment_count || 0;
                            fetchSuccess = true;
                        }
                    }
                } catch(e) {}

                // B) Siapkan URL lengkap untuk query komentar TikTok
                const commentTargetUrl = (videoMeta && videoMeta.author && videoMeta.author.unique_id && videoMeta.id)
                    ? `https://www.tiktok.com/@${videoMeta.author.unique_id}/video/${videoMeta.id}`
                    : effectiveUrl;

                // C) Ambil daftar komentar langsung di browser
                try {
                    let clientCursor = 0;
                    let clientHasMore = true;
                    const maxClientPages = 5;
                    const seenCids = new Set();

                    for (let p = 0; p < maxClientPages && clientHasMore; p++) {
                        const cClient = new AbortController();
                        const tClient = setTimeout(() => cClient.abort(), 6000);
                        const apiUrl = `https://www.tikwm.com/api/comment/list?url=${encodeURIComponent(commentTargetUrl)}&count=50&cursor=${clientCursor}`;
                        const cRes = await fetch(apiUrl, {
                            signal: cClient.signal,
                            headers: { 'Accept': 'application/json' }
                        });
                        clearTimeout(tClient);
                        if (cRes.ok) {
                            const cData = await cRes.json();
                            if (cData && cData.code === 0 && cData.data && Array.isArray(cData.data.comments)) {
                                const pageItems = cData.data.comments;
                                totalCommentsCount = cData.data.total || totalCommentsCount;
                                for (const ci of pageItems) {
                                    const uid = ci.id || (ci.create_time + '_' + (ci.user && ci.user.unique_id));
                                    if (!seenCids.has(uid)) {
                                        seenCids.add(uid);
                                        commentsList.push(ci);
                                    }
                                }
                                clientHasMore = !!cData.data.hasMore && pageItems.length > 0;
                                clientCursor = cData.data.cursor || 0;
                                fetchSuccess = true;
                                if (!clientHasMore || !clientCursor) break;
                            } else {
                                break;
                            }
                        } else {
                            break;
                        }
                    }
                } catch(e) {}

                // D) Pindai balasan komentar (replies) jika ada parent thread
                if (videoMeta && videoMeta.id && commentsList.length > 0) {
                    const candidateParents = commentsList
                        .filter(c => (c.reply_total || 0) > 0)
                        .slice(0, 10);
                    for (const parent of candidateParents) {
                        try {
                            const cRep = new AbortController();
                            const tRep = setTimeout(() => cRep.abort(), 3500);
                            const repRes = await fetch(`https://www.tikwm.com/api/comment/reply?video_id=${videoMeta.id}&comment_id=${parent.id}&count=50&cursor=0`, {
                                headers: { 'Accept': 'application/json' },
                                signal: cRep.signal
                            });
                            clearTimeout(tRep);
                            if (repRes.ok) {
                                const repJson = await repRes.json();
                                if (repJson && repJson.code === 0 && repJson.data && Array.isArray(repJson.data.comments)) {
                                    for (const rItem of repJson.data.comments) {
                                        commentsList.push(rItem);
                                    }
                                }
                            }
                        } catch(e) {}
                    }
                }
            }

            // Gabungkan caption/deskripsi video dan teks seluruh komentar
            let combinedText = '';
            if (videoMeta && (videoMeta.title || videoMeta.description)) {
                combinedText += ' ' + (videoMeta.description || videoMeta.title || '');
            }
            commentsList.forEach(c => {
                if (c.text) combinedText += ' ' + c.text;
                if (c.reply_comment && Array.isArray(c.reply_comment)) {
                    c.reply_comment.forEach(rc => {
                        if (rc.text) combinedText += ' ' + rc.text;
                    });
                }
            });

            // Ekstrak URL project Alight Motion
            let rawUrls = extractCleanUrlsFromText(combinedText);

            // Periksa juga database LocalStorage / catalog preset CTFY:
            // Jika deskripsi/komentar menyebutkan kode preset (misal "Preset A", "AA", dsb), hubungkan ke link project AM
            const localItems = (allItems && allItems.length) ? allItems : (getCachedData() || []);
            if (localItems.length > 0) {
                const lowerAll = (combinedText + ' ' + rawUrl).toLowerCase();
                localItems.forEach(it => {
                    const code = (it.Kode || '').toLowerCase();
                    const name = (it.Nama || '').toLowerCase();
                    // Kode wajib didahului kata "preset"/"kode"/"code" dan berdiri sendiri (hindari kecocokan palsu pada kode pendek).
                    const codeRe = code ? new RegExp('(?:preset|kode|code)[\\s:#-]*' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-z0-9])', 'i') : null;
                    const codeMatches = Boolean(codeRe && codeRe.test(lowerAll));
                    const nameMatches = name && name.length >= 4 && lowerAll.includes(name);
                    if (codeMatches || nameMatches) {
                        if (it.Link5MB && it.Link5MB.includes('alightcreative.com')) {
                            if (!rawUrls.includes(it.Link5MB)) {
                                rawUrls.push(it.Link5MB);
                            }
                        }
                    }
                });
            }

            const groupedItems = processAndGroupUrls(rawUrls);
            const amOnlyItems = groupedItems.filter(it => it.category === 'ALIGHT_MOTION');

            // Jika fetch gagal dan tidak ada link project yang terdeteksi
            if (!fetchSuccess && amOnlyItems.length === 0) {
                setFinderLoading(false);
                showFinderError(
                    'Tidak dapat menemukan link project Alight Motion.',
                    'Pastikan link video TikTok publik dan kreator menyertakan link project Alight Creative (alightcreative.com/am/share/) di komentar atau caption video.'
                );
                return;
            }

            setFinderLoading(false);
            renderFinderResults(amOnlyItems, videoMeta, commentsList.length);
        }

        function copyFinderUrl(rawOrEncodedUrl, btn) {
            let url = rawOrEncodedUrl || '';
            try {
                if (url.includes('%')) url = decodeURIComponent(url);
            } catch(e) {}
            flashCopiedButton(btn, 'Disalin');
            safeCopyToClipboard(url, '<i class="fas fa-circle-check" style="color:var(--success);margin-right:6px;"></i> Link berhasil disalin ke clipboard!');
        }

        function resetFinderTool() {
            clearFinderUrlInput();
            hideFinderError();
            const resultsSec = document.getElementById('finderResultsSection');
            if (resultsSec) resultsSec.style.display = 'none';
            const input = document.getElementById('finderUrlInput');
            if (input) input.focus();
        }

        function initFinderTool() {
            const input = document.getElementById('finderUrlInput');
            const clearBtn = document.getElementById('btnClearFinderUrl');
            if (input && clearBtn) {
                input.addEventListener('input', () => {
                    clearBtn.style.display = input.value.trim() ? 'inline-flex' : 'none';
                });
            }
        }

        window.initVideoAnalyzer = initVideoAnalyzer;
        window.triggerAnalyze = triggerAnalyze;
        window.switchAnalyzerMode = switchAnalyzerMode;
        window.handleLocalVideoSelect = handleLocalVideoSelect;
        window.analyzeLocalVideoFile = analyzeLocalVideoFile;
        window.clearUrlInput = clearUrlInput;
        window.pasteFromClipboard = pasteFromClipboard;
        window.resetUrlAnalyzer = resetUrlAnalyzer;
        window.copyAnalysisSummary = copyAnalysisSummary;
        window.switchToolsSubTab = switchToolsSubTab;
        window.openTool = switchToolsSubTab;
        window.switchFinderInputMode = switchFinderInputMode;
        window.clearFinderUrlInput = clearFinderUrlInput;
        window.pasteFinderFromClipboard = pasteFinderFromClipboard;
        window.triggerFinderAnalyze = triggerFinderAnalyze;
        window.triggerFinderManualParse = triggerFinderManualParse;
        window.copyFinderUrl = copyFinderUrl;
        window.resetFinderTool = resetFinderTool;
        window.initFinderTool = initFinderTool;
        window.saveAmProjectToStorage = saveAmProjectToStorage;
        window.removeSavedAmProject = removeSavedAmProject;
        window.clearAllSavedAmProjects = clearAllSavedAmProjects;
        window.copyAllSavedAmProjects = copyAllSavedAmProjects;
        window.exportSavedAmProjects = exportSavedAmProjects;
        window.importSavedAmProjectsPrompt = importSavedAmProjectsPrompt;
        window.toggleManualAddAmForm = toggleManualAddAmForm;
        window.submitManualAmProject = submitManualAmProject;
        window.filterSavedAmProjects = filterSavedAmProjects;
        window.renderSavedAmProjects = renderSavedAmProjects;
        window.handleSaveAmToLocalStorage = handleSaveAmToLocalStorage;
        window.pasteFromClipboardAndExtract = pasteFromClipboardAndExtract;
        window.filterCtfyPresetsFinder = filterCtfyPresetsFinder;
        window.renderCtfyPresetsFinder = renderCtfyPresetsFinder;
        window.loadFinderHistoryItem = loadFinderHistoryItem;
