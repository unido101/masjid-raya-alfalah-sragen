
# Masjid Raya Al-Falah Sragen — Web Publik

Website publik Masjid Raya Al-Falah Sragen untuk informasi program jamaah, donasi melalui QRIS dan transfer bank, pendaftaran program melalui WhatsApp, serta laporan publik.

## Teknologi

- HTML, CSS, dan JavaScript
- MongoDB Atlas untuk data program
- Vercel untuk hosting dan API
- WhatsApp untuk pendaftaran program

## Deploy ke Vercel

1. Hubungkan repository GitHub ke Vercel.
2. Gunakan framework preset `Other`.
3. Pastikan dependency terpasang melalui `package.json`.
4. Atur environment variables yang dibutuhkan di Vercel.
5. Deploy dan uji endpoint API.

## Environment Variables

- `MONGODB_URI`: URI koneksi MongoDB Atlas.
- `MONGODB_DB`: nama database, default `alfalah`.
- `ADMIN_TOKEN`: token otorisasi untuk pengelolaan data melalui API admin.

Jangan menyimpan kredensial atau token rahasia di dalam kode frontend maupun repository publik.

## Metode Donasi

Website menyediakan informasi donasi melalui QRIS dan transfer bank. Integrasi pembayaran iPaymu tidak digunakan.

## Fitur Website

- Informasi program masjid.
- Pengambilan data program melalui API.
- Donasi melalui QRIS dan transfer bank.
- Pendaftaran program melalui WhatsApp.
- Bagian laporan publik.