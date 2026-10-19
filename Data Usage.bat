@echo off
title ZTE Router Tracker Launcher
cd /d "C:\Users\cyber\Downloads\router-tracker"
start /b node server.js
timeout /t 2 /nobreak >nul
start chrome "http://localhost:3000"
exit