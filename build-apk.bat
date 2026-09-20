@echo off
:: ================================================================
:: HuaPlay APK Build Script
:: Requires: JDK 21, Android SDK, Node.js
:: ================================================================

echo [1/4] Building React frontend...
cd /d "%~dp0frontend"
call npm run build
if %ERRORLEVEL% NEQ 0 ( echo BUILD FAILED at npm run build & pause & exit /b 1 )

echo [2/4] Syncing assets to Android project...
call npx cap sync android
if %ERRORLEVEL% NEQ 0 ( echo BUILD FAILED at cap sync & pause & exit /b 1 )

echo [3/4] Compiling Android APK with Gradle...
cd android
set JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.12.8-hotspot
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\build-tools\36.0.0;%PATH%

call gradlew.bat assembleDebug
if %ERRORLEVEL% NEQ 0 ( echo BUILD FAILED at Gradle & pause & exit /b 1 )

echo [4/4] Copying APK to project root...
copy "app\build\outputs\apk\debug\app-debug.apk" "..\..\HuaPlay-debug.apk" /Y

echo.
echo ============================================
echo  APK GERADO COM SUCESSO!
echo  Arquivo: HuaPlay-debug.apk (raiz do projeto)
echo ============================================
echo.
pause
