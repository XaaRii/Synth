@Mode con: cols=100 lines=30
@powershell -command "&{$H=get-host;$W=$H.ui.rawui;$B=$W.buffersize;$B.width=100;$B.height=9000;$W.buffersize=$B;}"
@echo off
cd /d %~dp0
title [Synth] Checking for updates...
node index.js --update
:A
cls
title [Synth] Config manager
if NOT exist node_modules goto :missing
if exist .\*.pl (
    echo What config do you want to use? You currently have these:
    for %%f in (.\*.pl) do (
     echo %%~nf
    )
    echo.
    echo You can also create a new one by typing a new unique name.
    set /p "name=> "
) else (
    echo Seems like you don't have any configs set up yet.
    echo Pick a name for your config.
    set /p "name=> "
)

title [Synth] Spotify to YouTube playlist helper (by Pawele)
node index.js %name%
echo.
echo.
choice /C yn /M "Process finished. Do you want to run again for a different config?"
if "%errorlevel%"=="1" goto :A
exit

:missing
title Please wait a moment...
echo node_modules folder not found, generating new one.
call npm install
goto :A