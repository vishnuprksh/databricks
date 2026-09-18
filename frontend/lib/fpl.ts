// Shared types & helpers for FPL data

export const BASE_URL = "https://fantasy.premierleague.com/api";

export const HEADERS = {
  "User-Agent": "fpl-team-fetcher/vercel",
  Accept: "application/json",
};

export async function fetchFplJson(endpoint: string): Promise<any> {
  const url = `${BASE_URL}/${endpoint.replace(/^\//, "")}`;
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 60 } });
  if (res.status === 404) throw new Error(`FPL returned 404 for ${url}. Check the team ID and gameweek.`);
  if (!res.ok) throw new Error(`FPL returned HTTP ${res.status} for ${url}.`);
  return res.json();
}

export function chooseGameweek(events: any[], requested: string | null): number {
  const validIds = new Set(events.map((e) => e.id));
  if (requested && requested.trim()) {
    const req = parseInt(requested, 10);
    if (!validIds.has(req)) {
      throw new Error(`Gameweek must be one of: ${Math.min(...validIds)}-${Math.max(...validIds)}`);
    }
    return req;
  }
  const current = events.find((e) => e.is_current);
  if (current) return current.id;
  const finished = events.filter((e) => e.finished).map((e) => e.id);
  if (finished.length) return Math.max(...finished);
  const next = events.find((e) => e.is_next);
  if (next) return next.id;
  throw new Error("Could not determine a gameweek from bootstrap-static.");
}

export type TeamRow = {
  squad_position: number;
  player_id: number;
  player_name: string;
  full_name: string;
  club: string;
  position: string;
  price: number;
  selected_by_percent: number;
  chance_of_playing_next_round: number | null;
  total_points: number;
  form: number;
  gameweek_points: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  is_starter: boolean;
};

export function buildTeamRows(picks: any[], players: any[], teams: any[], positions: any[]): TeamRow[] {
  const playerById = new Map(players.map((p) => [p.id, p]));
  const teamById = new Map(teams.map((t) => [t.id, t.name]));
  const posById = new Map(positions.map((p) => [p.id, p.singular_name_short]));

  return [...picks]
    .sort((a, b) => a.position - b.position)
    .map((pick) => {
      const player = playerById.get(pick.element);
      if (!player) return null;
      return {
        squad_position: pick.position,
        player_id: player.id,
        player_name: player.web_name,
        full_name: `${player.first_name} ${player.second_name}`,
        club: teamById.get(player.team) ?? "Unknown",
        position: posById.get(player.element_type) ?? "Unknown",
        price: player.now_cost / 10,
        selected_by_percent: parseFloat(player.selected_by_percent),
        chance_of_playing_next_round: player.chance_of_playing_next_round ?? null,
        total_points: player.total_points,
        form: parseFloat(player.form),
        gameweek_points: pick.points ?? 0,
        multiplier: pick.multiplier,
        is_captain: pick.is_captain,
        is_vice_captain: pick.is_vice_captain,
        is_starter: pick.position <= 11,
      } as TeamRow;
    })
    .filter(Boolean) as TeamRow[];
}
