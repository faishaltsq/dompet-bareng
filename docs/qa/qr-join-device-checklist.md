# Checklist Perangkat & Acceptance — QR Join (1.3.0)

Status: **menunggu eksekusi perangkat**. Dokumen ini hanya mencatat hasil yang benar-benar diamati. Baris yang belum dijalankan ditandai `BELUM DIUJI`, bukan `GAGAL`.

## Lingkungan rujukan

| Item | Nilai |
| --- | --- |
| Target runtime | `appVersion` **1.3.0**, Android `versionCode` **4** |
| Rilis sebelumnya (baseline signature) | 1.2.0 / code3, SHA256 APK `ed0d9f8ffb69ede9df1bd1fb36eff4ae099fa4576d66d36acd3b87f904ee90bc` |
| Dependen native baru | `expo-camera` **57.0.6** (range SDK `~57.0.5`), `react-native-svg` 15.15.4 |
| Izin kamera | `CAMERA`; **tanpa** `RECORD_AUDIO`, `microphonePermission: false` |
| Profil build | `preview` (publik), `qr-join-qa` (kandidat, tidak pernah promotable) |

## Bukti lokal yang sudah terekam

Perintah dijalankan pada 2026-10-19 di host Windows ini.

| Gate | Perintah | Hasil aktual |
| --- | --- | --- |
| Unit | `NODE_ENV=test npm test` | **PASS** — 24 file, **409** test |
| Typecheck | `npx tsc --noEmit` | **PASS** (exit 0) |
| DB all + guard proof | `npm run test:db:qr -- --stage all --prove-guards` | **PASS** — baseline positive control, 3 migrasi, workflow, **flag_gate**, authorization, 2-session race, approval-vs-reset, mutant guard proof, performance |
| DB race | `npm run test:db:qr -- --stage race --prove-guards` | **PASS** |
| DB rollback | `npm run test:db:qr -- --stage rollback` | **PASS** |
| DB performance | `npm run test:db:qr -- --stage performance` | **PASS** (pending query 0.048–0.081 ms pada harness) |
| Whitespace | `git diff --check` | **PASS** (exit 0) |
| Export multi-platform | `CI=1 npx expo export --platform all` | **PASS** — Android `index-…hbc` 6.1 MB, iOS 5.9 MB, web 3.3 MB, **18 static routes** termasuk `/scan-invite`, `/join-requests`, `/invite/[token]` |
| Prebuild Android | `CI=1 npx expo prebuild --platform android --no-install` | **PASS** |
| Audit dependensi | `npm audit` | **35** temuan: 1 critical, 23 high, 11 moderate — lihat bagian audit |

## Skenario perangkat (belum dijalankan)

Isi kolom **Hasil** dan **Bukti** (screenshot/log/ID build) saat benar-benar diamati.

| # | Skenario | Ekspektasi | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka QR berulang / refresh / restart app | URL HTTPS sama selama belum di-reset | BELUM DIUJI | — |
| 2 | Decode QR asli oleh kamera HP / Google Lens | Keluar URL `https://dompet-bareng.vercel.app/invite/<token>` yang sama persis dengan yang dirender | BELUM DIUJI | — |
| 3 | Scan dari dalam aplikasi | Satu hasil diterima, tidak loncat ke browser, target wallet & akun sesuai, **tidak** langsung jadi member | BELUM DIUJI | — |
| 4 | Signed out / anonymous | Preview metadata minimal; login Google mempertahankan intent; anon tidak bisa submit | BELUM DIUJI | — |
| 5 | Requester registered → pending | Tidak ada akses data keuangan sebelum approval; request bertahan setelah restart | BELUM DIUJI | — |
| 6 | Approve / reject oleh owner/admin lain | Requester melihat hasil otoritatif | BELUM DIUJI | — |
| 7 | Ganti dompet / ganti akun | QR, antrean, intent, dan dompet aktif tidak bocor antar scope | BELUM DIUJI | — |
| 8 | Background app / izin kamera ditolak | Kamera berhenti; prompt tidak berulang; input manual tetap tersedia | BELUM DIUJI | — |
| 9 | Reset / disable QR | QR lama menolak request baru; pending QR lama kedaluwarsa; member lama tetap member | BELUM DIUJI | — |
| 10 | Aksi ganda / telat (scan & keputusan dobel) | Tidak ada duplikasi membership; membership yang sudah dihapus tidak balik | BELUM DIUJI | — |
| 11 | Fallback browser (kamera/Lens) | Link membuka app / login browser / opsi download tanpa loop redirect | BELUM DIUJI | — |
| 12 | Layout & bahasa | Layar kecil, safe area, keyboard input manual, quiet zone QR terbaca, salinan ID/EN | BELUM DIUJI | — |
| 13 | Cold start release tanpa Metro | App 1.3.0 start bersih, widget tetap jalan | BELUM DIUJI | — |
| 14 | iOS device | Diperlukan perangkat/simulator iOS nyata | BELUM DIUJI (export iOS ≠ bukti perilaku) | — |
| 15 | Dompet belum pernah membuat QR | Panel menampilkan status nonaktif + tombol "Aktifkan QR"; **tidak** ada QR yang diam-diam dibuat saat panel dibuka | BELUM DIUJI | — |
| 16 | `qr_join_enabled=false` (kill switch) | Approval baru tertolak; menolak permintaan tetap bisa; scan baru tertolak | BELUM DIUJI | — |

## Cara menjalankan

```bash
# Build kandidat terisolasi (tidak promotable)
CI=1 EAS_NO_VCS=1 npx --yes eas-cli@25.2.0 build --platform android --profile qr-join-qa --non-interactive --no-wait --freeze-credentials --json

# Build publik final (setelah seluruh gate hijau + otorisasi rilis)
CI=1 EAS_NO_VCS=1 npx --yes eas-cli@25.2.0 build --platform android --profile preview --non-interactive --no-wait --freeze-credentials --json
```

- Emulator lokal memakai ADB virtual (`adb devices`), tidak butuh port USB fisik.
- Jangan uninstall aplikasi yang ada hanya demi pemasangan signature; gunakan emulator sekali pakai bila perlu.
- Penerimaan kamera Samsung / Google Lens dapat berupa cek yang dibantu user terhadap QR yang dirender; tetap ditandai `BELUM DIUJI` sampai benar diamati.

## Gate yang masih ditahan

1. Migrasi produksi `20261019000100` → `000200` → `000300` (**belum diterapkan**).
2. Deploy webhook dengan `EAS_WEBHOOK_SIGNING_SECRET` + hold `APK_PROMOTION_HOLD=true` (**belum dideploy**).
3. Smoke dua akun di dompet QA produksi setelah `qr_join_enabled=true`.
4. Pembacaan ulang `app_configs.latest_apk_url`, `/api/download`, dan checksum APK final.
