@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
title ESORIA CodeFest UTS - Mulai

echo ====================================================
echo                 ESORIA CODEFEST UTS
echo ====================================================
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js 24.22.1+ belum ditemukan di PATH.
  echo Instal Node.js versi 24, lalu buka ulang terminal.
  goto :gagal
)
where docker >nul 2>&1
if errorlevel 1 (
  echo ERROR: Docker CLI belum ditemukan.
  echo Instal atau jalankan Docker Desktop lalu coba lagi.
  goto :gagal
)

echo Memeriksa konfigurasi, membangun image, dan memulai website...
node scripts\start-local.mjs
if errorlevel 1 goto :gagal

set "ESORIA_PORT="
if exist ".env" (
  for /f "tokens=1,* delims==" %%A in ('findstr /B /C:"APP_PORT=" ".env" 2^>nul') do set "ESORIA_PORT=%%B"
)
if defined ESORIA_PORT (
  echo.
  echo Website: http://localhost:%ESORIA_PORT%
  if /I not "%ESORIA_NO_PAUSE%"=="1" start "" "http://localhost:%ESORIA_PORT%"
)
echo.
echo Website aktif. Menutup jendela ini tidak menghentikan container Docker.
echo Untuk menghentikan: docker compose down
if /I "%ESORIA_NO_PAUSE%"=="1" exit /b 0
pause
exit /b 0

:gagal
echo.
echo Gagal menjalankan website. Lihat pesan di atas dan README.md.
if /I "%ESORIA_NO_PAUSE%"=="1" exit /b 1
pause
exit /b 1
