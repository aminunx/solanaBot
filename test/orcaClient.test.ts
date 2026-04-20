import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@solana/kit", () => ({
  address: (value: string) => value,
  createSolanaRpc: vi.fn(() => ({})),
  generateKeyPairSigner: vi.fn(async () => ({ address: "signer" }))
}));

vi.mock("@orca-so/whirlpools", () => ({
  setWhirlpoolsConfig: vi.fn(async () => undefined),
  swapInstructions: vi.fn(async () => ({
    quote: {
      tokenEstOut: 200n,
      tokenMinOut: 199n
    }
  }))
}));

import { OrcaClient } from "../src/adapters/orcaClient.js";

describe("OrcaClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("searches pools under the configured Orca API base path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            address: "pool",
            tokenMintA: "in",
            tokenMintB: "out",
            tvlUsdc: "1000"
          }
        ]
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new OrcaClient("https://api.orca.so/v2/solana", "https://solana-rpc.publicnode.com");
    const quote = await client.getQuote({
      inputMint: "in",
      outputMint: "out",
      amount: 100n,
      slippageBps: 10
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.toString()).toBe("https://api.orca.so/v2/solana/pools/search?tokenA=in&tokenB=out");
    expect(quote.otherAmountThreshold).toBe("199");
  });
});
