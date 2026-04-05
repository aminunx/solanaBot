# Solana Market Diagnosis - 2026-04-05

## Why the First Solana Scanner Was Weak
The initial scanner compared Jupiter against itself. That is not a real venue-vs-venue arbitrage surface because Jupiter already aggregates routes across multiple venues.

## Current Fix
The scanner now compares:
- Raydium direct quote
- Orca direct quote

Jupiter remains only a price reference for:
- SOL/USD normalization
- future market discovery support

## Live Findings
Measured direct Raydium<->Orca raw deltas on 2026-04-05 remained negative on currently tested markets.

Examples:
- `SOL/USDC/SOL`
  - `raydium->orca`: about `-265,215` lamports
  - `orca->raydium`: about `-216,777` lamports
- `USDC/SOL/USDC`
  - `raydium->orca`: about `-21,746` base units
  - `orca->raydium`: about `-26,639` base units
- `SOL/JLP/SOL`
  - `raydium->orca`: about `-281,629` lamports
  - `orca->raydium`: about `-247,357` lamports

Extended discovery across current top-traded verified tokens also remained negative on the best supported pairs.

Examples from the discovery pass:
- `SOL/JLP/SOL`: about `-0.0705 USD` net
- `SOL/JUP/SOL`: about `-0.0747 USD` net
- `USDC/cbBTC/USDC`: about `-0.0807 USD` net
- `SOL/PUMP/SOL`: about `-0.0825 USD` net

## Practical Conclusion
The current blocker is not code correctness. The blocker is market structure:
- direct Raydium<->Orca round trips on the currently scanned pairs are not positive enough
- therefore the next profitable path is more direct venue coverage or better market discovery, not forcing sender path activation

## Immediate Consequence
The bot should continue as:
1. direct-venue scanner
2. server-validated
3. no live send until a positive conservative candidate exists
