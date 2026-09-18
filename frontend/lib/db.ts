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

export type FixtureDifficultyRow = {
  fixture_id: number;
  event: number | null;
  kickoff_time: string | null;
  team_h_name: string;
  team_a_name: string;
  prob_home_win: number | null;
  prob_draw: number | null;
  prob_away_win: number | null;
  prob_home_clean: number | null;
  prob_away_clean: number | null;
  lambda_home: number | null;
  lambda_away: number | null;
  home_score: number | null;
  away_score: number | null;
  finished: boolean;
};

export type PlayerMatchRow = {
  fixture_id: number;
  gameweek: number | null;
  kickoff_time: string | null;
  opponent_team: number | null;
  opponent_name: string | null;
  was_home: boolean;
  fixture_difficulty: number | null;
  total_points: number | null;
  minutes: number | null;
  goals_scored: number | null;
  assists: number | null;
  bonus: number | null;
  clean_sheets: number | null;
  ict_index: number | null;
  expected_goals: number | null;
  expected_assists: number | null;
  prob_win: number | null; // player's team win prob (next fixtures, from fixture_difficulties)
  opponent: string | null; // opponent club short-ish name for next fixtures
  finished: boolean;
};

/** Last 4 played + next 4 upcoming matches for a player, merged with fixture difficulty/win probs. */
export async function fetchPlayerMatchDetails(playerId: number): Promise<{
  last4: PlayerMatchRow[];
  next4: PlayerMatchRow[];
}> {
  const { rows } = await getPool().query(
    `
    WITH seasons AS (
      SELECT max(season) AS season FROM fpl.player_history
    ),
    ph AS (
      SELECT ph.*
      FROM fpl.player_history ph, seasons s
      WHERE ph.player_id = $1 AND ph.season = s.season
    ),
    team AS (
      SELECT team_id FROM ph ORDER BY kickoff_time DESC NULLS LAST, fixture_id DESC LIMIT 1
    ),
    last4 AS (
      SELECT fixture_id, gameweek, kickoff_time, opponent_team, was_home,
             fixture_difficulty, total_points, minutes, goals_scored, assists, bonus,
             clean_sheets, ict_index, expected_goals, expected_assists
      FROM ph WHERE minutes IS NOT NULL AND minutes > 0
      ORDER BY kickoff_time DESC NULLS LAST, fixture_id DESC LIMIT 4
    ),
    next4 AS (
      SELECT fd.fixture_id, fd.event AS gameweek, fd.kickoff_time::text AS kickoff_time,
             CASE WHEN t.team_id = fd.team_h THEN fd.team_a ELSE fd.team_h END AS opponent_team,
             (t.team_id = fd.team_h) AS was_home,
             NULL::integer AS fixture_difficulty,
             NULL::integer AS total_points, NULL::integer AS minutes, NULL::integer AS goals_scored,
             NULL::integer AS assists, NULL::integer AS bonus, NULL::integer AS clean_sheets,
             NULL::double precision AS ict_index, NULL::double precision AS expected_goals,
             NULL::double precision AS expected_assists
      FROM fpl.fixture_difficulties fd, team t, seasons s
      WHERE fd.season = s.season AND fd.finished = false AND (fd.team_h = t.team_id OR fd.team_a = t.team_id)
      ORDER BY fd.kickoff_time ASC NULLS LAST, fd.fixture_id ASC LIMIT 4
    )
    SELECT 'last' AS kind, l.* FROM last4 l
    UNION ALL
    SELECT 'next' AS kind, n.* FROM next4 n
    `,
    [playerId]
  );

  // Opponent names + win probs come from fixture_difficulties
  const { rows: fdRows } = await getPool().query(
    `SELECT fixture_id, event, kickoff_time, team_h, team_a, team_h_name, team_a_name,
            lambda_home, lambda_away, prob_home_win, prob_draw, prob_away_win,
            prob_home_clean, prob_away_clean, home_score, away_score, finished
     FROM fpl.fixture_difficulties`
  );
  const fdById = new Map<number, FixtureDifficultyRow>();
  for (const r of fdRows) {
    fdById.set(Number(r.fixture_id), {
      fixture_id: Number(r.fixture_id),
      event: r.event === null ? null : Number(r.event),
      kickoff_time: r.kickoff_time ? new Date(r.kickoff_time).toISOString() : null,
      team_h_name: r.team_h_name,
      team_a_name: r.team_a_name,
      prob_home_win: numOrNull(r.prob_home_win),
      prob_draw: numOrNull(r.prob_draw),
      prob_away_win: numOrNull(r.prob_away_win),
      prob_home_clean: numOrNull(r.prob_home_clean),
      prob_away_clean: numOrNull(r.prob_away_clean),
      lambda_home: numOrNull(r.lambda_home),
      lambda_away: numOrNull(r.lambda_away),
      home_score: numOrNull(r.home_score),
      away_score: numOrNull(r.away_score),
      finished: Boolean(r.finished),
    });
  }

  const toMatch = (kind: "last" | "next", r: Record<string, unknown>): PlayerMatchRow => {
    const fd = fdById.get(Number(r.fixture_id));
    const wasHome = Boolean(r.was_home);
    const opponentName = fd ? (wasHome ? fd.team_a_name : fd.team_h_name) : null;
    const probWin = fd
      ? wasHome
        ? fd.prob_home_win
        : fd.prob_away_win
      : null;
    return {
      fixture_id: Number(r.fixture_id),
      gameweek: r.gameweek === null ? null : Number(r.gameweek),
      kickoff_time: r.kickoff_time ? new Date(r.kickoff_time as string).toISOString() : null,
      opponent_team: r.opponent_team === null ? null : Number(r.opponent_team),
      opponent_name: opponentName,
      was_home: wasHome,
      fixture_difficulty: r.fixture_difficulty === null ? null : Number(r.fixture_difficulty),
      total_points: r.total_points === null ? null : Number(r.total_points),
      minutes: r.minutes === null ? null : Number(r.minutes),
      goals_scored: r.goals_scored === null ? null : Number(r.goals_scored),
      assists: r.assists === null ? null : Number(r.assists),
      bonus: r.bonus === null ? null : Number(r.bonus),
      clean_sheets: r.clean_sheets === null ? null : Number(r.clean_sheets),
      ict_index: r.ict_index === null ? null : Number(r.ict_index),
      expected_goals: r.expected_goals === null ? null : Number(r.expected_goals),
      expected_assists: r.expected_assists === null ? null : Number(r.expected_assists),
      prob_win: probWin,
      opponent: opponentName,
      finished: kind === "last",
    };
  };

  const last4: PlayerMatchRow[] = [];
  const next4: PlayerMatchRow[] = [];
  for (const r of rows) {
    const kind = r.kind === "last" ? "last" : "next";
    (kind === "last" ? last4 : next4).push(toMatch(kind, r));
  }
  // The UNION ALL loses ordering; re-sort deterministically
  last4.sort((a, b) => (a.kickoff_time ?? "").localeCompare(b.kickoff_time ?? ""));
  next4.sort((a, b) => (a.kickoff_time ?? "").localeCompare(b.kickoff_time ?? ""));
  return { last4, next4 };
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

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
