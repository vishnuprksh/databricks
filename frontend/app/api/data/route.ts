import { NextResponse } from "next/server";
import { fetchPlayers, fetchPredictions } from "@/lib/db";

export async function GET() {
  try {
    const [players, predictions] = await Promise.all([fetchPlayers(), fetchPredictions()]);
    return NextResponse.json({ players, predictions });
  } catch (e: any) {
    return NextResponse.json({ error: `Database error: ${e.message}` }, { status: 500 });
  }
}
