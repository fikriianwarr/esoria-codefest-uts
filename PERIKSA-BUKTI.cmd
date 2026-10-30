@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
echo ====================================================
echo    ESORIA CODEFEST UTS - CEK BUKTI TANPA ERROR
echo ====================================================
echo.
where powershell >nul 2>&1
if errorlevel 1 (
  echo ERROR: Windows PowerShell tidak tersedia.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0cek-bukti.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" (
  echo VERIFIKASI GAGAL. Periksa pesan di atas.
) else (
  echo VERIFIKASI LOKAL BERHASIL.
)
pause
exit /b %RESULT%
