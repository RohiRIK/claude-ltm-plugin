# Stop LTM Graph Server

## Steps

1. **Kill all LTM processes**

```bash
# Kill by PID file
PID_FILE="$HOME/.claude/tmp/ltm-server.pid"
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  kill "$PID" 2>/dev/null && echo "Killed API (PID $PID)" || echo "PID $PID was not running"
fi

# Kill any process still holding ports
lsof -ti :7331 | xargs kill -9 2>/dev/null || true
lsof -ti :7332 | xargs kill -9 2>/dev/null || true

# Kill Next.js tmux session
tmux kill-session -t ltm-ui 2>/dev/null || true
```

2. **Cleanup**

```bash
rm -f "$HOME/.claude/tmp/ltm-server.pid"
rm -f "$HOME/.claude/tmp/ltm-server.log"
echo "LTM Graph server stopped."
```
