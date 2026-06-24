import pg from "pg";
import { env } from "../env.js";

/** Shared PostgreSQL connection pool, configured from DATABASE_URL (SPEC §6.1). */
export const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
