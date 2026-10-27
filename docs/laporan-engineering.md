# Laporan engineering Kamojang Unit 5

Tanggal verifikasi: 28 Oktober 2026, Asia/Jakarta. Status keseluruhan: **implementasi inti berfungsi; deliverable masterprompt belum selesai** karena gerbang aset 3D dan kesetiaan visual belum terpenuhi.

## Implementasi aktual

Aplikasi React/TypeScript menyediakan Ringkasan, Analisis lima parameter dan Metode dalam Bahasa Indonesia. Impor CSV/XLSX berjalan di worker lokal dengan validasi skema, satuan, tanggal, angka berhingga, ukuran berkas, jumlah baris, formula, lembar tambahan dan ekspansi ZIP. Impor dapat dibatalkan; kegagalan mempertahankan data sebelumnya. Setiap observasi menyimpan hash sumber, baris asli dan identitas stabil; tanggal berulang tidak digabung.

Skor median/MAD dihitung dari masukan, bukan JSON hasil tetap. Ambang sensitivitas mengubah hasil secara deterministik. Grafik menggunakan tanggal aktual; tabel dapat dipakai dengan keyboard. Pemeriksa baris, dialog, riwayat navigasi, pilihan parameter, ekspor CSV/JSON dan penghapusan data berfungsi. Data unggahan tidak dikirim ke server atau disimpan otomatis. Contoh dan gambar publik menggunakan data sintetis independen yang diberi label jelas.

README berbahasa Inggris, pedoman kontribusi/keamanan, metodologi, keputusan arsitektur, provenance, matriks pengujian, templat PR/issue, Dependabot dan CI tersedia. Tidak ada autentikasi, database, koneksi IoT atau status sensor langsung yang dibuat-buat.

## Bukti verifikasi

- `npm test`: **16 tes lulus**.
- `python -m unittest discover -s scripts -p test_audit.py -v`: **6 tes lulus**.
- `npm run test:e2e`: **11 tes publik lulus**, satu tes sumber privat dilewati secara sengaja. Tes privat dijalankan terpisah dan lulus.
- `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`: lulus.
- Dua pembaca independen cocok dengan **220 nilai dan 220 skor/flag** arsip. Workbook menghasilkan **44 observasi, 43 tanggal**, dengan **9/7/6** flag pada ambang **3,0/3,5/4,0**.
- Enam tes sumber yang tidak diubah lulus pada salinan privat setelah hanya lapisan pembaca diganti. Suite asli tetap tercatat gagal mengimpor `artifact_tool`, bukan diklaim lulus.
- Benchmark GPR terpisah mereproduksi 15 pasangan MAE/RMSE; dua peringatan batas optimizer dicatat. GPR menang MAE hanya untuk NCG pada split 36/8. Ini bukan akurasi deteksi kerusakan.
- Axe dan pemeriksaan overflow dijalankan untuk tiga halaman pada **1600×960, 1440×900, 1280×800, 390×844**. Fokus dialog, Esc, pembatalan impor dan kegagalan worker diuji di browser.
- Build lokal mencatat JS utama **246.860 byte**, worker **98.942 byte**, serta total direktori distribusi **594.870 byte**. Pengukuran gzip zlib default: **77.040** dan **30.381 byte**. Ini bukan hasil Lighthouse, Core Web Vitals lapangan, atau FPS 3D.

Clone bersih dari branch GitHub berhasil menjalankan `npm ci`, formatter, lint, typecheck, 16 tes TypeScript, enam tes Python, build dan pemindai path/kredensial tanpa berkas riset. Keadaan Git clone dan workspace utama bersih setelah commit. [CI jarak jauh pada commit 30c1ebc](https://github.com/vlnvn/kamojang/actions/runs/40551175183) selesai sukses pada Ubuntu, termasuk job browser dan aksesibilitas. Hasil tersebut terikat pada revisi itu; commit dokumentasi berikutnya memicu pemeriksaan baru.

## Git, kerahasiaan dan hak penggunaan

[PR draft #1](https://github.com/vlnvn/kamojang/pull/1) membandingkan branch `feat/initial-platform` dengan baseline `main`. Commit implementasi `9015a7c` dan CI/dokumentasi `30c1ebc` dibuat menggunakan identitas Git yang sudah dikonfigurasi; tidak ada force push, merge atau tanggal yang direkayasa. Commit dokumentasi berikutnya hanya mencatat bukti verifikasi.

Keempat masukan asli tetap utuh berdasarkan SHA-256. Excel, PDF, ZIP, pengukuran nyata, ekspor nyata serta gambar perbandingan yang memuat data privat tidak dikomit. Pemindaian terbatas memeriksa 55 path yang terpublikasi pada tahap awal; pemindaian diulang sebelum setiap push. Pemindaian pola bukan audit keamanan menyeluruh atau bukti izin redistribusi.

Font lokal memiliki lisensi OFL 1.1 yang disertakan. Ikon berasal dari desain Figma yang diberikan. Lisensi kode belum dipilih atas nama pemilik. Hak redistribusi sumber riset belum dibuktikan.

## Gerbang yang tersisa

**3D: BLOCKED.** Unduhan resmi kandidat Steam Turbine mengembalikan HTTP 401 karena autentikasi tidak tersedia pada jalur API; halaman langsung mendapat 403. Pemeriksaan sesi Windows berhenti karena kontrol Computer Use tidak dapat memastikan URL aktif untuk penegakan kebijakan. Tidak ada mesh, lisensi versi tertentu, hash aset, renderer, rotasi/zoom, fallback dari mesh, optimasi geometri atau FPS yang diklaim tersedia.

**Visual: FAIL.** Perbandingan Figma terbaru pada 1600×960, tanpa masking, menghasilkan selisih piksel **10,442% Ringkasan; 7,530% Analisis; 10,289% Metode** dengan toleransi kanal RGB 16. Referensi, aktual, overlay dan difference disimpan privat. Tidak ada klaim pixel-perfect. Model yang hilang, penyesuaian konten serta sisa perbedaan tipografi/tata letak masih perlu diselesaikan.

**Publikasi aplikasi dan pengaturan repositori:** tidak ada deployment publik, branch protection atau security alerts yang diklaim telah diaktifkan. PR tetap draft dan belum digabung. Konfirmasi sumber data operasional dan lisensi aset diperlukan sebelum distribusi publik yang relevan.

Langkah terkecil berikutnya adalah memperoleh GLB turbin melalui unduhan resmi yang sah beserta bukti lisensi, menerapkan dan menguji renderer/fallback/kontrolnya, lalu menutup perbedaan visual dan mengulang gerbang penerimaan. Label insiden terverifikasi tetap diperlukan sebelum mengukur precision/recall/F1.

## Menjalankan lokal

```sh
npm ci
npm run dev
```

Buka alamat localhost yang ditampilkan, lalu gunakan **Metode → Impor dan kelola data**. Perintah audit privat dan benchmark lengkap tersedia di `docs/data-methodology.md`; status setiap gerbang dan tautan CI tersedia di `docs/testing.md`.
