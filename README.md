# Panduan Lengkap RizzFlow (Khusus Pemula / Non-Programmer)

Selamat datang di **RizzFlow**! Panduan ini ditulis khusus dengan bahasa sehari-hari agar kamu bisa menyiapkan toko produk digital otomatis (Next.js + Supabase + DOKU + Resend) langkah demi langkah dari nol tanpa perlu mengerti koding.

---

## Daftar Isi
1. [Persiapan Awal di Laptop/Komputer](#1-persiapan-awal-di-laptopkomputer)
2. [Membuat Folder Proyek RizzFlow](#2-membuat-folder-proyek-rizzflow)
3. [Mengatur Database & Penyimpanan File di Supabase](#3-mengatur-database--penyimpanan-file-di-supabase)
4. [Mengatur Pengiriman Email Otomatis di Resend](#4-mengatur-pengiriman-email-otomatis-di-resend)
5. [Mengatur Pembayaran QRIS di DOKU](#5-mengatur-pembayaran-qris-di-doku)
6. [Menghubungkan Semuanya di File `.env.local`](#6-menghubungkan-semuanya-di-file-envlocal)
7. [Menjalankan Website di Laptop](#7-menjalankan-website-di-laptop)
8. [Meng-online-kan Website Gratis di Vercel](#8-meng-online-kan-website-gratis-di-vercel)

---

## 1. Persiapan Awal di Laptop/Komputer

Sebelum mulai, pastikan di laptop kamu sudah terpasang 2 aplikasi gratis ini:

1. **Node.js (Mesin penjalan website):**
   - Buka website [https://nodejs.org](https://nodejs.org)
   - Klik tombol hijau bertuliskan **LTS** (Recommended For Most Users).
   - Buka file yang terunduh, lalu klik **Next** terus sampai **Finish**.
2. **Text Editor (Aplikasi untuk menaruh file kode):**
   - Gunakan **VS Code** atau **Antigravity IDE** yang sudah kamu miliki.

---

## 2. Membuat Folder Proyek RizzFlow

1. Buka aplikasi **Terminal** atau **Command Prompt (CMD)** di laptop kamu.
2. Ketik perintah di bawah ini lalu tekan **Enter** untuk membuat proyek baru bernama `rizzflow`:
   ```bash
   npx create-next-app@latest rizzflow --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
   ```
   *(Jika muncul pertanyaan `Ok to proceed? (y)`, ketik `y` lalu tekan Enter. Jika ditanya tentang React Compiler atau Turbopack, pilih `No`).*
3. Setelah selesai, masuk ke dalam folder `rizzflow` dan pasang komponen pendukung (ikon, animasi, database, dan email) dengan menyalin perintah ini ke Terminal lalu tekan **Enter**:
   ```bash
   cd rizzflow
   npm install @supabase/supabase-js @supabase/ssr lucide-react framer-motion resend qrcode.react
   npm install -D @types/qrcode.react
   ```
4. Buka folder `rizzflow` tersebut di dalam aplikasi editor kode kamu.

---

## 3. Mengatur Database & Penyimpanan File di Supabase

Supabase adalah tempat gratis untuk menyimpan daftar produk, riwayat pembelian, kode promo, dan file produk digital kamu.

### A. Membuat Proyek Supabase
1. Buka [https://supabase.com](https://supabase.com) dan daftar/masuk menggunakan akun Google atau GitHub.
2. Klik tombol hijau **New Project**.
3. Isi formulirnya:
   - **Name:** `RizzFlow`
   - **Database Password:** Buat kata sandi yang kuat (simpan baik-baik).
   - **Region:** Pilih `Southeast Asia (Singapore)` agar cepat diakses dari Indonesia.
4. Klik **Create new project** dan tunggu sekitar 1–2 menit hingga proyek siap.

### B. Membuat Tabel Database Otomatis (`schema.sql`)
Kamu tidak perlu membuat tabel satu per satu. Kita akan menjalankan kode otomatis:
1. Di menu sebelah kiri Supabase, klik ikon **SQL Editor** (ikon bergambar terminal `>_`).
2. Klik tombol **+ New query**.
3. Salin (**Copy**) seluruh isi dari file `supabase/schema.sql` yang ada di proyek ini, lalu tempel (**Paste**) ke layar SQL Editor tersebut.
4. Klik tombol hijau **Run** di pojok kanan bawah.
5. Jika muncul tulisan **Success. No rows returned**, artinya seluruh tabel produk, kategori, promo, pesanan, serta **2 folder penyimpanan file (`product-thumbnails` dan `digital-products`)** sudah berhasil dibuat secara otomatis!

### C. Membuat Akun Login Admin (Untuk Kamu Sendiri)
Agar kamu bisa masuk ke halaman pengelola dagangan (`/admin`), buat akunmu di sini:
1. Di menu sebelah kiri Supabase, klik ikon **Authentication** (ikon bergambar gembok/orang).
2. Klik tab **Users** lalu klik tombol hijau **Add user** -> pilih **Create new user**.
3. Masukkan **Email** dan **Password** yang akan kamu pakai untuk login sebagai Admin toko.
4. Pastikan kotak **Auto Confirm User?** dicentang, lalu klik **Create user**.

### D. Mengambil Kunci Koneksi (API Keys) Supabase
1. Di menu sebelah kiri bawah Supabase, klik ikon **Project Settings** (ikon roda gigi ⚙️).
2. Klik menu **API** (atau **Data API** & **API Keys**).
3. Catat 3 kode penting ini (nanti akan kita masukkan ke file pengaturan):
   - **Project URL** (contoh: `https://xxxx.supabase.co`)
   - **anon / public key** (kode panjang yang diawali `eyJ...`)
   - **service_role / secret key** (klik tombol *Reveal* untuk melihatnya. **JANGAN** berikan kode ini ke orang lain karena ini adalah kunci master).

---

## 4. Mengatur Pengiriman Email Otomatis di Resend

Resend bertugas mengirimkan email berisi tombol download produk ke pembeli detik itu juga setelah mereka membayar QRIS.

1. Buka [https://resend.com](https://resend.com) dan daftar akun gratis.
2. Di menu sebelah kiri, klik **API Keys**.
3. Klik tombol **Create API Key**.
4. Beri nama `RizzFlow`, pilih Permission **Full access**, lalu klik **Add**.
5. Salin kode yang diawali dengan `re_xxxxxxxxx` dan simpan baik-baik (kode ini hanya muncul sekali!).
   *(Catatan: Pada akun gratis tanpa domain pribadi, Resend menggunakan pengirim `onboarding@resend.dev`. Jika nanti kamu sudah punya domain sendiri seperti `rizzflow.com`, kamu bisa mendaftarkannya di menu **Domains** di Resend).*

---

## 5. Mengatur Pembayaran QRIS di DOKU

DOKU bertugas membuat kode QRIS dan memberi tahu website kamu secara otomatis saat pembeli selesai membayar.

1. Buka [https://dashboard.doku.com](https://dashboard.doku.com) (Gunakan **Sandbox** untuk uji coba, atau **Production** jika akun bisnismu sudah aktif).
2. Masuk ke menu **Settings** -> **API Keys** (atau **Integration** -> **Credentials**).
3. Catat **Client ID** (contoh: `BRN-xxxx-xxxx`) dan **Secret Key** (`SK-xxxx`).
4. Masuk ke menu pengaturan **Notification URL / Webhook QRIS**, lalu isi dengan alamat website kamu ditambah `/api/webhooks/doku`:
   - Contoh saat nanti sudah online: `https://nama-website-kamu.vercel.app/api/webhooks/doku`
5. **Tips Penting Saat Baru Mencoba di Laptop:**
   Sebelum akun DOKU kamu aktif sepenuhnya, kamu tetap bisa mencoba seluruh fitur toko sampai berhasil kirim email dengan mengaktifkan `DOKU_SIMULATION_MODE="true"` di file `.env.local`.

---

## 6. Menghubungkan Semuanya di File `.env.local`

1. Di folder paling luar proyek `rizzflow`, buat sebuah file baru dengan nama persis:
   `.env.local`
2. Salin isi dari file `.env.example`, tempel ke dalam `.env.local`, lalu ganti nilai di dalamnya dengan kunci-kunci yang sudah kamu catat dari Supabase, Resend, dan DOKU tadi.

---

## 7. Menjalankan Website di Laptop

1. Buka kembali **Terminal** di dalam folder proyek `rizzflow`.
2. Ketik perintah berikut lalu tekan **Enter**:
   ```bash
   npm run dev
   ```
3. Buka browser (Chrome/Edge) kamu, lalu ketik alamat:
   - **Halaman Toko Pelanggan:** `http://localhost:3000`
   - **Halaman Admin Toko:** `http://localhost:3000/admin` (Login menggunakan email & password yang kamu buat di langkah 3C).

---

## 8. Meng-online-kan Website Gratis di Vercel

Agar toko kamu bisa diakses oleh pembeli dari seluruh dunia di HP mereka:

1. Unggah (*upload*) folder proyek `rizzflow` kamu ke akun [https://github.com](https://github.com) (gratis).
2. Buka [https://vercel.com](https://vercel.com) dan login menggunakan akun GitHub kamu.
3. Klik **Add New...** -> **Project**, lalu pilih proyek `rizzflow` kamu dan klik **Import**.
4. Pada bagian **Environment Variables**, masukkan semua isi yang ada di file `.env.local` kamu satu per satu.
5. Klik tombol **Deploy**.
6. Tunggu sekitar 1 menit, dan selamat! Toko digital **RizzFlow** kamu sudah resmi online! Jangan lupa ganti `NEXT_PUBLIC_APP_URL` di Vercel dengan alamat website Vercel kamu yang baru.