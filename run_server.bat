@echo off
TITLE Pocket Closet Server
SET PORT=8080

echo ======================================================
echo           POCKET CLOSET MOBILE SERVER
echo ======================================================
echo.

:: Get the local IPv4 address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do set IP=%%a
set IP=%IP: =%

echo [1] Your PC's Local IP is: %IP%
echo [2] On your phone, go to:  http://%IP%:%PORT%
echo.
echo ------------------------------------------------------
echo TIP: If the "Install" button doesn't appear on mobile:
echo Go to chrome://flags/#unsafely-treat-insecure-origin-as-secure
echo and add http://%IP%:%PORT% to the list.
echo ------------------------------------------------------
echo.
echo Starting server...
npx http-server . -p %PORT% -c-1
pause
