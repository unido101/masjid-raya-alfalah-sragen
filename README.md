# Masjid Raya Al-Falah Sragen — Web Publik

Situs statis untuk informasi program jamaah, donasi QRIS/transfer, pendaftaran via WhatsApp, dan laporan publik.

## Deploy ke Vercel

1. Buat repository GitHub baru, misalnya `masjid-raya-alfalah-public`.
2. Unggah seluruh isi folder ini ke repository tersebut.
3. Di Vercel pilih **Add New → Project**, lalu import repository baru.
4. Biarkan pengaturan build kosong / framework **Other**, lalu klik **Deploy**.

## iPaymu

Tampilan iPaymu sengaja ditandai “Segera hadir”. Integrasi checkout perlu endpoint serverless dan Environment Variables Vercel agar API key tidak terekspos di browser.
