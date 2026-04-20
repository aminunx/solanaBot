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
  cbBTC: {
    symbol: "cbBTC",
    mint: "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij",
    decimals: 8
  },
  TRUMP: {
    symbol: "TRUMP",
    mint: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
    decimals: 6
  },
  PUMP: {
    symbol: "PUMP",
    mint: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
    decimals: 6
  },
  JLP: {
    symbol: "JLP",
    mint: "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4",
    decimals: 6
  },
  Fartcoin: {
    symbol: "Fartcoin",
    mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump",
    decimals: 6
  },
  JUP: {
    symbol: "JUP",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
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
  { id: "usdc-sol-usdc", label: "USDC/SOL/USDC", inputSymbol: "USDC", midSymbol: "SOL" },
  { id: "sol-cbbtc-sol", label: "SOL/cbBTC/SOL", inputSymbol: "SOL", midSymbol: "cbBTC" },
  { id: "usdc-cbbtc-usdc", label: "USDC/cbBTC/USDC", inputSymbol: "USDC", midSymbol: "cbBTC" },
  { id: "sol-trump-sol", label: "SOL/TRUMP/SOL", inputSymbol: "SOL", midSymbol: "TRUMP" },
  { id: "sol-pump-sol", label: "SOL/PUMP/SOL", inputSymbol: "SOL", midSymbol: "PUMP" },
  { id: "sol-jlp-sol", label: "SOL/JLP/SOL", inputSymbol: "SOL", midSymbol: "JLP" },
  { id: "sol-fartcoin-sol", label: "SOL/Fartcoin/SOL", inputSymbol: "SOL", midSymbol: "Fartcoin" },
  { id: "sol-jup-sol", label: "SOL/JUP/SOL", inputSymbol: "SOL", midSymbol: "JUP" }
];
