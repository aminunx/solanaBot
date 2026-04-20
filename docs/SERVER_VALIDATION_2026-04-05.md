# Solana Bot Server Validation - 2026-04-05

## Environment
- host: Lightning server
- runtime: Node 22
- package manager: pnpm 10
- network: Solana mainnet-beta

## Validation
Executed on the server:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm scan:live
pnpm execute:prepare
```

## Result
- install: passed
- typecheck: passed
- tests: passed
- build: passed
- live scan: passed
- execution preflight: passed

## Operational Findings
1. Public Solana RPC returned `429` when account-heavy quoting was repeated too aggressively.
2. `https://solana-rpc.publicnode.com` works as a stronger live-read RPC than the default public Solana endpoint for Orca quote construction.
3. Direct Raydium<->Orca markets are now being scanned instead of aggregator-vs-aggregator routes.

## Market Finding
The current server-side task is no longer "make the scanner run." It already runs.

The current task is "find a direct market surface that is positive after conservative fees." That requires continued market expansion, not blind sender-path activation.
