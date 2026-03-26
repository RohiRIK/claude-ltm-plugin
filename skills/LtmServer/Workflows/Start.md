# Start LTM Graph Server

Two modes: **dev** (HMR on :7332, API on :7331) or **prod** (API on :7331 serves built Next.js).

## Step 0 — Kill anything on ports 7331 and 7332

Always run this first to avoid stale processes:

```bash
# Kill by PID file
PID_FILE="$HOME/.claude/tmp/ltm-server.pid"
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  kill "$PID" 2>/dev/null && echo "Killed API (PID $PID)"
  rm -f "$PID_FILE" "$HOME/.claude/tmp/ltm-server.log"
fi

# Kill any process still holding :7331 or :7332
lsof -ti :7331 | xargs kill -9 2>/dev/null || true
lsof -ti :7332 | xargs kill -9 2>/dev/null || true

# Kill stale tmux ltm-ui session
tmux kill-session -t ltm-ui 2>/dev/null || true

echo "Ports 7331 and 7332 cleared"
```

## Dev Mode (recommended for development)

1. **Start API server (port 7331)**

```bash
mkdir -p "$HOME/.claude/tmp"
nohup bun "${CLAUDE_PLUGIN_ROOT}/src/graph-server.ts" \
  > "$HOME/.claude/tmp/ltm-server.log" 2>&1 &
echo $! > "$HOME/.claude/tmp/ltm-server.pid"
sleep 0.5
echo "API started on http://localhost:7331"
```

2. **Start Next.js dev server (port 7332, HMR enabled) in tmux**

```bash
tmux new-session -d -s ltm-ui -x 220 -y 50 \
  "cd '${CLAUDE_PLUGIN_ROOT}/graph-app' && NEXT_PUBLIC_WS_URL=ws://localhost:7331 bun dev --port 7332"
echo "Next.js starting in tmux session 'ltm-ui'"
```

3. **Open browser** (wait ~5s for Next.js to compile on first start)

```bash
open "http://localhost:7332"
```

## Prod Mode

1. **Build Next.js app**

```bash
cd "${CLAUDE_PLUGIN_ROOT}/graph-app"
bun run build
```

2. **Start API server**

```bash
mkdir -p "$HOME/.claude/tmp"
nohup bun "${CLAUDE_PLUGIN_ROOT}/src/graph-server.ts" \
  > "$HOME/.claude/tmp/ltm-server.log" 2>&1 &
echo $! > "$HOME/.claude/tmp/ltm-server.pid"
sleep 0.5
```

3. **Open browser**

```bash
open "http://localhost:7332"
```

## Notes

- API + WebSocket always on `:7331`
- Next.js dev always on `:7332` with `/api/*` proxied to `:7331`
- `NEXT_PUBLIC_WS_URL=ws://localhost:7331` — WebSocket always connects to API server
