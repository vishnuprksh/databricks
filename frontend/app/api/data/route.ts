import { NextResponse } from "next/server";
import { fetchPlayers, fetchPredictions } from "@/lib/db";
import { fetchFplJson } from "@/lib/fpl";

export async function GET() {
  try {
    const [players, predictions, bootstrap] = await Promise.all([
      fetchPlayers(),
      fetchPredictions(),
      fetchFplJson("bootstrap-static/"),
    ]);
    const fplPlayerById = new Map<number, any>(bootstrap.elements.map((player: any) => [player.id, player]));
    const playersWithInjury = players.map((player) => {
      const fplPlayer = fplPlayerById.get(player.player_id);
      const chance = typeof fplPlayer?.chance_of_playing_next_round === "number"
        ? fplPlayer.chance_of_playing_next_round
        : null;
      return {
        ...player,
        chance_of_playing_next_round: chance,
        injury_percent: chance == null ? null : 100 - chance,
      };
    });
    return NextResponse.json({ players: playersWithInjury, predictions });
  } catch (e: any) {
    return NextResponse.json({ error: `Database error: ${e.message}` }, { status: 500 });
  }
}
