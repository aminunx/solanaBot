import { TOKENS } from "../config/addresses.js";
import { env } from "../config/env.js";
import type { JupiterQuote } from "../types.js";

export class JupiterClient {
  constructor(private readonly baseUrl: string) {}

  async getQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: bigint;
    slippageBps: number;
  }): Promise<JupiterQuote> {
    const url = new URL("/swap/v1/quote", this.baseUrl);
    url.searchParams.set("inputMint", params.inputMint);
    url.searchParams.set("outputMint", params.outputMint);
    url.searchParams.set("amount", params.amount.toString());
    url.searchParams.set("slippageBps", params.slippageBps.toString());

    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Jupiter quote HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<JupiterQuote>;
  }

  async deriveTokenUsdPrices(): Promise<Record<string, number>> {
    const [solUsdc, jupUsdc, bonkUsdc] = await Promise.all([
      this.getQuote({
        inputMint: TOKENS.SOL.mint,
        outputMint: TOKENS.USDC.mint,
        amount: 1_000_000_000n,
        slippageBps: env.SCANNER_SLIPPAGE_BPS
      }),
      this.getQuote({
        inputMint: TOKENS.JUP.mint,
        outputMint: TOKENS.USDC.mint,
        amount: 1_000_000n,
        slippageBps: env.SCANNER_SLIPPAGE_BPS
      }),
      this.getQuote({
        inputMint: TOKENS.BONK.mint,
        outputMint: TOKENS.USDC.mint,
        amount: 100_000_000n,
        slippageBps: env.SCANNER_SLIPPAGE_BPS
      })
    ]);

    return {
      SOL: Number(solUsdc.outAmount) / 1_000_000,
      USDC: 1,
      JUP: Number(jupUsdc.outAmount) / 1_000_000,
      BONK: Number(bonkUsdc.outAmount) / 1_000_000 / 1000
    };
  }
}
