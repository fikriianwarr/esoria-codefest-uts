# Koreksi error terakhir pada log 30 Oktober 2026

Log Windows menunjukkan **92/92 tes lulus**, audit container `PASS`, dan endpoint `/api/health` mengembalikan database `ok`. Kesalahan terakhir hanya pada penyalinan perintah manual: pemecahan `Sort-Object` menjadi `Sort` dan `Object`, serta backslash `\` tambahan di belakang SHA GitHub. Ini bukan kegagalan Docker ataupun aplikasi.

**Paling sederhana:** setelah website berjalan, jalankan `\.\PERIKSA-BUKTI.cmd`. Untuk seluruh pemeriksaan dari awal, gunakan `\.\PERIKSA-SEMUA.cmd`. Jangan ketik ulang paragraf instruksi atau contoh perintah salah. Bila menjalankan pemeriksaan release secara manual untuk image dengan `commit=local`, gunakan `node scripts/check-runtime.mjs --expected-release local`.

Pemeriksaan `--expected-sha` tetap harus gagal untuk image lokal yang bukan berasal dari commit pipeline; jangan gunakan klaim GitHub Actions untuk mengganti bukti Docker lokal. Panduan lengkap: `docs/PERINTAH_WINDOWS_FINAL_SIAP_SALIN.md`.

## Perintah UTS satu klik (Windows)

Untuk seluruh urutan perintah PowerShell tanpa salah ketik, buka folder proyek hasil ekstraksi dan jalankan `.\PERIKSA-SEMUA.cmd` (Docker Desktop harus aktif). Skrip ini sekarang menjalankan `mulai.cmd` tanpa jeda tombol otomatis, memeriksa port dan semua tes, serta tidak membandingkan commit lokal dengan SHA GitHub secara palsu. Perintah satu per satu yang dikoreksi tersedia di [docs/PERINTAH_WINDOWS_FINAL_SIAP_SALIN.md](docs/PERINTAH_WINDOWS_FINAL_SIAP_SALIN.md). Jangan mengetik `Sort` lalu `Object` secara terpisah; gunakan `.\lihat-audit.ps1`.

## Perbaikan build Docker dari ZIP GitHub (30 Oktober 2026)

Sumber utama paket ini adalah ZIP GitHub `esoria-codefest-uts-main.zip`. Kode aplikasi dan workflow sumber GitHub dipertahankan; revisi kompatibilitas Windows sebelumnya digabungkan. Pada versi sebelumnya pengujian nomor 87–89 gagal **hanya di Docker build** dengan `ENOENT /build/PERIKSA-BUKTI.cmd`, `/build/PERIKSA-SEMUA.cmd`, dan `/build/buka-bukti-github.ps1`.

Perbaikan: `.dockerignore` sekarang **mengikutkan `.cmd`**, dan `Dockerfile` menyalin `*.cmd`, `*.ps1`, `Dockerfile`, serta `.dockerignore` ke tahap `verify` **sebelum** menjalankan `npm test`. File-file verifikasi itu **tidak ikut ke image runtime**. Pengujian regresi `tests/docker-build-context.test.mjs` menjaga syarat ini. Jumlah tes sudah bertambah dan seluruhnya tetap dijalankan.

Untuk bukti bahwa Docker benar-benar menjalankan tes dari source baru (bukan image lama), gunakan `docker compose build --no-cache`, lalu `docker compose up -d --wait` hanya jika proses build selesai sukses. **Jangan** pakai `docker compose down -v`, jangan menghapus volume `esoria_uts_data`, dan jangan menyertakan `.env` pribadi dalam ZIP / GitHub. Jika volume lama ada tetapi `.env` hilang, `mulai.cmd` akan mencoba memulihkannya dari container ESORIA yang terverifikasi.

Dalam PowerShell, jangan mengetik judul, kalimat panduan, atau URL mentah sebagai perintah. Gunakan `PERIKSA-BUKTI.cmd` (pemeriksaan runtime tanpa build) atau `PERIKSA-SEMUA.cmd` (memulai serta menguji ulang), dan `buka-bukti-github.ps1` untuk membuka tautan. Image `commit=local` **tidak** dapat dinyatakan sama dengan SHA GitHub.

# ESORIA CodeFest UTS — Paket Bersih

Paket ini merupakan **edisi ESORIA CodeFest untuk UTS Pengembangan dan Operasi** yang menggunakan aplikasi Node.js + SQLite di dalam container Docker. Halaman ESORIA, API, autentikasi peserta/admin, pendaftaran, kategori, dan alur pengelolaan tetap ada. Edisi UTS ini **bukan** seluruh fitur website Firebase awal; fitur yang tidak dimigrasikan tidak boleh dianggap tersedia.

## Satu perintah tanpa menyalin teks penjelasan atau URL

**Untuk memeriksa website yang sudah berjalan**, buka PowerShell pada folder hasil ekstraksi dan jalankan **hanya**:

```powershell
.\PERIKSA-BUKTI.cmd
```

**Untuk menjalankan seluruh proses UTS dari awal** (termasuk launcher, `npm test`, dan audit Docker), jalankan **hanya**:

```powershell
.\PERIKSA-SEMUA.cmd
```

Ketika `mulai.cmd` menampilkan `Press any key to continue`, tekan satu tombol. Pada akhir skrip pemeriksaan, tekan tombol lagi untuk menutup. Skrip menampilkan status keberhasilan atau kesalahan yang sebenarnya, **tidak memalsukan perbandingan SHA GitHub dengan `local`**.

**Untuk membuka tautan GitHub dengan benar**, tanpa mengetik URL sebagai perintah:

```powershell
.\buka-bukti-github.ps1 -BukaBrowser
```

Teks `Alamat repository`, `Workflow YAML`, dan `Bukti Run` adalah keterangan, **bukan perintah PowerShell**. Jangan menyalin keterangan ke terminal. Hasil `Sort-Object` sudah ditangani oleh skrip; jangan memisahkannya menjadi `Sort` dan `Object`.

## Audit seluruh perintah PowerShell (direvisi)

Untuk menjalankan seluruh daftar verifikasi UTS sekaligus, buka Windows PowerShell pada folder hasil ekstraksi dan jalankan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\verifikasi-semua.ps1
```

Skrip ini memeriksa lokasi, alat, startup, container, port, 92 tes, bukti JSON, HTTP, dan identitas rilis, kemudian mencetak tautan bukti GitHub. **Skrip `powershell -File` berjalan di proses tersendiri**: bila ingin menjalankan `curl.exe` secara manual setelahnya pada jendela PowerShell asal, ketik `.\siapkan-demo.ps1` untuk mengatur kembali `$PORT` dan `$BASE` pada sesi aktif. Helper `.\lihat-audit.ps1` membaca audit terakhir sehingga perintah `Sort-Object` tidak perlu disalin. Untuk memeriksa audit JSON, endpoint, dan identitas image aktif tanpa mengulang Docker build, ketik `.\cek-bukti.ps1`. Versi perintah manual, contoh output yang benar, serta penjelasan SHA GitHub versus `local` terdapat pada [`docs/VERIFIKASI_POWERSHELL.md`](docs/VERIFIKASI_POWERSHELL.md). Pada image lokal, gunakan `node scripts/check-runtime.mjs --expected-release local`. Perintah `--expected-sha <commit>` khusus image yang benar-benar dibangun/dideploy dari commit tersebut dan **harus menolak SHA yang berbeda**.

## Memulai dengan satu file

1. Ekstrak ZIP ke folder biasa (bukan menjalankan file langsung dari ZIP).
2. Jalankan **Docker Desktop** dengan Linux containers dan pastikan **Node.js 24.22.1 atau versi 24 lebih baru** terpasang.
3. Klik dua kali **`mulai.cmd`**. Launcher membuat `.env` hanya jika belum tersedia, memilih port yang bebas, menjalankan `docker compose up -d --build --wait`, dan membuka website di browser.
4. Jika port 8080 sudah terpakai, port cadangan (misalnya 8088) dipilih dan disimpan ke `.env`. Lihat alamat yang dicetak pada terminal.
5. Admin awal: `admin@esoria.test`. Kata sandi dibuat acak pada pemakaian pertama dan disimpan dalam `.env`. **Jika memakai database lama, salin `.env` lama dari folder proyek sebelumnya sebelum menjalankan `mulai.cmd`** agar kredensial tetap sama. Jika `.env` hilang tetapi volume `esoria_uts_data` masih ada, launcher mencoba **memulihkan kredensial yang sama dari container `esoria-uts-web-1`**, setelah memeriksa label Compose dan volume yang terpasang. Tidak ada reset kata sandi pada jalur otomatis. Jika container lama tidak tersedia, launcher berhenti aman dan menampilkan instruksi pemulihan di bawah. Kata sandi baru **tidak dicetak di log** untuk mencegah kebocoran; lihat `ADMIN_PASSWORD` di `.env` secara privat.

**`mulai.cmd` adalah satu-satunya launcher website Windows**; `verifikasi-semua.ps1`, `siapkan-demo.ps1`, `lihat-audit.ps1`, dan `cek-bukti.ps1` adalah utilitas verifikasi PowerShell, bukan launcher lain. Skrip `.mjs` dan `.sh` dalam `scripts/` wajib dipertahankan karena diperlukan untuk build, pengujian, pemeriksaan kontainer, atau CI/CD. Jangan menghapus `Dockerfile`, `compose*.yaml`, `.github/`, `package*.json`, `app/`, atau `tests/`.

## Pemulihan aman jika `.env` hilang tetapi volume lama masih ada

Kondisi yang pernah terjadi pada Windows: `Test-Path .env` menghasilkan `False` dan Docker masih menyimpan volume `esoria_uts_data`. **Jangan hapus volume, jangan jalankan `docker compose down -v`, dan jangan membuat `.env` dengan password sembarang secara diam-diam.**

1. **Cara pertama (otomatis):** jalankan `mulai.cmd` dari ZIP versi ini. Apabila container `esoria-uts-web-1` lama masih dapat ditemukan dan terbukti memiliki label project `esoria-uts`, service `web`, dan volume `esoria_uts_data` di `/app/data`, launcher menyelamatkan `ADMIN_EMAIL`, `ADMIN_PASSWORD`, dan port dari konfigurasi container itu dan menyimpannya di `.env` lokal **tanpa menampilkan kata sandi**, lalu meneruskan startup. Password admin lama dipertahankan.
2. **Jika container lama telah dihapus:** periksa kembali folder ZIP/ekstraksi sebelumnya dan **salin `.env` lama secara privat** ke folder terbaru. Tidak perlu mengganti password atau menjalankan perintah pemulihan.
3. **Jika `.env` asli benar-benar hilang dan container lama tidak tersedia:** jalankan `npm run recover:admin:local`, lalu `./mulai.cmd` dari PowerShell (di Windows gunakan `.\mulai.cmd`). Opsi pemulihan ini **harus Anda jalankan secara sadar**: ia membuat password admin baru dalam `.env`. Saat server dimulai, `ADMIN_SYNC_ON_START=true` menyelaraskan akun admin yang ada dan mencabut sesi admin sebelumnya; peserta, pendaftaran, acara, dan named volume tetap ada.

Perintah PowerShell untuk langkah 3:

```powershell
npm run recover:admin:local
.\mulai.cmd
.\siapkan-demo.ps1
npm run check:docker
node scripts/check-runtime.mjs --expected-release local
```

Perintah pemulihan tidak diperlukan bila `mulai.cmd` sudah berhasil memulihkan `.env`. Jangan mengunggah `.env`, nilai `ADMIN_PASSWORD`, atau hasil `docker inspect` (berisi environment rahasia). Reset admin lokal bukan prosedur CD/produksi dan tidak mendeploy GitHub.

## Pengujian kode pada Windows dan Linux

Jalankan `npm test` dari PowerShell atau terminal proyek. **Windows menggunakan Docker Desktop dalam mode Linux containers** untuk sembilan pengujian skrip Bash `deploy.sh`/`rollback.sh`, sedangkan pengujian aplikasi lainnya lain berjalan langsung di Windows. Cara ini mencegah konflik antara `bash.exe` milik WSL/Git Bash dan path Windows serta error `EBUSY` saat membersihkan folder sementara.

Docker menjalankan pengujian Bash menggunakan image `node:24.22.1-bookworm-slim` dalam **container sementara** tanpa jaringan, tanpa akses Docker socket, tanpa port host, dan tanpa volume proyek. Source hanya dipasang *read-only* lalu file pengujian yang diperlukan disalin ke `/tmp` di dalam container. Docker yang dipanggil oleh skrip deployment **disimulasikan**, bukan Docker host. Tidak ada deployment produksi ataupun penghapusan data utama. Docker Desktop wajib berjalan di Windows untuk `npm test`; **Git Bash/WSL tidak diperlukan**.

Pada Linux (termasuk tahap `verify` Dockerfile), seluruh seluruh pengujian berjalan langsung dengan Node dan Bash, tanpa ketergantungan pada daemon Docker dalam tahap pengujian itu.

Perintah di Windows:

```powershell
node --version
docker info --format "{{.ServerVersion}}"
npm run check
npm test
```

Saat selesai, hasil `npm test` menampilkan jumlah lulus Windows native dan Linux terisolasi. Pengujian suite ini menggunakan Docker tiruan; untuk memvalidasi Docker sesungguhnya lanjutkan dengan `npm run verify:container:windows`. Pipeline GitHub menggunakan runner Linux sebagaimana dijelaskan dalam `docs/CI_CD.md`.

## Membaca bukti tanpa error perintah terpotong

Jika Anda sudah menjalankan `npm run verify:container:windows` dan hanya ingin menampilkan bukti sekaligus memeriksa endpoint, **jangan ulangi build** dan jangan ketik `Sort` lalu `Object` terpisah. Jalankan langsung:

```powershell
.\cek-bukti.ps1
```

Untuk hanya membaca JSON terakhir, gunakan `.\lihat-audit.ps1`. Perintah `Sort-Object` harus satu kata utuh bila diketik manual.

## Jika BASE kosong atau pembacaan audit gagal

Tiap jendela PowerShell punya variabel berbeda. Setelah membuka jendela baru, atau setelah memanggil `powershell -File .\verifikasi-semua.ps1`, jalankan perintah berikut di jendela PowerShell yang ingin dipakai untuk `curl.exe`:

```powershell
.\siapkan-demo.ps1
curl.exe -fsS "$($BASE)/api/health"
curl.exe -fsS "$($BASE)/api/release"
.\lihat-audit.ps1
node scripts/check-runtime.mjs --expected-release local
```

`siapkan-demo.ps1` tidak mengubah database atau merestart container. `lihat-audit.ps1` membaca JSON audit terbaru dan memverifikasi status `PASS`. Identitas rilis dari `mulai.cmd` adalah `local`; jangan menganggapnya SHA GitHub.

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

**Jika sandi admin pernah dibagikan ke chat, screenshot, atau log**, rotasi `ADMIN_PASSWORD` secara privat pada `.env` kemudian jalankan ulang `mulai.cmd` agar database menyinkronkan kredensial baru. Jika login admin belum sesuai setelah startup, periksa `ADMIN_EMAIL` dan `ADMIN_PASSWORD` pada `.env` milik sendiri lalu jalankan `mulai.cmd` kembali. Container akan menyinkronkan akun admin dengan `.env`. Jangan mengunggah nilai rahasia ini.

## CI/CD untuk rubrik UTS

`Dockerfile` memakai tahap `verify` sebelum tahap runtime. `compose.yaml` untuk lokal dan `compose.deploy.yaml` untuk deployment menggunakan volume yang sama. Pipeline `.github/workflows/esoria-ci-cd.yml` melaksanakan:

1. **verify:** pemeriksaan source,  pengujian Node dan build/uji container sesungguhnya.
2. **publish:** setelah CD diaktifkan, unggah image yang telah lulus tes ke GitHub Container Registry.
3. **deploy:** pasang image terverifikasi pada self-hosted runner Linux dan cek health/commit dengan rollback saat gagal.

Job `publish` dan `deploy` sengaja bersyarat; belum bisa dianggap berhasil sebelum ada repository, secrets, variables, dan runner yang disiapkan oleh kelompok. Petunjuk teknis lengkap: [`docs/CI_CD.md`](docs/CI_CD.md). Pemetaan rubrik: [`docs/ANALISIS_RUBRIK.md`](docs/ANALISIS_RUBRIK.md). Teknologi serta asal materi: [`docs/SUMBER.md`](docs/SUMBER.md).

## Struktur paket minimal

```text
mulai.cmd                  Launcher website Windows
verifikasi-semua.ps1      Audit otomatis lengkap
siapkan-demo.ps1          Mengatur $PORT dan $BASE pada sesi aktif
lihat-audit.ps1           Menampilkan bukti audit terbaru
cek-bukti.ps1             Memeriksa audit, HTTP dan identitas runtime tanpa variabel manual
PERIKSA-BUKTI.cmd          Satu perintah untuk memeriksa bukti tanpa copy-paste
PERIKSA-SEMUA.cmd          Satu perintah untuk seluruh tahapan UTS
buka-bukti-github.ps1      Menampilkan atau membuka URL sebagai tautan, bukan perintah
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
