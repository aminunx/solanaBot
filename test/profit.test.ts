import { describe, expect, it } from "vitest";

import { conservativeNetProfitUsd } from "../src/math/profit.js";

describe("conservativeNetProfitUsd", () => {
  it("subtracts fees and safety buffer from gross edge", () => {
    const result = conservativeNetProfitUsd({
      finalOutRaw: 10_200_000n,
      principalRaw: 10_000_000n,
      rawDecimals: 6,
      tokenUsd: 1,
      priorityFeeLamports: 5_000n,
      jitoTipLamports: 1_000n,
      rpcFeeLamports: 5_000n,
      solUsd: 200,
      safetyBufferUsd: 0.05
    });

    expect(result).toBeGreaterThan(0);
  });
});
