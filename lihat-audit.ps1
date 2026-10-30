# ESORIA CodeFest UTS - baca hasil audit lokal terbaru tanpa mengetik pipeline Sort-Object panjang.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$folder = Join-Path $PSScriptRoot 'evidence\local'
$AUDIT = Get-ChildItem -LiteralPath $folder -Filter 'container-audit-*.json' -File -ErrorAction SilentlyContinue |
    Sort-Object -Property LastWriteTime -Descending |
    Select-Object -First 1
if (-not $AUDIT) {
    throw 'File container-audit-*.json belum ada. Jalankan npm run verify:container:windows dari folder proyek terlebih dahulu.'
}
$raw = Get-Content -LiteralPath $AUDIT.FullName -Raw
try { $data = $raw | ConvertFrom-Json }
catch { throw "JSON audit tidak valid: $($AUDIT.FullName)" }
Write-Host "File audit: $($AUDIT.FullName)"
Write-Host "Status: $($data.result)"
if ($data.result -ne 'PASS') {
    throw 'Status audit bukan PASS. Lihat laporan dan hasil proses pengujian.'
}
Write-Output $raw
