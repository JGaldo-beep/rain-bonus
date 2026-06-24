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
      className="w-full h-auto rounded-xl bg-white/[0.02] ring-1 ring-white/10"
      role="img"
      aria-label="Mapa de zonas de Bogotá por nivel de bono"
    >
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#grid)" />

      {zones.map((z) => {
        const x = px(z.lon);
        const y = py(z.lat);
        return (
          <Link key={z.id} href={`/zones/${z.id}`}>
            <g className="cursor-pointer">
              <circle cx={x} cy={y} r={26} fill={z.hex} opacity={0.16} />
              <circle cx={x} cy={y} r={9} fill={z.hex} />
              <circle cx={x} cy={y} r={9} fill="none" stroke="white" strokeOpacity={0.5} />
              <text
                x={x}
                y={y - 18}
                textAnchor="middle"
                fontSize="13"
                fontWeight="600"
                fill="#e7e7ea"
              >
                {z.name}
              </text>
              <text
                x={x}
                y={y + 30}
                textAnchor="middle"
                fontSize="11"
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
