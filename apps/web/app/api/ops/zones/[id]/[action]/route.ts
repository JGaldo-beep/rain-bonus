/**
 * Server-side proxy for Ops mutations (override / approve / trigger).
 *
 * The browser POSTs here same-origin (no key needed); this handler forwards to
 * the Fastify API with the bearer key, which lives only in the server env. This
 * is how the demo keeps endpoints gated without leaking the key to the client.
 */
const API_BASE =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3000/api/v1";
const API_KEY = process.env.API_KEY ?? "demo-key";

const ACTIONS: Record<string, string> = {
  override: "override",
  approve: "approve",
  trigger: "trigger",
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await ctx.params;
  const endpoint = ACTIONS[action];
  if (!endpoint) {
    return Response.json({ success: false, error: "unknown action" }, { status: 404 });
  }

  const body = await req.text(); // forward as-is (override carries a JSON body)
  const upstream = await fetch(
    `${API_BASE}/zones/${id}/recommendation/${endpoint}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${API_KEY}`,
        "content-type": "application/json",
      },
      body: body || undefined,
    },
  );

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}
