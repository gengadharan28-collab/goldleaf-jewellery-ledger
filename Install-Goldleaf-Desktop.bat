@echo off
setlocal
echo ========================================================
echo   Goldleaf Jewellery ERP - Desktop App Installer
echo ========================================================
echo.
echo Installing Goldleaf Desktop Application Shortcut on Windows...
echo.

set "SCRIPT_DIR=%~dp0"
set "HTML_FILE=%SCRIPT_DIR%index.html"
set "ICON_PATH=%SCRIPT_DIR%icon-192.png"
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\Goldleaf Jewellery ERP.lnk"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$s = $ws.CreateShortcut('%SHORTCUT_PATH%'); " ^
  "$edge = [System.IO.Path]::Combine(${env:ProgramFiles(x86)}, 'Microsoft\Edge\Application\msedge.exe'); " ^
  "$chrome = [System.IO.Path]::Combine(${env:ProgramFiles}, 'Google\Chrome\Application\chrome.exe'); " ^
  "$chromeUser = [System.IO.Path]::Combine($env:LOCALAPPDATA, 'Google\Chrome\Application\chrome.exe'); " ^
  "if (Test-Path $chrome) { $browser = $chrome; } elseif (Test-Path $chromeUser) { $browser = $chromeUser; } elseif (Test-Path $edge) { $browser = $edge; } else { $browser = 'msedge.exe'; } " ^
  "$s.TargetPath = $browser; " ^
  "$fileUri = (New-Object System.Uri('%HTML_FILE%')).AbsoluteUri; " ^
  "$s.Arguments = '--app=\"' + $fileUri + '\"'; " ^
  "$s.Description = 'Goldleaf Jewellery ERP Desktop App'; " ^
  "if (Test-Path '%ICON_PATH%') { $s.IconLocation = '%ICON_PATH%'; } " ^
  "$s.WorkingDirectory = '%SCRIPT_DIR%'; " ^
  "$s.Save();"

if exist "%USERPROFILE%\Desktop\Goldleaf Jewellery ERP.lnk" (
  echo [SUCCESS] Goldleaf Desktop Shortcut successfully created on your Desktop!
  echo Location: %USERPROFILE%\Desktop\Goldleaf Jewellery ERP.lnk
  echo.
  echo You can now launch Goldleaf directly from your Desktop!
) else (
  echo [INFO] Please open index.html in Google Chrome or Microsoft Edge
  echo and click the Install icon (computer icon) in the address bar.
)

echo.
pause
