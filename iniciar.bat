@echo off
cd /d "%~dp0"
echo Iniciando el sistema...
docker compose up -d
if errorlevel 1 (
  echo.
  echo No se pudo iniciar. Verifica que Docker Desktop este abierto y vuelve a intentarlo.
  pause
  exit /b 1
)
echo.
echo Listo. Abriendo el sistema en el navegador...
timeout /t 6 >nul
start http://localhost
