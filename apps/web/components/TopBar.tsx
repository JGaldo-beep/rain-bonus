import Link from "next/link";
import type { ReactNode } from "react";

/** Rappi's iconic mustache, white, drawn as a symmetric handlebar. */
export function Mustache({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 50" className={className} fill="currentColor" aria-hidden>
      {/* Left half, mirrored to the right — the dip at center is the philtrum. */}
      <g>
        <path d="M50 20.5 C 45.5 12.5, 39 9, 32.5 9.6 C 22 10.7, 12 14, 6 11 C 9.5 18.5, 11.5 30, 22.5 37.5 C 32 43, 44.5 39.5, 50 30.5 Z" />
        <path
          d="M50 20.5 C 45.5 12.5, 39 9, 32.5 9.6 C 22 10.7, 12 14, 6 11 C 9.5 18.5, 11.5 30, 22.5 37.5 C 32 43, 44.5 39.5, 50 30.5 Z"
          transform="translate(100,0) scale(-1,1)"
        />
      </g>
    </svg>
  );
}

/** The Rappi-style wordmark: orange, rounded, confident. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2.5 ${className}`}>
      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-linear-to-b from-[#ff5a2c] to-[#ff2e57] text-white shadow-pop transition-transform group-hover:-rotate-6">
        <Mustache className="w-6" />
      </span>
      <span className="leading-none">
        <span className="font-display block text-lg font-extrabold tracking-tight text-ink">
          Rappi<span className="text-brand">·</span>Ops
        </span>
        <span className="block text-[11px] font-medium text-ink-soft">
          Bono dinámico por lluvia
        </span>
      </span>
    </Link>
  );
}

/** Sticky translucent app bar shared across pages. */
export function TopBar({ right }: { right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Wordmark />
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-sm font-semibold text-ink shadow-soft">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand" fill="currentColor" aria-hidden>
              <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
            </svg>
            Bogotá
          </span>
          {right}
        </div>
      </div>
    </header>
  );
}

/** Live connection pill with an animated ping when online. */
export function ConnPill({ status }: { status: "connecting" | "online" | "offline" }) {
  const cfg = {
    online: { dot: "bg-emerald-500", label: "En vivo", ring: "ring-emerald-200" },
    connecting: { dot: "bg-amber-500", label: "Conectando", ring: "ring-amber-200" },
    offline: { dot: "bg-brand", label: "Sin conexión", ring: "ring-brand-100" },
  }[status];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-sm font-semibold text-ink-soft shadow-soft ring-1 ${cfg.ring}`}
    >
      <span className={`relative h-2 w-2 rounded-full ${cfg.dot} ${status === "online" ? "ping-soft" : ""}`} />
      {cfg.label}
    </span>
  );
}
