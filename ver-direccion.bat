@echo off
echo Para entrar al sistema desde OTRAS computadoras de la red, abre en el navegador:
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do echo    http://%%a
echo.
echo (Si aparece mas de una direccion, usa la que empieza igual que las de las otras computadoras.)
echo Conviene que esta computadora tenga siempre la misma direccion (IP fija o reservada en el router).
echo.
pause
