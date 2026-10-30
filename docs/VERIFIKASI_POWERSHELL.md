# Verifikasi lengkap ESORIA CodeFest UTS — Windows PowerShell

Dokumen ini diperiksa terhadap **urutan demonstrasi pengguna** (Windows PowerShell, Node.js 24, Docker Desktop Linux containers), termasuk perintah yang sebelumnya salah ketik menjadi `Sort` lalu `Object` dan pemeriksaan commit GitHub `5fe69f90675504bcfc599efebd9fd5de04e5bc98`.

**Penting:** Verifikasi lokal tidak boleh dianggap sama dengan verifikasi image yang benar-benar dideploy dari GitHub Actions. `mulai.cmd` membangun image **lokal** dengan identitas rilis `local`, sehingga perintah `--expected-sha 5fe69...` memang tidak boleh berhasil pada image tersebut. SHA itu hanya untuk deployment yang berasal dari commit GitHub yang sama. Jangan memaksa hasilnya lulus dengan mengubah label image tanpa memeriksa sumbernya.

## Solusi langsung untuk log error terakhir

**Khusus ketika container `healthy` dan audit `PASS`, cukup jalankan**:

```powershell
.\PERIKSA-BUKTI.cmd
```

Untuk tes lengkap dan startup dari awal:

```powershell
.\PERIKSA-SEMUA.cmd
```

Untuk melihat/membuka URL GitHub:

```powershell
.\buka-bukti-github.ps1 -BukaBrowser
```

Jangan menyalin `Alamat repository (salin ke browser):`, `Workflow YAML:`, atau `Bukti Run #2:` ke PowerShell; itu label teks, bukan perintah. URL yang diketik sendiri tanpa `Start-Process` akan dianggap nama program dan ditolak. Perbaikan manual bila diperlukan:

```powershell
Start-Process 'https://github.com/fikriianwarr/esoria-codefest-uts'
Start-Process 'https://github.com/fikriianwarr/esoria-codefest-uts/blob/main/.github/workflows/esoria-ci-cd.yml'
Start-Process 'https://github.com/fikriianwarr/esoria-codefest-uts/actions/runs/40434638852'
```

Perintah audit lama salah karena `Sort-Object` terpecah menjadi `Sort` dan `Object`. Gunakan `.\lihat-audit.ps1`. **Kesalahan verifikasi SHA terhadap image lokal tidak boleh diubah menjadi sukses palsu**. Perintah yang benar untuk image dengan `/api/release` berisi `commit:local` adalah `node scripts/check-runtime.mjs --expected-release local`.

## Cara termudah: jalankan seluruh audit otomatis

Ekstrak ZIP baru ke folder baru yang berisi `verifikasi-semua.ps1`, `mulai.cmd`, dan `compose.yaml`. Buka **Windows PowerShell** dari folder proyek, pastikan Docker Desktop aktif pada mode Linux containers, kemudian jalankan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\verifikasi-semua.ps1
```

Skrip berjalan dalam proses PowerShell baru, sehingga **variabel `$BASE` milik skrip tidak bertahan di jendela PowerShell pemanggil**. Setelah skrip selesai atau setelah membuka jendela lain, jalankan `.\siapkan-demo.ps1` secara langsung di jendela tersebut; helper akan menetapkan `$PORT` dan `$BASE` pada sesi aktif. Untuk melihat bukti tanpa menyalin pipeline, ketik `.\lihat-audit.ps1`. Untuk membaca audit, API, dan identitas image lokal sekaligus tanpa mengisi `$BASE` sendiri, jalankan `.\cek-bukti.ps1`.

Skrip hanya membaca dan menguji; startup melalui launcher tetap bisa *recreate* container seperti biasa, namun volume utama tidak dihapus. Jika database lama digunakan, sebaiknya **salin `.env` lama** ke folder ZIP baru. Apabila `.env` hilang tetapi container lama `esoria-uts-web-1` masih ada dan telah diverifikasi label serta volumenya, launcher otomatis memulihkan kredensial lama tanpa reset. Jika container tidak ada, gunakan `npm run recover:admin:local` secara eksplisit (rotasi admin dan pencabutan sesi lama, data tetap ada) atau temukan `.env` lama. Audit `verify:container:windows` membuat image, container, dan volume uji terpisah, kemudian membersihkannya setelah pemeriksaan.

## Cara manual: seluruh perintah yang telah diperbaiki

Untuk audit pasca-startup tanpa mengulang build, jalankan **satu perintah** berikut dari folder proyek: `.\cek-bukti.ps1`. Skrip ini memeriksa container, membaca JSON audit, mengetes endpoint, dan memverifikasi identitas image lokal tanpa memerlukan perintah `Sort-Object` manual.

Jalankan dalam urutan berikut pada **jendela PowerShell yang sama**. Bila memulai sesi baru, ulangi `.\siapkan-demo.ps1` terlebih dahulu. **Baris `Sort-Object` harus utuh**, jangan terpotong menjadi dua perintah.

```powershell
Get-Location
Get-ChildItem -Name
node --version
docker compose version
docker info --format "{{.ServerVersion}}"
Test-Path .env

.\mulai.cmd
docker compose ps
docker compose port web 3000

.\siapkan-demo.ps1
Write-Host "Alamat demo: $BASE"
Start-Process "$BASE/"

npm run check
npm test
npm run verify:container:windows
npm run check:docker

.\lihat-audit.ps1

docker compose ps
npm run check:docker
curl.exe -fsS "$($BASE)/api/health"
curl.exe -fsS "$($BASE)/api/release"
```

**Periksa asal image sebelum memilih salah satu perintah berikut**:

```powershell
# Untuk image dari ZIP/launcher lokal dengan /api/release mengembalikan commit=local:
node scripts/check-runtime.mjs --expected-release local

# HANYA untuk image yang benar-benar dideploy dari commit Run GitHub #2 dan merespons SHA yang sama:
node scripts/check-runtime.mjs --expected-sha 5fe69f90675504bcfc599efebd9fd5de04e5bc98
```

Tanda `#` di atas adalah komentar PowerShell, tidak menjalankan sesuatu. **Jangan mengetik `^C`** untuk menghentikan proses: tekan tombol `Ctrl+C` pada keyboard. `^C` sebagai teks bukan perintah PowerShell. Jangan menjalankan dua pemeriksaan identitas ini pada image yang sama kecuali identitasnya benar-benar cocok masing-masing.

**Link bukti Github (bukan perintah PowerShell):**

- Repository: <https://github.com/fikriianwarr/esoria-codefest-uts>
- Workflow YAML: <https://github.com/fikriianwarr/esoria-codefest-uts/blob/main/.github/workflows/esoria-ci-cd.yml>
- Bukti Run #2: <https://github.com/fikriianwarr/esoria-codefest-uts/actions/runs/40434638852>

## Hasil yang benar dan cara membacanya

| Pemeriksaan | Hasil yang diharapkan | Catatan |
|---|---|---|
| `Get-Location` | Lokasi proyek hasil ekstraksi | Tidak harus sama dengan lokasi lama |
| `Get-ChildItem -Name` | Source lengkap dan `verifikasi-semua.ps1` | Folder `evidence` baru muncul setelah audit |
| `node --version` | Node.js 24.22.1 atau 24.x lebih baru | Node 22 tidak memenuhi syarat startup |
| `docker compose version` | Versi Compose terbaca | Versi tidak harus sama persis dengan log contoh |
| `docker info` | Nomor versi Engine | Pastikan Docker Desktop hidup |
| `Test-Path .env` | `False` pada setup pertama, `True` sesudah launcher | `False` bukan error pada folder baru |
| `mulai.cmd` | Image dibangun, container menjadi healthy | Port dapat 8080, 8088, atau port yang tersedia |
| `docker compose ps` / `port web 3000` | Container running/healthy dan port IPv4 diterbitkan | Port dipakai otomatis dalam `$BASE` |
| `npm run check` | Pemeriksaan sintaks/aset lulus | Tidak mengubah database |
| `npm test` | 92/92 tes lulus (83 Windows native + 9 Linux terisolasi) | Docker Desktop diperlukan pada Windows |
| `npm run verify:container:windows` | Audit PASS termasuk persistensi restart/recreate | Volume audit sementara, bukan data utama |
| `npm run check:docker` | Container healthy, database OK, volume `esoria_uts_data` | Identitas local atau SHA pipeline dilaporkan |
| `.\lihat-audit.ps1` | JSON berisi `"result":"PASS"` | Tidak ada perintah `Object` tersendiri |
| `curl.exe /api/health` | `app=esoria-uts`, `status=ok`, `database=ok` | Respons JSON dari server hidup |
| `curl.exe /api/release` | `commit` berasal dari image aktif | `local` benar untuk image lokal |
| `check-runtime --expected-release local` | PASS pada image lokal | Tidak membuktikan kesamaan dengan GitHub |
| `check-runtime --expected-sha <SHA>` | PASS hanya bila rilis sama SHA GitHub | Jika berbeda harus gagal; fitur keamanan |

## Hal yang tidak boleh dilakukan

1. Jangan mengedit `RELEASE_SHA` atau `commit` aplikasi hanya agar hasil SHA terlihat cocok, karena itu dapat membuat bukti rilis menyesatkan.
2. Jangan menjalankan `docker compose down -v`: perintah tersebut menghapus volume database utama.
3. Jangan mengunggah `.env`, password admin, token GitHub, cookie, atau log yang mengandung rahasia.
4. Jangan menganggap `npm test` lokal sebagai bukti deploy GitHub terbaru. Lihat job Actions dan commit pada mesin deployment yang sebenarnya.

Perintah lain yang bisa membantu:

```powershell
docker compose logs --tail 60 web
docker compose ps
Get-ChildItem .\evidence\local\*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 5
```

## Diagnosis tiga kesalahan dari log pengguna

1. `Object : The term 'Object' is not recognized` berarti `Sort-Object` terpotong menjadi `Sort` dan `Object`. Gunakan `.\lihat-audit.ps1` untuk hanya membaca audit, atau `.\cek-bukti.ps1` untuk audit dan pemeriksaan endpoint sekaligus. Ini salah ketik perintah manual, bukan kegagalan pengujian Docker.
2. `curl: (3) URL rejected: No host part in the URL` berarti `$BASE` kosong pada jendela PowerShell saat itu; gunakan `.\siapkan-demo.ps1` lalu periksa `Write-Host $BASE` sebelum menjalankan curl.
3. `Commit runtime berbeda ... local` adalah penolakan verifikasi SHA yang **benar** terhadap image lokal; gunakan `--expected-release local` untuk uji lokal. Hanya gunakan `--expected-sha` jika image aktif memang berasal dari SHA tersebut dan bukti CI/CD menegaskannya.

**Keamanan:** launcher versi ini tidak mencetak kata sandi admin baru ke log terminal. Periksa `.env` secara lokal; jangan unggah, screenshot, atau salin nilai `ADMIN_PASSWORD` ke percakapan. Jika kata sandi pernah terpapar, ganti di `.env` dan mulai ulang container agar sinkron.
