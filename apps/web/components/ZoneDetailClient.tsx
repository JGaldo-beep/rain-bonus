"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BonusProjectionPoint } from "@fleetweather/shared";
import type { ForecastLatest, RecommendationCurrent } from "../lib/types";
import { bonusTier, formatBonus, formatCop, formatEta, rainLabel } from "../lib/format";
import { BonusTimeline } from "./BonusTimeline";
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
    <>
      <header className="mt-4 flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-white/50">
            <ConnDot status={status} />
            {rec.pinned ? "Override de Ops activo" : "En vivo"}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{rec.zone_name}</h1>
          <p className="mt-1 text-white/50">
            {rec.city} · {rainLabel(rec.rain_intensity)}
            {forecast && rec.rain_intensity !== "none"
              ? ` · empieza ${formatEta(forecast.summary.next_rain_eta_min)}`
              : ""}
          </p>
        </div>
        <div className={`rounded-2xl border px-6 py-4 ${tier.border} ${tier.bg}`}>
          <div className="text-xs uppercase tracking-wide text-white/50">
            Bono recomendado / entrega
          </div>
          <div className={`mt-1 text-4xl font-bold ${tier.text}`}>
            {formatBonus(rec.recommended_bonus_cop)}
          </div>
          <div className="mt-1 text-xs text-white/50">
            {formatCop(rec.base_delivery_rate_cop)} base →{" "}
            <span className="text-white/80">{formatCop(total)}</span> con bono
          </div>
        </div>
      </header>

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {isPending && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <span>
            ⚠ Confianza del forecast {rec.confidence_pct}% (&lt; 60%). Requiere
            aprobación manual de Ops antes de publicar el bono (regla §8).
          </span>
          <button
            disabled={pending}
            onClick={() => run(() => postAction(rec.zone_id, "approve"))}
            className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-300 disabled:opacity-50"
          >
            {pending ? "Aprobando…" : "Aprobar y publicar"}
          </button>
        </div>
      )}

      <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Brecha de oferta" value={`${rec.expected_supply_gap}`} sub="Rappiteneros a incentivar" />
        <Stat label="Multiplicador demanda" value={`×${rec.demand_multiplier.toFixed(2)}`} sub="pedidos vs. día seco" />
        <Stat label="Confianza" value={`${rec.confidence_pct}%`} sub="del forecast" />
        <Stat
          label="Horas de lluvia"
          value={forecast ? `${forecast.summary.rainy_hours} h` : "—"}
          sub="en las próximas 72 h"
        />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_minmax(0,300px)]">
        <section className="rounded-2xl bg-white/[0.02] p-6 ring-1 ring-white/10">
          <h2 className="text-sm font-medium uppercase tracking-wide text-white/40">
            Proyección del bono · 72 h
          </h2>
          <p className="mb-4 mt-1 text-sm text-white/50">
            Cómo evoluciona el bono recomendado a medida que la lluvia entra y sale.
          </p>
          {projection.length > 0 ? (
            <BonusTimeline points={projection} />
          ) : (
            <p className="text-white/40">Sin proyección disponible.</p>
          )}
        </section>

        <div className="space-y-6">
          <FactorBreakdown rec={rec} />
          <OverridePanel rec={rec} pending={pending} onSubmit={(cop) => run(() => postAction(rec.zone_id, "override", { recommended_bonus_cop: cop }))} />
          <button
            disabled={pending}
            onClick={() => run(() => postAction(rec.zone_id, "trigger"))}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/[0.06] disabled:opacity-50"
          >
            {pending ? "Recalculando…" : "Recalcular ahora"}
          </button>
        </div>
      </div>
    </>
  );
}

function FactorBreakdown({ rec }: { rec: RecommendationCurrent }) {
  const sum = rec.factors.reduce((s, f) => s + f.contribution, 0);
  return (
    <section className="rounded-2xl bg-white/[0.02] p-5 ring-1 ring-white/10">
      <h2 className="text-sm font-medium uppercase tracking-wide text-white/40">
        Desglose del bono
      </h2>
      <ul className="mt-3 space-y-2 text-sm">
        {rec.factors.map((f) => (
          <li key={f.factor} className="flex items-center justify-between gap-2">
            <span className="text-white/60">{factorLabel(f.factor)}</span>
            <span className="font-medium text-white/90">+{formatCop(f.contribution)}</span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-2 border-t border-white/10 pt-2">
          <span className="text-white/50">Suma (antes de redondeo a $500)</span>
          <span className="font-semibold text-orange-300">+{formatCop(sum)}</span>
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
    <section className="rounded-2xl bg-white/[0.02] p-5 ring-1 ring-white/10">
      <h2 className="text-sm font-medium uppercase tracking-wide text-white/40">
        Override de Ops
      </h2>
      <p className="mt-1 text-xs text-white/40">
        Múltiplos de $500, máximo {formatCop(rec.max_bonus_cop)}. Queda fijado y la
        automatización lo respeta.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => setValue((v) => Math.max(0, v - 500))}
          className="h-9 w-9 rounded-lg bg-white/[0.05] text-lg hover:bg-white/[0.1]"
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
          className="w-full rounded-lg bg-white/[0.05] px-3 py-2 text-center text-sm tabular-nums outline-none ring-1 ring-white/10 focus:ring-sky-400/50"
        />
        <button
          onClick={() => setValue((v) => Math.min(rec.max_bonus_cop, v + 500))}
          className="h-9 w-9 rounded-lg bg-white/[0.05] text-lg hover:bg-white/[0.1]"
          aria-label="Subir $500"
        >
          +
        </button>
      </div>
      <button
        disabled={pending || invalid}
        onClick={() => onSubmit(value)}
        className="mt-3 w-full rounded-lg bg-fuchsia-500/90 px-3 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-40"
      >
        {pending ? "Aplicando…" : `Fijar bono en ${formatBonus(value)}`}
      </button>
    </section>
  );
}

function ConnDot({ status }: { status: "connecting" | "online" | "offline" }) {
  const color =
    status === "online" ? "bg-sky-400" : status === "connecting" ? "bg-amber-400" : "bg-red-400";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} title={status} />;
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/10">
      <div className="text-xs text-white/40">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      <div className="mt-0.5 text-xs text-white/40">{sub}</div>
    </div>
  );
}
