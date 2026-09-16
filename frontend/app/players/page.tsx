"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlayerRow, PredictionRow } from "@/lib/db";

type SortKey = "web_name" | "total_points" | "form" | "price" | "avg_prob_gt_6";

const POS_COLORS: Record<string, string> = {
  GKP: "bg-amber-500/20 text-amber-300",
  DEF: "bg-sky-500/20 text-sky-300",
  MID: "bg-emerald-500/20 text-emerald-300",
  FWD: "bg-rose-500/20 text-rose-300",
};

function PosBadge({ pos }: { pos: string }) {
  return <span className={`badge ${POS_COLORS[pos] ?? "bg-slate-500/20 text-slate-300"}`}>{pos}</span>;
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("total_points");
  const [descending, setDescending] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/data")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load players");
        setPlayers(data.players);
        setPredictions(data.predictions);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const predictionById = useMemo(
    () => new Map(predictions.map((prediction) => [prediction.player_id, prediction])),
    [predictions]
  );

  const visiblePlayers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return players
      .filter((player) => {
        const matchesPosition = position === "ALL" || player.position === position;
        const matchesQuery = !normalizedQuery || [player.web_name, player.first_name, player.second_name, player.team_name]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
        return matchesPosition && matchesQuery;
      })
      .sort((a, b) => {
        const aPrediction = predictionById.get(a.player_id)?.avg_prob_gt_6 ?? -1;
        const bPrediction = predictionById.get(b.player_id)?.avg_prob_gt_6 ?? -1;
        const aValue = sortKey === "avg_prob_gt_6" ? aPrediction : a[sortKey];
        const bValue = sortKey === "avg_prob_gt_6" ? bPrediction : b[sortKey];
        const comparison = typeof aValue === "string" && typeof bValue === "string"
          ? aValue.localeCompare(bValue)
          : Number(aValue) - Number(bValue);
        return descending ? -comparison : comparison;
      });
  }, [players, predictionById, position, query, sortKey, descending]);

  const changeSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) setDescending((current) => !current);
    else {
      setSortKey(nextKey);
      setDescending(true);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <nav className="text-sm text-[var(--muted)] mb-4">
            <a href="/" className="hover:text-[var(--accent)]">Team Manager</a>
            <span className="mx-2">/</span>
            <span className="text-[var(--text)]">Players</span>
          </nav>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Player <span className="text-[var(--accent)]">Market</span>
          </h1>
          <p className="text-[var(--muted)] mt-1">All FPL players, current performance and model predictions</p>
        </div>
        <div className="text-sm text-[var(--muted)]">
          Showing <strong className="text-[var(--text)]">{visiblePlayers.length}</strong> of {players.length} players
        </div>
      </header>

      <section className="card p-5 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex-1 min-w-[240px]">
            <span className="block text-xs uppercase tracking-wide text-[var(--muted)] mb-1">Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Player or club"
              className="w-full bg-[#0d1526] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="w-40">
            <span className="block text-xs uppercase tracking-wide text-[var(--muted)] mb-1">Position</span>
            <select
              value={position}
              onChange={(event) => setPosition(event.target.value)}
              className="w-full bg-[#0d1526] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent)]"
            >
              <option value="ALL">All positions</option>
              <option value="GKP">Goalkeepers</option>
              <option value="DEF">Defenders</option>
              <option value="MID">Midfielders</option>
              <option value="FWD">Forwards</option>
            </select>
          </label>
        </div>
      </section>

      {loading && <p className="text-[var(--muted)]">Loading players...</p>}
      {error && <p className="text-rose-400">{error}</p>}
      {!loading && !error && (
        <section className="card p-5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data">
              <thead>
                <tr>
                  <th>Player</th><th>Pos</th><th>Club</th><th>Status</th>
                  <th><button onClick={() => changeSort("price")} className="hover:text-[var(--accent)]">Price</button></th>
                  <th><button onClick={() => changeSort("total_points")} className="hover:text-[var(--accent)]">Total</button></th>
                  <th><button onClick={() => changeSort("form")} className="hover:text-[var(--accent)]">Form</button></th>
                  <th>PPG</th><th>Own %</th>
                  <th><button onClick={() => changeSort("avg_prob_gt_6")} className="hover:text-[var(--accent)]">Prediction</button></th>
                </tr>
              </thead>
              <tbody>
                {visiblePlayers.map((player) => {
                  const prediction = predictionById.get(player.player_id);
                  return (
                    <tr key={player.player_id}>
                      <td>
                        <div className="font-semibold">{player.web_name}</div>
                        <div className="text-xs text-[var(--muted)]">{player.first_name} {player.second_name}</div>
                      </td>
                      <td><PosBadge pos={player.position} /></td>
                      <td className="text-[var(--muted)]">{player.team_name}</td>
                      <td><span className={player.status === "a" ? "text-emerald-400" : "text-rose-400"}>{player.status === "a" ? "Available" : player.status}</span></td>
                      <td>£{player.price.toFixed(1)}m</td>
                      <td>{player.total_points}</td>
                      <td>{player.form.toFixed(1)}</td>
                      <td>{player.points_per_game.toFixed(1)}</td>
                      <td>{player.selected_by_percent.toFixed(1)}%</td>
                      <td className="font-semibold text-[var(--accent)]">{prediction ? prediction.avg_prob_gt_6.toFixed(3) : "N/A"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="text-center text-xs text-[var(--muted)] py-6">
        Data: official FPL API + fpl schema (players, predictions, teams)
      </footer>
    </main>
  );
}