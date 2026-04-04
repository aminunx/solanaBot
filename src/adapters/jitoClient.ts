import { env } from "../config/env.js";

export function buildJitoSendTransactionPayload(base64Tx: string): {
  jsonrpc: "2.0";
  id: number;
  method: "sendTransaction";
  params: [string, { encoding: "base64" }];
} {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "sendTransaction",
    params: [base64Tx, { encoding: "base64" }]
  };
}

export async function submitViaJito(base64Tx: string): Promise<unknown> {
  const response = await fetch(`${env.JITO_BLOCK_ENGINE_URL}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.JITO_AUTH_HEADER ? { Authorization: env.JITO_AUTH_HEADER } : {})
    },
    body: JSON.stringify(buildJitoSendTransactionPayload(base64Tx))
  });

  if (!response.ok) {
    throw new Error(`Jito HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json();
}
