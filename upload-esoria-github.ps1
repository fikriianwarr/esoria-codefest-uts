# Upload project ESORIA UTS ke repository GitHub yang sudah ada.
# Default: push ke branch terpisah agar tidak mengaktifkan deployment di main.
# Kompatibel dengan Windows PowerShell 5.1 dan PowerShell 7.
# Tidak membutuhkan GitHub CLI (gh); hanya Git for Windows.

[CmdletBinding()]
param(
    [string]$RepoUrl = 'https://github.com/fikriianwarr/esoria-codefest-uts.git',
    [string]$SourceZip = '',
    [string]$SourceFolder = '',
    [string]$Branch = '',
    [switch]$AllowMainPush
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Git {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Perintah Git gagal (exit code $LASTEXITCODE): git $($Arguments -join ' ')"
    }
}

function Test-SafeUploadPath {
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    $path = $RelativePath.Replace('\', '/').TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($path)) { return $false }

    $parts = $path.Split('/')
    $bannedDirs = @('.git', 'node_modules', 'data', '.preview-data', 'test-results', '__pycache__', '.venv', '.esoria-deploy-test-')
    foreach ($part in $parts) {
        if ($part -in $bannedDirs -or $part -like '.esoria-deploy-test-*') { return $false }
    }
    if ($path -like 'evidence/local/*') { return $false }
    $name = $parts[$parts.Length - 1]
    if ($name -eq '.env.example') { return $true }
    if ($name -like '.env*') { return $false }
    if ($name -match '(?i)\.(sqlite|sqlite-wal|sqlite-shm|db|log|pem|key|p12|pfx|p8|kdbx)$') { return $false }
    if ($name -match '(?i)^(id_rsa|id_ed25519|credentials|service-account)(\.|$)') { return $false }
    return $true
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git belum tersedia. Pasang Git for Windows dari https://git-scm.com/downloads/win, lalu buka kembali PowerShell.'
}

if ([string]::IsNullOrWhiteSpace($SourceZip) -and [string]::IsNullOrWhiteSpace($SourceFolder)) {
    $defaultZip = Join-Path $env:USERPROFILE 'Downloads\esoria_codefest_uts.zip'
    if (Test-Path -LiteralPath $defaultZip -PathType Leaf) {
        $SourceZip = $defaultZip
    } else {
        $SourceFolder = (Get-Location).Path
    }
}
if (-not [string]::IsNullOrWhiteSpace($SourceZip) -and -not [string]::IsNullOrWhiteSpace($SourceFolder)) {
    throw 'Pilih satu sumber saja: -SourceZip ATAU -SourceFolder.'
}
if ([string]::IsNullOrWhiteSpace($Branch)) {
    $Branch = 'upload-uts-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
}
if ($Branch -eq 'main' -and -not $AllowMainPush) {
    throw 'Push langsung ke main diblokir untuk mencegah deployment otomatis. Gunakan branch default. Hanya gunakan -Branch main -AllowMainPush setelah memeriksa variabel ENABLE_CD di GitHub.'
}
if ($Branch -notmatch '^[A-Za-z0-9][A-Za-z0-9._/-]*$' -or $Branch -match '\.\.|//|\.lock$|/$|^refs/') {
    throw "Nama branch tidak aman: $Branch"
}

# Periksa identitas Git untuk commit lokal. Tidak mengubah konfigurasi Git global.
$gitName = (& git config user.name)
$gitEmail = (& git config user.email)
if ([string]::IsNullOrWhiteSpace(($gitName | Out-String).Trim()) -or [string]::IsNullOrWhiteSpace(($gitEmail | Out-String).Trim())) {
    throw "Identitas Git belum diisi. Jalankan: git config --global user.name 'Nama Anda' ; git config --global user.email 'email-github-anda'"
}

$workDir = Join-Path ([IO.Path]::GetTempPath()) ('esoria-github-' + [guid]::NewGuid().ToString('N'))
$extractDir = Join-Path $workDir 'source'
$cloneDir = Join-Path $workDir 'repo'
New-Item -ItemType Directory -Path $workDir -Force | Out-Null

try {
    if (-not [string]::IsNullOrWhiteSpace($SourceZip)) {
        if (-not (Test-Path -LiteralPath $SourceZip -PathType Leaf)) { throw "ZIP tidak ditemukan: $SourceZip" }
        Write-Host "Membaca ZIP: $SourceZip" -ForegroundColor Cyan
        Expand-Archive -LiteralPath $SourceZip -DestinationPath $extractDir -Force
        $sourceRoot = (Resolve-Path -LiteralPath $extractDir).Path
    } else {
        if (-not (Test-Path -LiteralPath $SourceFolder -PathType Container)) { throw "Folder tidak ditemukan: $SourceFolder" }
        $sourceRoot = (Resolve-Path -LiteralPath $SourceFolder).Path
        Write-Host "Membaca folder: $sourceRoot" -ForegroundColor Cyan
    }

    # Mendukung ZIP yang berisi satu folder utama maupun file langsung di akar ZIP.
    if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot 'README.md') -PathType Leaf)) {
        $subDirs = @(Get-ChildItem -LiteralPath $sourceRoot -Directory -Force)
        $rootFiles = @(Get-ChildItem -LiteralPath $sourceRoot -File -Force)
        if ($subDirs.Count -eq 1 -and $rootFiles.Count -eq 0) { $sourceRoot = $subDirs[0].FullName }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot 'package.json') -PathType Leaf)) {
        throw "Sumber tidak terlihat sebagai akar proyek ESORIA (package.json tidak ditemukan): $sourceRoot"
    }

    Write-Host "Clone repository: $RepoUrl" -ForegroundColor Cyan
    Invoke-Git -Arguments @('clone', '--branch', 'main', '--single-branch', '--', $RepoUrl, $cloneDir)

    if ($Branch -ne 'main') {
        Invoke-Git -Arguments @('-C', $cloneDir, 'switch', '-c', $Branch)
    } else {
        Write-Warning 'ANDA MEMILIH MAIN. Workflow GitHub Actions dapat melakukan deployment jika ENABLE_CD=true.'
    }

    $prefix = $sourceRoot.TrimEnd([char]'\', [char]'/') + [IO.Path]::DirectorySeparatorChar
    $files = @(Get-ChildItem -LiteralPath $sourceRoot -Recurse -File -Force)
    $copied = 0
    $skipped = 0
    $copiedPaths = New-Object 'System.Collections.Generic.List[string]'

    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($prefix.Length)
        if (-not (Test-SafeUploadPath -RelativePath $relativePath)) {
            $skipped++
            continue
        }
        $destination = Join-Path $cloneDir $relativePath
        $destinationDir = Split-Path -Parent $destination
        if (-not (Test-Path -LiteralPath $destinationDir -PathType Container)) {
            New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null
        }
        Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
        $copiedPaths.Add($relativePath.Replace('\', '/'))
        $copied++
    }
    if ($copied -eq 0) { throw 'Tidak ada file aman untuk diunggah.' }
    Write-Host "File disalin: $copied; file dikecualikan: $skipped" -ForegroundColor Cyan

    # Hanya stage file yang baru saja disalin, bukan file rahasia/lokal.
    foreach ($relativePath in $copiedPaths) {
        Invoke-Git -Arguments @('-C', $cloneDir, 'add', '--', $relativePath)
    }
    $staged = @(& git -C $cloneDir diff --cached --name-only)
    if ($LASTEXITCODE -ne 0) { throw 'Gagal membaca perubahan Git.' }
    if ($staged.Count -eq 0) {
        Write-Host 'Tidak ada perubahan isi file dibanding versi GitHub. Tidak membuat commit kosong.' -ForegroundColor Yellow
        Write-Host "Repository: $($RepoUrl -replace '\.git$', '')"
        return
    }

    Write-Host 'Berkas yang berubah:' -ForegroundColor Cyan
    $staged | ForEach-Object { Write-Host "  $_" }
    Invoke-Git -Arguments @('-C', $cloneDir, 'commit', '-m', 'Update ESORIA CodeFest UTS: aplikasi, pengujian, dokumentasi')

    # Push biasa (tanpa --force). Jika terjadi konflik, Git menolak dan tidak menimpa remote.
    Invoke-Git -Arguments @('-C', $cloneDir, 'push', '-u', 'origin', $Branch)

    $repoPage = $RepoUrl -replace '\.git$', ''
    Write-Host ''
    Write-Host 'UPLOAD KE GITHUB BERHASIL' -ForegroundColor Green
    Write-Host "Repository : $repoPage"
    Write-Host "Branch     : $Branch"
    Write-Host "Lihat kode : $repoPage/tree/$Branch"
    if ($Branch -ne 'main') {
        Write-Host "Buat PR    : ${repoPage}/compare/main...${Branch}?expand=1"
        Write-Host 'Branch ini belum digabung ke main, sehingga tidak otomatis memicu deploy pada push.' -ForegroundColor Yellow
    }
} finally {
    # Hanya menghapus clone sementara; ZIP dan folder sumber asli tidak diubah.
    if (Test-Path -LiteralPath $workDir) {
        Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
