# Sumber aplikasi dan referensi teknis

## Source aplikasi yang diberikan

- Nama lampiran: `esoria_codefest(20261026-133256).zip`.
- Asal: unggahan pengguna pada percakapan tugas UTS kelompok ini, 26 Oktober 2026.
- Nama aplikasi: ESORIA CodeFest.
- Identitas penulis/pemegang lisensi source awal: tidak dinyatakan dalam lampiran percakapan; tidak dikarang pada laporan ini.
- Arsip source Firebase awal **tidak disertakan** dalam paket ZIP minimal karena tidak dipakai runtime edisi UTS. Simpan berkas asli secara terpisah sebagai sumber referensi jika dibutuhkan untuk pengumpulan akademik.
- Logo dan favicon runtime disalin dari `public/assets/` pada source awal.

Frontend dan backend edisi UTS, pengujian, Dockerfile, Compose, pipeline, serta panduan merupakan adaptasi untuk tugas ini berdasarkan source dan instruksi yang diberikan. Kelompok wajib menelaah source, menjalankan pengujian, dan memahami penjelasannya.

## Aplikasi/teknologi pendukung

| Pendukung | Penggunaan |
|---|---|
| Node.js 24.22.1 | HTTP server, crypto, filesystem, test runner, dan SQLite bawaan |
| SQLite / node:sqlite | Penyimpanan akun, sesi, kategori, pendaftaran, dan aktivitas |
| Docker Engine / Docker Desktop | Build dan menjalankan container Linux |
| Docker Compose v2 | Konfigurasi layanan, port, volume, health/readiness, lifecycle |
| Git dan GitHub | Source versioning, repository dan pull request |
| GitHub Actions | Pengujian, publikasi image, dan deployment otomatis |
| GitHub Container Registry | Penyimpanan image yang telah diuji |
| Ubuntu/WSL 2 dan Node.js 24 | Mesin self-hosted runner dan penulisan konfigurasi deployment |
| Browser modern | Mengakses website dan mencetak tiket |

Tidak ada dependency npm pihak ketiga pada runtime edisi UTS. Lockfile tetap disertakan agar `npm ci` konsisten. Dependency source Firebase awal tidak dipakai untuk menjalankan edisi UTS.

## Dokumentasi primer yang dirujuk

1. Docker. Dockerfile reference. https://docs.docker.com/reference/dockerfile/
2. Docker. Define services in Docker Compose. https://docs.docker.com/reference/compose-file/services/
3. Docker. Docker Compose volumes. https://docs.docker.com/reference/compose-file/volumes/
4. Docker. Introduction to GitHub Actions with Docker. https://docs.docker.com/guides/gha/
5. GitHub. Publishing Docker images. https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images
6. GitHub. Adding self-hosted runners. https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners
7. GitHub. Choosing the runner for a job. https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job
8. Node.js. SQLite, versi 24. https://nodejs.org/docs/latest-v24.x/api/sqlite.html
9. Node.js. Crypto. https://nodejs.org/docs/latest-v24.x/api/crypto.html
10. Node.js. Test runner. https://nodejs.org/docs/latest-v24.x/api/test.html

Tanggal pemeriksaan referensi utama: 26 Oktober 2026. Referensi mendukung cara implementasi teknis; tidak membuktikan bahwa workflow kelompok telah dijalankan.
