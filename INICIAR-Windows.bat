@echo off
rem Mediconnect: abre el sistema en este equipo (solo necesita Node.js)
chcp 65001 >nul
title Mediconnect
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se encontro Node.js en este equipo.
  echo Instale la version LTS desde https://nodejs.org/es/download y vuelva a abrir este archivo.
  echo.
  start "" "https://nodejs.org/es/download"
  pause
  exit /b 1
)
node "iniciar\iniciar.js"
echo.
pause
