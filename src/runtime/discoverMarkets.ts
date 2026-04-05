import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createSolanaConnection, getMedianPriorityFeeLamports } from "../adapters/solanaRpc.js";
import { JupiterClient } from "../adapters/jupiterClient.js";
import { OrcaClient } from "../adapters/orcaClient.js";
import { RaydiumClient } from "../adapters/raydiumClient.js";
import { TOKENS } from "../config/addresses.js";
import { env } from "../config/env.js";
import { conservativeNetProfitUsd } from "../math/profit.js";

const ARTIFACTS_DIR = join(process.cwd(), "artifacts");
const OUTPUT_PATH = join(ARTIFACTS_DIR, "market-discovery.json");
const BASE_RPC_FEE_LAMPORTS = 5_000n;
const DEFAULT_JITO_TIP_LAMPORTS = 1_000n;
const DISCOVERY_LIMIT = 20;
const DISCOVERY_MIN_LIQUIDITY_USD = 200_000;

type TopToken = {
  id: string;
  symbol: string;
  decimals: number;
  liquidity: number;
  isVerified?: boolean;
  tags?: string[];
};

async function main(): Promise<void> {
  const connection = createSolanaConnection();
  const jupiter = new JupiterClient(env.JUPITER_API_BASE_URL, env.JUPITER_API_KEY);
  const raydium = new RaydiumClient(env.RAYDIUM_API_BASE_URL);
  const orca = new OrcaClient(env.ORCA_API_BASE_URL, env.SOLANA_RPC_URL);

  const [tokenUsd, priorityFeeLamports, topTokens] = await Promise.all([
    jupiter.deriveTokenUsdPrices(),
    getMedianPriorityFeeLamports(connection),
    fetchTopTokens()
  ]);

  const rows: Array<Record<string, unknown>> = [];
  for (const token of topTokens) {
    rows.push(...(await evaluateToken(token, raydium, orca, tokenUsd, priorityFeeLamports)));
  }

  rows.sort((left, right) => Number(right.netProfitUsd ?? -Infinity) - Number(left.netProfitUsd ?? -Infinity));

  const summary = {
    checkedAt: new Date().toISOString(),
    tokenUsd,
    rows,
    best: rows[0] ?? null
  };

  await mkdir(ARTIFACTS_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

async function fetchTopTokens(): Promise<TopToken[]> {
  const response = await fetch(`https://lite-api.jup.ag/tokens/v2/toptraded/24h?limit=${DISCOVERY_LIMIT}`, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Jupiter top traded HTTP ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as TopToken[];
  return payload.filter(
    (token) =>
      token.symbol !== "SOL" &&
      token.symbol !== "USDC" &&
      token.liquidity >= DISCOVERY_MIN_LIQUIDITY_USD &&
      (token.isVerified || token.tags?.includes("strict") || token.tags?.includes("verified"))
  );
}

async function evaluateToken(
  token: TopToken,
  raydium: RaydiumClient,
  orca: OrcaClient,
  tokenUsd: Record<string, number>,
  priorityFeeLamports: bigint
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  for (const base of [
    { symbol: "SOL", mint: TOKENS.SOL.mint, amount: 100_000_000n, decimals: TOKENS.SOL.decimals },
    { symbol: "USDC", mint: TOKENS.USDC.mint, amount: 10_000_000n, decimals: TOKENS.USDC.decimals }
  ]) {
    const routes: Array<Record<string, unknown>> = [];

    try {
      const buyRaydium = await raydium.getQuote({
        inputMint: base.mint,
        outputMint: token.id,
        amount: base.amount,
        slippageBps: env.SCANNER_SLIPPAGE_BPS
      });
      const sellOrca = await orca.getQuote({
        inputMint: token.id,
        outputMint: base.mint,
        amount: BigInt(buyRaydium.data.otherAmountThreshold || buyRaydium.data.outputAmount),
        slippageBps: env.SCANNER_SLIPPAGE_BPS
      });
      routes.push(
        buildRouteRow({
          market: `${base.symbol}/${token.symbol}/${base.symbol}`,
          buyVenue: "raydium",
          sellVenue: "orca",
          inputAmount: base.amount,
          finalAmount: BigInt(sellOrca.otherAmountThreshold),
          baseDecimals: base.decimals,
          baseUsd: tokenUsd[base.symbol],
          solUsd: tokenUsd.SOL,
          priorityFeeLamports
        })
      );
    } catch (error) {
      routes.push({
        market: `${base.symbol}/${token.symbol}/${base.symbol}`,
        buyVenue: "raydium",
        sellVenue: "orca",
        error: error instanceof Error ? error.message : String(error)
      });
    }

    try {
      const buyOrca = await orca.getQuote({
        inputMint: base.mint,
        outputMint: token.id,
        amount: base.amount,
        slippageBps: env.SCANNER_SLIPPAGE_BPS
      });
      const sellRaydium = await raydium.getQuote({
        inputMint: token.id,
        outputMint: base.mint,
        amount: BigInt(buyOrca.otherAmountThreshold),
        slippageBps: env.SCANNER_SLIPPAGE_BPS
      });
      routes.push(
        buildRouteRow({
          market: `${base.symbol}/${token.symbol}/${base.symbol}`,
          buyVenue: "orca",
          sellVenue: "raydium",
          inputAmount: base.amount,
          finalAmount: BigInt(sellRaydium.data.otherAmountThreshold || sellRaydium.data.outputAmount),
          baseDecimals: base.decimals,
          baseUsd: tokenUsd[base.symbol],
          solUsd: tokenUsd.SOL,
          priorityFeeLamports
        })
      );
    } catch (error) {
      routes.push({
        market: `${base.symbol}/${token.symbol}/${base.symbol}`,
        buyVenue: "orca",
        sellVenue: "raydium",
        error: error instanceof Error ? error.message : String(error)
      });
    }

    rows.push(...routes);
  }

  return rows;
}

function buildRouteRow(params: {
  market: string;
  buyVenue: string;
  sellVenue: string;
  inputAmount: bigint;
  finalAmount: bigint;
  baseDecimals: number;
  baseUsd: number;
  solUsd: number;
  priorityFeeLamports: bigint;
}): Record<string, unknown> {
  return {
    market: params.market,
    buyVenue: params.buyVenue,
    sellVenue: params.sellVenue,
    inputAmountRaw: params.inputAmount.toString(),
    finalAmountRaw: params.finalAmount.toString(),
    netProfitRaw: (params.finalAmount - params.inputAmount).toString(),
    netProfitUsd: conservativeNetProfitUsd({
      finalOutRaw: params.finalAmount,
      principalRaw: params.inputAmount,
      rawDecimals: params.baseDecimals,
      tokenUsd: params.baseUsd,
      priorityFeeLamports: params.priorityFeeLamports,
      jitoTipLamports: DEFAULT_JITO_TIP_LAMPORTS,
      rpcFeeLamports: BASE_RPC_FEE_LAMPORTS,
      solUsd: params.solUsd,
      safetyBufferUsd: env.SAFETY_BUFFER_USD
    })
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
