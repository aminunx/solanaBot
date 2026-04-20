import type { Connection } from "@solana/web3.js";

import { JupiterClient } from "../adapters/jupiterClient.js";
import { MeteoraClient, type MeteoraQuote } from "../adapters/meteoraClient.js";
import { OrcaClient, type OrcaQuote } from "../adapters/orcaClient.js";
import { RaydiumClient, type RaydiumQuote } from "../adapters/raydiumClient.js";
import { getMedianPriorityFeeLamports } from "../adapters/solanaRpc.js";
import { ROUND_TRIP_MARKETS, TOKENS, type RoundTripMarket } from "../config/addresses.js";
import { env } from "../config/env.js";
import { conservativeNetProfitUsd } from "../math/profit.js";
import type { JupiterQuote, RoundTripCandidate, ScannerVenue, TokenUsdPrices } from "../types.js";

const BASE_RPC_FEE_LAMPORTS = 5_000n;
const DEFAULT_JITO_TIP_LAMPORTS = 1_000n;
const DIRECT_ROUTES: Array<readonly [ScannerVenue, ScannerVenue]> = [
  ["raydium", "orca"],
  ["orca", "raydium"],
  ["raydium", "meteora"],
  ["meteora", "raydium"],
  ["orca", "meteora"],
  ["meteora", "orca"]
] as const;

type NormalizedQuote = {
  venue: ScannerVenue;
  outAmount: bigint;
  conservativeOutAmount: bigint;
};

export async function scanRoundTrips(params: {
  connection: Connection;
  jupiter: JupiterClient;
  raydium: RaydiumClient;
  orca: OrcaClient;
  meteora: MeteoraClient;
  minNetProfitUsd?: number;
}): Promise<{
  checkedAt: string;
  tokenUsd: TokenUsdPrices;
  rows: RoundTripCandidate[];
  best: RoundTripCandidate | null;
}> {
  const [tokenUsd, priorityFeeLamports] = await Promise.all([
    params.jupiter.deriveTokenUsdPrices(),
    getMedianPriorityFeeLamports(params.connection)
  ]);

  const tasks = ROUND_TRIP_MARKETS.flatMap((market) =>
    amountsForMarket(market).flatMap((amount) =>
      DIRECT_ROUTES.map(([buyVenue, sellVenue]) =>
        scanSingleMarket(params, market, amount, tokenUsd, priorityFeeLamports, buyVenue, sellVenue)
      )
    )
  );

  const results = (await Promise.all(tasks)).filter((value): value is RoundTripCandidate => value !== null);
  results.sort((a, b) => b.netProfitUsd - a.netProfitUsd);

  return {
    checkedAt: new Date().toISOString(),
    tokenUsd,
    rows: results,
    best: results[0] ?? null
  };
}

async function scanSingleMarket(
  clients: {
    jupiter: JupiterClient;
    raydium: RaydiumClient;
    orca: OrcaClient;
    meteora: MeteoraClient;
    minNetProfitUsd?: number;
  },
  market: RoundTripMarket,
  inputAmount: bigint,
  tokenUsd: TokenUsdPrices,
  priorityFeeLamports: bigint,
  buyVenue: ScannerVenue,
  sellVenue: ScannerVenue
): Promise<RoundTripCandidate | null> {
  const inputToken = TOKENS[market.inputSymbol];
  const midToken = TOKENS[market.midSymbol];

  try {
    const buyQuote = await getNormalizedQuote(clients, buyVenue, {
      inputMint: inputToken.mint,
      outputMint: midToken.mint,
      amount: inputAmount,
      slippageBps: env.SCANNER_SLIPPAGE_BPS
    });

    if (buyQuote.conservativeOutAmount <= 0n) {
      return null;
    }

    const sellQuote = await getNormalizedQuote(clients, sellVenue, {
      inputMint: midToken.mint,
      outputMint: inputToken.mint,
      amount: buyQuote.conservativeOutAmount,
      slippageBps: env.SCANNER_SLIPPAGE_BPS
    });

    if (sellQuote.conservativeOutAmount <= 0n) {
      return null;
    }

    const netProfitUsd = conservativeNetProfitUsd({
      finalOutRaw: sellQuote.conservativeOutAmount,
      principalRaw: inputAmount,
      rawDecimals: inputToken.decimals,
      tokenUsd: tokenUsd[inputToken.symbol],
      priorityFeeLamports,
      jitoTipLamports: DEFAULT_JITO_TIP_LAMPORTS,
      rpcFeeLamports: BASE_RPC_FEE_LAMPORTS,
      solUsd: tokenUsd.SOL,
      safetyBufferUsd: env.SAFETY_BUFFER_USD
    });

    if (netProfitUsd < (clients.minNetProfitUsd ?? env.MIN_NET_PROFIT_USD)) {
      return null;
    }

    return {
      marketId: `${market.id}:${buyVenue}->${sellVenue}`,
      market: market.label,
      buyVenue,
      sellVenue,
      inputSymbol: inputToken.symbol,
      midSymbol: midToken.symbol,
      inputAmountRaw: inputAmount.toString(),
      midAmountRaw: buyQuote.conservativeOutAmount.toString(),
      finalAmountRaw: sellQuote.conservativeOutAmount.toString(),
      priorityFeeLamports: priorityFeeLamports.toString(),
      rpcFeeLamports: BASE_RPC_FEE_LAMPORTS.toString(),
      jitoTipLamports: DEFAULT_JITO_TIP_LAMPORTS.toString(),
      netProfitRaw: (sellQuote.conservativeOutAmount - inputAmount).toString(),
      netProfitUsd
    };
  } catch {
    return null;
  }
}

async function getNormalizedQuote(
  clients: {
    jupiter: JupiterClient;
    raydium: RaydiumClient;
    orca: OrcaClient;
    meteora: MeteoraClient;
  },
  venue: ScannerVenue,
  params: {
    inputMint: string;
    outputMint: string;
    amount: bigint;
    slippageBps: number;
  }
): Promise<NormalizedQuote> {
  if (venue === "jupiter") {
    const quote = await clients.jupiter.getQuote(params);
    return normalizeJupiterQuote(quote);
  }

  if (venue === "orca") {
    const quote = await clients.orca.getQuote(params);
    return normalizeOrcaQuote(quote);
  }

  if (venue === "meteora") {
    const quote = await clients.meteora.getQuote(params);
    return normalizeMeteoraQuote(quote);
  }

  const quote = await clients.raydium.getQuote(params);
  return normalizeRaydiumQuote(quote);
}

function normalizeJupiterQuote(quote: JupiterQuote): NormalizedQuote {
  return {
    venue: "jupiter",
    outAmount: BigInt(quote.outAmount),
    conservativeOutAmount: BigInt(quote.otherAmountThreshold ?? quote.outAmount)
  };
}

function normalizeRaydiumQuote(quote: RaydiumQuote): NormalizedQuote {
  return {
    venue: "raydium",
    outAmount: BigInt(quote.data.outputAmount),
    conservativeOutAmount: BigInt(quote.data.otherAmountThreshold || quote.data.outputAmount)
  };
}

function normalizeOrcaQuote(quote: OrcaQuote): NormalizedQuote {
  return {
    venue: "orca",
    outAmount: BigInt(quote.outAmount),
    conservativeOutAmount: BigInt(quote.otherAmountThreshold || quote.outAmount)
  };
}

function normalizeMeteoraQuote(quote: MeteoraQuote): NormalizedQuote {
  return {
    venue: "meteora",
    outAmount: BigInt(quote.outAmount),
    conservativeOutAmount: BigInt(quote.otherAmountThreshold || quote.outAmount)
  };
}

function amountsForMarket(market: RoundTripMarket): bigint[] {
  if (market.inputSymbol === "USDC") {
    return parseBigints(env.SCAN_USDC_INPUTS);
  }

  return parseBigints(env.SCAN_SOL_INPUTS_LAMPORTS);
}

function parseBigints(raw: string): bigint[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => BigInt(value));
}
