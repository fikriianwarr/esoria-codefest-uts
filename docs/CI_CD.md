# Aktivasi CI/CD ESORIA UTS

## Tujuan dan batas konfigurasi awal

Workflow `.github/workflows/esoria-ci-cd.yml` melakukan tiga job: `verify`, `publish`, dan `deploy`. File ini siap dikonfigurasi, tetapi **belum ada repository atau runner kelompok yang dihubungkan saat ZIP disiapkan**. Bukti CD baru ada setelah job `deploy` benar-benar berhasil.

Pipeline memakai GitHub Actions, GitHub Container Registry (GHCR), dan satu self-hosted runner Linux x64 milik kelompok. Runner sekaligus menjadi mesin deployment. Alternatif hemat untuk pengguna Windows adalah Ubuntu WSL 2 dengan integrasi Docker Desktop; mesin dan terminal runner harus tetap menyala saat deployment.

## 1. Unggah source ke repository kelompok

Buat **satu repository kelompok**, gunakan branch `main`, aktifkan Actions, lalu unggah isi folder proyek termasuk `.github`, Dockerfile, lockfile, source aplikasi, pengujian, dan dokumentasi. `.env`, data SQLite, log pribadi, atau token runner tidak boleh di-commit.

Contoh dari terminal proyek, setelah Git dan identitas commit dikonfigurasi:

```bash
git init
git branch -M main
git add .
git commit -m "Siapkan ESORIA UTS dengan container dan CI/CD"
git remote add origin https://github.com/AKUN_KELOMPOK/NAMA_REPOSITORY.git
git push -u origin main
```

Ganti URL contoh dengan repository yang benar. GitHub dapat meminta autentikasi melalui mekanisme Git yang tersedia pada komputer. Jangan menyisipkan token ke URL remote atau source code.

Pada revisi ini, **CI selalu menguji kode dan container di Pull Request serta branch `main`**. Bila `ENABLE_CD` belum disetel menjadi `true`, langkah pemeriksaan rahasia dan job `publish`/`deploy` dilewati, tetapi hasil CI tetap dapat diverifikasi. Ketika `ENABLE_CD=true`, langkah **Check required CD settings when deployment is enabled** memvalidasi kedua secret dan port tujuan; pengujian gagal sebelum publikasi jika konfigurasi belum lengkap. **Deploy yang skipped belum memenuhi bukti Continuous Deployment.**

## 2. Siapkan mesin deployment Linux

Kebutuhan:

- Linux x64/Ubuntu atau Ubuntu WSL 2 dengan Docker Desktop integration.
- Docker Engine/CLI, Compose v2 yang mendukung `--wait`, Node.js 24, dan akses internet ke GitHub/GHCR.
- User runner dapat menjalankan `docker info` dan `docker compose version` tanpa prompt interaktif.
- Port deployment yang benar pada mesin runner. Jika menggunakan daemon Docker yang sama dengan website lokal, periksa `docker compose port web 3000` dan gunakan port itu, misalnya 8088. Pada mesin berbeda, gunakan port kosong yang ditetapkan operator.

Periksa dari terminal Linux yang akan menjalankan runner:

```bash
docker info
docker compose version
node --version
```

Jika aplikasi lokal dari `compose.yaml` sudah memakai daemon yang sama, idealnya gunakan kredensial admin yang sama untuk secrets CD. Volume `esoria_uts_data` dipertahankan. Pada revisi ini, `ADMIN_SYNC_ON_START=true` menyelaraskan akun admin dengan secrets yang aktif setiap kali container dimulai; bila secret berubah, sesi lama dicabut dan password admin mengikuti secret terbaru. Jangan mengubahnya sembarangan.

## 3. Daftarkan self-hosted runner

1. Repository GitHub → **Settings → Actions → Runners → New self-hosted runner**.
2. Pilih **Linux** dan **x64**.
3. Ikuti perintah unduh dan verifikasi runner yang diberikan GitHub pada halaman tersebut. Gunakan versi/URL/token yang ditampilkan saat ini, bukan token dari contoh orang lain.
4. Letakkan folder runner di luar checkout aplikasi, misalnya `~/actions-runner-esoria`.
5. Pada perintah konfigurasi, tambahkan label **`esoria-uts`**, melalui opsi `--labels esoria-uts` atau isian label interaktif. Label default self-hosted/Linux/X64 tetap dipakai.
6. Jalankan `./run.sh` dan biarkan terminal ini hidup untuk demonstrasi. Di GitHub, status runner harus **Idle** atau online.

Workflow hanya mengirim job deployment dari branch `main` ke runner ini. Pull request memakai GitHub-hosted runner untuk pengujian, sehingga kode pull request belum langsung berjalan pada mesin deployment. Batasi akses tulis repository kepada anggota yang berwenang.

## 4. Isi secrets repository

Repository → **Settings → Secrets and variables → Actions → Secrets → New repository secret**.

| Nama secret | Isi |
|---|---|
| ESORIA_ADMIN_EMAIL | Email admin awal; dapat memakai `admin@esoria.test` |
| ESORIA_ADMIN_PASSWORD | Kata sandi admin awal yang kuat; salin dari `.env` jika database lokal sudah digunakan |

Password harus 12–128 karakter, mengandung huruf dan angka, dan untuk script deploy ini jangan memakai newline, petik tunggal, atau backslash. Password acak dari `npm run setup` sesuai ketentuan tersebut.

`GITHUB_TOKEN` tersedia otomatis pada job, dipakai untuk push/pull GHCR, dan tidak perlu dibuat sebagai PAT terpisah. Jika organisasi membatasi Actions/packages, sesuaikan izin repository/organisasi agar job memiliki `packages: write` saat publish dan `packages: read` saat deploy.

## 5. Isi variables repository

Pada halaman yang sama, pilih tab **Variables → New repository variable**.

| Nama variabel | Nilai awal | Fungsi |
|---|---|---|
| ENABLE_CD | `true` | Mengaktifkan job deploy setelah runner dan secrets siap |
| ESORIA_APP_PORT | Port aktual, misalnya `8088` | Wajib diisi; cocokkan dengan mesin runner, terutama setelah launcher memakai port cadangan |
| ESORIA_BIND_ADDRESS | `127.0.0.1` | Akses lokal pada mesin deployment |
| ESORIA_COOKIE_SECURE | `false` | HTTP lokal; `true` hanya setelah menggunakan HTTPS |

Tidak ada secret/domain/VPS yang perlu dikarang. Akses website dari komputer lain memerlukan konfigurasi jaringan yang memang diizinkan; default tidak memublikasikannya ke internet. Ketentuan public pada rubrik yang diberikan berlaku eksplisit pada video.

## 6. Jalankan pipeline penuh

Setelah konfigurasi siap, buka tab **Actions → ESORIA UTS - CI and CD → Run workflow**, pilih branch `main`, dan jalankan. Alternatifnya push perubahan baru ke `main`.

Urutannya:

1. **verify**: pemeriksaan konfigurasi CD untuk main, `npm ci`, pemeriksaan source, tes API/izin/aturan bisnis/persistensi, build Dockerfile, lalu container smoke test. Container uji memakai volume sementara yang dibersihkan setelah selesai.
2. Container uji membuat akun dan pendaftaran latihan, restart dan membaca lagi data, kemudian menghapus container uji dan membuat container baru dengan volume uji yang sama. ID container harus berubah dan pendaftaran yang sama harus tetap dapat dibaca. Commit runtime juga dicocokkan dengan source build.
3. **publish**: memuat image hasil job verify dari artifact; tidak membangun image berbeda. Image yang sama diberi tag `sha-<commit>` lalu didorong ke GHCR.
4. **deploy**: runner memvalidasi konfigurasi sementara dan menarik image berdasarkan **digest sha256** sebelum mengganti konfigurasi live. Sesudah Compose healthy, ID image container harus cocok dengan image tujuan; HTTP, nama layanan, database, dan commit dari `/api/release` juga diperiksa dengan timeout.
5. Bila penggantian container atau pemeriksaan rilis gagal, script memulihkan `.env`, Compose, dan catatan image sebelum mencoba menjalankan image sukses sebelumnya. Kegagalan pull menjaga konfigurasi live tetap utuh. Job tetap gagal agar masalah terlihat. Pada deployment pertama belum ada image sukses sebelumnya untuk rollback.

Lokasi konfigurasi privat pada mesin deployment adalah `~/.local/share/esoria-uts`, di luar checkout runner. File `current-image` mencatat digest sukses; `previous-image`, `.env.previous`, dan `compose.previous.yaml` menyimpan pasangan image/konfigurasi sukses sebelumnya. Riwayat ditulis sesudah verifikasi berhasil. Data tetap pada named volume `esoria_uts_data`. File konfigurasi privat tidak boleh dimasukkan ke laporan.

## 7. Buktikan deployment otomatis

Setelah pipeline pertama berhasil:

1. Catat commit pada halaman Operasional atau `/api/release`.
2. Ubah satu teks antarmuka yang mudah dikenali, misalnya kalimat pembuka panduan pada `app/public/app.js`.
3. Jalankan tes lokal, commit, dan push ke `main`.
4. Tunggu ketiga job sukses. Tidak perlu menjalankan Docker build manual pada mesin deployment.
5. Muat ulang website. Pastikan teks berubah dan commit pada Operasional sama dengan commit push.
6. Pastikan akun, nomor tiket, dan status pendaftaran yang dibuat sebelumnya tetap ada.

Inilah bukti CD. Image yang hanya berhasil dibangun atau diunggah tanpa layanan tujuan diperbarui baru membuktikan sebagian alur.

## 8. Bukti yang perlu disimpan

- URL repository dan commit yang didemonstrasikan.
- Tautan run Actions dengan tiga job sukses.
- Image tag dan digest dari ringkasan job publish.
- Status runner online dan status container healthy.
- Respons `/api/release` serta halaman web hasil perubahan.
- Nomor tiket/data yang sama sebelum dan sesudah deployment.

Jangan menampilkan `.env`, secret, token runner, cookie, atau isi lengkap `docker inspect` environment dalam bukti.

## 9. Jika deployment gagal

| Gejala | Tindakan |
|---|---|
| Check required CD settings when deployment is enabled gagal | Isi ENABLE_CD=true, kedua secrets admin, dan ESORIA_APP_PORT yang benar, lalu jalankan ulang seluruh workflow |
| Deploy skipped | Set ENABLE_CD menjadi string `true`, pastikan run pada main |
| Waiting for a runner | Pastikan runner online dan seluruh label cocok, termasuk esoria-uts |
| Permission denied saat Docker | Perbaiki akses Docker user runner pada mesin; jangan mengubah workflow menjadi privileged container |
| GHCR denied / 403 | Periksa izin packages serta akses repository pada package GHCR jika nama itu pernah dibuat sebelumnya |
| Bind port gagal | Ganti ESORIA_APP_PORT dengan port kosong dan jalankan ulang pipeline |
| Healthcheck gagal | Periksa log service web pada folder deployment; cari error pertama |
| Commit tidak cocok | Jangan menganggap deploy berhasil; job menolak versi yang tidak sesuai dan mencoba rollback |
| Password secret baru tidak bisa login | Pastikan image revisi ini sudah berjalan dan `ADMIN_SYNC_ON_START=true` di Compose deployment. Periksa email dan password yang digunakan di GitHub Secrets; jangan cetak rahasia di log |

Untuk operasi manual pada deployment hasil CI, dari Linux:

```bash
cd ~/.local/share/esoria-uts
export ESORIA_IMAGE="$(cat current-image)"
docker compose --env-file .env ps
docker compose --env-file .env logs --tail 60 web
```

`ESORIA_IMAGE` harus diisi karena Compose memakai image berdasarkan digest. Perintah operasi pada folder proyek lokal dan folder deployment memiliki konfigurasi yang berbeda; gunakan folder yang sesuai.

## 10. Rollback manual setelah dua deployment berhasil

Pada folder source checkout, jalankan `bash scripts/rollback.sh`. Script memulihkan `previous-image` beserta `.env.previous` dan `compose.previous.yaml`, memakai volume yang sama, menunggu healthcheck, serta mencocokkan ID image runtime. Jika rollback gagal, script mencoba memulihkan deployment semula. Riwayat dari versi lama yang belum memiliki pasangan konfigurasi ditolak; jalankan deployment sukses menggunakan revisi ini untuk membentuk snapshot. Ini rollback image/konfigurasi, bukan restore database. Tidak ada migrasi destruktif pada skema versi 1, tetapi kompatibilitas database harus diperiksa jika kelompok mengubah skema di masa depan.

Referensi resmi: https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners dan https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images.

## Verifikasi tambahan dari komputer Windows

Dari folder project yang berisi `Dockerfile`, jalankan `npm run verify:container:windows`. Alat ini **bukan pengganti CD**; ia hanya membuktikan image Docker benar-benar dibangun, healthcheck dan API berhasil, lalu data tetap ada setelah restart dan recreate container pada **volume uji terpisah**. Audit membersihkan container, volume, dan tag image sementaranya; data utama tetap aman. Bukti hanya ditulis saat pengujian lulus pada `evidence/local/container-audit-*.json`. Untuk CI/CD lengkap, screenshot sukses dari ketiga job GitHub Actions tetap diperlukan.
