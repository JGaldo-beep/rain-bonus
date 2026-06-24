import type { RainIntensity } from "@fleetweather/shared";

const copFmt = new Intl.NumberFormat("es-CO");

/** "+$2.000 COP", or "Sin bono" for 0. */
export function formatBonus(cop: number | null): string {
  if (cop == null) return "—";
  if (cop === 0) return "Sin bono";
  return `+$${copFmt.format(cop)} COP`;
}

/** "$2.200 COP" */
export function formatCop(cop: number): string {
  return `$${copFmt.format(cop)} COP`;
}

export interface Tier {
  key: "none" | "low" | "high" | "critical";
  label: string;
  text: string; // tailwind text color
  border: string;
  bg: string;
  dot: string; // solid fill
  hex: string; // for SVG
}

/** Maps a bonus amount to a visual tier for cards, pills and the map. */
export function bonusTier(cop: number | null): Tier {
  const v = cop ?? 0;
  if (v <= 0)
    return {
      key: "none",
      label: "Sin bono",
      text: "text-emerald-300",
      border: "border-emerald-500/30",
      bg: "bg-emerald-500/10",
      dot: "bg-emerald-400",
      hex: "#34d399",
    };
  if (v <= 1000)
    return {
      key: "low",
      label: "Bono bajo",
      text: "text-amber-300",
      border: "border-amber-500/30",
      bg: "bg-amber-500/10",
      dot: "bg-amber-400",
      hex: "#fbbf24",
    };
  if (v <= 2000)
    return {
      key: "high",
      label: "Bono alto",
      text: "text-orange-300",
      border: "border-orange-500/30",
      bg: "bg-orange-500/10",
      dot: "bg-orange-400",
      hex: "#fb923c",
    };
  return {
    key: "critical",
    label: "Bono crítico",
    text: "text-red-300",
    border: "border-red-500/30",
    bg: "bg-red-500/10",
    dot: "bg-red-400",
    hex: "#f87171",
  };
}

const RAIN_LABEL: Record<RainIntensity, string> = {
  none: "Sin lluvia",
  light: "Llovizna",
  moderate: "Lluvia moderada",
  heavy: "Lluvia fuerte",
};

export function rainLabel(r: RainIntensity | null): string {
  return r ? RAIN_LABEL[r] : "—";
}

const RAIN_HEX: Record<RainIntensity, string> = {
  none: "#3f3f46",
  light: "#38bdf8",
  moderate: "#6366f1",
  heavy: "#a855f7",
};

export function rainHex(r: RainIntensity): string {
  return RAIN_HEX[r];
}

/** "en 45 min" / "en 2 h 10 min" / "ahora". */
export function formatEta(min: number): string {
  if (min <= 0) return "ahora";
  if (min < 60) return `en ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `en ${h} h ${m} min` : `en ${h} h`;
}
