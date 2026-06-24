import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { env } from "./env.js";
import { pool } from "./db/pool.js";
import { zoneRoutes } from "./routes/zones.js";
import { startScheduler } from "./scheduler.js";
import { connectionCount, subscribe } from "./ws.js";

/**
 * FleetWeather API bootstrap.
 *
 * Demo build (ADR-0001/0003): Postgres only (no Redis), an in-process recompute
 * scheduler (no BullMQ), a single static bearer key on every REST endpoint except
 * /health, and a read-only WebSocket feed.
 */
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(websocket);

// ── Auth: static bearer key on everything except /health and the WS feed ──
// The WS feed is read-only public bonus data, so it stays open; Ops mutations go
// through the REST endpoints, which the web app calls server-side with the key.
app.addHook("onRequest", async (req, reply) => {
  if (req.url === "/health" || req.url.startsWith("/ws/")) return;
  const header = req.headers.authorization;
  if (header !== `Bearer ${env.API_KEY}`) {
    return reply.code(401).send({
      success: false,
      error: "missing or invalid API key",
      meta: { generated_at: new Date().toISOString(), cache_hit: false },
    });
  }
});

await app.register(zoneRoutes, { prefix: "/api/v1" });

// ── WebSocket feed (SPEC §7.2) ──
app.get("/ws/v1", { websocket: true }, (socket) => {
  const unsubscribe = subscribe(socket, null);
  socket.on("close", unsubscribe);
});
app.get<{ Params: { id: string } }>(
  "/ws/v1/zones/:id",
  { websocket: true },
  (socket, req) => {
    const unsubscribe = subscribe(socket, req.params.id);
    socket.on("close", unsubscribe);
  },
);

app.get("/health", async () => {
  let db = false;
  try {
    await pool.query("SELECT 1");
    db = true;
  } catch (err) {
    app.log.error({ err }, "health: postgres check failed");
  }
  return {
    success: db,
    data: { status: db ? "ok" : "degraded", db, ws_connections: connectionCount() },
    meta: { generated_at: new Date().toISOString(), cache_hit: false },
  };
});

try {
  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
  const stopScheduler = startScheduler(env.RECOMPUTE_INTERVAL_SEC, app.log);
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      stopScheduler();
      app.close().then(() => process.exit(0));
    });
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
