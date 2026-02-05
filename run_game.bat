@echo off
title Fire Snake Game
echo ========================================
echo          FIRE SNAKE GAME
echo ========================================
echo.
echo Starting Fire Snake Game...
echo The game will open in your browser at http://localhost:5050
echo.
echo Press Ctrl+C to stop the server.
echo ========================================
echo.

cd /d "%~dp0"

REM Check if JAR exists
if not exist "target\fire-snake-game-1.0.0.jar" (
    echo ERROR: JAR file not found!
    echo Please build the project first with: mvn clean package
    echo.
    pause
    exit /b 1
)

REM Start the game and open browser
start "" http://localhost:5050
java -jar target\fire-snake-game-1.0.0.jar

pause
