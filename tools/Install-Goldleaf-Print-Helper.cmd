@echo off
setlocal
set "GLDIR=%LOCALAPPDATA%\Goldleaf"
if not exist "%GLDIR%" mkdir "%GLDIR%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing 'https://gengadharan28-collab.github.io/goldleaf-jewellery-ledger/tools/Goldleaf-Citizen-Print-Helper.ps1' -OutFile '%GLDIR%\Goldleaf-Citizen-Print-Helper.ps1'"
if errorlevel 1 (
  echo Could not download the Goldleaf print helper.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Goldleaf Citizen Print Helper.lnk');$s.TargetPath='powershell.exe';$s.Arguments='-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""%LOCALAPPDATA%\Goldleaf\Goldleaf-Citizen-Print-Helper.ps1""';$s.WorkingDirectory='%GLDIR%';$s.Save()"
start "" powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%GLDIR%\Goldleaf-Citizen-Print-Helper.ps1"
echo.
echo Goldleaf direct print is installed and running.
echo Close this window and print the 80 mm estimate again.
pause
