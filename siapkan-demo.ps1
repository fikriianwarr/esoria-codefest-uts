# ESORIA CodeFest UTS - gunakan dari jendela PowerShell pengguna.
# Menetapkan $PORT dan $BASE dalam sesi PowerShell AKTIF (Scope Global),
# termasuk jika dipanggil biasa dengan .\siapkan-demo.ps1.
# Tidak membuat, menghapus, atau me-restart container/database.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
# Hindari memakai alamat lama bila pemeriksaan baru gagal.
Remove-Variable -Name 'BASE','PORT' -Scope Global -ErrorAction SilentlyContinue

Push-Location -LiteralPath $PSScriptRoot
try {
    if (-not (Test-Path -LiteralPath '.env')) {
        throw 'File .env belum ditemukan. Jalankan .\mulai.cmd dahulu. Jika memakai database lama, pindahkan .env lama secara privat.'
    }
    $bindingLines = @(& docker compose port web 3000 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw 'docker compose port web 3000 gagal. Pastikan Docker Desktop aktif dan container sudah berjalan (docker compose ps).'
    }
    $binding = [string]($bindingLines | Select-Object -First 1)
    if (-not ($binding -match '^(?:127\.0\.0\.1|0\.0\.0\.0|\[::1\]|\[::\]):(?<port>[0-9]{1,5})$')) {
        throw "Mapping port tidak dikenali: '$binding'. Periksa docker compose ps dan docker compose port web 3000."
    }
    $actualPort = [int]$Matches['port']
    if ($actualPort -lt 1024 -or $actualPort -gt 65535) {
        throw "Port host tidak valid: $actualPort."
    }
    Set-Variable -Name 'PORT' -Scope Global -Value $actualPort
    Set-Variable -Name 'BASE' -Scope Global -Value "http://127.0.0.1:$actualPort"
    Write-Host "Alamat demo: $BASE" -ForegroundColor Green
    Write-Host 'Variabel $PORT dan $BASE tersedia di jendela PowerShell ini.'
} finally {
    Pop-Location
}
