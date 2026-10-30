# ESORIA CodeFest UTS: pembuktian akhir tanpa pipeline Sort-Object manual.
# Tidak rebuild, reset admin, deploy, atau menghapus volume.
[CmdletBinding()]
param([switch]$BukaGitHub)
$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath $PSScriptRoot
try {
    & "$PSScriptRoot\siapkan-demo.ps1"
    $baseUrl = (Get-Variable -Name 'BASE' -Scope Global -ErrorAction Stop).Value
    if (-not $baseUrl) { throw 'Alamat BASE belum tersedia.' }

    & docker compose ps
    if ($LASTEXITCODE -ne 0) { throw 'docker compose ps gagal.' }

    Write-Host "`n--- Bukti audit container terbaru ---" -ForegroundColor Cyan
    & "$PSScriptRoot\lihat-audit.ps1" | Out-Host

    Write-Host "`n--- Endpoint kesehatan ---" -ForegroundColor Cyan
    $healthText = (& curl.exe -fsS "$baseUrl/api/health") -join "`n"
    if ($LASTEXITCODE -ne 0) { throw 'Permintaan /api/health gagal.' }
    try { $health = $healthText | ConvertFrom-Json }
    catch { throw 'Respons /api/health bukan JSON valid.' }
    if ($health.app -ne 'esoria-uts' -or $health.status -ne 'ok' -or $health.database -ne 'ok') {
        throw 'Respons /api/health bukan ESORIA yang sehat.'
    }
    Write-Output $healthText

    Write-Host "`n--- Endpoint identitas rilis ---" -ForegroundColor Cyan
    $releaseText = (& curl.exe -fsS "$baseUrl/api/release") -join "`n"
    if ($LASTEXITCODE -ne 0) { throw 'Permintaan /api/release gagal.' }
    try { $release = $releaseText | ConvertFrom-Json }
    catch { throw 'Respons /api/release bukan JSON valid.' }
    if (-not $release.commit) { throw 'Identitas commit tidak tersedia.' }
    Write-Output $releaseText

    Write-Host "`n--- Verifikasi identitas runtime ---" -ForegroundColor Cyan
    if ($release.commit -ceq 'local') {
        & node scripts/check-runtime.mjs --expected-release local
        if ($LASTEXITCODE -ne 0) { throw 'Verifikasi image lokal gagal.' }
        Write-Host 'Image lokal terverifikasi. Ini bukan bukti image dari commit GitHub Actions.' -ForegroundColor Green
    } else {
        Write-Warning "Image berjalan dengan commit $($release.commit); cek sumber image sebelum menjalankan --expected-sha. Tidak ada SHA yang dipalsukan."
        & node scripts/check-runtime.mjs --expected-release "$($release.commit)"
        if ($LASTEXITCODE -ne 0) { throw 'Verifikasi identitas runtime gagal.' }
    }
    Write-Host "`n--- Tautan bukti GitHub (bukan perintah PowerShell) ---" -ForegroundColor Cyan
    & "$PSScriptRoot\buka-bukti-github.ps1" -BukaBrowser:$BukaGitHub

    Write-Host "`nLULUS: audit JSON, kesehatan HTTP, release, dan pemeriksaan runtime." -ForegroundColor Green
    Write-Host 'Catatan: verifikasi lokal tidak menyatakan SHA GitHub sama dengan image lokal.' -ForegroundColor Yellow
} finally {
    Pop-Location
}
