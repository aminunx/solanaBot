export const SOLANA_MAINNET_CHAIN = "solana-mainnet";

export const TOKENS = {
  SOL: {
    symbol: "SOL",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9
  },
  USDC: {
    symbol: "USDC",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6
  }
} as const;

export type TokenSymbol = keyof typeof TOKENS;

export type RoundTripMarket = {
  id: string;
  label: string;
  inputSymbol: TokenSymbol;
  midSymbol: TokenSymbol;
};

export const ROUND_TRIP_MARKETS: RoundTripMarket[] = [
  { id: "sol-usdc-sol", label: "SOL/USDC/SOL", inputSymbol: "SOL", midSymbol: "USDC" },
  { id: "usdc-sol-usdc", label: "USDC/SOL/USDC", inputSymbol: "USDC", midSymbol: "SOL" }
];
