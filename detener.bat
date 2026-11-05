@echo off
cd /d "%~dp0"
echo Deteniendo el sistema (los datos se conservan)...
docker compose stop
echo.
echo Sistema detenido. Para volver a prenderlo usa iniciar.bat
pause
