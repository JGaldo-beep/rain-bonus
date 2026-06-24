import "server-only";
import type { BonusProjectionPoint, ContributingFactor, RainIntensity } from "@fleetweather/shared";
import type { ForecastLatest, RecommendationCurrent, ZoneOverview } from "./types";

export type { ForecastLatest, RecommendationCurrent, ZoneOverview } from "./types";

/**
 * Server-side data layer. Inside Docker the web container reaches the API by
 * service name (API_INTERNAL_URL); locally it falls back to localhost. The
 * bearer key is read from the server-only env and never reaches the browser
 * (`server-only` makes a client import a build error). All reads are uncached so
 * the demo always reflects the latest recompute.
 */
const API_BASE =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3000/api/v1";
const API_KEY = process.env.API_KEY ?? "demo-key";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    headers: { authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  const json = (await res.json()) as { data: T };
  return json.data;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));

export function getOverview(): Promise<ZoneOverview[]> {
  return get<Record<string, unknown>[]>("/zones/recommendations/all").then((rows) =>
    rows.map((r) => ({
      zone_id: String(r.zone_id),
      name: String(r.name),
      city: String(r.city),
      lat: num(r.lat),
      lon: num(r.lon),
      base_delivery_rate_cop: num(r.base_delivery_rate_cop),
      rain_intensity: (r.rain_intensity as RainIntensity) ?? null,
      recommended_bonus_cop:
        r.recommended_bonus_cop == null ? null : num(r.recommended_bonus_cop),
      expected_supply_gap:
        r.expected_supply_gap == null ? null : num(r.expected_supply_gap),
      demand_multiplier:
        r.demand_multiplier == null ? null : num(r.demand_multiplier),
      confidence_pct: r.confidence_pct == null ? null : num(r.confidence_pct),
      status: (r.status as ZoneOverview["status"]) ?? null,
      origin: (r.origin as ZoneOverview["origin"]) ?? null,
      pinned: (r.pinned as boolean) ?? null,
    })),
  );
}

export function getRecommendation(id: string): Promise<RecommendationCurrent> {
  return get<Record<string, unknown>>(
    `/zones/${id}/recommendation/current`,
  ).then((r) => ({
    zone_id: String(r.zone_id),
    zone_name: String(r.zone_name),
    city: String(r.city),
    base_delivery_rate_cop: num(r.base_delivery_rate_cop),
    rain_intensity: r.rain_intensity as RainIntensity,
    expected_supply_gap: num(r.expected_supply_gap),
    demand_multiplier: num(r.demand_multiplier),
    recommended_bonus_cop: num(r.recommended_bonus_cop),
    confidence_pct: num(r.confidence_pct),
    status: r.status as RecommendationCurrent["status"],
    origin: r.origin as RecommendationCurrent["origin"],
    pinned: Boolean(r.pinned),
    max_bonus_cop: num(r.max_bonus_cop),
    factors: (r.factors as ContributingFactor[]) ?? [],
    valid_until: String(r.valid_until),
  }));
}

export function getForecast(id: string): Promise<ForecastLatest> {
  return get<ForecastLatest>(`/zones/${id}/forecast/latest`);
}

export function getBonusProjection(id: string): Promise<BonusProjectionPoint[]> {
  return get<BonusProjectionPoint[]>(`/zones/${id}/recommendation/forecast`);
}
