@echo off
cd /d "%~dp0"
echo Actualizando el sistema con los cambios mas recientes del codigo...
echo (Esto puede tardar unos minutos. Los datos no se tocan.)
echo.
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo ERROR al actualizar. Revisa el mensaje de arriba.
  pause
  exit /b 1
)
docker image prune -f >nul 2>&1
echo.
echo Listo. El sistema ya esta actualizado.
pause
