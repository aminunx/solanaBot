export type RaydiumQuote = {
  id: string;
  success: boolean;
  version: string;
  data: {
    inputMint: string;
    outputMint: string;
    inputAmount: string;
    outputAmount: string;
    otherAmountThreshold: string;
    slippageBps: number;
    priceImpactPct: number;
    routePlan: unknown[];
  };
};

export class RaydiumClient {
  constructor(private readonly baseUrl: string) {}

  async getQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: bigint;
    slippageBps: number;
  }): Promise<RaydiumQuote> {
    const url = new URL("/compute/swap-base-in", this.baseUrl);
    url.searchParams.set("inputMint", params.inputMint);
    url.searchParams.set("outputMint", params.outputMint);
    url.searchParams.set("amount", params.amount.toString());
    url.searchParams.set("slippageBps", params.slippageBps.toString());
    url.searchParams.set("txVersion", "V0");

    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Raydium quote HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<RaydiumQuote>;
  }
}
