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
  },
  JUP: {
    symbol: "JUP",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    decimals: 6
  },
  BONK: {
    symbol: "BONK",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6B2kY4B1pPB263",
    decimals: 5
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
  { id: "usdc-sol-usdc", label: "USDC/SOL/USDC", inputSymbol: "USDC", midSymbol: "SOL" },
  { id: "sol-jup-sol", label: "SOL/JUP/SOL", inputSymbol: "SOL", midSymbol: "JUP" },
  { id: "sol-bonk-sol", label: "SOL/BONK/SOL", inputSymbol: "SOL", midSymbol: "BONK" }
];
