import type { FastifyBaseLogger } from "fastify";
import { recomputeAll } from "./services/recommendations.js";

/**
 * In-process recompute scheduler (ADR-0003). Re-anchors every Zone's forecast to
 * the current time and reapplies the lifecycle on a fast cadence, so the dashboard
 * stays alive without BullMQ. Returns a stop function.
 */
export function startScheduler(intervalSec: number, log: FastifyBaseLogger): () => void {
  const tick = async () => {
    try {
      const n = await recomputeAll();
      log.info(`recompute cycle complete (${n} zones)`);
    } catch (err) {
      log.error({ err }, "recompute cycle failed");
    }
  };
  const timer = setInterval(tick, intervalSec * 1000);
  timer.unref?.(); // don't keep the process alive just for the timer
  log.info(`scheduler started: recompute every ${intervalSec}s`);
  return () => clearInterval(timer);
}
