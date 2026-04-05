import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  BOT_ENV: z.enum(["development", "test", "production"]).default("development"),
  SOLANA_RPC_URL: z.string().url(),
  JITO_BLOCK_ENGINE_URL: z.string().url(),
  JITO_AUTH_HEADER: z.string().default(""),
  JUPITER_API_BASE_URL: z.string().url().default("https://api.jup.ag"),
  JUPITER_API_KEY: z.string().default(""),
  RAYDIUM_API_BASE_URL: z.string().url().default("https://transaction-v1.raydium.io"),
  ORCA_API_BASE_URL: z.string().url().default("https://api.orca.so/v2/solana"),
  METEORA_API_BASE_URL: z.string().url().default("https://dlmm.datapi.meteora.ag"),
  MIN_NET_PROFIT_USD: z.coerce.number().min(0).default(0),
  SAFETY_BUFFER_USD: z.coerce.number().min(0).default(0.05),
  PRIORITY_FEE_MULTIPLIER: z.coerce.number().positive().default(1.2),
  SCAN_SOL_INPUTS_LAMPORTS: z.string().default("10000000,25000000,50000000,100000000"),
  SCAN_USDC_INPUTS: z.string().default("10000000,25000000,50000000,100000000"),
  SCANNER_SLIPPAGE_BPS: z.coerce.number().int().min(0).max(10_000).default(10),
  PRIVATE_SEND_ENABLED: z.coerce.boolean().default(false),
  PRIVATE_SUBMISSION_MODE: z.enum(["jito", "rpc", "noop"]).default("jito"),
  SOLANA_OPERATOR_PRIVATE_KEY: z.string().default("")
});

export type AppEnv = z.infer<typeof envSchema>;
export const env = envSchema.parse(process.env);
