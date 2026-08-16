# Thumbnail HUT ke-81 — SMK Kehutanan Rimba Bahari

Versi ini memperbaiki alur selfie:

1. Guru/siswa pilih foto selfie.
2. Foto diproses di browser.
3. Background dihapus otomatis.
4. Orangnya diposisikan ke area kiri desain.
5. Area foto lama ditutup dengan nuansa hutan yang diambil dari desain asli.
6. Hasil bisa langsung di-download PNG.

## Deploy ke Vercel

### Cara paling mudah: upload ke GitHub
- Buat repository baru.
- Upload seluruh isi folder ini.
- Di Vercel pilih **Add New → Project**.
- Pilih repository tersebut.
- Framework akan terbaca sebagai Vite.
- Build Command: `npm run build`
- Output Directory: `dist`
- Klik Deploy.

### Catatan
Fitur remove-background memakai `@imgly/background-removal` dan berjalan di browser. Pada pemakaian pertama, model AI perlu diunduh sehingga proses pertama bisa lebih lama. Setelah itu biasanya lebih cepat.

Jangan hapus `public/design.png` karena itu adalah desain thumbnail yang digunakan aplikasi.
