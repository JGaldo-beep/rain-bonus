import type { Zone } from "@fleetweather/shared";
import type { RainScenario } from "../engine/forecast.js";

/**
 * Demo dataset: real Bogotá localities with hand-tuned supply/demand profiles
 * and rain scenarios chosen so the dashboard shows variety — from a dry zone
 * ($0 bonus) to a heavy-rain zone near the cap, plus one low-confidence zone
 * that requires manual approval (SPEC §8).
 */
export type DemoZone = Omit<Zone, "id"> & { scenario: RainScenario };

/** Typical intraday delivery-supply curve (24 hourly values) scaled per zone. */
function supplyCurve(scale: number): number[] {
  const shape = [
    4, 3, 2, 2, 2, 3, 6, 12, 18, 16, 15, 22, 30, 28, 22, 20, 24, 32, 38, 34,
    26, 18, 12, 7,
  ];
  return shape.map((v) => Math.round(v * scale));
}

export const DEMO_ZONES: DemoZone[] = [
  {
    name: "Chapinero",
    city: "Bogotá",
    centroid: { lat: 4.651, lon: -74.0628 },
    base_delivery_rate_cop: 2200,
    baseline_supply_curve: supplyCurve(1.0),
    rain_sensitivity: { light: 0.12, moderate: 0.32, heavy: 0.58 },
    demand_elasticity: { light: 1.2, moderate: 1.5, heavy: 1.95 },
    max_bonus_cop: 3000,
    active: true,
    // Heavy band hitting soon, high confidence → headline bonus.
    scenario: { peakHours: [2], peakMm: [11], spreadHours: 3, baseConfidence: 92 },
  },
  {
    name: "Usaquén",
    city: "Bogotá",
    centroid: { lat: 4.695, lon: -74.03 },
    base_delivery_rate_cop: 2400,
    baseline_supply_curve: supplyCurve(0.9),
    rain_sensitivity: { light: 0.1, moderate: 0.28, heavy: 0.5 },
    demand_elasticity: { light: 1.15, moderate: 1.4, heavy: 1.8 },
    max_bonus_cop: 3000,
    active: true,
    // Moderate band mid-afternoon.
    scenario: { peakHours: [4], peakMm: [6], spreadHours: 3, baseConfidence: 88 },
  },
  {
    name: "Kennedy",
    city: "Bogotá",
    centroid: { lat: 4.628, lon: -74.15 },
    base_delivery_rate_cop: 2000,
    baseline_supply_curve: supplyCurve(1.2),
    rain_sensitivity: { light: 0.14, moderate: 0.34, heavy: 0.6 },
    demand_elasticity: { light: 1.25, moderate: 1.55, heavy: 2.0 },
    max_bonus_cop: 3000,
    active: true,
    // Light drizzle only.
    scenario: { peakHours: [5], peakMm: [2], spreadHours: 4, baseConfidence: 84 },
  },
  {
    name: "Suba",
    city: "Bogotá",
    centroid: { lat: 4.74, lon: -74.09 },
    base_delivery_rate_cop: 2300,
    baseline_supply_curve: supplyCurve(1.05),
    rain_sensitivity: { light: 0.13, moderate: 0.33, heavy: 0.62 },
    demand_elasticity: { light: 1.2, moderate: 1.5, heavy: 2.1 },
    max_bonus_cop: 3000,
    active: true,
    // Heavy band but low near-term confidence → manual approval (SPEC §8).
    scenario: { peakHours: [3], peakMm: [13], spreadHours: 3, baseConfidence: 54 },
  },
  {
    name: "Engativá",
    city: "Bogotá",
    centroid: { lat: 4.705, lon: -74.12 },
    base_delivery_rate_cop: 2100,
    baseline_supply_curve: supplyCurve(0.95),
    rain_sensitivity: { light: 0.11, moderate: 0.3, heavy: 0.55 },
    demand_elasticity: { light: 1.18, moderate: 1.45, heavy: 1.85 },
    max_bonus_cop: 3000,
    active: true,
    // Dry → $0 bonus, green on the map.
    scenario: { peakHours: [], peakMm: [], spreadHours: 3, baseConfidence: 90 },
  },
  {
    name: "Fontibón",
    city: "Bogotá",
    centroid: { lat: 4.668, lon: -74.143 },
    base_delivery_rate_cop: 2250,
    baseline_supply_curve: supplyCurve(0.85),
    rain_sensitivity: { light: 0.12, moderate: 0.31, heavy: 0.56 },
    demand_elasticity: { light: 1.2, moderate: 1.48, heavy: 1.9 },
    max_bonus_cop: 3000,
    active: true,
    // Moderate band starting almost immediately.
    scenario: { peakHours: [1], peakMm: [7], spreadHours: 2, baseConfidence: 86 },
  },
];
