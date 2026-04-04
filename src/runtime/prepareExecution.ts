import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createSolanaConnection } from "../adapters/solanaRpc.js";
import { JupiterClient } from "../adapters/jupiterClient.js";
import { env } from "../config/env.js";
import { scanRoundTrips } from "../scanners/roundTripScanner.js";

const ARTIFACTS_DIR = join(process.cwd(), "artifacts");
const OUTPUT_PATH = join(ARTIFACTS_DIR, "latest-execution-preflight.json");

async function main(): Promise<void> {
  const connection = createSolanaConnection();
  const jupiter = new JupiterClient(env.JUPITER_API_BASE_URL);
  const summary = await scanRoundTrips({
    connection,
    jupiter
  });

  await mkdir(ARTIFACTS_DIR, { recursive: true });

  const result = summary.best
    ? {
        createdAt: new Date().toISOString(),
        status: "candidate",
        candidate: summary.best,
        tokenUsd: summary.tokenUsd
      }
    : {
        createdAt: new Date().toISOString(),
        status: "no_candidate",
        reason: "No candidate satisfied the Solana no-loss admission law in this scan window.",
        tokenUsd: summary.tokenUsd
      };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
