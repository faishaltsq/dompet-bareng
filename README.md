# DompetBareng 💰🐾

Aplikasi manajemen keuangan bersama untuk keluarga, pasangan, dan organisasi berbasis **Expo SDK 57 (React Native 0.86 / React 19)** dengan backend **Supabase** dan asisten keuangan interaktif berkarakter **Maskot Otter**.

---

## 🌟 Fitur Utama

### 1. Multi-Workspace (Dompet Bersama)
- **Multi-Tenant**: Buat dan kelola banyak dompet secara independen (misal: *Kas Keluarga*, *Tabungan Liburan*, *Kas Kantor*).
- **Peran & Akses**: Kontrol akses berbasis peran (**Admin** & **Member**).
- **Undangan Instan**: Buat tautan undangan deep-link (`dompetbareng://invite/<token>`) yang dapat langsung dibuka di aplikasi.
- **Manajemen Anggota**: Admin dapat mengeluarkan (*kick*) anggota dengan mencantumkan alasan khusus.
- **Foto Dompet**: Dukungan upload dan ganti foto profil dompet (tersimpan di Supabase Storage).
- **Persistent State**: Pilihan dompet terakhir tersimpan secara statis di perangkat pengguna.

### 2. Maskot Finansial Interaktif (Otter Companion)
- **Floating Overlay**: Maskot berang-berang mengambang yang dapat digeser (*draggable*) dan otomatis menempel ke tepi layar (*auto-docking*).
- **State Machine Mood Finansial**:
  - 🟢 **HAPPY**: Pengeluaran sehat (< 50% atau surplus besar).
  - 🔵 **NEUTRAL**: Pengeluaran stabil (50% – 75%).
  - 🟡 **WARNING**: Waspada pengeluaran (75% – 95%).
  - 🔴 **PANIC**: Kritis / defisit (pengeluaran > pemasukan / overbudget).
- **Tooltip Cerdas**: Pesan sapaan dinamis yang otomatis menyesuaikan posisi (kiri/kanan layar) saat otter digeser.
- **Interactive Companion Hub**:
  - **Quick Action Chips**: *"Boleh jajan gak hari ini?"*, *"Cek kebocoran halus"*, *"Roast dompet gue"*, *"Rangkum minggu ini"*.
  - **Quick NLP Expense Parser**: Catat transaksi langsung dari obrolan (contoh: *"Kopi kenangan 28rb"* atau *"Gaji 5jt"*).
  - **Status Ketahanan Dompet**: Estimasi sisa hari aman finansial berdasarkan riwayat pengeluaran harian.

### 3. Sistem Notifikasi In-App Realtime
- **Lonceng Notifikasi**: Ikon lonceng di header Beranda dengan badge jumlah pesan belum dibaca (*unread count*).
- **Histori & Filter Status**: Tampilan daftar notifikasi dengan penanda status dibaca (*read*) dan belum dibaca (*unread*).
- **Detail Notifikasi**: Modal detail pesan lengkap (termasuk alasan khusus dari admin saat dikeluarkan dari dompet).
- **Tandai Semua Dibaca**: Fitur satu ketukan untuk menandai seluruh notifikasi sebagai sudah dibaca.
- **Realtime Sync**: Ditenagai Supabase Realtime websocket (notifikasi masuk seketika tanpa refresh).

### 4. Pencatatan Transaksi & Anggaran Kategori
- **Pencatatan Cepat & Optimistik**: Penambahan transaksi instan tanpa menunggu loading network (`router.back()` langsung).
- **Filter Fleksibel**: Filter berdasarkan periode (Hari ini, Minggu ini, Bulan ini, Semua).
- **Target Anggaran (Budgeting)**: Atur batas kuota pengeluaran per kategori bulanan disertai progress bar visual.
- **Upload Struk**: Lampirkan foto bukti transaksi.

### 5. Autentikasi & Keamanan
- **Google OAuth**: Integrasi login Google dengan PKCE flow yang mendukung Web dan Mobile.
- **Multi-Account Switching**: Dukungan ganti akun bersih dengan Google Account Selector (`prompt: select_account`).
- **Dev / Tester Mode**: Jalur cepat login pengujian untuk staging / development.
- **Row Level Security (RLS)**: Isolasi data multi-tenant ketat di tingkat database PostgreSQL Supabase.

---

## 🛠️ Tech Stack

| Komponen | Teknologi |
| --- | --- |
| **Framework Mobile** | [Expo SDK 57](https://expo.dev) / React Native 0.86 / React 19 |
| **Bahasa** | TypeScript |
| **Routing** | Expo Router (File-based routing) |
| **Animasi & Interaksi** | React Native Reanimated 4, PanResponder (Native Gesture) |
| **Backend & Database** | [Supabase](https://supabase.com) (PostgreSQL, Auth, RLS, Storage, Realtime) |
| **Kecerdasan Buatan (AI)** | 9Router / Google Gemini API |
| **Penyimpanan Lokal** | AsyncStorage (Cache first UI) |

---

## 🚀 Memulai Proyek

### Prasyarat
- Node.js (v18+)
- npm atau yarn
- Aplikasi **Expo Go** di Android/iOS atau Android Studio Emulator

### Instalasi

1. **Clone repository**:
   ```bash
   git clone https://github.com/faishaltsq/dompet-bareng.git
   cd dompet-bareng
   ```

2. **Install dependensi**:
   ```bash
   npm install
   ```

3. **Konfigurasi Environment**:
   Salin atau buat file `.env` di root project:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   EXPO_PUBLIC_AI_BASE_URL=https://<your-ai-gateway>/v1
   EXPO_PUBLIC_AI_API_KEY=<your-api-key>
   EXPO_PUBLIC_AI_MODEL=ag/gemini-3.8-flash-high
   ```

4. **Setup Database Supabase**:
   Jalankan file migrasi SQL yang berada di folder `supabase/` melalui Supabase SQL Editor secara berurutan:
   - `supabase/schema.sql` (Skema dasar)
   - `supabase/add_profiles.sql` (Tabel profil pengguna)
   - `supabase/add_realtime_budgets.sql` (Anggaran & publikasi realtime)
   - `supabase/fix_recursion_final.sql` (RLS non-rekursif membership)
   - `supabase/add_notifications_and_fix_kick.sql` (Tabel notifikasi & RLS kick anggota)

5. **Jalankan Aplikasi**:
   ```bash
   # Jalankan Expo Development Server
   npx expo start

   # Atau langsung di Android
   npx expo start --android

   # Atau jalankan di Web
   npx expo start --web
   ```

---

## 📋 Ringkasan Progress Pengembangan

- [x] Inisialisasi Expo Router & Desain UI FinWise (Beranda, Statistik, Pengaturan).
- [x] Integrasi Supabase Auth (Google OAuth & Dev Guest Bypass).
- [x] Sistem Multi-Workspace (Create, Rename, Delete, Switch Workspace).
- [x] Sistem Undangan Deep Link (`dompetbareng://invite/[token]`).
- [x] Upload Foto Dompet & Bukti Transaksi ke Supabase Storage.
- [x] Input Transaksi Optimistik & Filter Periode.
- [x] Fitur Anggaran Bulanan (*Budgeting*) per Kategori.
- [x] Floating Mascot Otter Draggable (PanResponder, bebas crash di React 19).
- [x] AI Assistant Chat Hub, NLP Parser, & Quick Action Chips via 9Router.
- [x] Tooltip Sapaan Dinamis mengikuti posisi drag maskot (Kiri/Kanan/Bawah).
- [x] Dialog Konfirmasi Kick Anggota disertai Input Alasan.
- [x] Sistem Notifikasi In-App Realtime (Histori, Unread Badge, Detail Popup, Read/Unread).
- [x] Penanganan Sesi Bersih & Pembersihan Cache Logout (Web & Mobile).
- [x] Migrasi RLS Supabase bebas rekursi (`SECURITY DEFINER`).

---

## 📄 Lisensi
Proyek ini dibuat untuk keperluan internal dan pengembangan bersama.
