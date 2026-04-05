import { afterEach, describe, expect, it, vi } from "vitest";

import { RaydiumClient } from "../src/adapters/raydiumClient.js";

describe("RaydiumClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the official Raydium compute endpoint with base-in parameters", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "quote",
        success: true,
        version: "V1",
        data: {
          inputMint: "in",
          outputMint: "out",
          inputAmount: "100",
          outputAmount: "200",
          otherAmountThreshold: "199",
          slippageBps: 10,
          priceImpactPct: 0,
          routePlan: []
        }
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new RaydiumClient("https://transaction-v1.raydium.io");
    await client.getQuote({
      inputMint: "in",
      outputMint: "out",
      amount: 100n,
      slippageBps: 10
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toContain("https://transaction-v1.raydium.io/compute/swap-base-in");
    expect(url.toString()).toContain("inputMint=in");
    expect(url.toString()).toContain("outputMint=out");
    expect(url.toString()).toContain("amount=100");
    expect(url.toString()).toContain("slippageBps=10");
    expect(url.toString()).toContain("txVersion=V0");
    expect(init.headers).toEqual({ Accept: "application/json" });
  });
});
