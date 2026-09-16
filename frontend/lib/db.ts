import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var _fplPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global._fplPool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is not set");
    global._fplPool = new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return global._fplPool;
}

export type PlayerRow = {
  player_id: number;
  web_name: string;
  first_name: string;
  second_name: string;
  element_type: number;
  position: string;
  price: number;
  team_id: number;
  status: string;
  news: string;
  total_points: number;
  form: number;
  points_per_game: number;
  selected_by_percent: number;
  team_name: string;
  team_short_name: string;
};

export type GwPrediction = { gw: number; prob_gt_6: number };

export type PredictionRow = {
  player_id: number;
  player_name: string;
  position: string;
  price: number;
  team_name: string;
  gw_predictions: GwPrediction[];
  avg_prob_gt_6: number;
};

export async function fetchPredictions(): Promise<PredictionRow[]> {
  const { rows } = await getPool().query(
    "SELECT player_id, player_name, position, price, team_name, gw_predictions, avg_prob_gt_6 FROM fpl.predictions"
  );
  return rows.map((r) => ({
    player_id: Number(r.player_id),
    player_name: r.player_name,
    position: r.position,
    price: Number(r.price),
    team_name: r.team_name,
    gw_predictions: typeof r.gw_predictions === "string" ? JSON.parse(r.gw_predictions) : r.gw_predictions,
    avg_prob_gt_6: Number(r.avg_prob_gt_6),
  }));
}

export async function fetchPlayers(): Promise<PlayerRow[]> {
  const { rows } = await getPool().query("SELECT * FROM fpl.players");
  return rows.map((r) => ({
    player_id: Number(r.player_id),
    web_name: r.web_name,
    first_name: r.first_name,
    second_name: r.second_name,
    element_type: Number(r.element_type),
    position: r.position,
    price: Number(r.price),
    team_id: Number(r.team_id),
    status: r.status,
    news: r.news ?? "",
    total_points: Number(r.total_points),
    form: Number(r.form),
    points_per_game: Number(r.points_per_game),
    selected_by_percent: Number(r.selected_by_percent),
    team_name: r.team_name,
    team_short_name: r.team_short_name,
  }));
}
