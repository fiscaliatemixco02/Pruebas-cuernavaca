@echo off
net session >nul 2>&1
if errorlevel 1 (
  echo Este archivo debe ejecutarse como administrador.
  echo Haz clic derecho sobre el archivo y elige "Ejecutar como administrador".
  echo.
  pause
  exit /b 1
)
netsh advfirewall firewall delete rule name="Sistema Fiscalia" >nul 2>&1
netsh advfirewall firewall add rule name="Sistema Fiscalia" dir=in action=allow protocol=TCP localport=80 profile=any
echo.
echo Listo: las otras computadoras de la red ya pueden entrar por el puerto 80.
echo Si cambiaste PUERTO_WEB en el archivo .env, edita este archivo y pon ese numero en "localport".
pause
