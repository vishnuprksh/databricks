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
  chance_of_playing_next_round: number | null;
  injury_percent: number | null;
  total_points: number;
  form: number;
  points_per_game: number;
  selected_by_percent: number;
  team_name: string;
  team_short_name: string;
};

export type GwPrediction = { gw: number; prob_gt_6: number | null };

export type PredictionRow = {
  player_id: number;
  player_name: string;
  position: string;
  price: number;
  team_name: string;
  gw_predictions: GwPrediction[];
  agg_pred_prob: number;
};

export async function fetchPredictions(): Promise<PredictionRow[]> {
  const { rows } = await getPool().query(
    "SELECT player_id, player_name, position, price, team_name, gw_predictions, agg_pred_prob FROM fpl.predictions"
  );
  return rows.map((r) => ({
    player_id: Number(r.player_id),
    player_name: r.player_name,
    position: r.position,
    price: Number(r.price),
    team_name: r.team_name,
    gw_predictions: (typeof r.gw_predictions === "string" ? JSON.parse(r.gw_predictions) : r.gw_predictions).map(
      (forecast: { gw: number; prob_gt_6?: unknown }) => ({
        gw: Number(forecast.gw),
        prob_gt_6: typeof forecast.prob_gt_6 === "number" && Number.isFinite(forecast.prob_gt_6) ? forecast.prob_gt_6 : null,
      })
    ),
    agg_pred_prob: Number(r.agg_pred_prob),
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
    chance_of_playing_next_round: null,
    injury_percent: null,
    total_points: Number(r.total_points),
    form: Number(r.form),
    points_per_game: Number(r.points_per_game),
    selected_by_percent: Number(r.selected_by_percent),
    team_name: r.team_name,
    team_short_name: r.team_short_name,
  }));
}
