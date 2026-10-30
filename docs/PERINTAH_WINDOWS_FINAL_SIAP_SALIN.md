# Perintah PowerShell ESORIA — versi benar, siap salin

Jalankan dari folder ZIP revisi yang diekstrak, menggunakan **Windows PowerShell**, dengan Docker Desktop aktif.
Jangan salin judul "Alamat repository", label "Workflow YAML", atau URL sebagai perintah.

## Cara paling aman: satu perintah

```powershell
.\PERIKSA-SEMUA.cmd
```

Launcher tersebut menjalankan `verifikasi-semua.ps1`, termasuk semua pemeriksaan UTS. Saat dijalankan dari launcher ini, `mulai.cmd` tidak menunggu `Press any key` dan tidak membuka browser dua kali. Audit tidak perlu pengetikan `Sort-Object` secara manual.

## Perintah satu per satu (ketik **persis**, termasuk tanda minus)

```powershell
Get-Location
Get-ChildItem -Name
node --version
docker compose version
docker info --format '{{.ServerVersion}}'
Test-Path .env

.\mulai.cmd
docker compose ps
docker compose port web 3000

$PORT = ((docker compose port web 3000 | Select-Object -First 1) -split ':')[-1].Trim()
$BASE = "http://127.0.0.1:$PORT"
Write-Host "Alamat demo: $BASE"
Start-Process "$BASE/"

npm run check
npm test
npm run verify:container:windows
npm run check:docker

$AUDIT = Get-ChildItem '.\evidence\local\container-audit-*.json' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($AUDIT) { Get-Content -LiteralPath $AUDIT.FullName -Raw }

docker compose ps
npm run check:docker
curl.exe -fsS "$($BASE)/api/health"
curl.exe -fsS "$($BASE)/api/release"

# Saat image dijalankan lokal (release.commit = local):
node scripts/check-runtime.mjs --expected-release local

# Tautan GitHub dibuka dengan perintah, bukan ditempel mentah:
Start-Process 'https://github.com/fikriianwarr/esoria-codefest-uts'
Start-Process 'https://github.com/fikriianwarr/esoria-codefest-uts/blob/main/.github/workflows/esoria-ci-cd.yml'
Start-Process 'https://github.com/fikriianwarr/esoria-codefest-uts/actions/runs/40434638852'
```

**Dua hal penting:**

1. `Sort-Object` wajib tersambung menjadi satu nama perintah. Tulisan `Sort` diikuti `Object LastWriteTime` pada baris berikutnya **bukan sintaks PowerShell yang valid**. Bila khawatir terpecah, jalankan `.\lihat-audit.ps1`.
2. `node scripts/check-runtime.mjs --expected-sha 5fe69f90675504bcfc599efebd9fd5de04e5bc98` **harus gagal** apabila `/api/release` menunjukkan `commit: local`. SHA GitHub hanya boleh diverifikasi pada image dari commit itu sendiri. Untuk image lokal gunakan `--expected-release local` seperti pada skrip di atas. Tidak ada cara aman menjamin baris SHA tersebut selalu berhasil pada image yang salah.

## Koreksi log 30 Oktober: dua kesalahan saat menyalin perintah

Perintah `Object LastWriteTime -Descending` yang tampil sendiri pada log **bukan perintah**. Gunakan `\.\lihat-audit.ps1` dari folder proyek, atau salin satu baris lengkap `Sort-Object` dari bagian sebelumnya. Jangan menempelkan label, teks penjelasan, atau output terminal sebagai perintah.

Perintah yang berakhir dengan SHA berikut juga **salah** karena ada satu backslash setelah 40 karakter hash:

```powershell
# SALAH (jangan dijalankan; hanya contoh kesalahan)
# node scripts/check-runtime.mjs --expected-sha 5fe69f90675504bcfc599efebd9fd5de04e5bc98\
```

Pada log Anda `/api/release` menampilkan `"commit":"local"`. Jalankan **perintah yang sesuai untuk image lokal** tanpa karakter apa pun sesudah kata `local`:

```powershell
node scripts/check-runtime.mjs --expected-release local
```

Jangan mencoba mengganti `commit=local` menjadi SHA GitHub hanya agar pengujian terlihat lulus. Untuk melihat bukti akhir tanpa mengetik kedua perintah rawan salah tersebut, cukup jalankan `\.\PERIKSA-BUKTI.cmd`; untuk seluruh rangkaian mulai dari startup jalankan `\.\PERIKSA-SEMUA.cmd`.

## Memeriksa SHA GitHub secara bersyarat (tanpa hasil palsu)

```powershell
$CURRENT_COMMIT = (Invoke-RestMethod "$($BASE)/api/release").commit
if ($CURRENT_COMMIT -eq '5fe69f90675504bcfc599efebd9fd5de04e5bc98') {
    node scripts/check-runtime.mjs --expected-sha 5fe69f90675504bcfc599efebd9fd5de04e5bc98
} elseif ($CURRENT_COMMIT -eq 'local') {
    node scripts/check-runtime.mjs --expected-release local
    Write-Host 'PASS untuk image lokal. Image ini bukan build SHA GitHub Actions.'
} else {
    throw "Commit aplikasi ($CURRENT_COMMIT) berbeda dari dua identitas yang ingin diuji."
}
```

Jangan menjalankan `docker compose down -v`; volume `esoria_uts_data` mempertahankan database. Bila `.env` belum ada namun volume lama masih ada, `mulai.cmd` mencoba memulihkan konfigurasi dari container ESORIA yang diverifikasi. Bila itu gagal, jangan mereset data secara otomatis.
