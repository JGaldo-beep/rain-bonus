"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BonusProjectionPoint } from "@fleetweather/shared";
import type { ForecastLatest, RecommendationCurrent } from "../lib/types";
import { bonusTier, formatBonus, formatCop, formatEta, rainLabel } from "../lib/format";
import { BonusTimeline } from "./BonusTimeline";
import { TopBar, ConnPill } from "./TopBar";
import { useZoneStream, type WsEvent } from "./useZoneStream";

/** Apply a recommendation WS payload / action response onto the card state. */
function merge(rec: RecommendationCurrent, p: Record<string, unknown>): RecommendationCurrent {
  return {
    ...rec,
    recommended_bonus_cop: Number(p.recommended_bonus_cop),
    rain_intensity: p.rain_intensity as RecommendationCurrent["rain_intensity"],
    expected_supply_gap: Number(p.expected_supply_gap),
    demand_multiplier: Number(p.demand_multiplier),
    confidence_pct: Number(p.confidence_pct),
    status: p.status as RecommendationCurrent["status"],
    origin: p.origin as RecommendationCurrent["origin"],
    pinned: Boolean(p.pinned),
    factors: (p.factors as RecommendationCurrent["factors"]) ?? rec.factors,
    valid_until: String(p.valid_until ?? rec.valid_until),
  };
}

async function postAction(id: string, action: string, body?: unknown) {
  const res = await fetch(`/api/ops/zones/${id}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as { success: boolean; data?: unknown; error?: string };
  if (!res.ok || !json.success) throw new Error(json.error ?? `error ${res.status}`);
  return json.data as Record<string, unknown>;
}

export function ZoneDetailClient({
  initialRec,
  forecast,
  projection,
}: {
  initialRec: RecommendationCurrent;
  forecast: ForecastLatest | null;
  projection: BonusProjectionPoint[];
}) {
  const router = useRouter();
  const [rec, setRec] = useState(initialRec);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Follow server refreshes: when router.refresh() yields a fresh initialRec,
  // adopt it (React's sanctioned "adjust state during render" pattern). Between
  // refreshes the prop identity is stable, so WS updates to `rec` aren't clobbered.
  const [syncedFrom, setSyncedFrom] = useState(initialRec);
  if (syncedFrom !== initialRec) {
    setSyncedFrom(initialRec);
    setRec(initialRec);
  }

  // Live updates for this zone.
  const status = useZoneStream(rec.zone_id, (ev: WsEvent) => {
    if (ev.type === "recommendation.updated" || ev.type === "recommendation.published") {
      const p = ev.payload as Record<string, unknown>;
      setRec((cur) =>
        // published-wins: a new pending must not replace a live published card
        String(p.status) !== "published" && cur.status === "published" ? cur : merge(cur, p),
      );
    }
  });

  const run = (fn: () => Promise<Record<string, unknown>>) => {
    setError(null);
    startTransition(async () => {
      try {
        const data = await fn();
        setRec((cur) => merge(cur, data));
        router.refresh(); // re-pull projection/forecast from the server
      } catch (e) {
        setError(e instanceof Error ? e.message : "Acción fallida");
      }
    });
  };

  const tier = bonusTier(rec.recommended_bonus_cop);
  const total = rec.base_delivery_rate_cop + rec.recommended_bonus_cop;
  const isPending = rec.status === "pending_approval";

  return (
    <div className="relative z-10">
      <TopBar right={<ConnPill status={status} />} />

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-6 sm:px-8">
        <Link
          href="/"
          className="group inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft transition-colors hover:text-brand"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver al panel
        </Link>

        {/* ── Header + bonus headline ─────────────────────── */}
        <header className="rise mt-4 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-stretch">
          <div className="rounded-3xl border border-line bg-card p-6 shadow-soft sm:p-7">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
              <span className={`h-2 w-2 rounded-full ${rec.pinned ? "bg-fuchsia-500" : "bg-emerald-500"}`} />
              {rec.pinned ? "Override de Ops activo" : "Recomendación en vivo"}
            </div>
            <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
              {rec.zone_name}
            </h1>
            <p className="mt-2 text-[15px] text-ink-soft">
              {rec.city} ·{" "}
              <span className="font-semibold text-ink">{rainLabel(rec.rain_intensity)}</span>
              {forecast && rec.rain_intensity !== "none"
                ? ` · empieza ${formatEta(forecast.summary.next_rain_eta_min)}`
                : ""}
            </p>
            <span className={`mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${tier.border} ${tier.bg} ${tier.text}`}>
              <span className={`h-2 w-2 rounded-full ${tier.dot}`} />
              {tier.label}
            </span>
          </div>

          <div className={`relative overflow-hidden rounded-3xl p-7 text-white shadow-pop ${
            tier.key === "none"
              ? "bg-linear-to-br from-emerald-500 to-emerald-600"
              : "bg-linear-to-br from-brand via-brand-600 to-[#ff6a3d]"
          } lg:min-w-70`}>
            <div className="text-xs font-bold uppercase tracking-wider text-white/85">
              Bono recomendado / entrega
            </div>
            <div className="font-display tabular mt-2 text-5xl font-extrabold leading-none">
              {formatBonus(rec.recommended_bonus_cop)}
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur">
              <span className="tabular">{formatCop(rec.base_delivery_rate_cop)}</span>
              base
              <span className="opacity-60">→</span>
              <span className="tabular font-bold">{formatCop(total)}</span>
              con bono
            </div>
          </div>
        </header>

        {error && (
          <div className="rise mt-5 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">
            {error}
          </div>
        )}

        {isPending && (
          <div className="rise mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            <span className="font-medium">
              ⚠ Confianza del forecast {rec.confidence_pct}% (&lt; 60%). Requiere
              aprobación manual de Ops antes de publicar el bono (regla §8).
            </span>
            <button
              disabled={pending}
              onClick={() => run(() => postAction(rec.zone_id, "approve"))}
              className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-soft transition-colors hover:bg-amber-600 disabled:opacity-50"
            >
              {pending ? "Aprobando…" : "Aprobar y publicar"}
            </button>
          </div>
        )}

        {/* ── Stats ────────────────────────────────────────── */}
        <section className="mt-6 grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
          <Stat i={0} label="Brecha de oferta" value={`${rec.expected_supply_gap}`} sub="Rappiteneros a incentivar" />
          <Stat i={1} label="Multiplicador demanda" value={`×${rec.demand_multiplier.toFixed(2)}`} sub="pedidos vs. día seco" accent="text-brand" />
          <Stat i={2} label="Confianza" value={`${rec.confidence_pct}%`} sub="del forecast" accent={rec.confidence_pct < 60 ? "text-amber-600" : undefined} />
          <Stat
            i={3}
            label="Horas de lluvia"
            value={forecast ? `${forecast.summary.rainy_hours} h` : "—"}
            sub="en las próximas 72 h"
          />
        </section>

        {/* ── Timeline + side panels ──────────────────────── */}
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_minmax(0,320px)]">
          <section className="rise rounded-3xl border border-line bg-card p-6 shadow-soft" style={{ animationDelay: "120ms" }}>
            <h2 className="font-display text-lg font-bold text-ink">Proyección del bono · 72 h</h2>
            <p className="mb-5 mt-1 text-sm text-ink-soft">
              Cómo evoluciona el bono recomendado a medida que la lluvia entra y sale.
            </p>
            {projection.length > 0 ? (
              <BonusTimeline points={projection} />
            ) : (
              <p className="text-ink-faint">Sin proyección disponible.</p>
            )}
          </section>

          <div className="space-y-5">
            <FactorBreakdown rec={rec} />
            <OverridePanel rec={rec} pending={pending} onSubmit={(cop) => run(() => postAction(rec.zone_id, "override", { recommended_bonus_cop: cop }))} />
            <button
              disabled={pending}
              onClick={() => run(() => postAction(rec.zone_id, "trigger"))}
              className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-sm font-semibold text-ink shadow-soft transition-colors hover:bg-brand-50 hover:text-brand disabled:opacity-50"
            >
              {pending ? "Recalculando…" : "↻ Recalcular ahora"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function FactorBreakdown({ rec }: { rec: RecommendationCurrent }) {
  const sum = rec.factors.reduce((s, f) => s + f.contribution, 0);
  return (
    <section className="rise rounded-3xl border border-line bg-card p-5 shadow-soft" style={{ animationDelay: "180ms" }}>
      <h2 className="font-display text-base font-bold text-ink">Desglose del bono</h2>
      <ul className="mt-3 space-y-2.5 text-sm">
        {rec.factors.map((f) => (
          <li key={f.factor} className="flex items-center justify-between gap-2">
            <span className="text-ink-soft">{factorLabel(f.factor)}</span>
            <span className="tabular font-semibold text-ink">+{formatCop(f.contribution)}</span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-2 border-t border-line pt-2.5">
          <span className="text-ink-faint">Suma (antes de redondeo a $500)</span>
          <span className="tabular font-bold text-brand">+{formatCop(sum)}</span>
        </li>
      </ul>
    </section>
  );
}

const FACTOR_LABELS: Record<string, string> = {
  gap_closing_cost: "Cierre de brecha de oferta",
  demand_surge_premium: "Prima por demanda",
  rain_severity_premium: "Prima por intensidad",
  manual_override: "Override manual",
};
function factorLabel(key: string): string {
  return FACTOR_LABELS[key] ?? key;
}

function OverridePanel({
  rec,
  pending,
  onSubmit,
}: {
  rec: RecommendationCurrent;
  pending: boolean;
  onSubmit: (cop: number) => void;
}) {
  const [value, setValue] = useState(rec.recommended_bonus_cop);
  const invalid = value % 500 !== 0 || value < 0 || value > rec.max_bonus_cop;

  return (
    <section className="rise rounded-3xl border border-line bg-card p-5 shadow-soft" style={{ animationDelay: "240ms" }}>
      <h2 className="font-display text-base font-bold text-ink">Override de Ops</h2>
      <p className="mt-1 text-xs text-ink-soft">
        Múltiplos de $500, máximo {formatCop(rec.max_bonus_cop)}. Queda fijado y la
        automatización lo respeta.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => setValue((v) => Math.max(0, v - 500))}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-xl font-bold text-brand transition-colors hover:bg-brand-100"
          aria-label="Bajar $500"
        >
          −
        </button>
        <input
          type="number"
          step={500}
          min={0}
          max={rec.max_bonus_cop}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="tabular w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-center text-sm font-semibold text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-100"
        />
        <button
          onClick={() => setValue((v) => Math.min(rec.max_bonus_cop, v + 500))}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-xl font-bold text-brand transition-colors hover:bg-brand-100"
          aria-label="Subir $500"
        >
          +
        </button>
      </div>
      <button
        disabled={pending || invalid}
        onClick={() => onSubmit(value)}
        className="mt-4 w-full rounded-xl bg-brand px-3 py-2.5 text-sm font-bold text-white shadow-pop transition-all hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      >
        {pending ? "Aplicando…" : `Fijar bono en ${formatBonus(value)}`}
      </button>
    </section>
  );
}

function Stat({
  i,
  label,
  value,
  sub,
  accent,
}: {
  i: number;
  label: string;
  value: string;
  sub: string;
  accent?: string;
}) {
  return (
    <div
      className="rise rounded-3xl border border-line bg-card p-5 shadow-soft"
      style={{ animationDelay: `${i * 60 + 40}ms` }}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</div>
      <div className={`font-display tabular mt-2 text-3xl font-extrabold leading-none ${accent ?? "text-ink"}`}>
        {value}
      </div>
      <div className="mt-1.5 text-xs text-ink-faint">{sub}</div>
    </div>
  );
}
