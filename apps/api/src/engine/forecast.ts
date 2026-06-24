import type {
  ForecastInterval,
  ForecastResult,
  RainIntensity,
} from "@fleetweather/shared";

/**
 * Rain forecast engine (SPEC §4). For the demo it synthesizes a deterministic
 * 72h / 1h forecast from a per-zone scenario instead of polling live weather
 * APIs, so the stack shows coherent results offline. The mm→intensity mapping
 * and confidence semantics match what the real ingestion path would produce.
 */

const HORIZON_HOURS = 72;

/** mm/h → discrete intensity (SPEC §3.1). */
export function rainIntensityFromMm(mm: number): RainIntensity {
  if (mm <= 0) return "none";
  if (mm <= 2.5) return "light";
  if (mm <= 7.6) return "moderate";
  return "heavy";
}

export interface RainScenario {
  /** Hours from `now` at which a rain band peaks. */
  peakHours: number[];
  /** Peak precipitation (mm/h) for each band. */
  peakMm: number[];
  /** Half-width (hours) of each band. */
  spreadHours: number;
  /** Near-term forecast confidence 0–100 (decays over the horizon). */
  baseConfidence: number;
}

/** Gaussian bump so rain ramps up and down smoothly around each peak. */
function precipAtHour(h: number, scenario: RainScenario): number {
  let mm = 0;
  scenario.peakHours.forEach((peak, i) => {
    const amp = scenario.peakMm[i] ?? 0;
    const d = (h - peak) / scenario.spreadHours;
    mm += amp * Math.exp(-(d * d));
  });
  return Number(mm.toFixed(2));
}

/** Confidence decays with the forecast horizon (further out = less certain). */
function confidenceAtHour(h: number, scenario: RainScenario): number {
  const decayed = scenario.baseConfidence - (h / HORIZON_HOURS) * 30;
  return Number(Math.max(35, Math.min(99, decayed)).toFixed(1));
}

export function generateForecast(
  scenario: RainScenario,
  now: Date,
): Pick<ForecastResult, "intervals" | "summary" | "valid_from" | "valid_to"> {
  const validFrom = new Date(now);
  validFrom.setMinutes(0, 0, 0);

  const intervals: ForecastInterval[] = [];
  for (let h = 0; h < HORIZON_HOURS; h++) {
    const ts = new Date(validFrom.getTime() + h * 3_600_000);
    const mm = precipAtHour(h, scenario);
    intervals.push({
      timestamp: ts.toISOString(),
      precipitation_mm: mm,
      rain_intensity: rainIntensityFromMm(mm),
      confidence_pct: confidenceAtHour(h, scenario),
    });
  }

  const order: RainIntensity[] = ["none", "light", "moderate", "heavy"];
  const peak = intervals.reduce<RainIntensity>(
    (acc, iv) =>
      order.indexOf(iv.rain_intensity) > order.indexOf(acc)
        ? iv.rain_intensity
        : acc,
    "none",
  );
  const firstRain = intervals.find((iv) => iv.rain_intensity !== "none");
  const nextRainEtaMin = firstRain
    ? Math.round(
        (new Date(firstRain.timestamp).getTime() - now.getTime()) / 60_000,
      )
    : null;

  const validTo = new Date(validFrom.getTime() + HORIZON_HOURS * 3_600_000);

  return {
    valid_from: validFrom.toISOString(),
    valid_to: validTo.toISOString(),
    intervals,
    summary: {
      peak_rain_intensity: peak,
      next_rain_eta_min: nextRainEtaMin && nextRainEtaMin >= 0 ? nextRainEtaMin : 0,
      rainy_hours: intervals.filter((iv) => iv.rain_intensity !== "none").length,
    },
  };
}

/**
 * Picks the representative interval for the "current" recommendation: the
 * worst (most intense) of the next `windowHours` hours — the bonus must be set
 * ahead of incoming rain (SPEC §8).
 */
export function nearTermPeak(
  intervals: ForecastInterval[],
  windowHours = 6,
): ForecastInterval {
  const order: RainIntensity[] = ["none", "light", "moderate", "heavy"];
  const window = intervals.slice(0, windowHours);
  return window.reduce((worst, iv) =>
    order.indexOf(iv.rain_intensity) > order.indexOf(worst.rain_intensity)
      ? iv
      : worst,
  );
}
