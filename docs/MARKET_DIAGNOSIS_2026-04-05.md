# Solana Market Diagnosis - 2026-04-05

## Why the First Solana Scanner Was Weak
The initial scanner compared Jupiter against itself. That is not a real venue-vs-venue arbitrage surface because Jupiter already aggregates routes across multiple venues.

## Current Fix
The scanner now compares:
- Raydium direct quote
- Orca direct quote
- Meteora DLMM direct quote

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

After adding Meteora and fixing its public-node incompatibility by chunking `getMultipleAccountsInfo` requests to `<=10` accounts per call, the best supported routes were still negative.

Examples from the Meteora-expanded discovery pass:
- `SOL/JLP/SOL`
  - `orca->raydium`: about `-0.0702 USD`
  - `meteora->raydium`: about `-0.0704 USD`
  - `raydium->meteora`: about `-0.0725 USD`
- `SOL/JUP/SOL`
  - `meteora->orca`: about `-0.0726 USD`
- `SOL/cbBTC/SOL`
  - `meteora->raydium`: about `-0.0749 USD`

## Practical Conclusion
The current blocker is not code correctness. The blocker is market structure:
- direct Raydium<->Orca<->Meteora round trips on the currently scanned pairs are not positive enough
- therefore the next profitable path is more direct venue coverage or better market discovery, not forcing sender path activation

## Operational Finding
The current public RPC surface is also a practical constraint:
- `solana-rpc.publicnode.com` rate-limits aggressively under broad sweeps
- Meteora's SDK internally refetches multiple accounts, which required a client-side chunking wrapper
- broader discovery should run on a better RPC or on the server once SSH is restored

## Immediate Consequence
The bot should continue as:
1. direct-venue scanner
2. server-validated
3. broader venue coverage and amount sweeps
4. no live send until a positive conservative candidate exists
