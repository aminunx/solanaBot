import type { Connection } from "@solana/web3.js";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.SOLANA_RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
process.env.JITO_BLOCK_ENGINE_URL = process.env.JITO_BLOCK_ENGINE_URL ?? "https://mainnet.block-engine.jito.wtf/api/v1";

vi.mock("../src/adapters/solanaRpc.js", () => ({
  getMedianPriorityFeeLamports: vi.fn().mockResolvedValue(5_000n)
}));

let TOKENS: typeof import("../src/config/addresses.js").TOKENS;
let scanRoundTrips: typeof import("../src/scanners/roundTripScanner.js").scanRoundTrips;

beforeAll(async () => {
  ({ TOKENS } = await import("../src/config/addresses.js"));
  ({ scanRoundTrips } = await import("../src/scanners/roundTripScanner.js"));
});

describe("scanRoundTrips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a direct-venue candidate when Raydium and Orca disagree enough", async () => {
    const jupiter = {
      deriveTokenUsdPrices: vi.fn().mockResolvedValue({
        SOL: 80,
        USDC: 1
      }),
      getQuote: vi.fn()
    };

    const raydium = {
      getQuote: vi.fn().mockImplementation(async (params: { inputMint: string; outputMint: string; amount: bigint }) => {
        if (params.inputMint === TOKENS.USDC.mint && params.outputMint === TOKENS.SOL.mint) {
          return {
            id: "1",
            success: true,
            version: "V1",
            data: {
              inputMint: params.inputMint,
              outputMint: params.outputMint,
              inputAmount: params.amount.toString(),
              outputAmount: "10750000",
              otherAmountThreshold: "10740000",
              slippageBps: 10,
              priceImpactPct: 0,
              routePlan: []
            }
          };
        }

        if (params.inputMint === TOKENS.SOL.mint && params.outputMint === TOKENS.USDC.mint) {
          return {
            id: "2",
            success: true,
            version: "V1",
            data: {
              inputMint: params.inputMint,
              outputMint: params.outputMint,
              inputAmount: params.amount.toString(),
              outputAmount: "808000",
              otherAmountThreshold: "807000",
              slippageBps: 10,
              priceImpactPct: 0,
              routePlan: []
            }
          };
        }

        throw new Error("unsupported raydium quote");
      })
    };

    const orca = {
      getQuote: vi.fn().mockImplementation(async (params: { inputMint: string; outputMint: string; amount: bigint }) => {
        if (params.inputMint === TOKENS.USDC.mint && params.outputMint === TOKENS.SOL.mint) {
          return {
            poolAddress: "pool",
            inputMint: params.inputMint,
            outputMint: params.outputMint,
            inAmount: params.amount.toString(),
            outAmount: "10760000",
            otherAmountThreshold: "10750000"
          };
        }

        if (params.inputMint === TOKENS.SOL.mint && params.outputMint === TOKENS.USDC.mint) {
          return {
            poolAddress: "pool",
            inputMint: params.inputMint,
            outputMint: params.outputMint,
            inAmount: params.amount.toString(),
            outAmount: "808500",
            otherAmountThreshold: "807500"
          };
        }

        throw new Error("unsupported orca quote");
      })
    };

    const result = await scanRoundTrips({
      connection: {} as Connection,
      jupiter: jupiter as never,
      raydium: raydium as never,
      orca: orca as never
    });

    expect(result.best).not.toBeNull();
    expect(result.best?.buyVenue).toBe("raydium");
    expect(result.best?.sellVenue).toBe("orca");
    expect(result.best?.netProfitUsd).toBeGreaterThan(0);
  });
});
