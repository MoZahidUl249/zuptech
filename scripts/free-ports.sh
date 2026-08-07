#!/usr/bin/env bash
# Release the dev ports before starting the stack.
#
# `bun run --filter '*' dev` supervises both watchers. When the supervisor
# dies without reaping them — Ctrl+C at the wrong moment, a crashed terminal,
# a killed IDE task — the children survive and keep their listeners open. The
# next `bun run dev` then half-starts: backend claims :3000 (Bun's serve
# reuses the port), while the frontend dies on EADDRINUSE. That reads as "the
# frontend won't run" when the real problem is a process from the previous
# session.
#
# Only ever touches OUR two ports, and only listeners owned by this user.
set -u

for port in 3000 3001; do
  # -t: pids only. Restricted to LISTEN sockets so a browser tab or curl
  # holding a client connection to the port is never a target.
  pids=$(ss -lptnH "sport = :$port" 2>/dev/null |
    grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)

  for pid in $pids; do
    # Never kill ourselves or our own shell ancestry.
    [ "$pid" = "$$" ] && continue
    cmd=$(ps -p "$pid" -o comm= 2>/dev/null || true)
    [ -z "$cmd" ] && continue
    echo "free-ports: :$port held by pid $pid ($cmd) — stopping it"
    kill "$pid" 2>/dev/null || true
  done
done

# Give the graceful kills a moment, then escalate only for what's still there.
sleep 1
for port in 3000 3001; do
  pids=$(ss -lptnH "sport = :$port" 2>/dev/null |
    grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
  for pid in $pids; do
    [ "$pid" = "$$" ] && continue
    echo "free-ports: pid $pid still on :$port — SIGKILL"
    kill -9 "$pid" 2>/dev/null || true
  done
done

exit 0
