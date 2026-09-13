import { NextRequest, NextResponse } from "next/server";
import { fetchFplJson } from "@/lib/fpl";

// Squad picks + manager history for a given gameweek
export async function GET(req: NextRequest) {
  const teamId = req.nextUrl.searchParams.get("teamId");
  const gw = req.nextUrl.searchParams.get("gw");
  if (!teamId || !gw) return NextResponse.json({ error: "teamId and gw required" }, { status: 400 });
  try {
    const [picks, transfers] = await Promise.all([
      fetchFplJson(`entry/${parseInt(teamId, 10)}/event/${parseInt(gw, 10)}/picks/`),
      fetchFplJson(`entry/${parseInt(teamId, 10)}/transfers/`).catch(() => ({ transfers: [] as any[] })),
    ]);
    return NextResponse.json({ picks, transfers: transfers.transfers ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 404 });
  }
}
