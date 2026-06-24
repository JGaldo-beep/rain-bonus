"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ZoneOverview } from "../lib/types";
import { bonusTier, formatBonus, rainLabel } from "../lib/format";
import { ZoneMap } from "./ZoneMap";
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
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
        Aprobación manual
      </span>
    );
  if (z.pinned)
    return (
      <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-xs text-fuchsia-300">
        Override Ops
      </span>
    );
  if (z.status === "published")
    return <span className="text-xs text-white/40">Publicado</span>;
  return <span className="text-xs text-white/30">—</span>;
}

export function DashboardClient({ initial }: { initial: ZoneOverview[] }) {
  const [zones, setZones] = useState<ZoneOverview[]>(initial);
  const status = useZoneStream(null, (ev) => setZones((rows) => applyEvent(rows, ev)));

  const withBonus = zones.filter((z) => (z.recommended_bonus_cop ?? 0) > 0);
  const maxBonus = Math.max(0, ...zones.map((z) => z.recommended_bonus_cop ?? 0));
  const pendingApproval = zones.filter((z) => z.status === "pending_approval").length;

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
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-sm text-white/50">
          <ConnDot status={status} />
          FleetWeather · Bono dinámico por lluvia
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Panel de operaciones — Bogotá
        </h1>
        <p className="mt-1 text-white/50">
          Bono por entrega recomendado para Rappiteneros, calculado por zona según
          el forecast de lluvia de las próximas 72 h.
        </p>
      </header>

      {status === "offline" && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Conexión en vivo perdida — reintentando. Los datos pueden estar
          desactualizados.
        </div>
      )}

      <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Zonas activas" value={String(zones.length)} />
        <Kpi label="Con bono activo" value={String(withBonus.length)} />
        <Kpi label="Bono máximo" value={formatBonus(maxBonus)} accent="text-orange-300" />
        <Kpi
          label="Requieren aprobación"
          value={String(pendingApproval)}
          accent={pendingApproval ? "text-amber-300" : undefined}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_1fr]">
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-white/40">
            Mapa de zonas
          </h2>
          <ZoneMap zones={mapZones} />
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/50">
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

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-white/40">
            Zonas por bono recomendado
          </h2>
          <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-left text-white/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Zona</th>
                  <th className="px-4 py-3 font-medium">Lluvia</th>
                  <th className="px-4 py-3 font-medium text-right">Bono / entrega</th>
                  <th className="px-4 py-3 font-medium text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => {
                  const tier = bonusTier(z.recommended_bonus_cop);
                  return (
                    <tr
                      key={z.zone_id}
                      className="border-t border-white/5 hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/zones/${z.zone_id}`}
                          className="flex items-center gap-2 font-medium hover:underline"
                        >
                          <span className={`h-2.5 w-2.5 rounded-full ${tier.dot}`} />
                          {z.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-white/60">{rainLabel(z.rain_intensity)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${tier.text}`}>
                        {formatBonus(z.recommended_bonus_cop)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <StatusBadge z={z} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function ConnDot({ status }: { status: "connecting" | "online" | "offline" }) {
  const color =
    status === "online" ? "bg-sky-400" : status === "connecting" ? "bg-amber-400" : "bg-red-400";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} title={status} />;
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/10">
      <div className="text-xs text-white/40">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent ?? ""}`}>{value}</div>
    </div>
  );
}
