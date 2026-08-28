@echo off
echo Building Docker image...
docker build -t aeons-end-turn-order .

echo Opening browser...
start http://localhost:8085

echo Running Docker container...
docker run -p 8085:8080 aeons-end-turn-order

pause