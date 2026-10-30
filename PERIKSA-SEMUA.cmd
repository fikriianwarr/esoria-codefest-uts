@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
echo ====================================================
echo  ESORIA CODEFEST UTS - VERIFIKASI SEMUA PERINTAH
echo ====================================================
echo.
where powershell >nul 2>&1
if errorlevel 1 (
  echo ERROR: Windows PowerShell tidak tersedia.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0verifikasi-semua.ps1" -JanganBukaBrowser
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" (
  echo ADA PEMERIKSAAN GAGAL. Baca pesan di atas.
) else (
  echo SEMUA PEMERIKSAAN LOKAL LULUS.
)
pause
exit /b %RESULT%
