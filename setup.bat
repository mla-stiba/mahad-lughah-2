@echo off
chcp 65001 >nul
title Ma'had Lughah - Setup dan Deploy
color 0A

:: ===== SELF-ELEVATE TO ADMIN (winget needs admin) =====
net session >nul 2>nul
if %errorlevel% neq 0 (
    echo Requesting admin privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ============================================
echo    Ma'had Lughah - Setup dan Deploy Tool
echo ============================================
echo.

:: Helper: refresh PATH from registry (fix "close and re-run" problem)
goto :main

:refreshPATH
:: Read system PATH from registry
for /f "usebackq tokens=2,*" %%A in (`reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul`) do set "SYS_PATH=%%B"
:: Read user PATH from registry
for /f "usebackq tokens=2,*" %%A in (`reg query "HKCU\Environment" /v PATH 2^>nul`) do set "USR_PATH=%%B"
:: Combine and set in current session
set "PATH=%USR_PATH%;%SYS_PATH%"
:: Also manually add common install locations (belt and suspenders)
set "PATH=%PATH%;C:\Program Files\Git\cmd;C:\Program Files\Git\bin;C:\Program Files\nodejs;C:\Program Files\nodejs\node_modules\.bin;C:\Program Files (x86)\nodejs"
exit /b

:main

:: ===== STEP 1: Check & Install Dependencies =====
echo [1/5] Checking dependencies...

:: Check Git
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo   Installing Git...
    winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements --silent
    if %errorlevel% neq 0 (
        echo   winget failed, trying without --silent...
        winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
    )
    echo   Refreshing PATH...
    call :refreshPATH
    timeout /t 2 /nobreak >nul
) else (
    echo   Git already installed
)

:: Re-check Git after install
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo   WARNING: Git still not found in PATH.
    echo   Trying direct path...
    set "PATH=%PATH%;C:\Program Files\Git\cmd"
    "C:\Program Files\Git\cmd\git.exe" --version >nul 2>nul
    if %errorlevel% neq 0 (
        echo   ERROR: Cannot find Git. Please install manually.
        pause
        exit /b
    )
)
echo   Git OK

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   Installing Node.js LTS...
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements --silent
    if %errorlevel% neq 0 (
        echo   winget failed, trying without --silent...
        winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
    )
    echo   Refreshing PATH...
    call :refreshPATH
    timeout /t 3 /nobreak >nul
) else (
    echo   Node.js already installed
)

:: Re-check Node.js after install
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   WARNING: Node still not found in PATH.
    echo   Trying direct path...
    set "PATH=%PATH%;C:\Program Files\nodejs"
    "C:\Program Files\nodejs\node.exe" --version >nul 2>nul
    if %errorlevel% neq 0 (
        echo   ERROR: Cannot find Node.js. Please install manually.
        pause
        exit /b
    )
)
echo   Node.js OK

:: Check npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo   Refreshing PATH for npm...
    call :refreshPATH
    where npm >nul 2>nul
    if %errorlevel% neq 0 (
        echo   ERROR: npm not found. Please restart computer and re-run.
        pause
        exit /b
    )
)
echo   npm OK

echo.

:: ===== STEP 2: Install npm dependencies =====
echo [2/5] Installing npm packages...
call npm install --no-audit --no-fund
if %errorlevel% neq 0 (
    echo   ERROR: npm install failed
    pause
    exit /b
)
echo   npm packages installed

echo.

:: ===== STEP 3: Create .env file =====
echo [3/5] Creating .env file...

:: Generate random NEXTAUTH_SECRET (32 chars)
set "chars=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
set "secret="
set /a count=0
:genloop
set /a rand=%random% %% 62
call set "char=%%chars:~%rand%,1%%"
set "secret=%secret%%char%"
set /a count+=1
if %count% lss 32 goto genloop

:: Write .env file (overwrite if exists)
(
echo DATABASE_URL="postgresql://postgres:@%%TaV%%XsU!C90U@db.ralstfxcfhivehlufjyo.supabase.co:5432/postgres"
echo NEXTAUTH_SECRET="%secret%"
echo NEXT_PUBLIC_APP_NAME="mahad-lughah"
echo NEXT_PUBLIC_APP_URL="http://localhost:3000"
) > .env

echo   .env file created:
echo     DATABASE_URL=postgresql://postgres:****@db.ralstfxcfhivehlufjyo.supabase.co:5432/postgres
echo     NEXTAUTH_SECRET=%secret% (auto-generated)
echo.

:: ===== STEP 4: Prisma generate =====
echo [4/5] Generating Prisma client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo   WARNING: Prisma generate had issues, continuing anyway...
) else (
    echo   Prisma client generated
)
echo.

:: ===== STEP 5: Git init & push =====
echo [5/5] Setting up Git and pushing to GitHub...
echo.

:: Ask for version/commit message
set /p "version=Enter version (e.g. 3.5.0): "
if "%version%"=="" set "version=3.5.0"

set "commitmsg=Versi %version%"

echo.
echo   Commit message: "%commitmsg%"
echo.

:: Git init
git init -b main 2>nul
if %errorlevel% neq 0 (
    git init 2>nul
    git branch -M main
)

:: Set remote
git remote remove origin 2>nul
git remote add origin https://github.com/mla-stiba/mahad-lughah-2.git

:: Config
git config user.email "337858433+mla-stiba@users.noreply.github.com"
git config user.name "mla-stiba"

:: Add, commit, push
echo   Adding files...
git add .

echo   Committing...
git commit -m "%commitmsg%"

echo   Pushing to GitHub (force)...
git push -u origin main --force

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo    SUCCESS! Pushed to GitHub
    echo ============================================
    echo.
    echo    Repo: https://github.com/mla-stiba/mahad-lughah-2
    echo    Commit: %commitmsg%
    echo.
    echo    Next: Vercel will auto-deploy from this push.
) else (
    echo.
    echo ============================================
    echo    ERROR: Git push failed
    echo ============================================
    echo.
    echo    Possible causes:
    echo    - GitHub authentication needed (run: git config credential.helper manager)
    echo    - Wrong repository URL
    echo    - Network issue
    echo.
    echo    Try manually:
    echo    git push -u origin main --force
)

echo.
pause
