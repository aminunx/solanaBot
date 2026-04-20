import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createSolanaConnection, getMedianPriorityFeeLamports } from "../adapters/solanaRpc.js";
import { JupiterClient } from "../adapters/jupiterClient.js";
import { MeteoraClient } from "../adapters/meteoraClient.js";
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
  const meteora = new MeteoraClient(env.METEORA_API_BASE_URL, env.SOLANA_RPC_URL);

  const [tokenUsd, priorityFeeLamports, topTokens] = await Promise.all([
    jupiter.deriveTokenUsdPrices(),
    getMedianPriorityFeeLamports(connection),
    fetchTopTokens()
  ]);

  const rows: Array<Record<string, unknown>> = [];
  for (const token of topTokens) {
    rows.push(...(await evaluateToken(token, raydium, orca, meteora, tokenUsd, priorityFeeLamports)));
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
  meteora: MeteoraClient,
  tokenUsd: Record<string, number>,
  priorityFeeLamports: bigint
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  for (const base of [
    { symbol: "SOL", mint: TOKENS.SOL.mint, amount: 100_000_000n, decimals: TOKENS.SOL.decimals },
    { symbol: "USDC", mint: TOKENS.USDC.mint, amount: 10_000_000n, decimals: TOKENS.USDC.decimals }
  ]) {
    rows.push(
      ...(await evaluateRoute({
        token,
        base,
        buyVenue: "raydium",
        sellVenue: "orca",
        raydium,
        orca,
        meteora,
        tokenUsd,
        priorityFeeLamports
      })),
      ...(await evaluateRoute({
        token,
        base,
        buyVenue: "orca",
        sellVenue: "raydium",
        raydium,
        orca,
        meteora,
        tokenUsd,
        priorityFeeLamports
      })),
      ...(await evaluateRoute({
        token,
        base,
        buyVenue: "raydium",
        sellVenue: "meteora",
        raydium,
        orca,
        meteora,
        tokenUsd,
        priorityFeeLamports
      })),
      ...(await evaluateRoute({
        token,
        base,
        buyVenue: "meteora",
        sellVenue: "raydium",
        raydium,
        orca,
        meteora,
        tokenUsd,
        priorityFeeLamports
      })),
      ...(await evaluateRoute({
        token,
        base,
        buyVenue: "orca",
        sellVenue: "meteora",
        raydium,
        orca,
        meteora,
        tokenUsd,
        priorityFeeLamports
      })),
      ...(await evaluateRoute({
        token,
        base,
        buyVenue: "meteora",
        sellVenue: "orca",
        raydium,
        orca,
        meteora,
        tokenUsd,
        priorityFeeLamports
      }))
    );
  }

  return rows;
}

async function evaluateRoute(params: {
  token: TopToken;
  base: { symbol: string; mint: string; amount: bigint; decimals: number };
  buyVenue: "raydium" | "orca" | "meteora";
  sellVenue: "raydium" | "orca" | "meteora";
  raydium: RaydiumClient;
  orca: OrcaClient;
  meteora: MeteoraClient;
  tokenUsd: Record<string, number>;
  priorityFeeLamports: bigint;
}): Promise<Array<Record<string, unknown>>> {
  try {
    const buyQuote = await quoteOnVenue(params.buyVenue, params, params.base.mint, params.token.id, params.base.amount);
    const sellQuote = await quoteOnVenue(
      params.sellVenue,
      params,
      params.token.id,
      params.base.mint,
      buyQuote.conservativeOutAmount
    );

    return [
      buildRouteRow({
        market: `${params.base.symbol}/${params.token.symbol}/${params.base.symbol}`,
        buyVenue: params.buyVenue,
        sellVenue: params.sellVenue,
        inputAmount: params.base.amount,
        finalAmount: sellQuote.conservativeOutAmount,
        baseDecimals: params.base.decimals,
        baseUsd: params.tokenUsd[params.base.symbol],
        solUsd: params.tokenUsd.SOL,
        priorityFeeLamports: params.priorityFeeLamports
      })
    ];
  } catch (error) {
    return [
      {
        market: `${params.base.symbol}/${params.token.symbol}/${params.base.symbol}`,
        buyVenue: params.buyVenue,
        sellVenue: params.sellVenue,
        error: error instanceof Error ? error.message : String(error)
      }
    ];
  }
}

async function quoteOnVenue(
  venue: "raydium" | "orca" | "meteora",
  clients: {
    raydium: RaydiumClient;
    orca: OrcaClient;
    meteora: MeteoraClient;
  },
  inputMint: string,
  outputMint: string,
  amount: bigint
): Promise<{ conservativeOutAmount: bigint }> {
  if (venue === "raydium") {
    const quote = await clients.raydium.getQuote({
      inputMint,
      outputMint,
      amount,
      slippageBps: env.SCANNER_SLIPPAGE_BPS
    });
    return {
      conservativeOutAmount: BigInt(quote.data.otherAmountThreshold || quote.data.outputAmount)
    };
  }

  if (venue === "orca") {
    const quote = await clients.orca.getQuote({
      inputMint,
      outputMint,
      amount,
      slippageBps: env.SCANNER_SLIPPAGE_BPS
    });
    return {
      conservativeOutAmount: BigInt(quote.otherAmountThreshold || quote.outAmount)
    };
  }

  const quote = await clients.meteora.getQuote({
    inputMint,
    outputMint,
    amount,
    slippageBps: env.SCANNER_SLIPPAGE_BPS
  });
  return {
    conservativeOutAmount: BigInt(quote.otherAmountThreshold || quote.outAmount)
  };
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
