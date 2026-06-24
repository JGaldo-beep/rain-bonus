import type { Zone } from "@fleetweather/shared";

/** SPEC §7 response envelope. */
export function ok<T>(data: T, cacheHit = false) {
  return {
    success: true,
    data,
    meta: { generated_at: new Date().toISOString(), cache_hit: cacheHit },
  };
}

export function notFound(message: string) {
  return {
    success: false,
    error: message,
    meta: { generated_at: new Date().toISOString(), cache_hit: false },
  };
}

/** A `zones` row as returned by pg. */
export interface ZoneRow {
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
  };
  active: boolean;
}

/** Reconstructs a domain `Zone` from a DB row so the engine can consume it. */
export function zoneFromRow(row: ZoneRow): Zone {
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
