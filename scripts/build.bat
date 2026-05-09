@echo off
REM Build script for Architect Companion — Windows
REM Usage: scripts\build.bat [dev|prod]
REM   dev  (default) — packages config.dev.json
REM   prod           — packages config.prod.json
REM Requires PowerShell 5+ (built into Windows 10/11).

cd /d "%~dp0\.."

set ENV=%1
if "%ENV%"=="" set ENV=dev

if /i not "%ENV%"=="dev" if /i not "%ENV%"=="prod" (
  echo Error: env must be 'dev' or 'prod'
  echo Usage: scripts\build.bat [dev^|prod]
  exit /b 1
)

set CONFIG=config.%ENV%.json
if not exist "%CONFIG%" (
  echo Error: %CONFIG% not found
  exit /b 1
)

if not exist dist mkdir dist
set OUTPUT=%CD%\dist\archcadence-%ENV%.zip
if exist "%OUTPUT%" del "%OUTPUT%"

powershell -NoProfile -Command ^
  "$env = '%ENV%';" ^
  "$src = Get-Location;" ^
  "$out = '%OUTPUT%';" ^
  "$tmp = Join-Path $env:TEMP 'archcadence_build';" ^
  "if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force };" ^
  "New-Item -ItemType Directory -Path $tmp | Out-Null;" ^
  "foreach ($f in @('manifest.json','background.js','popup.html','popup.js')) { Copy-Item (Join-Path $src $f) $tmp };" ^
  "Copy-Item (Join-Path $src \"config.$env.json\") $tmp;" ^
  "Set-Content -Path (Join-Path $tmp 'settings.json') -Value \"{`\"env`\":`\"$env`\"}\";" ^
  "$iconsDir = Join-Path $tmp 'icons';" ^
  "New-Item -ItemType Directory -Path $iconsDir | Out-Null;" ^
  "foreach ($i in @('icon16.png','icon48.png','icon128.png')) { Copy-Item (Join-Path (Join-Path $src 'icons') $i) $iconsDir };" ^
  "Compress-Archive -Path (Join-Path $tmp '*') -DestinationPath $out;" ^
  "Remove-Item $tmp -Recurse -Force;" ^
  "Write-Host \"Build complete: $out\""
