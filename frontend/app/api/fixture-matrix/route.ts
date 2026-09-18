import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

export type FixtureMatrixRow = {
  fixture_id: number;
  event: number | null;
  kickoff_time: string | null;
  team_h: number;
  team_a: number;
  team_h_name: string;
  team_a_name: string;
  prob_home_win: number | null;
  prob_draw: number | null;
  prob_away_win: number | null;
  lambda_home: number | null;
  lambda_away: number | null;
  home_score: number | null;
  away_score: number | null;
  finished: boolean;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gwParam = searchParams.get("gw");
  try {
    const { rows } = await getPool().query(
      `WITH seasons AS (SELECT max(season) AS season FROM fpl.fixture_difficulties)
       SELECT fd.fixture_id, fd.event, fd.kickoff_time, fd.team_h, fd.team_a, fd.team_h_name, fd.team_a_name,
              fd.prob_home_win, fd.prob_draw, fd.prob_away_win, fd.lambda_home, fd.lambda_away,
              fd.home_score, fd.away_score, fd.finished
       FROM fpl.fixture_difficulties fd, seasons s
       WHERE fd.season = s.season
         AND ($1::bigint IS NULL OR fd.event = $1::bigint)
       ORDER BY fd.event ASC NULLS LAST, fd.kickoff_time ASC NULLS LAST, fd.fixture_id ASC`,
      [gwParam === null || gwParam === "" || Number.isNaN(Number(gwParam)) ? null : Number(gwParam)]
    );
    return NextResponse.json({ fixtures: rows });
  } catch (error) {
    console.error("[api/fixture-matrix] failed:", error);
    return NextResponse.json({ error: "Failed to fetch fixture matrix" }, { status: 500 });
  }
}
