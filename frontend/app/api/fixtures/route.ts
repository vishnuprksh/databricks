import { NextResponse } from "next/server";
import { fetchPlayerMatchDetails } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playerId = Number(searchParams.get("playerId"));
  if (!Number.isInteger(playerId) || playerId <= 0) {
    return NextResponse.json({ error: "playerId query param is required" }, { status: 400 });
  }
  try {
    const { last4, next4 } = await fetchPlayerMatchDetails(playerId);
    return NextResponse.json({ playerId, last4, next4 });
  } catch (error) {
    console.error("[api/fixtures] failed:", error);
    return NextResponse.json({ error: "Failed to fetch fixture details" }, { status: 500 });
  }
}
