@echo off
echo Running Python tests...
docker run --rm -e PYTHONDONTWRITEBYTECODE=1 -v "%CD%:/app" -w /app python:3.12-slim python -m unittest discover -s scripts -p "test_*.py"
IF %ERRORLEVEL% NEQ 0 (
    echo Python tests failed. Aborting build.
    pause
    exit /b %ERRORLEVEL%
)

echo Running tests...
docker run --rm -v "%CD%:/app" -v /app/node_modules -w /app node:22-slim sh -c "npm ci && npm run test"
IF %ERRORLEVEL% NEQ 0 (
    echo Tests failed. Aborting build.
    pause
    exit /b %ERRORLEVEL%
)

echo Tests passed. Building production image...
docker build -t aeons-end-turn-order -f Dockerfile .

echo Build complete.
pause
