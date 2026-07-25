@echo off
title KALUNEVA 2024 - Servidor Local
color 0B

echo.
echo  ██╗  ██╗ █████╗ ██╗     ██╗   ██╗
echo  ██║ ██╔╝██╔══██╗██║     ██║   ██║
echo  █████╔╝ ███████║██║     ██║   ██║
echo  ██╔═██╗ ██╔══██║██║     ██║   ██║
echo  ██║  ██╗██║  ██║███████╗╚██████╔╝
echo  ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝ ╚═════╝
echo.
echo  SISTEMA DE ADMINISTRACION 2024 PRO
echo  =====================================
echo.

cd /d "%~dp0"

echo [*] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado.
    echo         Descargalo en: https://nodejs.org
    pause
    exit /b 1
)

echo [*] Node.js OK. Iniciando servidor Vite...
echo.
echo  La aplicacion abrira automaticamente en:
echo  → http://localhost:3000
echo.
echo  Para detener el servidor: presiona Ctrl+C
echo  ============================================
echo.

npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Fallo al iniciar. Intentando instalar dependencias...
    npm install
    npm run dev
)

pause
