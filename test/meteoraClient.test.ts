import { afterEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn(async () => ({
  getBinArrayForSwap: vi.fn(async () => ["bin-array"]),
  swapQuote: vi.fn(() => ({
    outAmount: { toString: () => "250" },
    minOutAmount: { toString: () => "245" }
  }))
}));

import { __setMeteoraSdkForTests, MeteoraClient } from "../src/adapters/meteoraClient.js";

describe("MeteoraClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    createMock.mockClear();
    __setMeteoraSdkForTests(null);
  });

  it("uses the official Meteora pools endpoint and quotes through the SDK", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            address: "5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6",
            token_x: { address: "in", decimals: 6 },
            token_y: { address: "out", decimals: 9 },
            volume: { "24h": 1000 },
            tvl: 2000
          }
        ]
      })
    });

    vi.stubGlobal("fetch", fetchMock);
    __setMeteoraSdkForTests({
      create: createMock
    });

    const client = new MeteoraClient("https://dlmm.datapi.meteora.ag", "https://solana-rpc.publicnode.com");
    const quote = await client.getQuote({
      inputMint: "in",
      outputMint: "out",
      amount: 100n,
      slippageBps: 10
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.toString()).toContain("https://dlmm.datapi.meteora.ag/pools?");
    expect(url.toString()).toContain("sort_by=volume_24h%3Adesc");
    expect(quote.poolAddress).toBe("5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6");
    expect(quote.outAmount).toBe("250");
    expect(quote.otherAmountThreshold).toBe("245");
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});
