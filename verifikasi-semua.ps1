# ESORIA CodeFest UTS - pemeriksaan Windows PowerShell (5.1 / 7+)
# Tidak melakukan push GitHub, deploy produksi, reset database, atau docker compose down -v.
# Jalankan dari folder proyek: .\verifikasi-semua.ps1
# Jika execution policy mencegah: powershell -NoProfile -ExecutionPolicy Bypass -File .\verifikasi-semua.ps1
[CmdletBinding()]
param(
    [string]$GitHubRunSHA = '5fe69f90675504bcfc599efebd9fd5de04e5bc98',
    [switch]$JanganBukaBrowser
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Step([string]$Title) {
    Write-Host "`n========== $Title ==========" -ForegroundColor Cyan
}
function RunNative([string]$Name, [string[]]$Arguments) {
    & $Name @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Name gagal dengan exit code $LASTEXITCODE. Periksa output di atas."
    }
}
function ReadJsonEndpoint([string]$Endpoint) {
    $response = & curl.exe -fsS "$BASE$Endpoint"
    if ($LASTEXITCODE -ne 0) { throw "HTTP $Endpoint gagal. Periksa status container dan port." }
    $raw = ($response -join "`n")
    try { return ($raw | ConvertFrom-Json) }
    catch { throw "HTTP $Endpoint tidak mengembalikan JSON yang valid." }
}

Step '1. Lokasi, isi folder, dan alat'
Get-Location
Get-ChildItem -Name
RunNative 'node' @('--version')
RunNative 'docker' @('compose', 'version')
RunNative 'docker' @('info', '--format', '{{.ServerVersion}}')
$alreadyConfigured = Test-Path -LiteralPath '.env'
Write-Host "Test-Path .env = $alreadyConfigured"
if (-not $alreadyConfigured) {
    Write-Warning 'File .env belum ada. Jika volume lama ada, launcher akan mencoba memulihkan dari container ESORIA yang terverifikasi. Jika tidak tersedia, salin .env lama atau jalankan npm run recover:admin:local secara eksplisit.'
}

Step '2. Mulai aplikasi dan tunggu container healthy'
# Non-interactive saat verifikasi: launcher tidak membuka browser atau menunggu tombol.
$previousNoPause = $env:ESORIA_NO_PAUSE
try {
    $env:ESORIA_NO_PAUSE = '1'
    & '.\mulai.cmd'
    $startupExitCode = $LASTEXITCODE
} finally {
    if ($null -eq $previousNoPause) { Remove-Item Env:ESORIA_NO_PAUSE -ErrorAction SilentlyContinue }
    else { $env:ESORIA_NO_PAUSE = $previousNoPause }
}
if ($startupExitCode -ne 0) { throw 'mulai.cmd gagal. Periksa Node.js 24 dan Docker Desktop.' }
RunNative 'docker' @('compose', 'ps')
RunNative 'docker' @('compose', 'port', 'web', '3000')
# Ambil BASE secara konsisten; jika audit nanti dijalankan pada sesi lain,
# pengguna dapat mengulangi .\siapkan-demo.ps1 tanpa mengulang setup atau Docker build.
. "$PSScriptRoot\siapkan-demo.ps1"
if (-not $JanganBukaBrowser) { Start-Process "$BASE/" }

Step '3. Pemeriksaan kode dan seluruh 92 tes'
RunNative 'npm' @('run','check')
RunNative 'npm' @('test')

Step '4. Audit container terpisah, volume, dan runtime'
RunNative 'npm' @('run','verify:container:windows')
RunNative 'npm' @('run','check:docker')

Step '5. Baca bukti audit terakhir'
# Tidak perlu mengetik "Sort" atau "Object" di console; helper membaca audit terakhir.
& "$PSScriptRoot\lihat-audit.ps1"

Step '6. Verifikasi endpoint, identitas aplikasi, dan release'
RunNative 'docker' @('compose','ps')
RunNative 'npm' @('run','check:docker')
$health = ReadJsonEndpoint '/api/health'
$release = ReadJsonEndpoint '/api/release'
Write-Host "Health: $($health | ConvertTo-Json -Compress -Depth 5)"
Write-Host "Release: $($release | ConvertTo-Json -Compress -Depth 5)"
if ($health.app -ne 'esoria-uts' -or $health.status -ne 'ok' -or $health.database -ne 'ok') {
    throw 'Respons /api/health tidak sesuai layanan ESORIA atau database belum sehat.'
}
if (-not $release.commit) { throw 'Respons /api/release tidak memiliki identitas commit.' }

# Perbandingan SHA pipeline hanya valid jika benar-benar menjalankan image dari commit itu.
if ($release.commit -ceq $GitHubRunSHA) {
    Write-Host 'Commit runtime cocok dengan GitHub Actions Run #2. Memeriksa SHA secara ketat.' -ForegroundColor Green
    RunNative 'node' @('scripts/check-runtime.mjs','--expected-sha',$GitHubRunSHA)
} elseif ($release.commit -ceq 'local') {
    Write-Host 'Ini build LOKAL dengan release=local, bukan image yang dibangun pada GitHub Actions Run #2.' -ForegroundColor Yellow
    RunNative 'node' @('scripts/check-runtime.mjs','--expected-release','local')
    Write-Host "Perintah --expected-sha $GitHubRunSHA sengaja TIDAK dijalankan karena akan gagal secara benar untuk image lokal." -ForegroundColor Yellow
} else {
    Write-Host "Commit runtime $($release.commit) tidak sama dengan GitHub Run #2 ($GitHubRunSHA)." -ForegroundColor Yellow
    RunNative 'node' @('scripts/check-runtime.mjs','--expected-release',"$($release.commit)")
    Write-Host 'Periksa asal image sebelum mengklaim verifikasi SHA pipeline.' -ForegroundColor Yellow
}

Step '7. Referensi bukti GitHub (bukan klaim deploy terbaru)'
& "$PSScriptRoot\buka-bukti-github.ps1"
Write-Host "`nSELESAI: seluruh tahapan lokal lulus. SHA GitHub hanya diklaim cocok bila commit runtime benar-benar identik." -ForegroundColor Green
