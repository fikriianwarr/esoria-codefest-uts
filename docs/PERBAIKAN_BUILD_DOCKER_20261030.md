# Perbaikan build Docker setelah gagal 3/89 tes — 30 Oktober 2026

## Sumber dan masalah

Paket ini disusun dari arsip `esoria-codefest-uts-main.zip` yang diberikan pemilik repository, dengan revisi lintas Windows yang sebelumnya diperlukan. Source aplikasi `app/`, berkas `compose.deploy.yaml`, `compose.yaml`, serta workflow `.github/workflows/esoria-ci-cd.yml` tetap sesuai arsip tersebut.

Pada build sebelumnya, tes 87–89 gagal ketika `node --test` berjalan di Docker stage `/build`:

- `ENOENT ... /build/PERIKSA-BUKTI.cmd`
- `ENOENT ... /build/PERIKSA-SEMUA.cmd`
- `ENOENT ... /build/buka-bukti-github.ps1`

Akar masalah: `.dockerignore` mengecualikan `*.cmd`, sementara Dockerfile tidak menyalin `.cmd` dan `.ps1` ke stage `verify` sebelum `npm test`. Karena itu, tes Windows dapat lulus langsung dari folder Windows, tetapi gagal dalam `docker build`.

## Perubahan

- `.dockerignore`: pola `*.cmd` dihapus sehingga launcher masuk ke build context.
- `Dockerfile`: tambahan `COPY *.cmd ./`, `COPY *.ps1 ./`, dan `COPY Dockerfile .dockerignore ./` pada stage `verify`, **sebelum tes**.
- `tests/docker-build-context.test.mjs`: satu tes regresi tambahan memeriksa syarat di atas dan memastikan tahap runtime tidak membawa launcher.
- README dan panduan PowerShell diperbarui untuk 90 pengujian.

Semua pengujian dari proyek tetap aktif (tidak ada tes di-skip atau dimatikan). File `.env` pribadi tidak disertakan.

## Verifikasi yang telah dilakukan

- `npm run check`: berhasil di lingkungan Linux alat perbaikan.
- `npm test`: 90/90 berhasil di lingkungan Linux alat perbaikan.
- Simulasi perintah `COPY` untuk stage Docker `verify` ke folder bersih: seluruh file tersedia dan 90/90 tes berhasil di sana.
- Docker daemon dan PowerShell Windows tidak tersedia dalam lingkungan alat ini: **build Docker sesungguhnya pada Windows harus dilakukan di komputer pengguna**. Node pada lingkungan alat ialah v22.16.0, sedangkan persyaratan startup aplikasi ialah Node 24.22.1; hasil Docker yang benar menggunakan image base Node 24.22.1.

## Cara menguji secara benar di Windows PowerShell

Ekstrak ZIP ke folder kerja dan pastikan Docker Desktop berjalan pada Linux containers. Jangan hilangkan file `.env` lama bila menggunakan volume `esoria_uts_data` yang sudah ada. Jika `.env` hilang tetapi container lama benar, launcher mencoba pemulihan aman.

```powershell
Get-Location
Get-ChildItem -Name
node --version
docker compose version
docker info --format '{{.ServerVersion}}'
Test-Path .env

# Verifikasi bahwa build menggunakan source terbaru, bukan cache tes lama:
docker compose build --no-cache
# Lanjut hanya apabila perintah build di atas berhasil:
.\mulai.cmd

docker compose ps
npm run check
npm test
npm run verify:container:windows
npm run check:docker
.\cek-bukti.ps1
```

Bila `docker compose build --no-cache` gagal, jangan menghapus container/volume lama. Periksa pesan error aktual; aplikasi lama dapat tetap `healthy` tetapi itu bukan bukti build baru berhasil. Perintah `npm run verify:container:windows` membuat container dan volume **uji terpisah** lalu menghapus hanya aset uji. Untuk URL GitHub, gunakan `powershell -NoProfile -ExecutionPolicy Bypass -File .\buka-bukti-github.ps1 -BukaBrowser` alih-alih menempel URL mentah ke PowerShell.

Rilis image lokal dengan `/api/release` `commit=local` diperiksa dengan:

```powershell
node scripts/check-runtime.mjs --expected-release local
```

Perintah `--expected-sha` untuk commit GitHub **harus gagal** pada image `local`. Keamanan verifikasi tersebut tidak diubah. Tidak ada push, deploy produksi, atau penghapusan volume dalam revisi kode ini.
