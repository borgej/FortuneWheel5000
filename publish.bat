@echo off
setlocal

set DEST=\\mediaserver\c$\inetpub\wwwroot\FortuneWheel5000
set VERSION=

:: Parse arguments
:parse_args
if "%1"=="" goto done_args
if /I "%1"=="--clean" (
    set CLEAN=1
    shift
    goto parse_args
)
if /I "%1"=="--version" (
    set VERSION=%2
    shift
    shift
    goto parse_args
)
shift
goto parse_args
:done_args

echo Publishing FortuneWheel5000 to %DEST%...

if not exist "%DEST%" (
    mkdir "%DEST%"
    if errorlevel 1 (
        echo ERROR: Could not create destination folder. Check network access and permissions.
        pause
        exit /b 1
    )
)

if defined CLEAN (
    echo Cleaning destination folder...
    del /Q "%DEST%\*.*" >nul 2>&1
    for /D %%d in ("%DEST%\*") do rd /S /Q "%%d" >nul 2>&1
    echo   Done.
)

:: Patch version in app.js and index.html if --version was given
if defined VERSION (
    echo Patching version to %VERSION%...
    powershell -Command "(Get-Content app.js) -replace \"version: '[^']*'\", \"version: '%VERSION%'\" | Set-Content app.js"
    powershell -Command "(Get-Content index.html) -replace 'app\.js\?v=[^\"'']+', 'app.js?v=%VERSION%' -replace 'styles\.css\?v=[^\"'']+', 'styles.css?v=%VERSION%' | Set-Content index.html"
    echo   Patched version to %VERSION%
)

set FILES=index.html app.js styles.css tmi.min.js web.config

for %%f in (%FILES%) do (
    copy /Y "%%f" "%DEST%\%%f" >nul
    if errorlevel 1 (
        echo ERROR: Failed to copy %%f
        pause
        exit /b 1
    )
    echo   Copied %%f
)

echo.
echo Done! App published to %DEST%
if defined VERSION echo Version: %VERSION%
pause
