@echo off
REM Install FDS Runner Bot as a Windows Task Scheduler task
REM Run this script as Administrator

REM --- CONFIGURE THESE ---
SET PYTHON_PATH=python
SET SCRIPT_PATH=%~dp0FDS_Runner_Bot.py
SET WORKING_DIR=C:\FDS_Runs

echo ============================================
echo   FDS Runner Bot Installer
echo ============================================
echo.

REM --- Step 1: Install Python dependencies ---
echo Installing Python dependencies...
pip install -r "%~dp0requirements.txt"
if %ERRORLEVEL% NEQ 0 (
    echo Failed to install dependencies.
    pause
    exit /b 1
)
echo.

REM --- Step 2: Store credentials in Windows Credential Manager ---
echo Setting up dashboard credentials...
echo These will be stored securely in Windows Credential Manager.
echo.

SET /P DASHBOARD_URL="Dashboard URL (e.g. https://backendfornextapp-production.up.railway.app): "
SET /P API_KEY="API Key: "

%PYTHON_PATH% -c "import keyring; keyring.set_password('fds-runner', 'dashboard_url', '%DASHBOARD_URL%'); keyring.set_password('fds-runner', 'api_key', '%API_KEY%'); print('Credentials stored in Windows Credential Manager.')"
if %ERRORLEVEL% NEQ 0 (
    echo Failed to store credentials.
    pause
    exit /b 1
)
echo.

REM --- Step 3: Create the working directory if it doesn't exist ---
if not exist "%WORKING_DIR%" (
    mkdir "%WORKING_DIR%"
    echo Created working directory: %WORKING_DIR%
)

REM --- Step 4: Create scheduled task ---
echo Creating scheduled task: FDS_Runner_Bot
echo Script: %SCRIPT_PATH%
echo Working directory: %WORKING_DIR%
echo.

schtasks /create /tn "FDS_Runner_Bot" /tr "\"%PYTHON_PATH%\" \"%SCRIPT_PATH%\"" /sc onstart /ru %USERNAME% /rl HIGHEST /f

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo   Setup complete!
    echo ============================================
    echo.
    echo The runner will start automatically on boot.
    echo Drop .fds files into %WORKING_DIR% to run them.
    echo.
    echo To test now:
    echo   cd %WORKING_DIR%
    echo   python "%SCRIPT_PATH%" --mock
) else (
    echo.
    echo Failed to create task. Make sure you are running as Administrator.
)

pause
