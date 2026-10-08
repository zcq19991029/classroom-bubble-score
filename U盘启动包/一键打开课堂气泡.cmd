@echo off
setlocal
set "CLASSROOM_URL=https://classroom-bubble-score.zcq991029.chatgpt.site/"
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --start-maximized "%CLASSROOM_URL%"
  exit /b 0
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --start-maximized "%CLASSROOM_URL%"
  exit /b 0
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
  start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" --start-maximized "%CLASSROOM_URL%"
  exit /b 0
)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --start-maximized "%CLASSROOM_URL%"
  exit /b 0
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --start-maximized "%CLASSROOM_URL%"
  exit /b 0
)
start "" "%CLASSROOM_URL%"
exit /b 0
