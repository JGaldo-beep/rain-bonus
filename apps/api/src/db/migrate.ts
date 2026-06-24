import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

/**
 * Minimal forward-only migration runner.
 *
 * Applies every `*.sql` file in ./migrations (sorted by filename) that has
 * not been recorded in `schema_migrations`, each inside its own transaction.
 * Idempotent: re-running only applies new files. (SPEC §6.1.)
 */
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const { rows } = await pool.query<{ name: string }>(
    "SELECT name FROM schema_migrations",
  );
  const applied = new Set(rows.map((r) => r.name));

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`• skip   ${file} (already applied)`);
      continue;
    }

    const sql = await readFile(join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        file,
      ]);
      await client.query("COMMIT");
      console.log(`✓ apply  ${file}`);
      count++;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`✗ failed ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }

  console.log(
    count === 0 ? "Database already up to date." : `Applied ${count} migration(s).`,
  );
}

migrate()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
