import BN from "bn.js";
import { Connection, PublicKey } from "@solana/web3.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

type MeteoraToken = {
  address: string;
  symbol?: string;
  decimals: number;
};

type MeteoraPool = {
  address: string;
  token_x: MeteoraToken;
  token_y: MeteoraToken;
  tvl?: number;
  volume?: {
    "24h"?: number;
  };
  is_blacklisted?: boolean;
};

export type MeteoraQuote = {
  poolAddress: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
};

type CachedPool = {
  pool: MeteoraPool;
  dlmm: MeteoraSdkInstance;
};

type MeteoraSdkInstance = {
  getBinArrayForSwap(swapForY: boolean): Promise<unknown[]>;
  swapQuote(
    inAmount: BN,
    swapForY: boolean,
    allowedSlippage: BN,
    binArrays: unknown[]
  ): {
    outAmount: { toString(): string };
    minOutAmount: { toString(): string };
  };
};

type MeteoraSdkStatic = {
  create(connection: Connection, pool: PublicKey): Promise<MeteoraSdkInstance>;
};

let meteoraSdkOverride: MeteoraSdkStatic | null = null;

export class MeteoraClient {
  private readonly connection: Connection;
  private readonly poolCache = new Map<string, CachedPool | null>();

  constructor(
    private readonly apiBaseUrl: string,
    rpcUrl: string
  ) {
    this.connection = createChunkSafeConnection(rpcUrl);
  }

  async getQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: bigint;
    slippageBps: number;
  }): Promise<MeteoraQuote> {
    const cachedPool = await this.findBestPool(params.inputMint, params.outputMint);
    if (!cachedPool) {
      throw new Error(`No Meteora DLMM pool for ${params.inputMint}/${params.outputMint}`);
    }

    const swapForY = resolveSwapDirection(cachedPool.pool, params.inputMint, params.outputMint);
    const binArrays = await cachedPool.dlmm.getBinArrayForSwap(swapForY);
    const quote = cachedPool.dlmm.swapQuote(
      new BN(params.amount.toString()),
      swapForY,
      new BN(params.slippageBps),
      binArrays
    );

    return {
      poolAddress: cachedPool.pool.address,
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inAmount: params.amount.toString(),
      outAmount: quote.outAmount.toString(),
      otherAmountThreshold: quote.minOutAmount.toString()
    };
  }

  private async findBestPool(inputMint: string, outputMint: string): Promise<CachedPool | null> {
    const cacheKey = canonicalPairKey(inputMint, outputMint);
    if (this.poolCache.has(cacheKey)) {
      return this.poolCache.get(cacheKey) ?? null;
    }

    const url = new URL("pools", ensureTrailingSlash(this.apiBaseUrl));
    url.searchParams.set("page_size", "20");
    url.searchParams.set("sort_by", "volume_24h:desc");
    url.searchParams.set(
      "filter_by",
      `is_blacklisted=false && token_x=[${inputMint}|${outputMint}] && token_y=[${inputMint}|${outputMint}]`
    );

    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Meteora pools HTTP ${response.status}: ${await response.text()}`);
    }

    const payload = (await response.json()) as { data?: MeteoraPool[] };
    const exactPool =
      (payload.data ?? [])
        .filter((pool) => pairMatches(pool, inputMint, outputMint))
        .sort(comparePools)[0] ?? null;

    if (!exactPool) {
      this.poolCache.set(cacheKey, null);
      return null;
    }

    const dlmm = await getMeteoraSdk().create(this.connection, new PublicKey(exactPool.address));
    const cachedPool = {
      pool: exactPool,
      dlmm
    };
    this.poolCache.set(cacheKey, cachedPool);
    return cachedPool;
  }
}

export function __setMeteoraSdkForTests(sdk: MeteoraSdkStatic | null): void {
  meteoraSdkOverride = sdk;
}

function resolveSwapDirection(pool: MeteoraPool, inputMint: string, outputMint: string): boolean {
  if (pool.token_x.address === inputMint && pool.token_y.address === outputMint) {
    return true;
  }

  if (pool.token_y.address === inputMint && pool.token_x.address === outputMint) {
    return false;
  }

  throw new Error(`Pool ${pool.address} does not match ${inputMint}/${outputMint}`);
}

function canonicalPairKey(inputMint: string, outputMint: string): string {
  return [inputMint, outputMint].sort().join(":");
}

function pairMatches(pool: MeteoraPool, inputMint: string, outputMint: string): boolean {
  const poolTokens = [pool.token_x.address, pool.token_y.address].sort();
  const target = [inputMint, outputMint].sort();
  return poolTokens[0] === target[0] && poolTokens[1] === target[1];
}

function comparePools(left: MeteoraPool, right: MeteoraPool): number {
  const volumeDelta = Number(right.volume?.["24h"] ?? 0) - Number(left.volume?.["24h"] ?? 0);
  if (volumeDelta !== 0) {
    return volumeDelta;
  }

  return Number(right.tvl ?? 0) - Number(left.tvl ?? 0);
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function getMeteoraSdk(): MeteoraSdkStatic {
  if (meteoraSdkOverride) {
    return meteoraSdkOverride;
  }

  const loaded = require("@meteora-ag/dlmm") as {
    default?: MeteoraSdkStatic;
    create?: MeteoraSdkStatic["create"];
  };

  if (loaded.default?.create) {
    return loaded.default;
  }

  if (loaded.create) {
    return loaded as MeteoraSdkStatic;
  }

  throw new Error("Failed to load Meteora DLMM SDK");
}

function createChunkSafeConnection(rpcUrl: string): Connection {
  const connection = new Connection(rpcUrl, "confirmed");
  const originalGetMultipleAccountsInfo = connection.getMultipleAccountsInfo.bind(connection);

  connection.getMultipleAccountsInfo = (async (publicKeys: PublicKey[], commitmentOrConfig?: unknown) => {
    if (publicKeys.length <= 10) {
      return originalGetMultipleAccountsInfo(publicKeys, commitmentOrConfig as never);
    }

    const results = [];
    for (let index = 0; index < publicKeys.length; index += 10) {
      const chunk = publicKeys.slice(index, index + 10);
      results.push(...(await originalGetMultipleAccountsInfo(chunk, commitmentOrConfig as never)));
    }
    return results;
  }) as Connection["getMultipleAccountsInfo"];

  return connection;
}
