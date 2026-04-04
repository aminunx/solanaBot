import { ROUND_TRIP_MARKETS, TOKENS, type RoundTripMarket } from "../config/addresses.js";
import { env } from "../config/env.js";
import { JupiterClient } from "../adapters/jupiterClient.js";
import { getMedianPriorityFeeLamports } from "../adapters/solanaRpc.js";
import { conservativeNetProfitUsd } from "../math/profit.js";
import type { RoundTripCandidate, TokenUsdPrices } from "../types.js";
import type { Connection } from "@solana/web3.js";

const BASE_RPC_FEE_LAMPORTS = 5_000n;
const DEFAULT_JITO_TIP_LAMPORTS = 1_000n;

export async function scanRoundTrips(params: {
  connection: Connection;
  jupiter: JupiterClient;
}): Promise<{
  checkedAt: string;
  tokenUsd: TokenUsdPrices;
  rows: RoundTripCandidate[];
  best: RoundTripCandidate | null;
}> {
  const tokenUsd = await params.jupiter.deriveTokenUsdPrices();
  const tasks = ROUND_TRIP_MARKETS.flatMap((market) =>
    amountsForMarket(market).map((amount) => scanSingleMarket(params.connection, params.jupiter, market, amount, tokenUsd))
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
  connection: Connection,
  jupiter: JupiterClient,
  market: RoundTripMarket,
  inputAmount: bigint,
  tokenUsd: TokenUsdPrices
): Promise<RoundTripCandidate | null> {
  const inputToken = TOKENS[market.inputSymbol];
  const midToken = TOKENS[market.midSymbol];
  try {
    const [buyQuote, priorityFeeLamports] = await Promise.all([
      jupiter.getQuote({
        inputMint: inputToken.mint,
        outputMint: midToken.mint,
        amount: inputAmount,
        slippageBps: env.SCANNER_SLIPPAGE_BPS
      }),
      getMedianPriorityFeeLamports(connection)
    ]);

    const midAmount = BigInt(buyQuote.outAmount);
    if (midAmount <= 0n) {
      return null;
    }

    const sellQuote = await jupiter.getQuote({
      inputMint: midToken.mint,
      outputMint: inputToken.mint,
      amount: midAmount,
      slippageBps: env.SCANNER_SLIPPAGE_BPS
    });

    const finalAmount = BigInt(sellQuote.outAmount);
    const netProfitUsd = conservativeNetProfitUsd({
      finalOutRaw: finalAmount,
      principalRaw: inputAmount,
      rawDecimals: inputToken.decimals,
      tokenUsd: tokenUsd[inputToken.symbol],
      priorityFeeLamports,
      jitoTipLamports: DEFAULT_JITO_TIP_LAMPORTS,
      rpcFeeLamports: BASE_RPC_FEE_LAMPORTS,
      solUsd: tokenUsd.SOL,
      safetyBufferUsd: env.SAFETY_BUFFER_USD
    });

    if (netProfitUsd < env.MIN_NET_PROFIT_USD) {
      return null;
    }

    return {
      marketId: market.id,
      market: market.label,
      inputSymbol: inputToken.symbol,
      midSymbol: midToken.symbol,
      inputAmountRaw: inputAmount.toString(),
      midAmountRaw: midAmount.toString(),
      finalAmountRaw: finalAmount.toString(),
      priorityFeeLamports: priorityFeeLamports.toString(),
      rpcFeeLamports: BASE_RPC_FEE_LAMPORTS.toString(),
      jitoTipLamports: DEFAULT_JITO_TIP_LAMPORTS.toString(),
      netProfitRaw: (finalAmount - inputAmount).toString(),
      netProfitUsd
    };
  } catch {
    return null;
  }
}

function amountsForMarket(market: RoundTripMarket): bigint[] {
  if (market.inputSymbol === "USDC") {
    return parseBigints(env.SCAN_USDC_INPUTS);
  }
  return parseBigints(env.SCAN_SOL_INPUTS_LAMPORTS);
}

function parseBigints(raw: string): bigint[] {
  return raw.split(",").map((value) => value.trim()).filter(Boolean).map((value) => BigInt(value));
}
