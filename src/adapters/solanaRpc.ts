import { Connection, PublicKey } from "@solana/web3.js";

import { env } from "../config/env.js";

export function createSolanaConnection(): Connection {
  return new Connection(env.SOLANA_RPC_URL, "confirmed");
}

export async function getMedianPriorityFeeLamports(connection: Connection, writableAccounts: string[] = []): Promise<bigint> {
  const fees = await connection.getRecentPrioritizationFees({
    lockedWritableAccounts: writableAccounts.map((value) => new PublicKey(value))
  });

  if (fees.length === 0) {
    return 0n;
  }

  const sorted = fees.map((entry) => entry.prioritizationFee).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  return BigInt(Math.ceil(median * env.PRIORITY_FEE_MULTIPLIER));
}
