@echo off
setlocal
cd /d "%~dp0"
if not exist respaldos mkdir respaldos
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm"') do set FECHA=%%i

echo Guardando la base de datos...
docker compose exec -T db sh -c "pg_dump -U $POSTGRES_USER $POSTGRES_DB" > "respaldos\base-%FECHA%.sql"
if errorlevel 1 (
  echo ERROR al respaldar la base de datos. Verifica que el sistema este prendido.
  if not "%1"=="auto" pause
  exit /b 1
)

echo Guardando los PDF subidos...
docker run --rm -v fiscalia_archivos:/datos -v "%cd%\respaldos":/destino alpine tar czf /destino/archivos-%FECHA%.tar.gz -C /datos .
if errorlevel 1 (
  echo ERROR al respaldar los archivos.
  if not "%1"=="auto" pause
  exit /b 1
)

echo.
echo Listo. Respaldos guardados en la carpeta "respaldos":
echo   base-%FECHA%.sql
echo   archivos-%FECHA%.tar.gz
if not "%1"=="auto" pause
