import type {
  ContributingFactor,
  RainIntensity,
  Zone,
} from "@fleetweather/shared";

/**
 * Bonus calculator — the per-delivery incentive in COP that closes the
 * rain-driven supply/demand gap for a Zone.
 *
 * The bonus is an **additive decomposition** of three COP terms (ADR-0005), so
 * `contributing_factors` literally sums to the result and a reader can verify
 * the math by eye:
 *
 *     bonus_raw = gap_closing_cost + demand_surge_premium + rain_severity_premium
 *     bonus     = cap( snap_to_500(bonus_raw), max_bonus_cop )
 *
 * This is an honest v1 heuristic. The constants below are documented placeholders
 * calibrated so the demo lands in a believable Colombian range (light ≈ $500,
 * moderate ≈ $1.500, heavy ≈ $2.500); they are NOT fitted to real data. Replacing
 * them with values estimated from real Rappitenero supply-elasticity is the
 * explicit next step.
 */

/**
 * COP applied to the supply-gap ratio (0–1). The dominant term: at a gap ratio of
 * ~0.8 (heavy rain on an exposed zone) it contributes ~$1.200. Stand-in for the
 * marginal COP needed to recruit the missing Rappiteneros — calibrate with real
 * supply-elasticity data.
 */
const COP_PER_GAP_RATIO = 1500;

/**
 * COP applied to demand surge, i.e. (demand_multiplier − 1). At a 1.95× demand
 * spike it contributes ~$475. Reflects that elevated demand alone warrants a
 * premium even before the supply gap.
 */
const DEMAND_PREMIUM_COP = 500;

/**
 * Flat COP premium per rain level — the discomfort/risk of riding in rain,
 * independent of the gap. None contributes nothing.
 */
const RAIN_SEVERITY_PREMIUM_COP: Record<RainIntensity, number> = {
  none: 0,
  light: 100,
  moderate: 400,
  heavy: 800,
};

/** §8: bonuses move in multiples of $500 COP. */
const MIN_INCREMENT = 500;

/** §8: confidence below this marks a recommendation Low Confidence. */
export const LOW_CONFIDENCE_THRESHOLD = 60;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const roundToIncrement = (n: number) => Math.round(n / MIN_INCREMENT) * MIN_INCREMENT;

export interface BonusInputs {
  zone: Zone;
  hour: number; // 0–23, indexes baseline_supply_curve
  rainIntensity: RainIntensity;
  confidencePct: number; // 0–100, from the forecast
}

export interface BonusBreakdown {
  recommended_bonus_cop: number;
  expected_supply_gap: number; // Rappiteneros to incentivize
  demand_multiplier: number;
  low_confidence: boolean;
  contributing_factors: ContributingFactor[];
}

/** Computes the recommended per-delivery bonus for one zone/hour/intensity. */
export function computeBonus({
  zone,
  hour,
  rainIntensity,
  confidencePct,
}: BonusInputs): BonusBreakdown {
  const baseline = zone.baseline_supply_curve[hour] ?? 0;

  // Supply shrinks and demand grows with rain.
  const sensitivity =
    rainIntensity === "none" ? 0 : zone.rain_sensitivity[rainIntensity];
  const demandMultiplier =
    rainIntensity === "none" ? 1 : zone.demand_elasticity[rainIntensity];

  const expectedRainySupply = baseline * (1 - sensitivity);
  const requiredRappiteneros = baseline * demandMultiplier;
  const toIncentivize = Math.max(0, requiredRappiteneros - expectedRainySupply);

  // Gap ratio: share of required supply that is missing (0–1).
  const gapRatio =
    requiredRappiteneros > 0
      ? clamp(toIncentivize / requiredRappiteneros, 0, 1)
      : 0;
  const demandSurge = Math.max(0, demandMultiplier - 1);

  // ── The three additive COP terms (ADR-0005) ──
  const gapClosingCost = COP_PER_GAP_RATIO * gapRatio;
  const demandSurgePremium = DEMAND_PREMIUM_COP * demandSurge;
  const rainSeverityPremium = RAIN_SEVERITY_PREMIUM_COP[rainIntensity];

  const bonusRaw = gapClosingCost + demandSurgePremium + rainSeverityPremium;
  const recommended = clamp(roundToIncrement(bonusRaw), 0, zone.max_bonus_cop);

  const low_confidence = confidencePct < LOW_CONFIDENCE_THRESHOLD;

  // Each contribution is the term's COP value; they sum to bonusRaw (pre-rounding).
  const contributing_factors: ContributingFactor[] = [
    {
      factor: "gap_closing_cost",
      value: Number(gapRatio.toFixed(3)),
      weight: COP_PER_GAP_RATIO,
      contribution: Math.round(gapClosingCost),
    },
    {
      factor: "demand_surge_premium",
      value: Number(demandSurge.toFixed(3)),
      weight: DEMAND_PREMIUM_COP,
      contribution: Math.round(demandSurgePremium),
    },
    {
      factor: "rain_severity_premium",
      value: 1,
      weight: rainSeverityPremium,
      contribution: rainSeverityPremium,
    },
  ];

  return {
    recommended_bonus_cop: recommended,
    expected_supply_gap: Math.round(toIncentivize),
    demand_multiplier: Number(demandMultiplier.toFixed(3)),
    low_confidence,
    contributing_factors,
  };
}
