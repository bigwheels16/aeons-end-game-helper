@echo off
echo Building Dev Docker image...
docker build -t aeons-end-turn-order-dev -f Dockerfile.dev .

echo Running Docker container with live-reload...
docker run --rm -p 8085:5173 -e SCANNER_PROXY_TARGET=http://host.docker.internal:8080 -v "%CD%:/app" -v /app/node_modules aeons-end-turn-order-dev

pause