<p align="center">
  <a href="https://github.com/andyrhman/fishink-extension" target="blank">
    <img src="https://i.imgur.com/1lhgc1O.png" width="200" alt="Fishink Logo" />
  </a>
</p>

<h1 align="center">Fishink Extension</h1>

<p align="center">
  Ekstensi Chrome untuk mendeteksi URL phishing secara offline menggunakan model machine learning berbasis TensorFlow.js.
</p>

---

## Tentang Fishink

Fishink adalah ekstensi browser yang dirancang untuk membantu mendeteksi URL phishing secara lokal langsung di browser tanpa backend.  
Ekstensi ini menggunakan model machine learning untuk menganalisis URL, lalu menampilkan loader saat proses pemeriksaan dan warning page jika situs terindikasi berbahaya.

Project ini masih dalam tahap **beta**, sehingga masih mungkin ada false positive, bug kecil, atau penyesuaian UI/UX di versi berikutnya.

---

## Tampilan Ekstensi

### Panel Ekstensi
<p align="center">
  <img src="https://i.imgur.com/KC7XJqa.png" alt="Fishink Extension Panel" />
</p>

Panel utama Fishink menampilkan status proteksi, URL yang sedang dipantau, tombol enable/disable, dan akses ke pengaturan whitelist.  
Tampilan ini dibuat sederhana agar pengguna bisa langsung melihat apakah proteksi sedang aktif atau tidak.

### Warning Phishing
<p align="center">
  <img src="https://i.imgur.com/Jl1LkOb.png" alt="Fishink Phishing Warning" />
</p>

Jika URL terdeteksi berbahaya, Fishink akan menampilkan halaman peringatan dengan skor risiko, URL tujuan, serta dua aksi:
- menambahkan URL ke whitelist
- melanjutkan ke situs tidak aman

---

## Fitur

- Deteksi phishing URL secara offline
- Loader page saat URL sedang dianalisis
- Warning page jika URL terindikasi berbahaya
- Whitelist manual dari popup ekstensi
- Penyimpanan whitelist di browser storage
- Toggle proteksi aktif/nonaktif dari popup
- Tampilan modern dengan background gelap
- Terintegrasi dengan TensorFlow.js di browser

---

## Cara Kerja

1. Pengguna membuka website di browser.
2. Fishink menangkap navigasi URL.
3. URL dikirim ke model phishing prediction di browser.
4. Jika URL aman, halaman dibuka seperti biasa.
5. Jika URL berbahaya, Fishink menampilkan warning page.
6. Pengguna bisa memilih:
   - kembali aman
   - melanjutkan situs
   - menambahkan URL ke whitelist

---

## Instalasi

### Cara 1. Download dari release

1. Download extension fishink dari release
2. Extract file zip-nya
3. Aktifkan chrome developer mode pada extension
4. Load Unpacked folder fishink-extension

### Cara 2. Build dari source

Disarankan menggunakan distribusi linux seperti ubuntu untuk build kode ini, karena pada windows instalasi-nya sedikit rumit.
Project ini dibangun di WSL dan hasil akhirnya berupa folder extension siap pakai.

Clone repository:

1. Clone Repository dan install dependency package yang diperlukan

   ```bash
   git clone https://github.com/andyrhman/fishink-extension.git
   npm install
   npm scripts/build-extension
   ```

2. Aktifkan chrome developer mode pada extension
3. Load unpacked folder dist/fishink-extension
