import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { JupiterClient } from "../adapters/jupiterClient.js";
import { createSolanaConnection } from "../adapters/solanaRpc.js";
import { env } from "../config/env.js";
import { scanRoundTrips } from "../scanners/roundTripScanner.js";

const ARTIFACTS_DIR = join(process.cwd(), "artifacts");
const LATEST_PATH = join(ARTIFACTS_DIR, "watch-scan-latest.json");
const JOURNAL_PATH = join(ARTIFACTS_DIR, "watch-scan.jsonl");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const connection = createSolanaConnection();
  const jupiter = new JupiterClient(env.JUPITER_API_BASE_URL, env.JUPITER_API_KEY);
  await mkdir(ARTIFACTS_DIR, { recursive: true });

  let cycle = 0;
  while (true) {
    cycle += 1;
    const summary = await scanRoundTrips({
      connection,
      jupiter
    });

    const entry = {
      timestamp: new Date().toISOString(),
      cycle,
      status: summary.best ? "candidate" : "no_candidate",
      best: summary.best,
      tokenUsd: summary.tokenUsd
    };

    await appendFile(JOURNAL_PATH, `${JSON.stringify(entry)}\n`, "utf8");
    await writeFile(LATEST_PATH, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(entry));

    await sleep(15_000);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
