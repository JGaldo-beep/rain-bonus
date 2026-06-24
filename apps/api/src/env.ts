import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Load the monorepo-root .env for local dev. In containers/prod the file is
// absent and real environment variables are used instead, so a miss is fine.
const repoRootEnv = join(dirname(fileURLToPath(import.meta.url)), "../../../.env");
try {
  process.loadEnvFile(repoRootEnv);
} catch {
  // no .env file — rely on the ambient environment
}

/**
 * Validated environment configuration.
 *
 * Required vars fail fast on boot so misconfiguration surfaces immediately. This
 * is the demo build (ADR-0001/0003): no Redis, no BullMQ, no JWT — just Postgres,
 * a single static bearer API key, and the in-process recompute interval.
 */
const envSchema = z.object({
  // Datastore
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // API
  API_PORT: z.coerce.number().int().positive().default(3000),

  // Auth — a single static bearer key gates every endpoint except /health
  // (ADR: demo auth). Defaults to a known demo value so the stack runs out of the box.
  API_KEY: z.string().min(1).default("demo-key"),

  // In-process scheduler: how often the recompute cycle runs (ADR-0003). Fast by
  // default so the dashboard feels alive in a demo.
  RECOMPUTE_INTERVAL_SEC: z.coerce.number().int().positive().default(45),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
