# CTFYLink — ctfy.my.id

Website statis resmi **CTFY (imctfy)**, kreator motion graphic. Berisi Platform Link, Library Asset (project files & preset), Video Analyzer, dan Project Link Finder.

## Deployment (static hosting)

```
GitHub Repository → Cloudflare Pages → Custom Domain (ctfy.my.id)
```

Pengaturan Cloudflare Pages:

| Pengaturan | Nilai |
| --- | --- |
| Framework preset | **None** |
| Build command | *(kosong)* |
| Build output directory | `/` (root repository) |

Tidak ada server, `npm install`, `npm run build`, atau `npm start`. Cukup unggah isi folder ini ke repository GitHub, hubungkan ke Cloudflare Pages, lalu tambahkan custom domain `ctfy.my.id`.

## Struktur Project

```text
├── index.html          # aplikasi utama (HTML + CSS + JavaScript)
├── 404.html            # halaman 404 + redirect path lama (/library, /tools, dst.) ke query string
├── metadata.json       # metadata project AI Studio (tidak dipakai saat runtime)
├── robots.txt
├── sitemap.xml
├── site.webmanifest
├── favicon.svg
├── favicon.ico
├── .gitignore
├── README.md
└── assets/images/      # favicon, ikon PWA, og-image.png
```

## Sumber Data & Layanan Eksternal

Semua dijalankan langsung dari browser (tanpa backend sendiri):

- **Data Library**: Google Apps Script (`API_URL` di `index.html`), dengan cache `localStorage` 10 menit.
- **Counter unduhan**: Firebase Firestore (koleksi `downloads`). Konfigurasi Firebase web di `index.html` memang bersifat publik; keamanannya bergantung pada **Firestore Security Rules** (lihat catatan di bawah).
- **Video Analyzer & Project Link Finder**: TikWM (`tikwm.com`), TikTok oEmbed, dan unshorten.me. Bila layanan eksternal tidak tersedia, aplikasi menampilkan pesan error; tidak ada hasil palsu.
- **Fuse.js** (pencarian), **Font Awesome**, dan **Google Fonts** dimuat dari CDN. Jika Fuse.js gagal dimuat, pencarian otomatis memakai pencocokan teks sederhana.

## Catatan Operasional

- Counter unduhan menghitung **klik pada link unduhan** (Google Drive / link project), bukan unduhan yang selesai di situs tujuan. Hitungan hanya dicatat bila Firestore mengonfirmasi penulisan.
- Rekomendasi Firestore Rules: izinkan `read` publik, batasi `write` pada dokumen `downloads/{kode}` hanya untuk menaikkan field `count` (+1). Counter berbasis klien tetap dapat dimanipulasi; jangan dijadikan dasar keputusan finansial.
- `sameAs` di JSON-LD hanya berisi akun yang diverifikasi pemilik (TikTok, Instagram, YouTube). Tambahkan akun lain hanya setelah dipastikan akun tersebut benar dan menautkan balik ke `https://ctfy.my.id/`.
- Link Discord belum tersedia (ditampilkan sebagai "Segera hadir"). Ganti elemen pada `#cardDiscord` dengan tautan undangan asli bila sudah ada.

## Pengujian Lokal

Cukup sajikan folder ini dengan server statis apa pun, misalnya:

```bash
python3 -m http.server 8080
```
