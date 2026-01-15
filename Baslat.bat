@echo off
chcp 65001 >nul
title 🌸 Duduc Anket Asistani
color 0D
cls
echo.
echo  ╔════════════════════════════════════════════╗
echo  ║                                            ║
echo  ║   🌸 Duduc Anket Asistani Basliyor! 🌸   ║
echo  ║                                            ║
echo  ║      Seni cok seviyorum! 💕               ║
echo  ║                                            ║
echo  ╚════════════════════════════════════════════╝
echo.
echo  📌 Tarayicinda su adrese git:
echo.
echo     👉 http://localhost:3000
echo.
echo  🛑 Kapatmak icin bu pencereyi kapat.
echo.
echo  ════════════════════════════════════════════
echo.

cd /d "%~dp0"
call npx ts-node server.ts

pause
