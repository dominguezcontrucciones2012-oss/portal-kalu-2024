# Script para reparar la estructura del proyecto KALUNEVA2024
# Ejecuta este script con clic derecho -> Ejecutar con PowerShell

$srcPath = "c:\Users\pc\Music\src"
$destPath = "c:\Users\pc\Downloads\kalu_folden_2024\src"

if (Test-Path $srcPath) {
    if (Test-Path $destPath) {
        Write-Host "Borrando carpeta src antigua en el destino..." -ForegroundColor Yellow
        Remove-Item -Path $destPath -Recurse -Force
    }
    
    Write-Host "Moviendo carpeta src desde Music a Downloads..." -ForegroundColor Green
    Move-Item -Path $srcPath -Destination $destPath -Force
    Write-Host "¡Reparación completada con éxito!" -ForegroundColor Cyan
} else {
    Write-Host "Error: No se encontró la carpeta src en Music. Verifica la ruta." -ForegroundColor Red
}

Pause
