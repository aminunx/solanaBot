# Solana Live Scan Loop - 2026-04-05

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

## Current Scan Model
- price reference: Jupiter
- direct buy/sell venues: Raydium and Orca
- current markets:
  - `SOL/USDC/SOL`
  - `USDC/SOL/USDC`
  - `SOL/cbBTC/SOL`
  - `USDC/cbBTC/USDC`
  - `SOL/TRUMP/SOL`
  - `SOL/PUMP/SOL`
  - `SOL/JLP/SOL`
  - `SOL/Fartcoin/SOL`
  - `SOL/JUP/SOL`

## Current Interpretation
If the loop keeps returning `no_candidate`, the correct next step is not to enable live sending anyway. The correct next step is to widen direct venue coverage or change market selection based on measured raw venue spreads.
