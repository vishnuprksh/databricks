"use client";

import { useEffect, useMemo, useState } from "react";

type FixtureRow = {
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

const HEADER_BG = "bg-[#0d1526]";

/** Colour scale for win probability: red (low) → amber (mid) → green (high).
 *  Domain clamps to [0.2, 0.8] since most probabilities fall in that range. */
const PROB_MIN = 0.2;
const PROB_MAX = 0.8;

function probColor(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "transparent";
  const raw = Math.max(0, Math.min(1, p));
  const pct = Math.max(0, Math.min(1, (raw - PROB_MIN) / (PROB_MAX - PROB_MIN)));
  // 0 -> #ef4444, 0.5 -> #f59e0b, 1 -> #22c55e (simple 2-stop interpolation)
  const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
  const from = pct <= 0.5 ? [239, 68, 68] : [245, 158, 11];
  const to = pct <= 0.5 ? [245, 158, 11] : [34, 197, 94];
  const t = pct <= 0.5 ? pct / 0.5 : (pct - 0.5) / 0.5;
  return `rgb(${lerp(from[0], to[0], t)}, ${lerp(from[1], to[1], t)}, ${lerp(from[2], to[2], t)})`;
}

function fmtKickoff(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function FixturesPage() {
  const [fixtures, setFixtures] = useState<FixtureRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gw, setGw] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setFixtures(null);
    fetch(`/api/fixture-matrix${gw ? `?gw=${encodeURIComponent(gw)}` : ""}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json();
      })
      .then((json) => { if (!cancelled) setFixtures(json.fixtures ?? []); })
      .catch((e) => { if (!cancelled) setError(e.message ?? "Failed to load"); });
    return () => { cancelled = true; };
  }, [gw]);

  const teamIds = useMemo(() => {
    if (!fixtures) return [];
    const s = new Set<number>();
    for (const f of fixtures) { s.add(Number(f.team_h)); s.add(Number(f.team_a)); }
    return [...s].sort((a, b) => a - b);
  }, [fixtures]);

  const nameById = useMemo(() => {
    const m = new Map<number, string>();
    if (fixtures) for (const f of fixtures) {
      if (!m.has(Number(f.team_h))) m.set(Number(f.team_h), f.team_h_name);
      if (!m.has(Number(f.team_a))) m.set(Number(f.team_a), f.team_a_name);
    }
    return m;
  }, [fixtures]);

  const events = useMemo(() => {
    if (!fixtures) return [];
    const s = new Set<number>();
    for (const f of fixtures) if (f.event != null) s.add(Number(f.event));
    return [...s].sort((a, b) => a - b);
  }, [fixtures]);

  /** weeks × teams: each cell = the row team's fixture in that gameweek */
  const schedule = useMemo(() => {
    if (!fixtures) return [];
    const byTeamGw = new Map<string, FixtureRow>();
    for (const f of fixtures) {
      if (f.event == null) continue;
      byTeamGw.set(`${f.team_h}-${f.event}`, f);
      byTeamGw.set(`${f.team_a}-${f.event}`, f);
    }
    return teamIds.map((teamId) => ({
      teamId,
      cells: events.map((ev) => ({ ev, fixture: byTeamGw.get(`${teamId}-${ev}`) ?? null })),
    }));
  }, [fixtures, teamIds, events]);

  return (
    <main className="mx-auto max-w-[1400px] px-2 py-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Fixtures — Gameweek Schedule</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Each cell shows a team's fixture that week: opponent, home/away and the team's win probability, from the
        Poisson model in <code>fpl.fixture_difficulties</code>. Hover a cell for score details.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--muted)]">GW</span>
          <input
            value={gw}
            onChange={(e) => setGw(e.target.value)}
            placeholder="all"
            className="w-20 rounded-md border border-[var(--border)] bg-[#0d1526] px-2 py-1 text-sm"
          />
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">Failed to load: {error}</p>}
      {!fixtures && !error && <p className="mt-4 text-sm text-[var(--muted)]">Loading…</p>}

      {fixtures && (
        <>
          <p className="mt-3 text-xs text-[var(--muted)]">
            {fixtures.length} fixtures · gameweeks {events.length ? `${events[0]}–${events[events.length - 1]}` : "—"}
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full table-fixed border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className={`sticky left-0 z-10 ${HEADER_BG} px-3 py-2 text-left text-[10px] uppercase tracking-wide text-[var(--muted)]`}>
                    Team
                  </th>
                  {events.map((ev) => (
                    <th key={ev} className={`${HEADER_BG} px-0.5 py-2 text-center font-semibold`}>
                      <span className="text-[10px]">GW{ev}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.map(({ teamId, cells }) => (
                  <tr key={teamId} className="border-t border-[var(--border)]">
                    <th className={`sticky left-0 z-10 ${HEADER_BG} px-3 py-1 text-left font-semibold whitespace-nowrap`}>
                      {nameById.get(teamId)}
                    </th>
                    {cells.map(({ ev, fixture }) => {
                      if (!fixture) {
                        return <td key={ev} className="px-0.5 py-0.5 text-center text-[var(--muted)] opacity-40">·</td>;
                      }
                      const home = Number(fixture.team_h) === teamId;
                      const p = home ? fixture.prob_home_win : fixture.prob_away_win;
                      const pct = p != null ? Math.round(p * 100) : null;
                      const opponent = home ? fixture.team_a_name : fixture.team_h_name;
                      return (
                        <td key={ev} className="p-[2px]">
                          <div
                            title={`${fixture.team_h_name} ${fixture.home_score ?? "–"} : ${fixture.away_score ?? "–"} ${fixture.team_a_name}\nGW ${fixture.event ?? "?"} · ${fmtKickoff(fixture.kickoff_time)}\nWin ${pct ?? "?"}% / Draw ${(home ? fixture.prob_draw : fixture.prob_draw) != null ? Math.round((fixture.prob_draw ?? 0) * 100) : "?"}% / Lose ${(home ? fixture.prob_away_win : fixture.prob_home_win) != null ? Math.round((home ? fixture.prob_away_win : fixture.prob_home_win) ?? 0) * 100 : "?"}%`}
                            className="flex h-10 w-full min-w-0 cursor-default flex-col items-center justify-center rounded"
                            style={{ backgroundColor: probColor(p) }}
                          >
                            <span className="w-full truncate px-0.5 text-center text-[10px] font-semibold text-black/80">
                              {home ? "vs" : "@"} {opponent}
                            </span>
                            <span className="text-[9px] font-bold text-black/70">
                              {pct != null ? `${pct}%` : "—"}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-[var(--muted)]">
            <span>&lt;20%</span>
            <span className="h-2 w-40 rounded" style={{ background: "linear-gradient(to right, rgb(239,68,68), rgb(245,158,11), rgb(34,197,94))" }} />
            <span>&gt;80% win probability</span>
          </div>
        </>
      )}
    </main>
  );
}
