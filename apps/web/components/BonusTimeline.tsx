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
              stroke="rgba(255,255,255,0.08)"
            />
            <text x={padL - 8} y={yBonus(g) + 4} textAnchor="end" fontSize="11" fill="#71717a">
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
          stroke="#38bdf8"
          strokeWidth="1.5"
          strokeOpacity="0.85"
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
              fill="#71717a"
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
            stroke="rgba(255,255,255,0.25)"
          />
        )}
      </svg>

      <div className="mt-2 flex items-center justify-between text-xs text-white/45">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-orange-400" /> Bono recomendado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-sky-400" /> Precipitación (mm/h)
        </span>
      </div>

      {active && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg bg-zinc-900 px-3 py-2 text-xs ring-1 ring-white/15">
          <span className="text-white/50">+{hover}h · </span>
          <span style={{ color: rainHex(active.rain_intensity) }}>
            {rainLabel(active.rain_intensity)}
          </span>{" "}
          <span className="text-white/50">({active.precipitation_mm} mm)</span>{" "}
          <span className="font-semibold text-orange-300">
            {formatBonus(active.recommended_bonus_cop)}
          </span>
        </div>
      )}
    </div>
  );
}
