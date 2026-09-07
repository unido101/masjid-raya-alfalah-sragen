# Masjid Raya Al-Falah Sragen — Web Publik

Situs statis untuk informasi program jamaah, donasi QRIS/transfer, pendaftaran via WhatsApp, dan laporan publik.

## Deploy ke Vercel

1. Buat repository GitHub baru, misalnya `masjid-raya-alfalah-public`.
2. Unggah seluruh isi folder ini ke repository tersebut.
3. Di Vercel pilih **Add New → Project**, lalu import repository baru.
4. Biarkan pengaturan build kosong / framework **Other**, lalu klik **Deploy**.

## iPaymu

Checkout iPaymu dijalankan oleh endpoint serverless `/api/ipaymu`, sehingga API key tidak pernah dikirim ke browser. Tambahkan Environment Variables berikut di Vercel (Production dan Preview):

- `IPAYMU_VA`: nomor VA iPaymu.
- `IPAYMU_API_KEY`: API Key iPaymu.
- `IPAYMU_BASE_URL` (opsional): endpoint iPaymu; secara bawaan memakai `https://my.ipaymu.com/api/v2/payment`.

Gunakan kredensial sandbox dan isi `IPAYMU_BASE_URL` dengan endpoint sandbox iPaymu saat pengujian. Setelah kredensial ditambahkan, lakukan redeploy.
