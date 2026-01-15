@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>nul
title Duduc Anket Asistani - Otomatik Kurulum
color 0D

echo.
echo  ========================================================
echo.
echo         Duduc Anket Asistani - Otomatik Kurulum
echo.
echo              Seni cok seviyorum!
echo.
echo  ========================================================
echo.

:: Proje klasörüne git
cd /d "%~dp0"

:: ===== ADIM 1: Node.js Kontrolü =====
echo  [1/4] Node.js kontrol ediliyor...

where node >nul 2>nul
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODE_VER=%%i
    echo  Node.js bulundu: !NODE_VER!
    goto :check_npm
)

echo.
echo  Node.js bulunamadi! Otomatik kurulum basliyor...
echo.

:: ===== Node.js İndir =====
echo  [2/4] Node.js indiriliyor...
echo         (Bu islem 1-2 dakika surebilir)
echo.

set "NODE_URL=https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
set "NODE_INSTALLER=%TEMP%\node_installer.msi"

:: PowerShell ile indir
powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_INSTALLER%' -UseBasicParsing } catch { exit 1 }"

if not exist "%NODE_INSTALLER%" (
    echo.
    echo  Indirme basarisiz oldu!
    echo  Lutfen https://nodejs.org adresinden manuel kurun.
    echo.
    pause
    exit /b 1
)

echo  Indirme tamamlandi!
echo.

:: ===== Node.js Kur =====
echo  [3/4] Node.js kuruluyor...
echo         (Yonetici izni penceresi acilabilir)
echo.

:: Yönetici olarak MSI'yı çalıştır
powershell -Command "Start-Process msiexec.exe -ArgumentList '/i', '%NODE_INSTALLER%', '/qn', '/norestart' -Verb RunAs -Wait"

:: Kurulum dosyasını sil
del "%NODE_INSTALLER%" >nul 2>nul

:: PATH'i güncelle
set "PATH=%PATH%;C:\Program Files\nodejs"

:: Kontrol et
timeout /t 2 /nobreak >nul
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo  Kurulum tamamlandi gibi gorunuyor ama PATH guncellenmedi.
    echo  Lutfen bu pencereyi kapatin ve tekrar acin.
    echo.
    pause
    exit /b 0
)

echo  Node.js basariyla kuruldu!

:check_npm
echo.

:: ===== ADIM 2: npm install =====
echo  [3/4] Bagimliliklar kontrol ediliyor...

if not exist "node_modules" (
    echo  npm install calistiriliyor...
    echo  (Bu islem 1-2 dakika surebilir)
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo  npm install basarisiz!
        pause
        exit /b 1
    )
    echo.
    echo  Bagimliliklar yuklendi!
) else (
    echo  Bagimliliklar zaten yuklu!
)

:: ===== ADIM 3: Sunucuyu Başlat =====
echo.
echo  [4/4] Sunucu baslatiliyor...
echo.
echo  ========================================================
echo.
echo  Tarayicinda su adrese git:
echo.
echo       http://localhost:3000
echo.
echo  Kapatmak icin bu pencereyi kapat.
echo.
echo  ========================================================
echo.

:: 2 saniye bekle ve tarayıcıyı aç
timeout /t 2 /nobreak >nul
start http://localhost:3000

:: Sunucuyu başlat
call npx ts-node server.ts

echo.
echo  Sunucu durdu.
pause
