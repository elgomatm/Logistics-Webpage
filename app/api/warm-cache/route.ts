/**
 * /api/warm-cache
 *
 * Called by the Vercel cron job every hour (see vercel.json).
 * Hits /api/reports-count to populate the Data Cache so the
 * first real user always gets an instant response.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const base =
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  try {
    const res = await fetch(`${base}/api/reports-count`, { cache: "no-store" });
    const data = await res.json();
    console.log("[warm-cache] pre-fetched reports count:", data.total, "| source:", data.source);
    return NextResponse.json({ ok: true, total: data.total, source: data.source });
  } catch (err) {
    console.log("[warm-cache] ERROR:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
