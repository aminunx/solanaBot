# Solana Live Scan Loop — 2026-04-05

## Purpose
Run a continuous Solana mainnet scan loop on the server without sending transactions.

## Command
```bash
pnpm watch:scan
```

## Behavior
- scans live markets every 15 seconds
- writes:
  - `artifacts/watch-scan-latest.json`
  - `artifacts/watch-scan.jsonl`
- emits:
  - `status = no_candidate`
  - or `status = candidate`

## Why This Exists
The correct next step before any sender path on Solana is to observe whether the chosen no-loss law ever produces a live candidate on real market data.

If it does not, then the next engineering task is not “send faster” but “expand market coverage or improve route logic”.
