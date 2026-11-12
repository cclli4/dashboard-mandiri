# Peta Potensi MT Haryono

Versi folder dari `Peta Potensi MT Haryono.html`. Tiap tab sekarang jadi satu halaman
HTML sendiri, jadi mau ubah satu tab tidak perlu buka file 400 KB.

Buka `index.html` langsung lewat double-click — tidak perlu server. Pindah tab = pindah
halaman lewat menu di rail kiri.

## Update data tiap bulan (untuk tim cabang)

Buka `perbarui.html` (menu **Perbarui data** di rail kiri), lalu:

1. Masukkan dua file dari pusat apa adanya: **Pipeline Program Champion … Kol1 Region 5.xlsx**
   dan **Merchant LVM 12422.xlsx**. Tidak perlu dirapikan atau diubah nama.
2. Klik **Proses data**. Baca pesannya. Kalau muncul **unit mikro baru**, pilih kecamatan
   lokasinya. Pilihan ini ikut tersimpan, jadi bulan berikutnya tidak ditanya lagi.
3. Cek tabel angka utama (data sekarang vs data baru).
4. Klik **Simpan langsung ke folder data** (Chrome/Edge) dan pilih folder `data`. File lama
   otomatis dicadangkan ke `data/cadangan/`. Atau klik **Unduh dua file** lalu timpa
   `data/mapdata.js` dan `data/dashdata.js`.
5. Buka ulang dashboard. Tanggal "Data per …" ikut berganti.

Data BPS (penduduk, minimarket) cukup diperbarui setahun sekali lewat kotak ketiga, dengan
format seperti `peta_peluang_semua_wilayah_lengkap.xlsx`: satu sheet per kab/kota (nama sheet
`Kab Bogor`, `Kota Depok`, `Jakarta Selatan`, `Kota Bogor`, …), kolom `Kecamatan`,
`Penduduk …`, dan opsional `Minimarket …`.

Semua file diolah di browser. Tidak ada yang dikirim ke server. Ke dashboard hanya masuk
nama depan + inisial debitur (tanpa NIK, nomor HP, atau nomor rekening).

### Aturan yang dipakai pengolah (`js/olah.js`)

Aturan direkonstruksi dari data September 2026 dan sudah dicek menghasilkan angka yang sama
dengan dashboard awal. Kalau kebijakan berubah, ubah konstanta di bagian atas `js/olah.js`.

| Hal | Aturan |
| --- | --- |
| Debitur → kecamatan | Lewat lokasi unit mikro (`MAPDATA.unitmap`, diisi dari halaman Perbarui data) |
| Kategori kecamatan | Median penduduk dihitung dari semua kecamatan di kab/kota itu, median penetrasi hanya dari kecamatan yang sudah ada debiturnya. Prioritas garap = penduduk ≥ median & penetrasi < median; Pertahankan = keduanya ≥; Sudah tergarap = penduduk < median & penetrasi ≥; Pantau = keduanya <; Belum tersentuh = 0 debitur |
| Skor peluang | Ada minimarket: 40% penduduk + 30% minimarket + 30% (1 − penetrasi), masing-masing dibagi nilai terbesar di kab/kota itu. Tanpa minimarket: 60% penduduk + 40% (1 − penetrasi) |
| Status merchant | Rekening CLOSED → Closed. Status trx bulan ini ACTIVE → Aktif (atau "Aktif, turun" jika trx 30 hari < 50% bulan lalu). Bulan lalu ACTIVE → Baru berhenti. Bulan lalu NEW MERCHANT → Baru, belum transaksi. Selain itu Usak |
| Wilayah merchant | Kata kunci di alamat, dicek berurutan (`WIL_ATURAN`) |
| Skor kunjungan | Baru cair +40, MM Booking +30, Agen +20, baki debet ÷ 5 (maks. 40 di Rp 200 jt). 120 teratas per kota |

## Menandai kunjungan & akuisisi (aktivitas lapangan)

Di peta, klik kecamatan lalu **+ Tandai** di panel Detail wilayah. Isi nama usaha, status
(Dikunjungi → Dalam proses → Berhasil akuisisi / Tidak berminat), produk, tanggal, petugas, dan
catatan. Untuk memperbarui progres, klik usahanya lagi dan ganti statusnya. Riwayat tiap
perubahan ikut tersimpan.

- Mode peta **Aktivitas lapangan** mewarnai kecamatan menurut status terjauh, dan lencana angka
  menunjukkan jumlah usaha yang ditandai. Periode bisa bulan ini, 3 bulan, atau semua.
- Halaman **Progress akuisisi** (`aktivitas.html`) berisi ringkasan per status, tabel yang bisa
  disaring, progres per petugas, daftar kecamatan prioritas yang belum dikunjungi, dan Ekspor Excel.

**Penyimpanan bersama.** Tanda disimpan di `data/aktivitas.js`. Di tiap laptop, klik
**Hubungkan folder data** sekali (Chrome/Edge) dan pilih folder `data` di shared drive. Setelah
itu setiap simpan langsung ditulis ke file bersama. Perubahan dari rekan dicek tiap 15 detik
dan saat jendela kembali dibuka, lalu peta ikut berganti. Kalau dua orang menyimpan berdekatan,
keduanya digabung per usaha (yang terakhir diubah menang), jadi tidak saling menimpa. Selama
belum terhubung, tanda tersimpan di browser itu saja dan otomatis terkirim begitu folder
dihubungkan. Kadang browser meminta izin ulang; klik **Aktifkan sinkron** di bilah status.

Form menolak isian yang terlihat seperti NIK, nomor HP, atau nomor rekening.
`data/aktivitas.js` tidak disentuh oleh halaman Perbarui data.

## Struktur

```
index.html        Tab "Peta & peluang"      → js/peta.js      + css/peta.css
potensi.html      Tab "Potensi debitur"     → js/potensi.js   + css/dash.css
merchant.html     Tab "Kesehatan merchant"  → js/merchant.js  + css/dash.css
kunjungan.html    Tab "Daftar kunjungan"    → js/kunjungan.js + css/dash.css
perbarui.html     Halaman update bulanan    → js/perbarui.js + js/olah.js + css/perbarui.css
aktivitas.html    Tab "Progress akuisisi"   → js/progress.js + css/aktivitas.css

js/aktivitas.js   Simpan/sinkron aktivitas lapangan + formulir tandai (dipakai peta & progress)
data/aktivitas.js window.AKTIVITAS — kunjungan & akuisisi yang ditandai tim (ditulis dari browser)

assets/           Logo Livin' dan foto gedung untuk header

css/base.css      Token warna, layout, rail, hero, KPI, kartu,
                  tombol segmented, daftar batang (.rank), tabel (.tbl)
css/peta.css      Khusus peta: SVG kecamatan, legenda, tooltip, panel detail, insight
css/dash.css      Khusus tiga tab tabel: grid, saringan, donat, legenda, skor

data/mapdata.js   window.MAPDATA — batas kecamatan (GADM), penduduk BPS, skor peluang, unitmap
data/dashdata.js  window.DASHDATA — pipeline debitur, unit mikro, merchant, target, meta (tanggal)
                  (kedua file ini ditulis ulang oleh halaman Perbarui data — jangan diedit manual)

js/vendor/        d3 7.9.0 dan SheetJS 0.20.3 (pembaca Excel), disimpan lokal

js/common.js      Format angka (fI/f1/fK/fP), helper $/el, dan komponen yang dipakai
                  lebih dari satu halaman: rankList, donut, legendList, fill, segBtns.
                  Juga menyiapkan MER/SEG/SEGC dari data merchant.
js/kpi.js         Mengisi lima kartu KPI + chip "Cakupan peta" (sama di semua halaman)
js/peta.js        Peta, zoom, panel detail, peringkat, insight, tabel skor
js/potensi.js     Debitur per area, komposisi produk, tabel unit mikro
js/merchant.js    Status merchant, aktif per jenis usaha, per tahun, tracker
js/kunjungan.js   Tabel target kunjungan + ringkasan sumber debitur
```

## Cara edit yang paling sering dibutuhkan

| Mau ubah apa | Buka file |
| --- | --- |
| Teks judul / deskripsi satu tab | halaman HTML tab itu, bagian `<header class="hero">` |
| Isi tabel, kolom, atau saringan satu tab | halaman HTML tab itu + `js/<tab>.js` |
| Angka KPI di atas | `js/kpi.js` |
| Warna, font, radius sudut | blok `:root` di bagian atas `css/base.css` |
| Menu rail kiri | bagian `<nav class="nav">` — ada di keempat halaman HTML |
| Foto header | ganti `assets/gedung-mandiri.jpg`; posisinya di `.hero-img`, `css/base.css` |
| Data bulanan | halaman `perbarui.html` (lihat atas) |
| Aturan skor, kategori, status merchant | konstanta di atas `js/olah.js` |

Catatan: rail, header, dan baris KPI sengaja ditulis ulang di tiap halaman supaya tiap
file bisa dibuka sendiri tanpa server. Kalau mengubah bagian itu, ubah di keempat HTML.

Ikon dari Phosphor Icons (duotone, lisensi MIT), ditulis langsung di HTML.

Foto header: "Graha Mandiri (2025)" oleh Medelam, CC BY-SA 4.0, via Wikimedia Commons;
dipotong dan disesuaikan warnanya. Logo Livin' by Mandiri milik PT Bank Mandiri (Persero) Tbk.

Internet hanya dipakai untuk font Plus Jakarta Sans. Tanpa internet semuanya tetap jalan,
termasuk peta dan halaman update. Hanya font yang kembali ke bawaan.

File asli satu-berkas masih ada di `../Peta Potensi MT Haryono.html` sebagai cadangan.
