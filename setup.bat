@echo off
chcp 65001 >nul
title Ma'had Lughah - Setup & Deploy
color 0A

echo ============================================
echo    Ma'had Lughah - Setup ^& Deploy Tool
echo ============================================
echo.

:: ===== STEP 1: Check & Install Dependencies =====
echo [1/5] Checking dependencies...

:: Check Git
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo   Installing Git...
    winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
    echo   Git installed. Please CLOSE this window and RE-RUN.
    pause
    exit /b
) else (
    echo   Git already installed
)

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   Installing Node.js LTS...
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
    echo   Node.js installed. Please CLOSE this window and RE-RUN.
    pause
    exit /b
) else (
    echo   Node.js already installed
)

:: Check npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo   npm not found. Please restart your computer and re-run.
    pause
    exit /b
) else (
    echo   npm already installed
)

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
echo [5/5] Setting up Git & pushing to GitHub...
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
