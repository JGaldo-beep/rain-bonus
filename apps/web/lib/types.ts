import type {
  ContributingFactor,
  ForecastInterval,
  RainIntensity,
  RecommendationOrigin,
  RecommendationStatus,
} from "@fleetweather/shared";

/** Shapes the dashboard renders. Kept out of api.ts (which is server-only) so
 * client components can import the types without pulling in server code. */

export interface ZoneOverview {
  zone_id: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  base_delivery_rate_cop: number;
  rain_intensity: RainIntensity | null;
  recommended_bonus_cop: number | null;
  expected_supply_gap: number | null;
  demand_multiplier: number | null;
  confidence_pct: number | null;
  status: RecommendationStatus | null;
  origin: RecommendationOrigin | null;
  pinned: boolean | null;
}

export interface RecommendationCurrent {
  zone_id: string;
  zone_name: string;
  city: string;
  base_delivery_rate_cop: number;
  rain_intensity: RainIntensity;
  expected_supply_gap: number;
  demand_multiplier: number;
  recommended_bonus_cop: number;
  confidence_pct: number;
  status: RecommendationStatus;
  origin: RecommendationOrigin;
  pinned: boolean;
  max_bonus_cop: number;
  factors: ContributingFactor[];
  valid_until: string;
}

export interface ForecastLatest {
  id: string;
  zone_id: string;
  generated_at: string;
  valid_from: string;
  valid_to: string;
  intervals: ForecastInterval[];
  summary: {
    peak_rain_intensity: RainIntensity;
    next_rain_eta_min: number;
    rainy_hours: number;
  };
}
