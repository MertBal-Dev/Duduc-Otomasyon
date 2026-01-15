@echo off
setlocal enabledelayedexpansion

:: Hata olsa bile kapanmasin
set SCRIPT_ERROR=0

:: Loglama icin dosya
set LOGFILE=%~dp0kurulum_log.txt
echo Kurulum Basladi: %DATE% %TIME% > "%LOGFILE%"

title Duduc Anket Asistani - Kurulum
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

:: Proje klasorune git
cd /d "%~dp0"
echo  Klasor: %CD%
echo  Klasor: %CD% >> "%LOGFILE%"
echo.

:: ===== ADIM 1: Node.js Kontrolu =====
echo  [1/4] Node.js kontrol ediliyor...
echo  [1/4] Node.js kontrol ediliyor... >> "%LOGFILE%"

where node >nul 2>nul
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODE_VER=%%i
    echo  Node.js bulundu: !NODE_VER!
    echo  Node.js bulundu: !NODE_VER! >> "%LOGFILE%"
    goto :check_npm
)

echo.
echo  Node.js bulunamadi! Otomatik kurulum basliyor...
echo  Node.js bulunamadi >> "%LOGFILE%"
echo.

:: ===== Node.js Indir =====
echo  [2/4] Node.js indiriliyor...
echo         (Bu islem 1-2 dakika surebilir)
echo  [2/4] Node.js indiriliyor... >> "%LOGFILE%"
echo.

set "NODE_URL=https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
set "NODE_INSTALLER=%TEMP%\node_installer.msi"

echo  Indirme URL: %NODE_URL%
echo  Indirme URL: %NODE_URL% >> "%LOGFILE%"

:: PowerShell ile indir
powershell -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Write-Host 'Indirme basliyor...'; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_INSTALLER%' -UseBasicParsing; Write-Host 'Indirme tamamlandi!' } catch { Write-Host 'HATA:' $_.Exception.Message; exit 1 }"

if not exist "%NODE_INSTALLER%" (
    echo.
    echo  HATA: Indirme basarisiz oldu!
    echo  HATA: Indirme basarisiz >> "%LOGFILE%"
    echo.
    echo  Muhtemel sebepler:
    echo  - Internet baglantisi yok
    echo  - Antivirus engelliyor
    echo  - PowerShell erisim sorunu
    echo.
    set SCRIPT_ERROR=1
    goto :script_end
)

echo  Indirme tamamlandi!
echo  Indirme tamamlandi >> "%LOGFILE%"
echo.

:: ===== Node.js Kur =====
echo  [3/4] Node.js kuruluyor...
echo         (Yonetici izni penceresi acilabilir - EVET deyin)
echo  [3/4] Node.js kuruluyor... >> "%LOGFILE%"
echo.

:: Yonetici olarak MSI yi calistir
powershell -ExecutionPolicy Bypass -Command "Start-Process msiexec.exe -ArgumentList '/i', '%NODE_INSTALLER%', '/qn', '/norestart' -Verb RunAs -Wait"

:: Kurulum dosyasini sil
del "%NODE_INSTALLER%" >nul 2>nul

:: PATH i guncelle
set "PATH=%PATH%;C:\Program Files\nodejs"

:: 3 saniye bekle
echo  Kurulum tamamlaniyor, bekleyin...
timeout /t 3 /nobreak >nul

:: Kontrol et - yeni cmd ile
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo  UYARI: Node.js kuruldu ama PATH guncellenmedi.
    echo  Bu pencereyi kapatin ve Baslat.bat i tekrar calistirin.
    echo  PATH guncellenmedi >> "%LOGFILE%"
    echo.
    set SCRIPT_ERROR=0
    goto :script_end
)

echo  Node.js basariyla kuruldu!
echo  Node.js kuruldu >> "%LOGFILE%"

:check_npm
echo.

:: ===== ADIM 2: npm install =====
echo  [3/4] Bagimliliklar kontrol ediliyor...
echo  [3/4] Bagimliliklar kontrol ediliyor... >> "%LOGFILE%"

if not exist "node_modules" (
    echo  npm install calistiriliyor...
    echo  (Bu islem 1-2 dakika surebilir)
    echo  npm install basliyor... >> "%LOGFILE%"
    echo.
    call npm install 2>> "%LOGFILE%"
    if %errorlevel% neq 0 (
        echo.
        echo  HATA: npm install basarisiz!
        echo  npm install basarisiz >> "%LOGFILE%"
        set SCRIPT_ERROR=1
        goto :script_end
    )
    echo.
    echo  Bagimliliklar yuklendi!
    echo  npm install tamamlandi >> "%LOGFILE%"
) else (
    echo  Bagimliliklar zaten yuklu!
    echo  node_modules mevcut >> "%LOGFILE%"
)

:: ===== ADIM 3: Sunucuyu Baslat =====
echo.
echo  [4/4] Sunucu baslatiliyor...
echo  [4/4] Sunucu baslatiliyor... >> "%LOGFILE%"
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

:: 2 saniye bekle ve tarayiciyi ac
timeout /t 2 /nobreak >nul
start http://localhost:3000

:: Sunucuyu baslat
call npx ts-node server.ts

:script_end
echo.
echo  ========================================================
if %SCRIPT_ERROR% equ 1 (
    echo  HATA OLUSTU! Detaylar icin kurulum_log.txt dosyasina bakin.
    echo  Klasor: %~dp0
)
echo  ========================================================
echo.
echo  Kapatmak icin bir tusa basin...
pause >nul
