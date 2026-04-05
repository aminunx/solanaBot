import { address, createSolanaRpc, generateKeyPairSigner } from "@solana/kit";
import { setWhirlpoolsConfig, swapInstructions } from "@orca-so/whirlpools";

type OrcaPool = {
  address: string;
  tokenMintA: string;
  tokenMintB: string;
  tvlUsdc?: string;
};

export type OrcaQuote = {
  poolAddress: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
};

export class OrcaClient {
  private readonly rpc;
  private readonly signerPromise = generateKeyPairSigner();
  private readonly poolCache = new Map<string, OrcaPool | null>();
  private readonly configPromise = setWhirlpoolsConfig("solanaMainnet");

  constructor(
    private readonly apiBaseUrl: string,
    private readonly rpcUrl: string
  ) {
    this.rpc = createSolanaRpc(rpcUrl);
  }

  async getQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: bigint;
    slippageBps: number;
  }): Promise<OrcaQuote> {
    const pool = await this.findExactPool(params.inputMint, params.outputMint);
    if (!pool) {
      throw new Error(`No exact Orca pool for ${params.inputMint}/${params.outputMint}`);
    }

    await this.configPromise;
    const signer = await this.signerPromise;
    const result = await swapInstructions(
      this.rpc,
      {
        inputAmount: params.amount,
        mint: address(params.inputMint)
      },
      address(pool.address),
      params.slippageBps,
      signer
    );

    const minOut = result.quote.tokenMinOut ?? result.quote.tokenEstOut;
    return {
      poolAddress: pool.address,
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inAmount: params.amount.toString(),
      outAmount: result.quote.tokenEstOut.toString(),
      otherAmountThreshold: minOut.toString()
    };
  }

  private async findExactPool(inputMint: string, outputMint: string): Promise<OrcaPool | null> {
    const cacheKey = canonicalPairKey(inputMint, outputMint);
    if (this.poolCache.has(cacheKey)) {
      return this.poolCache.get(cacheKey) ?? null;
    }

    const url = new URL("pools/search", ensureTrailingSlash(this.apiBaseUrl));
    url.searchParams.set("tokenA", inputMint);
    url.searchParams.set("tokenB", outputMint);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Orca pool search HTTP ${response.status}: ${await response.text()}`);
    }

    const payload = (await response.json()) as { data?: OrcaPool[] };
    const exactPool =
      (payload.data ?? [])
        .filter((pool) => pairMatches(pool, inputMint, outputMint))
        .sort((left, right) => Number(right.tvlUsdc ?? 0) - Number(left.tvlUsdc ?? 0))[0] ?? null;

    this.poolCache.set(cacheKey, exactPool);
    return exactPool;
  }
}

function canonicalPairKey(inputMint: string, outputMint: string): string {
  return [inputMint, outputMint].sort().join(":");
}

function pairMatches(pool: OrcaPool, inputMint: string, outputMint: string): boolean {
  const poolTokens = [pool.tokenMintA, pool.tokenMintB].sort();
  const target = [inputMint, outputMint].sort();
  return poolTokens[0] === target[0] && poolTokens[1] === target[1];
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
