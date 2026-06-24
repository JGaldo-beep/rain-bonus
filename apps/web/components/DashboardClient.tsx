"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ZoneOverview } from "../lib/types";
import { bonusTier, formatBonus, formatCop, rainLabel } from "../lib/format";
import { ZoneMap } from "./ZoneMap";
import { TopBar, ConnPill } from "./TopBar";
import { useZoneStream, type WsEvent } from "./useZoneStream";

/** Merges a recommendation WS payload into the matching overview row. */
function applyEvent(rows: ZoneOverview[], ev: WsEvent): ZoneOverview[] {
  if (ev.type !== "recommendation.updated" && ev.type !== "recommendation.published")
    return rows;
  const p = ev.payload as Record<string, unknown>;
  return rows.map((r) => {
    if (r.zone_id !== ev.zone_id) return r;
    // Published-wins: don't let a new pending recommendation hide a live bonus.
    const incomingStatus = String(p.status) as ZoneOverview["status"];
    if (incomingStatus !== "published" && r.status === "published") return r;
    return {
      ...r,
      recommended_bonus_cop: Number(p.recommended_bonus_cop),
      rain_intensity: p.rain_intensity as ZoneOverview["rain_intensity"],
      expected_supply_gap: Number(p.expected_supply_gap),
      demand_multiplier: Number(p.demand_multiplier),
      confidence_pct: Number(p.confidence_pct),
      status: incomingStatus,
      origin: p.origin as ZoneOverview["origin"],
      pinned: Boolean(p.pinned),
    };
  });
}

function StatusBadge({ z }: { z: ZoneOverview }) {
  if (z.status === "pending_approval")
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
        Aprobación manual
      </span>
    );
  if (z.pinned)
    return (
      <span className="rounded-full bg-fuchsia-100 px-2.5 py-1 text-xs font-semibold text-fuchsia-700">
        Override Ops
      </span>
    );
  if (z.status === "published")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Publicado
      </span>
    );
  return <span className="text-xs text-ink-faint">En espera</span>;
}

export function DashboardClient({ initial }: { initial: ZoneOverview[] }) {
  const [zones, setZones] = useState<ZoneOverview[]>(initial);
  const status = useZoneStream(null, (ev) => setZones((rows) => applyEvent(rows, ev)));

  const withBonus = zones.filter((z) => (z.recommended_bonus_cop ?? 0) > 0);
  const maxBonus = Math.max(0, ...zones.map((z) => z.recommended_bonus_cop ?? 0));
  const pendingApproval = zones.filter((z) => z.status === "pending_approval").length;
  const raining = zones.filter((z) => z.rain_intensity && z.rain_intensity !== "none").length;

  // Sort by bonus desc so the hottest zones rise to the top of the list.
  const sorted = useMemo(
    () => [...zones].sort((a, b) => (b.recommended_bonus_cop ?? 0) - (a.recommended_bonus_cop ?? 0)),
    [zones],
  );

  const mapZones = useMemo(
    () =>
      zones.map((z) => {
        const tier = bonusTier(z.recommended_bonus_cop);
        return {
          id: z.zone_id,
          name: z.name,
          lat: z.lat,
          lon: z.lon,
          hex: tier.hex,
          bonusLabel: formatBonus(z.recommended_bonus_cop),
        };
      }),
    [zones],
  );

  return (
    <div className="relative z-10">
      <TopBar right={<ConnPill status={status} />} />

      <main className="mx-auto max-w-7xl px-5 pb-20 pt-6 sm:px-8">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="rise relative overflow-hidden rounded-[28px] bg-linear-to-br from-brand via-brand-600 to-[#ff6a3d] p-7 text-white shadow-pop sm:p-10">
          <RainBackdrop />
          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur">
              Centro de operaciones · Bogotá
            </span>
            <h1 className="font-display mt-4 text-4xl font-extrabold leading-[1.05] sm:text-5xl">
              Cuando llueve,
              <br />
              el bono se mueve.
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/90">
              Bono por entrega recomendado para Rappiteneros, recalculado por zona
              según el forecast de lluvia de las próximas 72&nbsp;horas.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-center">
              <HeroChip label="Zonas con lluvia" value={String(raining)} />
              <HeroChip label="Bono activo" value={String(withBonus.length)} />
              <HeroChip label="Bono máximo" value={formatBonus(maxBonus)} strong />
            </div>
          </div>
        </section>

        {status === "offline" && (
          <div className="rise mt-5 flex items-center gap-2 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">
            <span className="h-2 w-2 rounded-full bg-brand" />
            Conexión en vivo perdida — reintentando. Los datos pueden estar desactualizados.
          </div>
        )}

        {/* ── KPIs ─────────────────────────────────────────── */}
        <section className="mt-6 grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
          <Kpi i={0} label="Zonas activas" value={String(zones.length)} hint="monitoreadas en vivo" />
          <Kpi i={1} label="Con bono activo" value={String(withBonus.length)} hint="incentivo > $0" accent="text-brand" />
          <Kpi i={2} label="Bono máximo" value={formatBonus(maxBonus)} hint="por entrega" accent="text-brand" />
          <Kpi
            i={3}
            label="Requieren aprobación"
            value={String(pendingApproval)}
            hint="baja confianza · §8"
            accent={pendingApproval ? "text-amber-600" : undefined}
          />
        </section>

        {/* ── Map + list ───────────────────────────────────── */}
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,520px)_1fr]">
          <section className="rise rounded-3xl border border-line bg-card p-5 shadow-soft" style={{ animationDelay: "120ms" }}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink">Mapa de zonas</h2>
              <span className="text-xs font-medium text-ink-faint">Bogotá · {zones.length} zonas</span>
            </div>
            <ZoneMap zones={mapZones} />
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-ink-soft">
              {(["none", "low", "high", "critical"] as const).map((k) => {
                const t = bonusTier(
                  k === "none" ? 0 : k === "low" ? 1000 : k === "high" ? 2000 : 3000,
                );
                return (
                  <span key={k} className="inline-flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${t.dot}`} />
                    {t.label}
                  </span>
                );
              })}
            </div>
          </section>

          <section className="rise rounded-3xl border border-line bg-card p-5 shadow-soft" style={{ animationDelay: "200ms" }}>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink">Zonas por bono</h2>
              <span className="text-xs font-medium text-ink-faint">mayor incentivo primero</span>
            </div>
            <ul className="divide-y divide-line">
              {sorted.map((z) => {
                const tier = bonusTier(z.recommended_bonus_cop);
                return (
                  <li key={z.zone_id}>
                    <Link
                      href={`/zones/${z.zone_id}`}
                      className="group -mx-2 flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-brand-50"
                    >
                      <span className={`h-9 w-1.5 shrink-0 rounded-full ${tier.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-ink">{z.name}</div>
                        <div className="text-xs text-ink-soft">{rainLabel(z.rain_intensity)}</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-display tabular text-lg font-extrabold leading-none ${tier.text}`}>
                          {formatBonus(z.recommended_bonus_cop)}
                        </div>
                        <div className="mt-1 flex justify-end">
                          <StatusBadge z={z} />
                        </div>
                      </div>
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        aria-hidden
                      >
                        <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}

function HeroChip({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`rounded-2xl px-3.5 py-2 backdrop-blur ${
        strong ? "col-span-2 bg-white text-brand-700 sm:col-auto" : "bg-white/15 text-white"
      }`}
    >
      <div className={`text-[11px] font-semibold uppercase tracking-wide ${strong ? "text-brand-600/80" : "text-white/80"}`}>
        {label}
      </div>
      <div className="font-display tabular text-lg font-extrabold leading-tight">{value}</div>
    </div>
  );
}

function Kpi({
  i,
  label,
  value,
  hint,
  accent,
}: {
  i: number;
  label: string;
  value: string;
  hint: string;
  accent?: string;
}) {
  return (
    <div
      className="rise rounded-3xl border border-line bg-card p-5 shadow-soft transition-transform hover:-translate-y-0.5"
      style={{ animationDelay: `${i * 70 + 40}ms` }}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</div>
      <div className={`font-display tabular mt-2 text-3xl font-extrabold leading-none ${accent ?? "text-ink"}`}>
        {value}
      </div>
      <div className="mt-1.5 text-xs text-ink-faint">{hint}</div>
    </div>
  );
}

/** Deterministic diagonal rain streaks — no Math.random (avoids hydration drift). */
function RainBackdrop() {
  const streaks = Array.from({ length: 26 }, (_, i) => {
    const left = (i * 37) % 100;
    const delay = (i % 13) * 0.18;
    const dur = 0.9 + ((i * 7) % 10) * 0.09;
    const h = 22 + ((i * 5) % 5) * 8;
    return { left, delay, dur, h };
  });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-50" aria-hidden>
      {streaks.map((s, i) => (
        <span
          key={i}
          className="rain-streak absolute top-0 w-px bg-linear-to-b from-transparent via-white to-transparent"
          style={{
            left: `${s.left}%`,
            height: `${s.h}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.dur}s`,
            transform: "rotate(14deg)",
          }}
        />
      ))}
    </div>
  );
}
