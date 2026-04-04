export function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / 1_000_000_000;
}

export function unitsToToken(amount: bigint, decimals: number): number {
  return Number(amount) / 10 ** decimals;
}

export function conservativeNetProfitUsd(params: {
  finalOutRaw: bigint;
  principalRaw: bigint;
  rawDecimals: number;
  tokenUsd: number;
  priorityFeeLamports: bigint;
  jitoTipLamports: bigint;
  rpcFeeLamports: bigint;
  solUsd: number;
  safetyBufferUsd: number;
}): number {
  const grossToken = unitsToToken(params.finalOutRaw - params.principalRaw, params.rawDecimals) * params.tokenUsd;
  const feeUsd =
    lamportsToSol(params.priorityFeeLamports + params.jitoTipLamports + params.rpcFeeLamports) * params.solUsd;
  return grossToken - feeUsd - params.safetyBufferUsd;
}
