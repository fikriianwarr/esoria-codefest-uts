<div align="center">

<a href="https://github.com/fikriianwarr/esoria-codefest-uts">
  <img src="app/public/assets/logo_esoria.webp" alt="Logo ESORIA CodeFest" width="100" />
</a>

# ESORIA CODEFEST

**BUILD. SECURE. COMPETE.**

### Ubah ide kamu menjadi karya dengan kami.

### Kelompok Esoria

**Havidz Andrian** (NIM: 231111899) |  
**Fikri Anwar** (NIM: 231112145) |  
**Muhammad Alfisyahrin** (NIM: 231112853)

**UTS Pengembangan dan Operasi · IF-B Pagi · T.A. 2026/2027**

**Link video presentasi & demo:**  
https://youtu.be/zcOF-xwKlBs?si=sCpMBJPNYbbfNb8c

**Link Source Code - Esoria Codefest versi UTS:**
https://mikroskilacid-my.sharepoint.com/:u:/g/personal/havidz_andrian_students_mikroskil_ac_id/IQCtBeFLQXmAQoYdPmuZlqyvAcJ2RwKc7EDlz7xbPP5wFWA?e=PdELAR
<br>

`Node.js 24` &nbsp;·&nbsp; `Docker` &nbsp;·&nbsp; `SQLite` &nbsp;·&nbsp; `GitHub Actions` &nbsp;·&nbsp; `GHCR`

<br>

[**Mulai menjalankan**](#jalankan-aplikasi) &nbsp;|&nbsp;
[**Alur CI/CD**](#alur-ci-dan-cd) &nbsp;|&nbsp;
[**Bukti pengujian**](#bukti-pengujian) &nbsp;|&nbsp;
[**Dokumentasi**](#dokumentasi)

</div>

---

> [!IMPORTANT]
> **Ruang lingkup:** Repository ini berisi **ESORIA CodeFest edisi UTS** untuk praktik implementasi container dan CI/CD. Aplikasi menggunakan Node.js dan SQLite sebagai sistem mandiri yang dikembangkan untuk kebutuhan UTS, sehingga tidak mencakup seluruh fitur website ESORIA CodeFest berbasis Firebase yang telah dikembangkan sebelumnya.

ESORIA CodeFest adalah aplikasi web pengelolaan kompetisi informatika dengan antarmuka responsif, sistem akun peserta, pendaftaran kompetisi, pengelolaan kategori, dan dashboard administrasi. Pengembangan versi UTS berfokus pada penerapan container menggunakan Docker serta otomatisasi proses **build → test → publish → deploy** melalui GitHub Actions.

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

### Menjalankan pada Windows

**1.** Jalankan Docker Desktop dan pastikan Docker Engine siap.

**2.** Buka folder source aplikasi, lalu klik dua kali file **`mulai.cmd`**.

**3.** Tunggu sampai container selesai dibangun dan berstatus sehat.

**4.** Buka alamat website yang muncul di terminal setelah aplikasi berhasil dijalankan.

```text
Port utama    : http://localhost:8080
Port cadangan : http://localhost:8088 (contoh hasil pengujian)
Port internal : 3000/tcp
```

`mulai.cmd` menjalankan konfigurasi awal apabila diperlukan, memilih port yang tersedia, membangun Docker image, menjalankan container, dan menampilkan alamat aplikasi.

**Port yang digunakan dapat berbeda**, sehingga pengguna perlu mengikuti alamat yang benar-benar ditampilkan oleh launcher.

<details>
<summary><strong>Alternatif: menjalankan melalui PowerShell</strong></summary>

Dari direktori utama proyek, jalankan:

```powershell
npm run setup
docker compose up -d --build --wait
docker compose ps
docker compose port web 3000
```

Cara terminal ini tidak menjalankan pemilihan port cadangan secara otomatis seperti launcher. Jika terjadi konflik port, sesuaikan `APP_PORT` pada file `.env` terlebih dahulu.

</details>

### Konfigurasi admin

Pada konfigurasi awal, sistem membuat file `.env` dengan kata sandi administrator yang dihasilkan secara acak.

Email administrator default pada konfigurasi awal adalah:

```text
admin@esoria.test
```

Kata sandi administrator ditampilkan ketika proses setup pertama berhasil dan disimpan dalam file `.env`.

Simpan informasi tersebut secara pribadi karena diperlukan untuk mengakses dashboard administrator.

> [!CAUTION]
> **Jangan mengunggah file `.env`** atau menampilkan password, token runner, dan session cookie pada repository maupun screenshot. Jika menggunakan database lama, pertahankan konfigurasi `.env` yang sesuai agar kredensial administrator tidak berubah tanpa disengaja.

---

## Alur CI dan CD

Penerapan CI/CD pada ESORIA CodeFest dilakukan melalui GitHub Actions yang menghubungkan proses pemeriksaan source code, pengujian aplikasi, pembangunan Docker image, publikasi image, dan deployment ke mesin kelompok.

### Tahapan implementasi

| Tahap | Proses | Hasil |
| :-- | :-- | :-- |
| **01 · SOURCE** | Commit atau pull request pada GitHub | Source masuk ke workflow |
| **02 · VERIFY** | Pemeriksaan source, pengujian otomatis, build dan smoke test Docker | Image yang lulus pengujian |
| **03 · PUBLISH** | Upload image teruji ke GHCR saat CD diaktifkan | Referensi image berbasis digest |
| **04 · DEPLOY** | Self-hosted runner mengambil image dan menjalankan Docker Compose | Container aplikasi yang telah diterapkan |
| **05 · VALIDATE** | Pemeriksaan HTTP, database, kesehatan container, dan SHA rilis | Deployment terverifikasi; kegagalan ditangani skrip pemulihan |

### Alur kerja pipeline

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
- `publish` menerbitkan image **yang sudah lolos pengujian**, bukan membangun ulang image tanpa verifikasi.
- `deploy` menggunakan runner `self-hosted`, `Linux`, `X64`, dan `esoria-uts` untuk menjalankan deployment serta memvalidasi rilis.
- Mekanisme pemulihan tersedia pada skrip deployment, tetapi **keberhasilan rollback dalam kegagalan produksi nyata tidak diklaim**.

### Secrets dan variables

| Jenis | Nama | Keterangan |
| :-- | :-- | :-- |
| Secret | `ESORIA_ADMIN_EMAIL` | Email admin untuk deployment |
| Secret | `ESORIA_ADMIN_PASSWORD` | Password admin, tidak boleh dipublikasikan |
| Variable | `ENABLE_CD` | `true` untuk mengizinkan publish/deploy pada kondisi workflow yang sesuai |
| Variable | `ESORIA_APP_PORT` | Port host tujuan; `8088` pada pengujian yang terdokumentasi |
| Variable | `ESORIA_BIND_ADDRESS` | `127.0.0.1` untuk akses dari komputer sendiri |
| Variable | `ESORIA_COOKIE_SECURE` | `false` pada HTTP lokal; sesuaikan bila menggunakan HTTPS |

Autentikasi ke GHCR pada workflow menggunakan **`GITHUB_TOKEN` yang disediakan secara otomatis oleh GitHub Actions**.

Panduan konfigurasi lebih lanjut tersedia pada [`docs/CI_CD.md`](docs/CI_CD.md).

> [!WARNING]
> **Sebelum mengubah README pada branch `main`:** Perubahan dokumentasi tetap dianggap sebagai `push` dan dapat memicu workflow. Jika tidak ingin proses CD berjalan, ubah repository variable `ENABLE_CD` menjadi `false` sebelum commit. Self-hosted runner yang memiliki akses Docker juga perlu dilindungi dari pekerjaan yang berasal dari sumber tidak tepercaya.

---

## Bukti pengujian

Pengujian aplikasi ESORIA CodeFest dilakukan secara bertahap untuk memastikan seluruh fungsi utama, keamanan, dan proses deployment dapat berjalan sesuai kebutuhan. Proses pengujian dibagi menjadi dua tahap, yaitu pengujian pada versi awal aplikasi dan pengujian lanjutan setelah dilakukan pembaruan serta penyempurnaan kode.

### Tahap 1 - Pengujian versi awal (81 tes)

Pada tahap pengujian pertama, aplikasi berhasil menjalankan **81 dari 81 pengujian otomatis tanpa kegagalan**. Pengujian ini mencakup pemeriksaan source code, fungsi aplikasi, autentikasi, pengelolaan data, serta pemeriksaan container.

Hasil tersebut tercatat pada **GitHub Actions Run #2 tanggal 27 Oktober 2026**, yang sekaligus membuktikan keberhasilan implementasi pipeline CI/CD melalui tiga job utama, yaitu `verify`, `publish`, dan `deploy`.

Pengujian tahap awal menjadi dasar untuk memastikan bahwa aplikasi telah dapat dibangun, diuji, dipublikasikan ke GitHub Container Registry, dan dijalankan melalui container pada mesin deployment.

### Tahap 2 - Pengujian versi final setelah pembaruan kode (94 tes)

Setelah pengujian tahap pertama berhasil, kelompok melakukan pembaruan dan penyempurnaan kode aplikasi serta memperluas pemeriksaan pada lingkungan pengujian lokal.

Pada tahap kedua yang digunakan sebagai **pengujian versi final**, hasil rekapitulasi menunjukkan bahwa **94 dari 94 pengujian berhasil dijalankan tanpa kegagalan**, terdiri atas 85 pengujian Windows natif dan 9 pengujian Linux terisolasi.

Jumlah pengujian yang terdokumentasi meningkat dari 81 menjadi 94, atau bertambah sebanyak 13 pengujian. Penambahan tersebut menunjukkan bahwa pemeriksaan pada tahap akhir memiliki cakupan pengujian yang lebih luas dibandingkan tahap sebelumnya.

Hasil pengujian versi final didokumentasikan melalui screenshot **SS 10 pada Lampiran E laporan UTS**, sedangkan pengujian tahap pertama tercatat pada screenshot SS 09 dan log GitHub Actions Run #2.

Dengan demikian, **81 tes merupakan hasil pengujian tahap awal, sedangkan 94 tes merupakan hasil pengujian lokal versi final setelah pembaruan kode aplikasi**.

Kedua hasil tersebut didokumentasikan secara terpisah agar perkembangan pengujian dapat ditelusuri dengan jelas.

### Rekapitulasi pengujian aplikasi

| Tahap pengujian | Jumlah tes | Lulus | Gagal | Keterangan |
| :-- | :--: | :--: | :--: | :-- |
| **Tahap 1 - Versi awal** | 81 | 81 | 0 | Pengujian awal yang tercatat pada GitHub Actions Run #2 dan SS 09 |
| **Tahap 2 - Versi final** | 94 | 94 | 0 | Pengujian lokal setelah pembaruan kode, didokumentasikan pada SS 10 |

**Hasil pengujian akhir:**

- **94 dari 94 pengujian versi final berhasil**, tanpa kegagalan pada rekapitulasi pengujian lokal.
- Pengujian final mencakup **85 pengujian Windows natif dan 9 pengujian Linux terisolasi**.
- Pengujian tahap awal menunjukkan **81 dari 81 tes berhasil**, tanpa kegagalan.
- Hasil 94 tes merupakan rekapitulasi pengujian lokal setelah pembaruan kode dan **bukan keluaran GitHub Actions Run #2**.
- Peningkatan jumlah pengujian menunjukkan perluasan pemeriksaan, bukan ukuran akurasi model.

### Hasil GitHub Actions Run #2

GitHub Actions Run #2 pada 27 Oktober 2026 berhasil menyelesaikan proses CI/CD secara end-to-end.

| Job | Hasil pada Run #2 | Durasi job |
| :-- | :--: | --: |
| Test application and container - `verify` | **SUCCESS** | 1 menit 13 detik |
| Publish tested image to GHCR - `publish` | **SUCCESS** | 29 detik |
| Deploy on group machine - `deploy` | **SUCCESS** | 1 menit 21 detik |
| **Workflow keseluruhan** | **SUCCESS** | **9 menit 48 detik** |

### Hasil verifikasi container dan deployment

Selain pengujian otomatis, pemeriksaan terhadap container dan layanan aplikasi juga menunjukkan hasil sebagai berikut:

- Container `esoria-uts-web-1` berstatus **healthy** setelah deployment yang terdokumentasi.
- Endpoint `/api/health` mengembalikan `status: ok` dan `database: ok`.
- Endpoint `/api/release` menunjukkan versi `1.0.0` serta commit yang sesuai dengan pipeline.
- Basis data SQLite tersimpan pada named volume `esoria_uts_data`.
- Pengujian restart/recreate dan persistensi data dilaksanakan pada **volume pengujian terpisah**.
- Docker image yang dipublikasikan ke GHCR menggunakan referensi berbasis digest untuk menjaga kesesuaian image hasil pengujian dan deployment.

### Tautan verifikasi

- [**GitHub Actions - Run #2 (Success)**](https://github.com/fikriianwarr/esoria-codefest-uts/actions/runs/40434638852)
- [**Workflow CI/CD**](.github/workflows/esoria-ci-cd.yml)
- [**Commit terverifikasi**](https://github.com/fikriianwarr/esoria-codefest-uts/commit/5fe69f90675504bcfc599efebd9fd5de04e5bc98)

<details>
<summary><strong>Identitas image GHCR yang berhasil dipublikasikan</strong></summary>

```text
ghcr.io/fikriianwarr/esoria-codefest-uts/esoria-uts@sha256:98fc41ff98001539068478aadddc9bdb5661e5e03125fbfa66bf425199d8bfd9
```

</details>

> [!NOTE]
> GitHub Actions Run #2 berhasil melalui pemicu manual (`workflow_dispatch`) dan mendokumentasikan keberhasilan tiga job utama, yaitu `verify`, `publish`, dan `deploy`, dengan 81 pengujian pada tahap awal. Hasil 94 pengujian merupakan pengujian lokal lanjutan setelah pembaruan kode dan tidak diklaim sebagai hasil Run #2. Trigger `push` telah dikonfigurasi, tetapi demonstrasi perubahan aplikasi melalui push baru tidak diklaim sudah diuji secara terpisah. Repository masih berstatus Private pada screenshot yang didokumentasikan saat pengujian awal.

### Perintah verifikasi lokal

Dari PowerShell pada direktori utama proyek, jalankan:

```powershell
npm run check
npm test
npm run verify:container:windows
docker compose ps
```

Untuk memeriksa endpoint aplikasi, sesuaikan port dengan hasil launcher:

```powershell
curl.exe -fsS http://localhost:8088/api/health
curl.exe -fsS http://localhost:8088/api/release
```

Berkas audit lokal dari skrip verifikasi dapat ditemukan di `evidence/local/` setelah pemeriksaan berhasil.

Hasil pengujian lokal versi final dicatat secara terpisah dari log GitHub Actions Run #2 agar perkembangan pengujian aplikasi tetap dapat ditelusuri.

---

## Penyimpanan data dan keamanan

Arsitektur penyimpanan aplikasi menggunakan SQLite yang dijalankan dalam container Docker dengan penyimpanan persisten melalui named volume.

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

Keamanan container yang dikonfigurasi mencakup:

- Proses aplikasi berjalan sebagai pengguna **non-root**.
- Root filesystem dikonfigurasi dalam mode **read-only**.
- Direktori sementara menggunakan `tmpfs /tmp`.
- Capability container dibatasi melalui `cap_drop: [ALL]`.
- Peningkatan hak akses proses dibatasi dengan `no-new-privileges`.
- Penggunaan CPU dan memori memiliki batas yang ditentukan.
- Healthcheck digunakan untuk memeriksa respons aplikasi dan memastikan layanan dalam kondisi sehat.

### Menghentikan container

Untuk menghentikan aplikasi tanpa menghapus volume database, jalankan:

```powershell
docker compose down
```

> [!CAUTION]
> **Jangan menjalankan `docker compose down -v`** untuk penghentian biasa karena opsi `-v` dapat menghapus volume database. Keberadaan volume tidak dengan sendirinya membuktikan bahwa seluruh data historis peserta masih lengkap. Pembuktian tersebut memerlukan pemeriksaan isi database sebelum dan sesudah perubahan.

---

## Struktur repository

```text
esoria-codefest-uts/
├── .github/
│   └── workflows/
│       └── esoria-ci-cd.yml       # Verify, publish, deploy
├── app/
│   ├── public/                    # UI, CSS, JS, logo
│   ├── server.mjs                 # Server + REST API
│   ├── database.mjs               # SQLite
│   └── security.mjs               # Auth dan kontrol keamanan
├── scripts/                      # Setup, start, verify, deploy, rollback
├── tests/                        # Automated test suite
├── docs/
│   ├── ANALISIS_RUBRIK.md
│   ├── CI_CD.md
│   └── SUMBER.md
├── Dockerfile
├── compose.yaml
├── compose.deploy.yaml
├── mulai.cmd                      # Launcher Windows
├── .env.example                   # Contoh, tanpa password aktual
├── package.json
├── package-lock.json
└── README.md
```

---

## Dokumentasi

Dokumentasi teknis proyek tersedia pada repository untuk membantu pemeriksaan source code, konfigurasi deployment, serta pemenuhan kebutuhan UTS.

| Berkas | Fungsi |
| :-- | :-- |
| [`docs/CI_CD.md`](docs/CI_CD.md) | Konfigurasi workflow, runner, variabel, dan penanganan kegagalan |
| [`docs/ANALISIS_RUBRIK.md`](docs/ANALISIS_RUBRIK.md) | Pemetaan kebutuhan tugas UTS |
| [`docs/SUMBER.md`](docs/SUMBER.md) | Penjelasan sumber proyek dan teknologi yang digunakan |
| [GitHub Actions Run #2](https://github.com/fikriianwarr/esoria-codefest-uts/actions/runs/40434638852) | Bukti tiga job berhasil |

Dokumentasi proyek mencatat dua tahap pengujian aplikasi, yaitu **81 pengujian berhasil pada tahap awal** dan **94 pengujian berhasil pada tahap akhir setelah pembaruan kode berdasarkan hasil pengujian lokal**.

GitHub Actions Run #2 digunakan sebagai bukti keberhasilan pipeline CI/CD secara end-to-end, sedangkan hasil pengujian lokal versi final didokumentasikan melalui Lampiran E laporan UTS.

Kedua hasil tersebut dipisahkan untuk menjaga kesesuaian antara proses pengembangan, hasil pengujian, dan bukti implementasi yang tersedia.

---

## Tim Esoria

| Anggota | NIM | Kontribusi |
| :-- | :-- | :-- |
| **Fikri Anwar** | `231112145` | Dockerfile, Compose, container, port, dan website |
| **Muhammad Alfisyahrin** | `231112853` | GitHub Actions, GHCR, self-hosted runner, CI/CD |
| **Havidz Andrian** | `231111899` | Pengujian, API, SQLite, persistensi, dokumentasi |

---

<div align="center">

<strong>ESORIA CODEFEST</strong>

<sub>BUILD. SECURE. COMPETE. · Versi aplikasi 1.0.0 · Rilis: 27 Oktober 2026</sub>

</div>
