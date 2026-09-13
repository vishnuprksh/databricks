import { NextRequest, NextResponse } from "next/server";
import { fetchFplJson, chooseGameweek } from "@/lib/fpl";

export async function GET(req: NextRequest) {
  const gw = req.nextUrl.searchParams.get("gw");
  try {
    const bootstrap = await fetchFplJson("bootstrap-static/");
    const gameweek = chooseGameweek(bootstrap.events, gw);
    return NextResponse.json({ gameweek, bootstrap });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
