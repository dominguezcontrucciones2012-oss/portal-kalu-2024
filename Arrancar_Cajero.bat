@echo off
title 🤖 Robot Cajero - Kalu
echo ====================================================
echo             INICIANDO EL CAJERO ROBOT
echo ====================================================
echo.
echo Limpiando memoria de la PC...
taskkill /F /IM node.exe /T >nul 2>&1
wmic process where "name='chrome.exe' and commandline like '%%--headless%%'" call terminate >nul 2>&1
rmdir /S /Q .wwebjs_cache >nul 2>&1
del /F /Q .wwebjs_auth_cajero\session\SingletonLock >nul 2>&1
echo Memoria limpia.
echo.
echo Iniciando conexion a WhatsApp...
npm run cajero
pause
