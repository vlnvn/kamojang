# Laporan engineering Kamojang Unit 5

Verifikasi lokal: 28 Oktober 2026, Asia/Jakarta. Pekerjaan dilanjutkan pada branch `feat/initial-platform` dan [PR draft #1](https://github.com/vlnvn/kamojang/pull/1). Tidak ada merge atau deployment publik. Aplikasi belum diklaim flawless atau pixel-perfect.

## Hasil implementasi

Judul parameter menggunakan **Tekanan, NCG, Kualitas uap, TDS, Suhu**, tanpa `.toLowerCase()` yang merusak singkatan. Tracking heading, posisi header/panel dan lebar kontrol diperbaiki berdasarkan ukuran Figma. Kegagalan konstruksi worker dan callback impor usang ditangani. Jalur median/MAD yang sudah diverifikasi tetap dipertahankan.

ZIP turbin yang diberikan pemilik memuat mesh asli dan notice **CC BY 4.0** oleh landinweaver yang sesuai dengan metadata glTF. Model dioptimalkan menjadi **1.215.756 byte**; hanya dua bidang latar dihapus, tanpa menyederhanakan geometri turbin. Mesh memiliki 173.699 segitiga setelah instancing; 52.645 adalah segitiga unik tersimpan. Hash asli/hasil, lisensi, transformasi dan batas validator tersedia di [provenance](asset-provenance.md). Tampilan ini representatif, bukan digital twin perangkat Kamojang.

Viewer menyediakan mouse/touch/pinch, keyboard, zoom terbatas, reset, orbit kamera yang awalnya berhenti, mode gambar dari render mesh aktual, retry, batas pemuatan 45 detik, reduced motion, pelepasan sumber daya dan penanganan context loss. Kegagalan modul/decoder/mesh/WebGL tidak mematikan analisis. Tidak ada gerak rotor atau status operasi yang direkayasa.

GPR kini benar-benar melatih lima model melalui layanan Python loopback opsional. Kernel, seed 1729, scaling hanya pada data latih dan delapan observasi uji mengikuti benchmark riset yang telah direproduksi. UI menampilkan MAE/RMSE untuk GPR dan dua baseline, prediksi uji serta peringatan optimizer. GPR bukan klasifikasi kerusakan; tanpa label insiden, precision/recall/F1 tidak dapat dinyatakan. Data hanya dikirim ke proses lokal setelah tindakan eksplisit, dibatasi 12–256 baris / satu pekerjaan / 60 detik, tidak dicatat atau disimpan. Jalur robust tetap bekerja tanpa Python.

## Gerbang terverifikasi

| Gerbang                  | Hasil                                             | Bukti dan batas                                                                                                                  |
| ------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| A1 Lisensi               | PASS                                              | Notice arsip dan metadata cocok, CC BY 4.0, kredit/link/modifikasi disertakan                                                    |
| A2 Mesh asli             | PASS                                              | GLB self-hosted dirender pada build produksi; poster berasal dari mesh yang sama                                                 |
| A3 Interaksi             | PASS                                              | Mouse, touch/pinch DPR 2, keyboard, reset/pause, fallback/retry diuji                                                            |
| A4 Reliabilitas/performa | PASS terbatas                                     | Siklus lifecycle dan kegagalan teruji; hasil lab Intel UHD tercatat. Stabil 60 FPS semua perangkat belum terbukti                |
| A5 Visual                | BLOCKED untuk persetujuan; pixel-equivalence FAIL | Posisi 11 elemen kritis dalam 2 px; selisih penuh 13,038% / 7,149% / 9,913%; deviasi mesh/kontrol/data perlu persetujuan pemilik |
| A6 Sains/privasi         | PASS terbatas                                     | 220 nilai/skor parity tetap; 15 pasangan MAE/RMSE API cocok; masukan dan gambar privat tidak dipublikasikan                      |
| A7 GitHub                | Bukti revisi pada PR                              | Commit dan CI harus dinilai berdasarkan SHA terbaru yang dicantumkan di PR, bukan CI baseline                                    |

Hasil lokal: **17 tes TypeScript**, **10 tes Python**, **22 tes browser publik** lulus; tiga tes sengaja dilewati pada pemanggilan publik. Suite GPR terpisah **3 lulus**, dan satu tes browser workbook privat lulus. Lint, typecheck, formatter dan build lulus. Dua peringatan optimizer riset dipertahankan. Suite paket asli masih terblokir oleh `artifact_tool`; enam assertion sumber pada salinan dengan perubahan pembaca saja lulus. Tidak ada klaim suite asli berhasil tanpa dependensinya.

Parity workbook tetap **44 observasi / 43 tanggal**, 220 nilai dan skor/flag, serta **9/7/6** indikasi pada ambang 3,0/3,5/4,0. Keempat masukan asli tetap sesuai SHA-256 awal. Pengukuran/prediksi nyata, PDF, XLSX, ZIP, referensi Figma dan perbandingan privat tidak dikomit.

## Pengukuran dan keterbatasan

Build produksi di Chromium 156 / renderer Intel UHD D3D11 mencatat desktop DPR 1: pemuatan 1.763,2 ms, RAF rata-rata **49,25 Hz** pada sampel 3,53 detik (termasuk stall), p95 16,8 ms, respons dua RAF 27,5 ms. Skenario viewport 430×932 DPR 2 dengan renderer dibatasi 1,5: 439,6 ms, **60,00 Hz**, p95 16,8 ms, respons 13,2 ms. Ini observasi perangkat lokal; bukan frame GPU timer, hasil telepon fisik, jaminan 60 FPS atau Core Web Vitals lapangan. Pengukuran terdahulu 59–60 Hz tidak menggantikan sampel final yang lebih rendah.

GLB mentransfer 1.216.056 byte di localhost. Renderer menghitung 35 draw call dan 347.400 segitiga termasuk pass bayangan/lantai. Byte VRAM tidak tersedia. Chunk viewer lazy sekitar 642 kB minified / 161 kB gzip masih menghasilkan peringatan ukuran Vite yang tidak disembunyikan. Detail reproduksi dan batas pengujian ada di [matriks verifikasi](testing.md).

Visual memakai Figma terkini, font lokal yang sudah dimuat, ukuran 1600×960 DPR 1, kamera/orbit berhenti dan metrik penuh yang sama (delta kanal RGB >16, tanpa masking). Ringkasan berbeda karena mesh asli menggantikan ilustrasi; Analisis/Metode membaik dari baseline 7,530%/10,289% menjadi 7,149%/9,913%. Persetujuan akhir tampilan, pengujian telepon fisik/assistive technology, field performance dan lisensi kode pemilik tetap terbuka. Tidak ada izin distribusi data riset yang diasumsikan.

## Menjalankan lokal

```sh
npm ci
python -m pip install -r scripts/requirements-research.txt
npm run dev:research
```

Gunakan **Metode → GPR · prediksi → Jalankan benchmark GPR**. `npm run dev` tetap menyediakan analisis robust dan 3D tanpa layanan Python. Tidak ada koneksi sensor langsung, akun cloud atau database operasional.

## Bukti publikasi implementasi

Commit implementasi `f6cc2ae` sudah dipush ke branch existing. [CI 40561154745](https://github.com/vlnvn/kamojang/actions/runs/40561154745) lulus ketiga job: kualitas/build, browser/aksesibilitas, serta protokol/keamanan GPR lokal. Clone remote bersih tanpa masukan riset lulus instalasi, kualitas, 17 tes TypeScript, 10 tes Python, build, pemindai 78 path, dan smoke test distribusi produksi dengan GPR lokal/data sintetis. Working tree clone bersih. Perbaikan lanjutan mengarahkan fokus dan scroll ke hasil GPR ketika dibuka; status CI SHA lanjutan yang terbaru tetap dicatat pada PR. PR tetap draft dan tidak digabung.

## Peningkatan multivariat dan inspeksi turbin (28 Oktober 2026)

Keunggulan repositori pembanding yang diterapkan: model gabungan lima sensor, pengaturan contamination/jumlah pohon dan kandidat manual. Implementasi ditulis mandiri; lisensi kode pembanding belum tersedia sehingga kode, Excel dan CSV miliknya tidak disalin ke aplikasi atau publikasi ini. Paper Isolation Forest dan kontrak API resmi menjadi rujukan; [protokol lengkap](multivariate-research.md) membedakan keputusan engineering dari klaim ilmiah.

Model referensi, model holdout kronologis dan hasil manual diberi scope terpisah. Input manual tidak ikut pelatihan; perubahan sumber/konfigurasi membatalkan hasil lama. Sensitivitas menghitung ambang pada forest referensi yang tetap, termasuk penanganan skor seri. Nilai yang tak dapat direpresentasikan estimator ditolak, bukan di-clipping agar tampak valid. Seluruh 220 parity robust dan 15 pasangan benchmark GPR tetap lulus. Perbandingan privat juga cocok dengan 44 hasil referensi serta 9 holdout repositori pembanding pada presisi serialisasinya; kesamaan itu bukan bukti akurasi deteksi.

Keluhan tombol Jelajahi turbin/Lihat objek terbukti: sebelumnya keduanya mengganti rute tetapi tetap memakai komposisi Ringkasan yang hampir sama. Kini keduanya membuka judul Inspeksi turbin 3D dan scene selebar area konten; fokus masuk ke canvas saat siap, lalu kembali ke pemicu saat kembali. Uji desktop/mobile, keyboard, fallback dan parameter URL dipertahankan. Aset/lisensi tetap sama. Berkas 404 sekarang ditolak sebelum kompilasi GPU.

Gerbang unit lokal saat peningkatan: 20 TypeScript dan 16 Python lulus; pemeriksaan alignment kritis 11 elemen tetap lulus. Modul riset lazy dan kegagalannya terisolasi; bundle utama bertambah sekitar 2,06 kB minified / 0,47 kB gzip, dengan chunk fitur 11,87 kB dimuat setelah dibuka. Tidak ada dependency runtime baru. Hasil browser/CI terbaru harus dibaca di PR karena tes lokal Windows kemudian menemukan finalisasi unduhan tertahan, termasuk pada build baseline yang belum diubah. Seluruh byte diterima tetapi unduhan belum selesai; penyebabnya belum ditetapkan dan proteksi browser tidak dilemahkan. Tidak ada klaim seluruh gerbang lokal PASS.

Scene inspeksi yang lebih luas terukur sekitar 47,665 Hz RAF desktop Intel UHD D3D11 pada sampel yang mengandung stall, serta 60,003 Hz pada viewport mobile emulasi. Ini bukan jaminan semua perangkat atau bukti telepon fisik. Pixel-equivalence dan persetujuan visual akhir tetap terbuka. Rincian kegagalan, koreksi, environment dan perintah ada pada [matriks verifikasi](testing.md). PR tetap draft; tidak ada merge atau deployment publik.
