import type { BonusProjectionPoint, ForecastInterval } from "@fleetweather/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import { computeBonus } from "../engine/bonus.js";
import { pool } from "../db/pool.js";
import {
  approveRecommendation,
  InvalidTransitionError,
  overrideBonus,
  recomputeZone,
  ValidationError,
} from "../services/recommendations.js";
import { ok, notFound, zoneFromRow, type ZoneRow } from "./helpers.js";

/**
 * /api/v1 routes (SPEC §7.1). Reads expose the Zone's *active* Bonus
 * Recommendation (published or pending approval) plus its lifecycle fields;
 * writes are the demo's live beats: trigger a recompute, override, approve.
 */
export async function zoneRoutes(app: FastifyInstance): Promise<void> {
  // GET /zones — active zones.
  app.get("/zones", async () => {
    const { rows } = await pool.query(
      `SELECT id, name, city, lat, lon, base_delivery_rate_cop, active
         FROM zones WHERE active ORDER BY name`,
    );
    return ok(rows);
  });

  // GET /zones/recommendations/all — city-wide active bonus per zone.
  app.get("/zones/recommendations/all", async () => {
    const { rows } = await pool.query(
      `SELECT z.id AS zone_id, z.name, z.city, z.lat, z.lon,
              z.base_delivery_rate_cop,
              r.rain_intensity, r.recommended_bonus_cop, r.expected_supply_gap,
              r.demand_multiplier, r.confidence_pct, r.status, r.origin, r.pinned,
              r.valid_until
         FROM zones z
         LEFT JOIN LATERAL (
           SELECT * FROM bonus_recommendations br
            WHERE br.zone_id = z.id AND br.status IN ('published','pending_approval')
            ORDER BY (br.status = 'published') DESC, br.created_at DESC LIMIT 1
         ) r ON TRUE
        WHERE z.active
        ORDER BY r.recommended_bonus_cop DESC NULLS LAST, z.name`,
    );
    return ok(rows);
  });

  // GET /zones/:id/forecast/latest — most recent rain forecast.
  app.get<{ Params: { id: string } }>(
    "/zones/:id/forecast/latest",
    async (req, reply) => {
      const { rows } = await pool.query(
        `SELECT * FROM forecast_results
          WHERE zone_id = $1 ORDER BY generated_at DESC LIMIT 1`,
        [req.params.id],
      );
      if (rows.length === 0) return reply.code(404).send(notFound("No forecast for zone"));
      return ok(rows[0]);
    },
  );

  // GET /zones/:id/recommendation/current — the Zone's active bonus recommendation.
  app.get<{ Params: { id: string } }>(
    "/zones/:id/recommendation/current",
    async (req, reply) => {
      const { rows } = await pool.query(
        `SELECT br.*, z.name AS zone_name, z.city, z.base_delivery_rate_cop,
                (z.config->>'max_bonus_cop')::int AS max_bonus_cop
           FROM bonus_recommendations br
           JOIN zones z ON z.id = br.zone_id
          WHERE br.zone_id = $1 AND br.status IN ('published','pending_approval')
          ORDER BY (br.status = 'published') DESC, br.created_at DESC LIMIT 1`,
        [req.params.id],
      );
      if (rows.length === 0)
        return reply.code(404).send(notFound("No recommendation for zone"));
      return ok(rows[0]);
    },
  );

  // GET /zones/:id/recommendation/forecast — 72h bonus projection.
  app.get<{ Params: { id: string } }>(
    "/zones/:id/recommendation/forecast",
    async (req, reply) => {
      const zoneRes = await pool.query<ZoneRow>(
        `SELECT id, name, city, lat, lon, base_delivery_rate_cop, config, active
           FROM zones WHERE id = $1`,
        [req.params.id],
      );
      if (zoneRes.rows.length === 0)
        return reply.code(404).send(notFound("Zone not found"));

      const fcRes = await pool.query<{ intervals: ForecastInterval[] }>(
        `SELECT intervals FROM forecast_results
          WHERE zone_id = $1 ORDER BY generated_at DESC LIMIT 1`,
        [req.params.id],
      );
      if (fcRes.rows.length === 0)
        return reply.code(404).send(notFound("No forecast for zone"));

      const zone = zoneFromRow(zoneRes.rows[0]!);
      const projection: BonusProjectionPoint[] = fcRes.rows[0]!.intervals.map((iv) => {
        const hour = new Date(iv.timestamp).getHours();
        const bonus = computeBonus({
          zone,
          hour,
          rainIntensity: iv.rain_intensity,
          confidencePct: iv.confidence_pct,
        });
        return {
          timestamp: iv.timestamp,
          rain_intensity: iv.rain_intensity,
          precipitation_mm: iv.precipitation_mm,
          recommended_bonus_cop: bonus.recommended_bonus_cop,
          confidence_pct: iv.confidence_pct,
        };
      });
      return ok(projection);
    },
  );

  // POST /zones/:id/recommendation/trigger — force a recompute now (demo beat).
  app.post<{ Params: { id: string } }>(
    "/zones/:id/recommendation/trigger",
    async (req, reply) => {
      const result = await recomputeZone(req.params.id);
      if (!result) return reply.code(404).send(notFound("Zone not found or inactive"));
      return ok(result.recommendation);
    },
  );

  // POST /zones/:id/recommendation/override — Ops pins a manual bonus.
  app.post<{ Params: { id: string }; Body: { recommended_bonus_cop?: number } }>(
    "/zones/:id/recommendation/override",
    async (req, reply) => {
      const bonus = req.body?.recommended_bonus_cop;
      if (typeof bonus !== "number")
        return reply.code(400).send(notFound("recommended_bonus_cop (number) is required"));
      try {
        const rec = await overrideBonus(req.params.id, bonus);
        return ok(rec);
      } catch (err) {
        return mapServiceError(err, reply);
      }
    },
  );

  // POST /zones/:id/recommendation/approve — Ops approves the pending bonus.
  app.post<{ Params: { id: string } }>(
    "/zones/:id/recommendation/approve",
    async (req, reply) => {
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM bonus_recommendations
          WHERE zone_id = $1 AND status = 'pending_approval'
          ORDER BY created_at DESC LIMIT 1`,
        [req.params.id],
      );
      if (rows.length === 0)
        return reply.code(404).send(notFound("No pending recommendation to approve"));
      try {
        const rec = await approveRecommendation(rows[0]!.id);
        return ok(rec);
      } catch (err) {
        return mapServiceError(err, reply);
      }
    },
  );
}

function mapServiceError(err: unknown, reply: FastifyReply) {
  if (err instanceof ValidationError)
    return reply.code(400).send(notFound(err.message));
  if (err instanceof InvalidTransitionError)
    return reply.code(409).send(notFound(err.message));
  throw err;
}
