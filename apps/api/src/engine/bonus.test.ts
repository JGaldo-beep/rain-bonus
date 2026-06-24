import assert from "node:assert/strict";
import { test } from "node:test";
import type { RainIntensity, Zone } from "@fleetweather/shared";
import { computeBonus } from "./bonus.js";

/** A zone with a flat supply curve so `hour` is irrelevant to the math. */
function zone(overrides: Partial<Zone> = {}): Zone {
  return {
    id: "z1",
    name: "Test",
    city: "Bogotá",
    centroid: { lat: 0, lon: 0 },
    base_delivery_rate_cop: 2200,
    baseline_supply_curve: Array(24).fill(20),
    rain_sensitivity: { light: 0.12, moderate: 0.32, heavy: 0.58 },
    demand_elasticity: { light: 1.2, moderate: 1.5, heavy: 1.95 },
    max_bonus_cop: 3000,
    active: true,
    ...overrides,
  };
}

const at = (rainIntensity: RainIntensity, confidencePct = 90) =>
  computeBonus({ zone: zone(), hour: 12, rainIntensity, confidencePct });

test("no rain yields no bonus and no supply gap", () => {
  const r = computeBonus({ zone: zone(), hour: 12, rainIntensity: "none", confidencePct: 95 });
  assert.equal(r.recommended_bonus_cop, 0);
  assert.equal(r.expected_supply_gap, 0);
  assert.equal(r.demand_multiplier, 1);
});

test("bonus rises monotonically with rain intensity", () => {
  const light = at("light").recommended_bonus_cop;
  const moderate = at("moderate").recommended_bonus_cop;
  const heavy = at("heavy").recommended_bonus_cop;
  assert.ok(light < moderate, `light ${light} < moderate ${moderate}`);
  assert.ok(moderate < heavy, `moderate ${moderate} < heavy ${heavy}`);
});

test("demo scenario lands in the expected COP bands", () => {
  // The hand-calibrated targets from ADR-0005 for the Chapinero-like profile.
  assert.equal(at("light").recommended_bonus_cop, 500);
  assert.equal(at("moderate").recommended_bonus_cop, 1500);
  assert.equal(at("heavy").recommended_bonus_cop, 2500);
});

test("contributing factors sum to the pre-rounding bonus", () => {
  for (const intensity of ["light", "moderate", "heavy"] as const) {
    const r = at(intensity);
    const summed = r.contributing_factors.reduce((s, f) => s + f.contribution, 0);
    // Sum is pre-rounding; the published number is snapped to the nearest $500.
    const snapped = Math.round(summed / 500) * 500;
    assert.equal(
      snapped,
      r.recommended_bonus_cop,
      `${intensity}: factors ${summed} → ${snapped} != ${r.recommended_bonus_cop}`,
    );
  }
});

test("bonus is snapped to multiples of $500", () => {
  for (const intensity of ["light", "moderate", "heavy"] as const) {
    assert.equal(at(intensity).recommended_bonus_cop % 500, 0);
  }
});

test("bonus never exceeds the zone cap", () => {
  const capped = computeBonus({
    zone: zone({ max_bonus_cop: 1000, demand_elasticity: { light: 2, moderate: 3, heavy: 4 } }),
    hour: 12,
    rainIntensity: "heavy",
    confidencePct: 90,
  });
  assert.ok(capped.recommended_bonus_cop <= 1000);
  assert.equal(capped.recommended_bonus_cop, 1000);
});

test("confidence below 60% flags low confidence", () => {
  assert.equal(at("heavy", 59).low_confidence, true);
  assert.equal(at("heavy", 60).low_confidence, false);
  assert.equal(at("heavy", 92).low_confidence, false);
});
