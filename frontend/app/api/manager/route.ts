import { NextRequest, NextResponse } from "next/server";
import { fetchFplJson } from "@/lib/fpl";

export async function GET(req: NextRequest) {
  const teamId = req.nextUrl.searchParams.get("teamId");
  if (!teamId || !teamId.trim()) return NextResponse.json({ error: "teamId required" }, { status: 400 });
  try {
    const manager = await fetchFplJson(`entry/${parseInt(teamId, 10)}/`);
    return NextResponse.json({ manager });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 404 });
  }
}
