@echo off
title ZTE Router Tracker Launcher

:: 🛑 Step 1: Clear any background Node processes to ensure port 3000 is clean
taskkill /f /im node.exe >nul 2>&1

:: 📁 Step 2: Navigate to your project directory
cd /d "C:\Users\cyber\Downloads\router-tracker"

:: 🚀 Step 3: Spin up the web application engine quietly in the background
start /b node server.js

:: ⏳ Step 4: Give the database engine 2 seconds to initialize safely
timeout /t 2 /nobreak >nul

:: 🌐 Step 5: Open the dashboard directly inside a clean, maximized Chrome browser tab
start chrome --maximized "http://localhost:3000"

exit
