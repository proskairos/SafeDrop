#!/bin/bash
# Persistent agent starter — respawns if the agent crashes
cd "$(dirname "$0")"
while true; do
  echo "[$(date)] Starting Custodian Agent..."
  npx tsx index.ts
  EXIT_CODE=$?
  echo "[$(date)] Agent exited with code $EXIT_CODE. Restarting in 3s..."
  sleep 3
done
