<div align="center">
  <a href="https://github.com/fikriianwarr/esoria-codefest-uts">
    <img src="app/public/assets/logo_esoria.webp" alt="Logo ESORIA CodeFest" width="100" />
  </a>

  # ESORIA CODEFEST

  **BUILD. SECURE. COMPETE.**

# Ubah ide kamu menjadi karya dengan kami.
### Kelompok Esoria

 **Havidz Andrian** (NIM: 231111899) |
 **Fikri Anwar** (NIM: 231112145) |
 **Muhammad Alfisyahrin** (NIM: 231112853)

  **UTS Pengembangan dan Operasi · IF-B Pagi · T.A. 2026/2027**

  `Node.js 24` &nbsp;·&nbsp; `Docker` &nbsp;·&nbsp; `SQLite` &nbsp;·&nbsp; `GitHub Actions` &nbsp;·&nbsp; `GHCR`

  [**Mulai menjalankan**](#jalankan-aplikasi) &nbsp;|&nbsp;
  [**Alur CI/CD**](#alur-ci-dan-cd) &nbsp;|&nbsp;
  [**Bukti pengujian**](#bukti-pengujian) &nbsp;|&nbsp;
  [**Dokumentasi**](#dokumentasi)
</div>

---

> [!IMPORTANT]
> **Ruang lingkup:** repository ini berisi **ESORIA CodeFest edisi UTS** untuk praktik container dan CI/CD. Aplikasi menggunakan Node.js + SQLite dan **bukan salinan fitur lengkap** website ESORIA berbasis Firebase yang dikembangkan sebelumnya seperti pada versi untuk lomba kami tidak digunakan lagi disini karena sudah berbeda penerapannya.

ESORIA CodeFest adalah aplikasi web pengelolaan kompetisi informatika dengan antarmuka editorial, sistem akun, pendaftaran, pengelolaan kategori, dan dashboard administrasi. Edisi UTS mengutamakan proses **build → test → publish → deploy** yang dapat diperiksa melalui Docker dan GitHub Actions.

| Komponen | Teknologi dan penerapan |
| :-- | :-- |
| **Antarmuka** | HTML5, CSS3, JavaScript native; responsif |
| **Server & API** | Node.js `24.22.1`, ES Modules, API HTTP |
| **Database** | SQLite melalui `node:sqlite`, mode WAL |
| **Container** | Dockerfile multi-stage, Docker Compose v2 |
| **Penyimpanan** | Named volume `esoria_uts_data` |
| **Otomatisasi** | GitHub Actions: `verify` → `publish` → `deploy` |
| **Registry** | GitHub Container Registry (GHCR) |
| **Mesin deployment** | Self-hosted runner Ubuntu WSL2 + Docker |

### Fitur aplikasi

| Peran | Cakupan fitur |
| :-- | :-- |
| **Peserta** | Registrasi akun, masuk, melihat kategori, mendaftar, melihat status/tiket, mengelola profil, dan mengirim tautan karya |
| **Admin** | Meninjau pendaftaran, mengelola kategori, memantau statistik dan aktivitas |
| **Operasional** | Melihat status layanan dan informasi rilis aplikasi |
---

## Jalankan aplikasi

### Persyaratan

- **Windows** dengan Docker Desktop dan mode **Linux containers** aktif.
- **Docker Compose v2** tersedia melalui Docker Desktop.
- **Node.js `>=24.22.1 <25`** terpasang dan dapat dipanggil dari terminal.
- Source diekstrak ke folder biasa, bukan dijalankan langsung dari dalam ZIP.

### (Windows)

**1.** Jalankan Docker Desktop dan pastikan Docker Engine siap.

**2.** Buka folder source, lalu klik dua kali file **`mulai.cmd`**.

**3.** Buka alamat yang muncul di terminal setelah container berstatus sehat.

```text
Port utama    : http://localhost:8080
Port cadangan : http://localhost:8088 (contoh hasil pengujian)
Port internal : 3000/tcp
```

`mulai.cmd` menjalankan setup bila diperlukan, memilih port yang tersedia, membangun image, menjalankan container, dan menampilkan alamat aplikasi. **Port yang digunakan bisa berbeda**, sehingga ikuti alamat yang benar-benar dicetak oleh launcher.

<details>
<summary><strong>Alternatif: menjalankan melalui PowerShell</strong></summary>

Dari root proyek:

```powershell
npm run setup
docker compose up -d --build --wait
docker compose ps
docker compose port web 3000
```

Cara terminal ini tidak menjalankan pemilihan port cadangan dari launcher. Jika port bentrok, sesuaikan `APP_PORT` di `.env` privat terlebih dahulu.

</details>

### Konfigurasi admin

Pada setup awal, sistem membuat `.env` dengan kata sandi admin acak. Email default pada contoh setup adalah **`admin@esoria.test`**. Simpan kata sandi yang muncul pada setup pertama secara pribadi.

> [!CAUTION]
> **Jangan unggah `.env`** atau menyalin password, token runner, dan session cookie ke repository maupun screenshot. Jika database lama tetap digunakan, pertahankan `.env` yang sesuai agar kredensial admin tidak berubah tanpa disengaja.

---

## Alur CI dan CD

**Alur implementasi yang mudah dibaca tanpa diagram eksternal:**

| Tahap | Proses | Hasil |
| :-- | :-- | :-- |
| **01 · SOURCE** | Commit / pull request pada GitHub | Source masuk ke workflow |
| **02 · VERIFY** | Pemeriksaan source, 81 automated tests, build dan smoke test Docker | Image yang lulus pengujian |
| **03 · PUBLISH** | Upload image teruji ke GHCR saat CD diaktifkan | Referensi image berbasis digest |
| **04 · DEPLOY** | Self-hosted runner mengambil image dan menjalankan Docker Compose | Container aplikasi terbaru |
| **05 · VALIDATE** | Periksa HTTP, database, status sehat, dan SHA rilis | Deployment terverifikasi; kegagalan ditangani skrip pemulihan |

```text
GITHUB REPOSITORY
       |
       v
[ 01 SOURCE ] --> [ 02 VERIFY ]
                         |
                         | main + ENABLE_CD=true
                         v
                  [ 03 PUBLISH / GHCR ]
                         |
                         v
                  [ 04 DEPLOY / WSL2 ]
                         |
                         v
                  [ 05 HEALTH + SHA CHECK ]
                         |
                 SUCCESS / FAILURE HANDLING
```

**Berkas workflow:** [`.github/workflows/esoria-ci-cd.yml`](.github/workflows/esoria-ci-cd.yml)

- `verify` berjalan untuk `pull_request`, `push` ke `main`, dan `workflow_dispatch`.
- `publish` dan `deploy` berjalan sesuai kondisi pada workflow, termasuk `ENABLE_CD=true` dan branch `main`.
- `publish` menerbitkan image **yang sudah lolos tes**, bukan membangun image baru tanpa verifikasi.
- `deploy` menggunakan runner `self-hosted`, `Linux`, `X64`, `esoria-uts` dan memvalidasi rilis setelah pemasangan.
- Mekanisme pemulihan tersedia pada skrip deployment; **keberhasilan rollback dalam kegagalan produksi nyata tidak diklaim**.

### Secrets dan variables

| Jenis | Nama | Keterangan |
| :-- | :-- | :-- |
| Secret | `ESORIA_ADMIN_EMAIL` | Email admin untuk deployment |
| Secret | `ESORIA_ADMIN_PASSWORD` | Password admin, tidak boleh dipublikasikan |
| Variable | `ENABLE_CD` | `true` untuk mengizinkan publish/deploy pada kondisi workflow yang sesuai |
| Variable | `ESORIA_APP_PORT` | Port host tujuan; `8088` pada pengujian yang terdokumentasi |
| Variable | `ESORIA_BIND_ADDRESS` | `127.0.0.1` untuk akses dari komputer sendiri |
| Variable | `ESORIA_COOKIE_SECURE` | `false` pada HTTP lokal; sesuaikan bila menggunakan HTTPS |

Autentikasi ke GHCR dalam workflow memakai **`GITHUB_TOKEN` yang disediakan GitHub Actions**. Panduan konfigurasi lebih lanjut: [`docs/CI_CD.md`](docs/CI_CD.md).

> [!WARNING]
> **Sebelum mengubah README di branch `main`:** perubahan dokumentasi tetap merupakan `push` dan dapat memicu workflow. Jika Anda tidak ingin proses CD berjalan, ubah repository variable `ENABLE_CD` menjadi `false` sebelum commit. Runner self-hosted yang mempunyai akses Docker juga sebaiknya tidak digunakan untuk pekerjaan dari sumber yang tidak dipercaya.

---

## Bukti pengujian

Dokumentasi berikut merujuk pada **GitHub Actions Run #2 tanggal 27 Oktober 2026**, bukan status real-time dari seluruh run berikutnya.

| Job | Hasil pada Run #2 | Durasi job |
| :-- | :--: | --: |
| Test application and container — `verify` | **SUCCESS** | 1 menit 13 detik |
| Publish tested image to GHCR — `publish` | **SUCCESS** | 29 detik |
| Deploy on group machine — `deploy` | **SUCCESS** | 1 menit 21 detik |
| **Workflow keseluruhan** | **SUCCESS** | **9 menit 48 detik** |

**Hasil tambahan yang sudah terdokumentasi:**

- **81 dari 81 automated tests lulus**, tanpa kegagalan pada pengujian yang dicatat.
- Container `esoria-uts-web-1` berstatus **healthy** setelah deployment.
- `/api/health` mengembalikan `status: ok` dan `database: ok`.
- `/api/release` menunjukkan versi `1.0.0` serta commit yang sesuai dengan pipeline.
- Data SQLite berada pada named volume `esoria_uts_data`.
- Audit container lokal menguji restart/recreate dan persistensi pada **volume uji terpisah**.

**Tautan verifikasi:**

- [**GitHub Actions — Run #2 (Success)**](https://github.com/fikriianwarr/esoria-codefest-uts/actions/runs/40434638852)
- [**Workflow CI/CD**](.github/workflows/esoria-ci-cd.yml)
- [**Commit terverifikasi**](https://github.com/fikriianwarr/esoria-codefest-uts/commit/5fe69f90675504bcfc599efebd9fd5de04e5bc98)

<details>
<summary><strong>Identitas image GHCR yang berhasil dipublikasikan</strong></summary>

```text
ghcr.io/fikriianwarr/esoria-codefest-uts/esoria-uts@sha256:98fc41ff98001539068478aadddc9bdb5661e5e03125fbfa66bf425199d8bfd9
```

</details>

> [!NOTE]
> Run #2 berhasil melalui **pemicu manual (`workflow_dispatch`)**. Trigger `push` telah dikonfigurasi, tetapi demonstrasi perubahan aplikasi melalui push baru tidak diklaim sudah diuji secara terpisah. Repository masih **Private** pada screenshot yang didokumentasikan; penguji memerlukan akses untuk membuka kode dan bukti GitHub.

### Perintah verifikasi lokal

Dari PowerShell pada root proyek:

```powershell
npm run check
npm test
npm run verify:container:windows
docker compose ps
```

Untuk memeriksa endpoint, sesuaikan port dengan hasil launcher:

```powershell
curl.exe -fsS http://localhost:8088/api/health
curl.exe -fsS http://localhost:8088/api/release
```

Berkas audit lokal dari skrip verifikasi dapat ditemukan di `evidence/local/` setelah pemeriksaan berhasil. Jangan menafsirkan hasil uji lokal sebagai pengganti status GitHub Actions.

---

## Penyimpanan data dan keamanan

```text
Browser -> http://localhost:<port>
                   |
                   v
         Docker container :3000
                   |
       +-----------+-----------+
       |           |           |
    Frontend     HTTP API    Security
   app/public   app/server   app/security
                   |
                   v
               SQLite WAL
                   |
                   v
          Volume esoria_uts_data
          /app/data/esoria.sqlite
```

Keamanan container yang dikonfigurasi mencakup proses **non-root**, root filesystem **read-only**, `tmpfs /tmp`, `cap_drop: [ALL]`, `no-new-privileges`, dan pembatasan CPU/memori. Healthcheck memastikan aplikasi memberi respons sesuai pemeriksaan runtime.

Hentikan container tanpa menghapus volume database:

```powershell
docker compose down
```

> [!CAUTION]
> **Jangan menjalankan `docker compose down -v`** untuk penghentian biasa karena opsi `-v` dapat menghapus volume database. Keberadaan volume tidak dengan sendirinya membuktikan setiap data historis peserta masih lengkap; pembuktian tersebut memerlukan pemeriksaan isi database sebelum dan sesudah perubahan.

---

## Struktur repository

```text
esoria-codefest-uts/
├── .github/
│   └── workflows/
│       └── esoria-ci-cd.yml       # Verify, publish, deploy
├── app/
│   ├── public/                  # UI, CSS, JS, logo
│   ├── server.mjs               # Server + REST API
│   ├── database.mjs             # SQLite
│   └── security.mjs             # Auth dan kontrol keamanan
├── scripts/                    # Setup, start, verify, deploy, rollback
├── tests/                      # Automated test suite
├── docs/
│   ├── ANALISIS_RUBRIK.md
│   ├── CI_CD.md
│   └── SUMBER.md
├── Dockerfile
├── compose.yaml
├── compose.deploy.yaml
├── mulai.cmd                    # Launcher Windows
├── .env.example                 # Contoh, tanpa password aktual
├── package.json
├── package-lock.json
└── README.md
```

## Dokumentasi

| Berkas | Fungsi |
| :-- | :-- |
| [`docs/CI_CD.md`](docs/CI_CD.md) | Konfigurasi workflow, runner, variabel, dan penanganan kegagalan |
| [`docs/ANALISIS_RUBRIK.md`](docs/ANALISIS_RUBRIK.md) | Pemetaan kebutuhan tugas UTS |
| [`docs/SUMBER.md`](docs/SUMBER.md) | Penjelasan sumber proyek dan teknologi yang digunakan |
| [GitHub Actions Run #2](https://github.com/fikriianwarr/esoria-codefest-uts/actions/runs/40434638852) | Bukti tiga job berhasil |

> Panduan teknis pada `docs/` dibuat sejak tahap persiapan proyek. **Status eksekusi terbaru yang didokumentasikan dalam README ini adalah Run #2**, sehingga pernyataan awal di dokumen persiapan tentang deployment yang belum diaktifkan tidak boleh dipakai sebagai status akhir.

## Tim Esoria
| Anggota | NIM | Kontribusi |
| :-- | :-- | :-- |
| **Fikri Anwar** | `231112145` | Dockerfile, Compose, container, port, dan website |
| **Muhammad Alfisyahrin** | `231112853` | GitHub Actions, GHCR, self-hosted runner, CI/CD |
| **Havidz Andrian** | `231111899` | Pengujian, API, SQLite, persistensi, dokumentasi |


**Link video presentasi & demo: https://youtu.be/zcOF-xwKlBs?si=sCpMBJPNYbbfNb8c**

---

<div align="center">
  <strong>ESORIA CODEFEST</strong>

  <sub>BUILD. SECURE. COMPETE. · Versi aplikasi 1.0.0 · Rilis: 27 Oktober 2026</sub>
</div>
