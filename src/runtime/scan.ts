import { createSolanaConnection } from "../adapters/solanaRpc.js";
import { JupiterClient } from "../adapters/jupiterClient.js";
import { OrcaClient } from "../adapters/orcaClient.js";
import { RaydiumClient } from "../adapters/raydiumClient.js";
import { env } from "../config/env.js";
import { scanRoundTrips } from "../scanners/roundTripScanner.js";

async function main(): Promise<void> {
  const connection = createSolanaConnection();
  const jupiter = new JupiterClient(env.JUPITER_API_BASE_URL, env.JUPITER_API_KEY);
  const raydium = new RaydiumClient(env.RAYDIUM_API_BASE_URL);
  const orca = new OrcaClient(env.ORCA_API_BASE_URL, env.SOLANA_RPC_URL);
  const summary = await scanRoundTrips({
    connection,
    jupiter,
    raydium,
    orca
  });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
