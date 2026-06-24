import Link from "next/link";

export interface MapZone {
  id: string;
  name: string;
  lat: number;
  lon: number;
  hex: string;
  bonusLabel: string;
}

/**
 * Lightweight "map" of Bogotá zones: an SVG scatter positioned by lat/lon and
 * colored by bonus tier. No tile/map dependency, so it renders instantly and
 * offline for the demo.
 */
export function ZoneMap({ zones }: { zones: MapZone[] }) {
  const W = 520;
  const H = 420;
  const pad = 56;

  const lats = zones.map((z) => z.lat);
  const lons = zones.map((z) => z.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const spanLat = maxLat - minLat || 1;
  const spanLon = maxLon - minLon || 1;

  // lon → x (east right), lat → y (north up, so invert).
  const px = (lon: number) => pad + ((lon - minLon) / spanLon) * (W - 2 * pad);
  const py = (lat: number) => H - pad - ((lat - minLat) / spanLat) * (H - 2 * pad);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full rounded-2xl ring-1 ring-line"
      role="img"
      aria-label="Mapa de zonas de Bogotá por nivel de bono"
    >
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="rgba(28,20,16,0.05)"
            strokeWidth="1"
          />
        </pattern>
        <radialGradient id="mapglow" cx="50%" cy="0%" r="90%">
          <stop offset="0%" stopColor="#fff2ee" />
          <stop offset="100%" stopColor="#fdfaf8" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#mapglow)" />
      <rect width={W} height={H} fill="url(#grid)" />

      {zones.map((z) => {
        const x = px(z.lon);
        const y = py(z.lat);
        return (
          <Link key={z.id} href={`/zones/${z.id}`}>
            <g className="cursor-pointer">
              <circle cx={x} cy={y} r={26} fill={z.hex} opacity={0.14} />
              <circle cx={x} cy={y} r={9} fill={z.hex} />
              <circle cx={x} cy={y} r={9} fill="none" stroke="white" strokeWidth={2} />
              <text
                x={x}
                y={y - 18}
                textAnchor="middle"
                fontSize="13"
                fontWeight="700"
                fill="#1c1410"
              >
                {z.name}
              </text>
              <text
                x={x}
                y={y + 31}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill={z.hex}
              >
                {z.bonusLabel}
              </text>
            </g>
          </Link>
        );
      })}
    </svg>
  );
}
