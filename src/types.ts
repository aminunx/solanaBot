export type JupiterQuote = {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold?: string;
  swapMode?: string;
  slippageBps?: number;
  routePlan?: unknown[];
  priceImpactPct?: string;
};

export type TokenUsdPrices = Record<string, number>;
export type ScannerVenue = "jupiter" | "raydium" | "orca";

export type RoundTripCandidate = {
  marketId: string;
  market: string;
  buyVenue: string;
  sellVenue: string;
  inputSymbol: string;
  midSymbol: string;
  inputAmountRaw: string;
  midAmountRaw: string;
  finalAmountRaw: string;
  priorityFeeLamports: string;
  rpcFeeLamports: string;
  jitoTipLamports: string;
  netProfitRaw: string;
  netProfitUsd: number;
};
