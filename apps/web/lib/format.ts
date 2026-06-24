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
      text: "text-emerald-700",
      border: "border-emerald-200",
      bg: "bg-emerald-50",
      dot: "bg-emerald-500",
      hex: "#10b981",
    };
  if (v <= 1000)
    return {
      key: "low",
      label: "Bono bajo",
      text: "text-amber-700",
      border: "border-amber-200",
      bg: "bg-amber-50",
      dot: "bg-amber-500",
      hex: "#f59e0b",
    };
  if (v <= 2000)
    return {
      key: "high",
      label: "Bono alto",
      text: "text-orange-700",
      border: "border-orange-200",
      bg: "bg-orange-50",
      dot: "bg-orange-500",
      hex: "#fb6514",
    };
  return {
    key: "critical",
    label: "Bono crítico",
    text: "text-brand-700",
    border: "border-brand-100",
    bg: "bg-brand-50",
    dot: "bg-brand",
    hex: "#ff441f",
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
  none: "#94a3b8",
  light: "#38bdf8",
  moderate: "#4f46e5",
  heavy: "#7c3aed",
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
