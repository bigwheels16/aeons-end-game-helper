@echo off
echo Running tests...
docker run --rm -v "%CD%:/app" -w /app node:22-slim sh -c "npm ci && npm run test"
IF %ERRORLEVEL% NEQ 0 (
    echo Tests failed. Aborting build.
    pause
    exit /b %ERRORLEVEL%
)

echo Tests passed. Building production image...
docker build -t aeons-end-turn-order -f Dockerfile .

echo Build complete.
pause
