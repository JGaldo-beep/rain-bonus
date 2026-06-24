"use client";

import { useState } from "react";
import type { BonusProjectionPoint } from "@fleetweather/shared";
import { bonusTier, formatBonus, rainHex, rainLabel } from "../lib/format";

/**
 * 72h projection of the recommended bonus, as bars (height + color = bonus
 * tier) with the precipitation curve overlaid so the rain → bonus story reads
 * at a glance. Hover a bar for the exact values.
 */
export function BonusTimeline({ points }: { points: BonusProjectionPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 960;
  const H = 260;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const n = points.length;
  const maxBonus = 3000;
  const maxMm = Math.max(1, ...points.map((p) => p.precipitation_mm));

  const barW = plotW / n;
  const yBonus = (cop: number) => padT + plotH - (cop / maxBonus) * plotH;
  const yMm = (mm: number) => padT + plotH - (mm / maxMm) * plotH;
  const x = (i: number) => padL + i * barW;

  const precipLine = points
    .map((p, i) => `${x(i) + barW / 2},${yMm(p.precipitation_mm)}`)
    .join(" ");

  const active = hover != null ? points[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        onMouseLeave={() => setHover(null)}
      >
        {/* y gridlines at each $1.000 */}
        {[0, 1000, 2000, 3000].map((g) => (
          <g key={g}>
            <line
              x1={padL}
              x2={W - padR}
              y1={yBonus(g)}
              y2={yBonus(g)}
              stroke="rgba(28,20,16,0.08)"
            />
            <text
              x={padL - 8}
              y={yBonus(g) + 4}
              textAnchor="end"
              fontSize="11"
              fill="#a99c92"
              fontFamily="var(--font-mono)"
            >
              ${g / 1000}k
            </text>
          </g>
        ))}

        {/* bonus bars */}
        {points.map((p, i) => {
          const t = bonusTier(p.recommended_bonus_cop);
          const top = yBonus(p.recommended_bonus_cop);
          const h = padT + plotH - top;
          return (
            <rect
              key={i}
              x={x(i) + 1}
              y={top}
              width={Math.max(1, barW - 2)}
              height={Math.max(0, h)}
              fill={t.hex}
              opacity={hover == null || hover === i ? 0.9 : 0.45}
              onMouseEnter={() => setHover(i)}
            />
          );
        })}

        {/* precipitation curve */}
        <polyline
          points={precipLine}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
          strokeOpacity="0.9"
        />

        {/* x labels every 12h */}
        {points.map((p, i) =>
          i % 12 === 0 ? (
            <text
              key={`x${i}`}
              x={x(i) + barW / 2}
              y={H - 12}
              textAnchor="middle"
              fontSize="11"
              fill="#a99c92"
              fontFamily="var(--font-mono)"
            >
              +{i}h
            </text>
          ) : null,
        )}

        {active && hover != null && (
          <line
            x1={x(hover) + barW / 2}
            x2={x(hover) + barW / 2}
            y1={padT}
            y2={padT + plotH}
            stroke="rgba(28,20,16,0.16)"
          />
        )}
      </svg>

      <div className="mt-3 flex items-center justify-between text-xs font-medium text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3 rounded-sm bg-brand" /> Bono recomendado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-blue-600" /> Precipitación (mm/h)
        </span>
      </div>

      {active && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-xs font-medium text-white shadow-pop ring-1 ring-black/10">
          <span className="text-white/60">+{hover}h · </span>
          <span className="font-semibold" style={{ color: rainHex(active.rain_intensity) }}>
            {rainLabel(active.rain_intensity)}
          </span>{" "}
          <span className="text-white/60">({active.precipitation_mm} mm)</span>{" "}
          <span className="font-bold text-brand-100">
            {formatBonus(active.recommended_bonus_cop)}
          </span>
        </div>
      )}
    </div>
  );
}
