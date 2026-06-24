import type { RainIntensity, Zone } from "@fleetweather/shared";
import { computeBonus } from "../engine/bonus.js";
import { generateForecast, nearTermPeak } from "../engine/forecast.js";
import { classifyNewRecommendation } from "../engine/lifecycle.js";
import { DEMO_ZONES } from "./demo-data.js";
import { pool } from "./pool.js";

/**
 * Demo seed (idempotent): wipes and repopulates the full pipeline anchored to the
 * current time (ADR-0004), so the stack shows a coherent staged rain front the
 * moment it boots — zones (with their rain scenario stored in config so the
 * scheduler can re-forecast), 24h of supply/demand history, a 72h forecast, and
 * the resulting Bonus Recommendation with its lifecycle status (ADR-0002).
 */

const RAIN_LEVELS: RainIntensity[] = ["none", "light", "moderate", "heavy"];

async function seed(): Promise<void> {
  const now = new Date();

  await pool.query(`
    TRUNCATE
      bonus_recommendations,
      forecast_results,
      demand_history,
      rappitenero_supply_history,
      weather_readings,
      zones
    RESTART IDENTITY CASCADE;
  `);

  for (const z of DEMO_ZONES) {
    // 1. Zone + its supply/demand config (with the rain scenario, so the running
    //    API can re-forecast on the schedule).
    const config = {
      baseline_supply_curve: z.baseline_supply_curve,
      rain_sensitivity: z.rain_sensitivity,
      demand_elasticity: z.demand_elasticity,
      max_bonus_cop: z.max_bonus_cop,
      scenario: z.scenario,
    };
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO zones (name, city, lat, lon, base_delivery_rate_cop, config, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [z.name, z.city, z.centroid.lat, z.centroid.lon, z.base_delivery_rate_cop, config, z.active],
    );
    const zoneId = rows[0]!.id;
    const zone: Zone = { id: zoneId, ...z };

    // 2. Supply/demand history — one observed row per hour for the last 24h.
    for (let h = 0; h < 24; h++) {
      const ts = new Date(now.getTime() - (24 - h) * 3_600_000).toISOString();
      const level = RAIN_LEVELS[h % RAIN_LEVELS.length]!;
      const baselineSupply = z.baseline_supply_curve[h] ?? 0;
      const sens = level === "none" ? 0 : z.rain_sensitivity[level];
      const elas = level === "none" ? 1 : z.demand_elasticity[level];
      const baselineOrders = Math.round(baselineSupply * 2.4);

      await pool.query(
        `INSERT INTO rappitenero_supply_history
           (zone_id, hour, rain_intensity, active_rappiteneros, baseline_rappiteneros, timestamp)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [zoneId, h, level, Math.round(baselineSupply * (1 - sens)), baselineSupply, ts],
      );
      await pool.query(
        `INSERT INTO demand_history
           (zone_id, hour, rain_intensity, order_count, baseline_order_count, timestamp)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [zoneId, h, level, Math.round(baselineOrders * elas), baselineOrders, ts],
      );
    }

    // 3. 72h rain forecast.
    const fc = generateForecast(z.scenario, now);
    const { rows: fcRows } = await pool.query<{ id: string }>(
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

    // 4. Bonus recommendation — worst conditions in the next 6h, with the
    //    confidence-gated initial status (ADR-0002).
    const peak = nearTermPeak(fc.intervals, 6);
    const bonus = computeBonus({
      zone,
      hour: new Date(peak.timestamp).getHours(),
      rainIntensity: peak.rain_intensity,
      confidencePct: peak.confidence_pct,
    });
    const { status, needsApproval } = classifyNewRecommendation({
      confidencePct: peak.confidence_pct,
      live: null,
      now,
    });
    const validUntil = new Date(now.getTime() + 6 * 3_600_000).toISOString();

    await pool.query(
      `INSERT INTO bonus_recommendations
         (forecast_id, zone_id, rain_intensity, expected_supply_gap, demand_multiplier,
          recommended_bonus_cop, confidence_pct, factors, status, origin, pinned,
          valid_from, valid_until)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'auto',FALSE,$10,$11)`,
      [
        forecastId,
        zoneId,
        peak.rain_intensity,
        bonus.expected_supply_gap,
        bonus.demand_multiplier,
        bonus.recommended_bonus_cop,
        peak.confidence_pct,
        JSON.stringify(bonus.contributing_factors),
        status,
        now.toISOString(),
        validUntil,
      ],
    );

    console.log(
      `✓ ${z.name.padEnd(10)} rain=${peak.rain_intensity.padEnd(8)} ` +
        `bonus=+$${bonus.recommended_bonus_cop} COP  conf=${peak.confidence_pct}%  ${status}` +
        (needsApproval ? "  ⚠ needs approval" : ""),
    );
  }

  console.log(`\nSeeded ${DEMO_ZONES.length} zones.`);
}

seed()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
