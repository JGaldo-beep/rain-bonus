import Link from "next/link";
import { notFound } from "next/navigation";
import { getBonusProjection, getForecast, getRecommendation } from "../../../lib/api";
import { ZoneDetailClient } from "../../../components/ZoneDetailClient";

export const dynamic = "force-dynamic";

export default async function ZoneDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [rec, forecast, projection] = await Promise.all([
    getRecommendation(id).catch(() => null),
    getForecast(id).catch(() => null),
    getBonusProjection(id).catch(() => []),
  ]);

  if (!rec) notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/" className="text-sm text-white/50 hover:text-white">
        ← Volver al panel
      </Link>
      <ZoneDetailClient initialRec={rec} forecast={forecast} projection={projection} />
    </main>
  );
}
