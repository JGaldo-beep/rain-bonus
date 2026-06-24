/**
 * FleetWeather — shared TypeScript types.
 *
 * Source of truth for the domain interfaces defined in SPEC.md (v2.0.0,
 * §3–§5): weather, internal Rappi supply/demand, rain forecast, zone
 * configuration, and the per-delivery bonus recommendation.
 */

/** ISO 8601 timestamp string, e.g. "2026-06-23T10:00:00Z". */
export type ISO8601 = string;

/** Discretized rain intensity used across the system (SPEC §3.1). */
export type RainIntensity = "none" | "light" | "moderate" | "heavy";

// ─── §3.2 Weather ───────────────────────────────────────────────────────────

/** Normalized weather reading from any external source (SPEC §3.2). */
export interface WeatherReading {
  source: string; // "openweather" | "open-meteo" | "noaa"
  zone_id: string;
  timestamp: ISO8601;
  temperature_c: number;
  wind_speed_kmh: number;
  precipitation_mm: number;
  visibility_km: number;
  humidity_pct: number;
  pressure_hpa: number;
  rain_intensity: RainIntensity;
  condition_code: string;
  raw: object; // original payload, unmodified
}

// ─── §3.3 Internal Rappi data ────────────────────────────────────────────────

/** Historical/current Rappitenero login rate by hour, zone and rain (SPEC §3.3a). */
export interface RappiteneroSupplyRecord {
  zone_id: string;
  hour: number; // 0–23 (zone local hour)
  rain_intensity: RainIntensity;
  active_rappiteneros: number; // observed connected
  baseline_rappiteneros: number; // expected connected on a dry day at this hour
  timestamp: ISO8601;
}

/** Historical/current order volume by hour, zone and rain (SPEC §3.3b). */
export interface DemandRecord {
  zone_id: string;
  hour: number; // 0–23
  rain_intensity: RainIntensity;
  order_count: number; // observed
  baseline_order_count: number; // expected on a dry day at this hour
  timestamp: ISO8601;
}

// ─── §4.4 Rain forecast ──────────────────────────────────────────────────────

/** A single 1-hour interval of the rain forecast (SPEC §4.4). */
export interface ForecastInterval {
  timestamp: ISO8601;
  precipitation_mm: number;
  rain_intensity: RainIntensity;
  confidence_pct: number;
}

/** 72h rain forecast for a zone (SPEC §4.4). */
export interface ForecastResult {
  id: string; // UUID
  zone_id: string;
  generated_at: ISO8601;
  valid_from: ISO8601;
  valid_to: ISO8601; // generated_at + 72h
  intervals: ForecastInterval[];
  summary: {
    peak_rain_intensity: RainIntensity;
    next_rain_eta_min: number | null;
    rainy_hours: number;
  };
}

// ─── §5.3 Zone configuration ─────────────────────────────────────────────────

/** Per-level numeric profile keyed by rain intensity (excludes "none"). */
export interface RainLevelProfile {
  light: number;
  moderate: number;
  heavy: number;
}

/** Zone configuration and its supply/demand profile (SPEC §5.3). */
export interface Zone {
  id: string;
  name: string; // "Chapinero"
  city: string; // "Bogotá"
  centroid: { lat: number; lon: number };
  base_delivery_rate_cop: number; // base rate per delivery
  baseline_supply_curve: number[]; // 24 hourly values (Rappiteneros on a dry day)
  rain_sensitivity: RainLevelProfile; // % that disconnect per rain level
  demand_elasticity: RainLevelProfile; // demand multiplier per rain level
  max_bonus_cop: number; // cap above base rate (config)
  active: boolean;
}

// ─── Bonus recommendation ────────────────────────────────────────────────────

/**
 * One additive COP term of the bonus, for explainability (ADR-0005).
 *
 * `contribution` is the term's value in COP; the terms sum to the pre-rounding
 * bonus. `value` is the input driver (e.g. the supply-gap ratio) and `weight`
 * is the COP scale applied to it, so `contribution ≈ value × weight`.
 */
export interface ContributingFactor {
  factor: string;
  value: number;
  weight: number;
  contribution: number; // COP
}

/** A single point of the 72h bonus projection (GET /zones/:id/recommendation/forecast). */
export interface BonusProjectionPoint {
  timestamp: ISO8601;
  rain_intensity: RainIntensity;
  precipitation_mm: number;
  recommended_bonus_cop: number;
  confidence_pct: number;
}

/**
 * Lifecycle state of a Bonus Recommendation (ADR-0002). At most one `published`
 * recommendation covers a Zone at a time.
 * - `pending_approval` — Low Confidence; needs an Ops Approval before going live.
 * - `published` — currently live for the Zone.
 * - `superseded` — replaced by a newer published one, or computed while a pinned
 *   Override holds (never went live).
 * - `expired` — its validity window passed without replacement.
 */
export type RecommendationStatus =
  | "pending_approval"
  | "published"
  | "superseded"
  | "expired";

/** How a recommendation came to be (ADR-0002). */
export type RecommendationOrigin = "auto" | "approved" | "override";

/** Per-delivery bonus recommendation for a zone — the system's main output. */
export interface BonusRecommendation {
  id: string;
  forecast_id: string | null;
  zone_id: string;
  generated_at: ISO8601;
  rain_intensity: RainIntensity;
  expected_supply_gap: number; // # of missing Rappiteneros
  demand_multiplier: number; // float (>1 when raining)
  base_rate_cop: number;
  recommended_bonus_cop: number; // ← main output (COP over base rate)
  confidence_pct: number; // 0–100 (inherited from the forecast)
  low_confidence: boolean; // confidence_pct < 60
  status: RecommendationStatus;
  origin: RecommendationOrigin;
  pinned: boolean; // a pinned Override defers automatic recalcs (ADR-0002)
  contributing_factors: ContributingFactor[];
  valid_from: ISO8601;
  valid_until: ISO8601;
}
