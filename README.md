# ESORIA CodeFest UTS — Paket Bersih

Paket ini merupakan **edisi ESORIA CodeFest untuk UTS Pengembangan dan Operasi** yang menggunakan aplikasi Node.js + SQLite di dalam container Docker. Halaman ESORIA, API, autentikasi peserta/admin, pendaftaran, kategori, dan alur pengelolaan tetap ada. Edisi UTS ini **bukan** seluruh fitur website Firebase awal; fitur yang tidak dimigrasikan tidak boleh dianggap tersedia.

## Memulai dengan satu file

1. Ekstrak ZIP ke folder biasa (bukan menjalankan file langsung dari ZIP).
2. Jalankan **Docker Desktop** dengan Linux containers dan pastikan **Node.js 24.22.1 atau versi 24 lebih baru** terpasang.
3. Klik dua kali **`mulai.cmd`**. Launcher membuat `.env` hanya jika belum tersedia, memilih port yang bebas, menjalankan `docker compose up -d --build --wait`, dan membuka website di browser.
4. Jika port 8080 sudah terpakai, port cadangan (misalnya 8088) dipilih dan disimpan ke `.env`. Lihat alamat yang dicetak pada terminal.
5. Admin awal: `admin@esoria.test`. Kata sandi dibuat acak pada pemakaian pertama dan disimpan dalam `.env`. **Jika memakai database lama, salin `.env` lama dari folder proyek sebelumnya sebelum menjalankan `mulai.cmd`** agar kredensial tetap sama. Sandi admin tidak ditampilkan lagi jika `.env` sudah ada.

**Hanya `mulai.cmd` yang merupakan launcher Windows di folder proyek.** Skrip `.mjs` dan `.sh` dalam `scripts/` wajib dipertahankan karena diperlukan untuk build, pengujian, pemeriksaan kontainer, atau CI/CD. Jangan menghapus `Dockerfile`, `compose*.yaml`, `.github/`, `package*.json`, `app/`, atau `tests/`.

## Perintah setelah website menyala

Jalankan PowerShell dari folder proyek:

```powershell
docker compose ps
docker compose logs --tail 60 web
npm run check:docker
npm run verify:container:windows
```

`npm run verify:container:windows` menguji image, API, healthcheck, serta ketahanan data saat container di-restart dan dibuat ulang memakai **volume uji terpisah**. Berkas bukti lokal dibuat di `evidence/local/` saat pemeriksaan berhasil. Perintah tersebut tidak menghapus volume utama.

Jika hanya ingin menghentikan container tanpa menghapus data:

```powershell
docker compose down
```

### Database dan keamanan

Volume database utama adalah **`esoria_uts_data`**. File `.env` disimpan di komputer Anda, tidak dimasukkan ke ZIP dan tidak boleh di-commit. Jangan menjalankan `docker compose down -v` kecuali benar-benar ingin menghapus database (akun peserta, pendaftaran, aktivitas, dan pengaturan). Reset volume **tidak** mengubah `.env`; pada startup admin dibentuk/disinkronkan dari kredensial tersebut.

Jika login admin belum sesuai setelah startup, periksa `ADMIN_EMAIL` dan `ADMIN_PASSWORD` pada `.env` milik sendiri lalu jalankan `mulai.cmd` kembali. Container akan menyinkronkan akun admin dengan `.env`. Jangan mengunggah nilai rahasia ini.

## CI/CD untuk rubrik UTS

`Dockerfile` memakai tahap `verify` sebelum tahap runtime. `compose.yaml` untuk lokal dan `compose.deploy.yaml` untuk deployment menggunakan volume yang sama. Pipeline `.github/workflows/esoria-ci-cd.yml` melaksanakan:

1. **verify:** pemeriksaan source,  pengujian Node dan build/uji container sesungguhnya.
2. **publish:** setelah CD diaktifkan, unggah image yang telah lulus tes ke GitHub Container Registry.
3. **deploy:** pasang image terverifikasi pada self-hosted runner Linux dan cek health/commit dengan rollback saat gagal.

Job `publish` dan `deploy` sengaja bersyarat; belum bisa dianggap berhasil sebelum ada repository, secrets, variables, dan runner yang disiapkan oleh kelompok. Petunjuk teknis lengkap: [`docs/CI_CD.md`](docs/CI_CD.md). Pemetaan rubrik: [`docs/ANALISIS_RUBRIK.md`](docs/ANALISIS_RUBRIK.md). Teknologi serta asal materi: [`docs/SUMBER.md`](docs/SUMBER.md).

## Struktur paket minimal

```text
mulai.cmd                  Satu-satunya launcher Windows
app/                       Website, API dan SQLite
scripts/                   Verifikasi, deployment, rollback dan startup
tests/                     Pengujian otomatis
Dockerfile                 Build image multi-stage
compose.yaml               Menjalankan container lokal
compose.deploy.yaml        Pemasangan image CI/CD
.github/workflows/         Pipeline GitHub Actions
.env.example               Contoh konfigurasi tanpa kata sandi asli
package.json, package-lock.json
docs/                      Hanya panduan teknis CI/CD, pemetaan rubrik, dan sumber
```

Direktori **referensi Firebase lama**, **log hasil uji historis**, berkas laporan, dan launcher Windows tambahan **tidak disertakan** karena tidak dibutuhkan aplikasi UTS ini. Ini tidak menghapus source asli pada perangkat Anda atau mengubah volume Docker yang sudah ada.

**Batas klaim rubrik:** Uji kode lokal tidak sama dengan bukti Docker Desktop dan deployment GitHub Actions. Penilaian UTS 100 poin mencakup container (50), CI/CD (20), video (20), dan laporan (10). Video dan laporan tidak dibuat dalam paket ini sesuai permintaan, sehingga nilai 100 tidak bisa dijamin dari ZIP saja.
