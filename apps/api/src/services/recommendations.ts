import type {
  ContributingFactor,
  RainIntensity,
  Zone,
} from "@fleetweather/shared";
import pg from "pg";
import { computeBonus } from "../engine/bonus.js";
import { generateForecast, nearTermPeak, type RainScenario } from "../engine/forecast.js";
import {
  approve as approveTransition,
  classifyNewRecommendation,
  InvalidTransitionError,
  type LiveRecommendation,
} from "../engine/lifecycle.js";
import { pool } from "../db/pool.js";
import { broadcast } from "../ws.js";

/**
 * Recommendation services: the recompute cycle (forecast → bonus → lifecycle)
 * and the Ops actions (override, approve). All persistence and lifecycle
 * transitions live here; the engine modules stay pure (ADR-0002/0005).
 */

const MIN_INCREMENT = 500;
const WINDOW_HOURS = 6; // a "current" recommendation covers the next 6h (SPEC §7.1).

export { InvalidTransitionError };
export class ValidationError extends Error {}

/** A `zones` row whose JSONB config also carries the demo rain scenario. */
interface ZoneRow {
  id: string;
  name: string;
  city: string;
  lat: string;
  lon: string;
  base_delivery_rate_cop: number;
  config: {
    baseline_supply_curve: number[];
    rain_sensitivity: Zone["rain_sensitivity"];
    demand_elasticity: Zone["demand_elasticity"];
    max_bonus_cop: number;
    scenario: RainScenario;
  };
  active: boolean;
}

function zoneFromRow(row: ZoneRow): Zone {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    centroid: { lat: Number(row.lat), lon: Number(row.lon) },
    base_delivery_rate_cop: row.base_delivery_rate_cop,
    baseline_supply_curve: row.config.baseline_supply_curve,
    rain_sensitivity: row.config.rain_sensitivity,
    demand_elasticity: row.config.demand_elasticity,
    max_bonus_cop: row.config.max_bonus_cop,
    active: row.active,
  };
}

/** A persisted recommendation row, as the API returns it. */
export interface RecommendationRow {
  id: string;
  forecast_id: string | null;
  zone_id: string;
  rain_intensity: RainIntensity;
  expected_supply_gap: number;
  demand_multiplier: number;
  recommended_bonus_cop: number;
  confidence_pct: number;
  factors: ContributingFactor[];
  status: string;
  origin: string;
  pinned: boolean;
  valid_from: string;
  valid_until: string;
  created_at: string;
}

async function getZone(zoneId: string): Promise<ZoneRow | null> {
  const { rows } = await pool.query<ZoneRow>(
    `SELECT id, name, city, lat, lon, base_delivery_rate_cop, config, active
       FROM zones WHERE id = $1`,
    [zoneId],
  );
  return rows[0] ?? null;
}

/** The Zone's currently-live (published) recommendation, if any. */
async function getLivePublished(
  client: pg.PoolClient | pg.Pool,
  zoneId: string,
): Promise<(LiveRecommendation & { id: string }) | null> {
  const { rows } = await client.query<{
    id: string;
    status: LiveRecommendation["status"];
    origin: LiveRecommendation["origin"];
    pinned: boolean;
    valid_until: string;
  }>(
    `SELECT id, status, origin, pinned, valid_until
       FROM bonus_recommendations
      WHERE zone_id = $1 AND status = 'published'
      ORDER BY created_at DESC LIMIT 1`,
    [zoneId],
  );
  return rows[0] ?? null;
}

async function getActiveById(id: string): Promise<RecommendationRow | null> {
  const { rows } = await pool.query<RecommendationRow>(
    `SELECT * FROM bonus_recommendations WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

interface InsertInput {
  forecastId: string | null;
  zoneId: string;
  rainIntensity: RainIntensity;
  expectedSupplyGap: number;
  demandMultiplier: number;
  recommendedBonusCop: number;
  confidencePct: number;
  factors: ContributingFactor[];
  status: string;
  origin: string;
  pinned: boolean;
  validFrom: string;
  validUntil: string;
}

async function insertRecommendation(
  client: pg.PoolClient,
  i: InsertInput,
): Promise<RecommendationRow> {
  const { rows } = await client.query<RecommendationRow>(
    `INSERT INTO bonus_recommendations
       (forecast_id, zone_id, rain_intensity, expected_supply_gap, demand_multiplier,
        recommended_bonus_cop, confidence_pct, factors, status, origin, pinned,
        valid_from, valid_until)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      i.forecastId,
      i.zoneId,
      i.rainIntensity,
      i.expectedSupplyGap,
      i.demandMultiplier,
      i.recommendedBonusCop,
      i.confidencePct,
      JSON.stringify(i.factors),
      i.status,
      i.origin,
      i.pinned,
      i.validFrom,
      i.validUntil,
    ],
  );
  return rows[0]!;
}

/** Supersede the Zone's active rows of the given statuses (so we never pile up). */
async function supersede(
  client: pg.PoolClient,
  zoneId: string,
  statuses: string[],
): Promise<void> {
  await client.query(
    `UPDATE bonus_recommendations SET status = 'superseded'
      WHERE zone_id = $1 AND status = ANY($2)`,
    [zoneId, statuses],
  );
}

function emit(rec: RecommendationRow, needsApproval: boolean): void {
  broadcast({ type: "recommendation.updated", zone_id: rec.zone_id, payload: rec });
  if (rec.status === "published") {
    broadcast({ type: "recommendation.published", zone_id: rec.zone_id, payload: rec });
  }
  if (needsApproval) {
    broadcast({ type: "alert.low_confidence", zone_id: rec.zone_id, payload: rec });
  }
}

export interface RecomputeResult {
  zoneId: string;
  recommendation: RecommendationRow;
}

/**
 * Recompute cycle for one Zone: regenerate the rain forecast anchored to `now`,
 * compute the bonus, then apply the lifecycle (ADR-0002) — publishing, parking
 * for approval, or deferring to a live pinned Override.
 */
export async function recomputeZone(
  zoneId: string,
  now: Date = new Date(),
): Promise<RecomputeResult | null> {
  const zoneRow = await getZone(zoneId);
  if (!zoneRow || !zoneRow.active) return null;
  const zone = zoneFromRow(zoneRow);
  const scenario = zoneRow.config.scenario;

  // 1. Forecast (anchored to now) → persist.
  const fc = generateForecast(scenario, now);
  const peak = nearTermPeak(fc.intervals, WINDOW_HOURS);
  const bonus = computeBonus({
    zone,
    hour: new Date(peak.timestamp).getHours(),
    rainIntensity: peak.rain_intensity,
    confidencePct: peak.confidence_pct,
  });

  const live = await getLivePublished(pool, zoneId);
  const klass = classifyNewRecommendation({
    confidencePct: peak.confidence_pct,
    live,
    now,
  });

  const validUntil = new Date(now.getTime() + WINDOW_HOURS * 3_600_000).toISOString();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: fcRows } = await client.query<{ id: string }>(
      `INSERT INTO forecast_results
         (zone_id, generated_at, valid_from, valid_to, intervals, summary, model_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        zoneId,
        now.toISOString(),
        fc.valid_from,
        fc.valid_to,
        JSON.stringify(fc.intervals),
        JSON.stringify(fc.summary),
        "demo-weighted-v1",
      ],
    );
    const forecastId = fcRows[0]!.id;

    // Supersession (ADR-0002): a publish replaces the live bonus AND any stale
    // pending; a pending-approval must NOT take down the live bonus, only stale
    // pending; a deferred (override active) rec supersedes nothing.
    if (klass.status === "published") {
      await supersede(client, zoneId, ["published", "pending_approval"]);
    } else if (klass.status === "pending_approval") {
      await supersede(client, zoneId, ["pending_approval"]);
    }

    const rec = await insertRecommendation(client, {
      forecastId,
      zoneId,
      rainIntensity: peak.rain_intensity,
      expectedSupplyGap: bonus.expected_supply_gap,
      demandMultiplier: bonus.demand_multiplier,
      recommendedBonusCop: bonus.recommended_bonus_cop,
      confidencePct: peak.confidence_pct,
      factors: bonus.contributing_factors,
      status: klass.status,
      origin: "auto",
      pinned: false,
      validFrom: now.toISOString(),
      validUntil,
    });

    await client.query("COMMIT");
    broadcast({ type: "forecast.updated", zone_id: zoneId, payload: fc.summary });
    emit(rec, klass.needsApproval);
    return { zoneId, recommendation: rec };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Recompute every active Zone (the scheduler cycle). */
export async function recomputeAll(now: Date = new Date()): Promise<number> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM zones WHERE active`,
  );
  let n = 0;
  for (const { id } of rows) {
    try {
      await recomputeZone(id, now);
      n++;
    } catch (err) {
      console.error(`recompute failed for zone ${id}:`, err);
    }
  }
  return n;
}

/**
 * Ops Override (ADR-0002): pin a manually-chosen bonus for the Zone. Validates
 * the §8 rules (multiple of $500, within the cap), supersedes the live bonus,
 * and inserts a published, pinned recommendation that automatic recalcs defer to.
 */
export async function overrideBonus(
  zoneId: string,
  bonusCop: number,
  now: Date = new Date(),
): Promise<RecommendationRow> {
  const zoneRow = await getZone(zoneId);
  if (!zoneRow) throw new ValidationError("zone not found");
  if (!Number.isInteger(bonusCop) || bonusCop < 0)
    throw new ValidationError("bonus must be a non-negative integer (COP)");
  if (bonusCop % MIN_INCREMENT !== 0)
    throw new ValidationError(`bonus must be a multiple of ${MIN_INCREMENT} COP`);
  if (bonusCop > zoneRow.config.max_bonus_cop)
    throw new ValidationError(
      `bonus exceeds the zone cap of ${zoneRow.config.max_bonus_cop} COP`,
    );

  // Inherit rain/demand context from the current recommendation, if any.
  const current = (
    await pool.query<RecommendationRow>(
      `SELECT * FROM bonus_recommendations
        WHERE zone_id = $1 AND status IN ('published','pending_approval')
        ORDER BY created_at DESC LIMIT 1`,
      [zoneId],
    )
  ).rows[0];

  const validUntil = new Date(now.getTime() + WINDOW_HOURS * 3_600_000).toISOString();
  const factors: ContributingFactor[] = [
    { factor: "manual_override", value: 1, weight: bonusCop, contribution: bonusCop },
  ];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await supersede(client, zoneId, ["published", "pending_approval"]);
    const rec = await insertRecommendation(client, {
      forecastId: current?.forecast_id ?? null,
      zoneId,
      rainIntensity: current?.rain_intensity ?? "none",
      expectedSupplyGap: current?.expected_supply_gap ?? 0,
      demandMultiplier: current?.demand_multiplier ?? 1,
      recommendedBonusCop: bonusCop,
      confidencePct: current?.confidence_pct ?? 100,
      factors,
      status: "published",
      origin: "override",
      pinned: true,
      validFrom: now.toISOString(),
      validUntil,
    });
    await client.query("COMMIT");
    emit(rec, false);
    return rec;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Ops Approval (ADR-0002): take a `pending_approval` recommendation live. Throws
 * InvalidTransitionError (→ 409) if it is in any other state.
 */
export async function approveRecommendation(id: string): Promise<RecommendationRow> {
  const rec = await getActiveById(id);
  if (!rec) throw new ValidationError("recommendation not found");
  const next = approveTransition(rec.status as LiveRecommendation["status"]);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Approving makes it live, replacing any currently-published bonus.
    await client.query(
      `UPDATE bonus_recommendations SET status = 'superseded'
        WHERE zone_id = $1 AND status = 'published' AND id <> $2`,
      [rec.zone_id, id],
    );
    const { rows } = await client.query<RecommendationRow>(
      `UPDATE bonus_recommendations SET status = $2, origin = $3
        WHERE id = $1 RETURNING *`,
      [id, next.status, next.origin],
    );
    await client.query("COMMIT");
    const updated = rows[0]!;
    emit(updated, false);
    return updated;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
