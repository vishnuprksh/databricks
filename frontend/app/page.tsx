"use client";

import { useCallback, useEffect, useState } from "react";
import type { TeamRow } from "@/lib/fpl";
import { findBestTransfer, generateSuggestions, optimizeStartingEleven } from "@/lib/suggestions";
import type { SquadPlayer, Suggestion, StatsRow, OptimizeResult } from "@/lib/suggestions";
import type { PredictionRow } from "@/lib/db";

type Manager = any;
type Bootstrap = any;

const POS_COLORS: Record<string, string> = {
  GKP: "bg-amber-500/20 text-amber-300",
  DEF: "bg-sky-500/20 text-sky-300",
  MID: "bg-emerald-500/20 text-emerald-300",
  FWD: "bg-rose-500/20 text-rose-300",
};

function PosBadge({ pos }: { pos: string }) {
  return <span className={`badge ${POS_COLORS[pos] ?? "bg-slate-500/20 text-slate-300"}`}>{pos}</span>;
}

export default function Home() {
  const [teamId, setTeamId] = useState("");
  const [gwInput, setGwInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [manager, setManager] = useState<Manager | null>(null);
  const [gameweek, setGameweek] = useState<number | null>(null);
  const [teamRows, setTeamRows] = useState<TeamRow[]>([]);
  const [entryHistory, setEntryHistory] = useState<any>(null);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [bank, setBank] = useState(0);
  const [clubCount, setClubCount] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<Record<string, StatsRow>>({});
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [noPred, setNoPred] = useState<string[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [suggestingTransfer, setSuggestingTransfer] = useState(false);
  const [optResult, setOptResult] = useState<OptimizeResult | null>(null);

  const optimize = async () => {
    if (squad.length !== 15) {
      setError("Need a full 15-man squad to optimize.");
      return;
    }
    setOptimizing(true);
    try {
      setOptResult(optimizeStartingEleven(squad));
    } finally {
      setOptimizing(false);
    }
  };

  const suggestBestTransfer = async () => {
    setSuggestingTransfer(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    try {
      const best = findBestTransfer(squad, predictions, stats, bank, teamRows.map((r) => r.player_name));
      setSuggestions(best ? [best] : []);
      const nextClubCount: Record<string, number> = {};
      for (const player of squad) nextClubCount[player.club] = (nextClubCount[player.club] ?? 0) + 1;
      setClubCount(nextClubCount);
    } finally {
      setSuggestingTransfer(false);
    }
  };

  const approveTransfer = (suggestion: Suggestion) => {
    const outgoing = teamRows.find((r) => r.player_name === suggestion.out.name);
    const incomingPrediction = predictions.find((p) => p.player_name === suggestion.in.name);
    if (!outgoing || !incomingPrediction) return;

    const incomingStats = stats[suggestion.in.name];
    if (!incomingStats) return;

    const incomingRow: TeamRow = {
      ...outgoing,
      player_id: incomingPrediction.player_id,
      player_name: suggestion.in.name,
      full_name: suggestion.in.name,
      club: suggestion.in.club,
      price: suggestion.in.price,
      selected_by_percent: incomingStats.selected_by_percent,
      total_points: incomingStats.total_points,
      form: incomingStats.form,
    };
    const incomingSquadPlayer: SquadPlayer = {
      name: suggestion.in.name,
      pos: suggestion.out.pos,
      nowPrice: suggestion.in.price,
      sellPrice: suggestion.in.price,
      pred: suggestion.in.pred,
      starter: suggestion.out.starter,
      club: suggestion.in.club,
    };
    const nextRows = teamRows.map((r) => (r.player_name === suggestion.out.name ? incomingRow : r));
    const nextSquad = squad.map((p) => (p.name === suggestion.out.name ? incomingSquadPlayer : p));
    const nextBank = bank - suggestion.in.costDiff;
    const bestNextTransfer = findBestTransfer(nextSquad, predictions, stats, nextBank, nextRows.map((r) => r.player_name));
    const nextSuggestions = bestNextTransfer ? [bestNextTransfer] : [];

    setTeamRows(nextRows);
    setSquad(nextSquad);
    setBank(nextBank);
    setSuggestions(nextSuggestions);
    const nextClubCount: Record<string, number> = {};
    for (const player of nextSquad) nextClubCount[player.club] = (nextClubCount[player.club] ?? 0) + 1;
    setClubCount(nextClubCount);
    setNoPred(nextSquad.filter((p) => p.pred === null).map((p) => p.name));
    setOptResult(optimizeStartingEleven(nextSquad));
  };

  const load = useCallback(async () => {
    if (!teamId.trim()) {
      setError("Please enter a Team ID");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. Bootstrap (resolve gameweek + player/team metadata)
      const bsRes = await fetch(`/api/bootstrap?gw=${encodeURIComponent(gwInput)}`);
      const bs = await bsRes.json();
      if (!bsRes.ok) throw new Error(bs.error);
      const gameweek: number = bs.gameweek;
      const bootstrap: Bootstrap = bs.bootstrap;

      // 2. Manager info
      const mRes = await fetch(`/api/manager?teamId=${encodeURIComponent(teamId)}`);
      const md = await mRes.json();
      if (!mRes.ok) throw new Error(md.error);
      setManager(md.manager);

      // 3. Picks + transfers
      const pkRes = await fetch(`/api/picks?teamId=${encodeURIComponent(teamId)}&gw=${gameweek}`);
      const pk = await pkRes.json();
      if (!pkRes.ok) throw new Error(pk.error);

      // Build team rows (same logic as notebook)
      const playerById = new Map<number, any>(bootstrap.elements.map((p: any) => [p.id, p]));
      const teamById = new Map<number, string>(bootstrap.teams.map((t: any) => [t.id, t.name]));
      const posById = new Map<number, string>(bootstrap.element_types.map((p: any) => [p.id, p.singular_name_short]));
      const rows = [...pk.picks.picks]
        .sort((a: any, b: any) => a.position - b.position)
        .map((pick: any) => {
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
            total_points: player.total_points,
            form: parseFloat(player.form),
            gameweek_points: pick.points ?? 0,
            multiplier: pick.multiplier,
            is_captain: pick.is_captain,
            is_vice_captain: pick.is_vice_captain,
            is_starter: pick.position <= 11,
            photo: (player.photo ?? "").replace(/\.jpg$/, ""), // e.g. "95658" → /p95658.png
          };
        })
        .filter(Boolean) as TeamRow[];
      setTeamRows(rows);
      setEntryHistory(pk.picks.entry_history ?? {});
      setActiveChip(pk.picks.active_chip ?? null);
      setGameweek(gameweek);

      // 4. DB data (players + predictions) and transfer suggestions
      const dataRes = await fetch("/api/data");
      const data = await dataRes.json();
      if (!dataRes.ok) throw new Error(data.error);

      const statsMap: Record<string, StatsRow> = {};
      for (const p of data.players) {
        statsMap[p.web_name] = {
          web_name: p.web_name,
          position: p.position,
          price: p.price,
          team_name: p.team_name,
          status: p.status,
          news: p.news,
          total_points: p.total_points,
          form: p.form,
          points_per_game: p.points_per_game,
          selected_by_percent: p.selected_by_percent,
        };
      }
      setStats(statsMap);

      const predById: Record<number, any> = {};
      for (const p of data.predictions) predById[p.player_id] = p;
      setPredictions(data.predictions);

      // Sell prices from transfer history
      const purchasePrices: Record<number, number> = {};
      for (const t of [...(pk.transfers ?? [])].sort((a: any, b: any) => a.event - b.event)) {
        purchasePrices[t.element_in] = t.element_in_cost;
        if (t.element_out in purchasePrices) delete purchasePrices[t.element_out];
      }
      const sell: Record<string, number> = {};
      for (const r of rows) {
        const nowTenths = Math.round(r.price * 10);
        const buyTenths = purchasePrices[r.player_id] ?? nowTenths;
        sell[r.player_name] = Math.min(buyTenths, nowTenths) / 10;
      }

      const squadPlayers: SquadPlayer[] = rows.map((r) => ({
        name: r.player_name,
        pos: r.position,
        nowPrice: r.price,
        sellPrice: sell[r.player_name] ?? r.price,
        pred: predById[r.player_id]?.avg_prob_gt_6 ?? null,
        starter: r.is_starter,
        club: r.club,
        photo: (r as any).photo,
      }));
      setSquad(squadPlayers);
      setNoPred(squadPlayers.filter((p) => p.pred === null).map((p) => p.name));

      const bankVal = (md.manager.last_deadline_bank ?? 0) / 10;
      setBank(bankVal);

      // 5. Generate suggestions (client-side port of notebook logic)
      const { generateSuggestions } = await import("@/lib/suggestions");
      const result = generateSuggestions(
        squadPlayers,
        data.predictions,
        statsMap,
        bankVal,
        rows.map((r) => r.player_name)
      );
      setSuggestions(result.suggestions);
      setClubCount(result.clubCount);
      setOptResult(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [teamId, gwInput]);

  const totalValue = teamRows.reduce((s, r) => s + r.price, 0);
  const squadSellValue = squad.reduce((s, p) => s + p.sellPrice, 0);
  const totalGwPoints = teamRows
    .filter((r) => r.is_starter)
    .reduce((s, r) => s + r.gameweek_points * r.multiplier, 0);
  const totalCost = suggestions.reduce((s, x) => s + x.in.costDiff, 0);
  const totalGain = suggestions.reduce((s, x) => s + x.improvement, 0);
  const finalBank = bank - totalCost;

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <header className="mb-8">
        <nav className="text-sm text-[var(--muted)] mb-4">
          <span className="text-[var(--text)]">Team Manager</span>
          <span className="mx-2">/</span>
          <a href="/players" className="hover:text-[var(--accent)]">Players</a>
        </nav>
        <h1 className="text-3xl font-extrabold tracking-tight">
          ⚽ FPL Team <span className="text-[var(--accent)]">Manager</span>
        </h1>
        <p className="text-[var(--muted)] mt-1">
          Squad overview, gameweek stats and ML-powered transfer suggestions
        </p>
      </header>

      {/* Input form */}
      <section className="card p-5 mb-8">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs uppercase tracking-wide text-[var(--muted)] mb-1">FPL Team ID</label>
            <input
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="e.g. 1234567"
              className="w-full bg-[#0d1526] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="w-40">
            <label className="block text-xs uppercase tracking-wide text-[var(--muted)] mb-1">Gameweek</label>
            <input
              value={gwInput}
              onChange={(e) => setGwInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="current"
              className="w-full bg-[#0d1526] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent)]"
            />
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="bg-[var(--accent)] text-[#04140b] font-bold px-6 py-2 rounded-lg hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Fetch Team"}
          </button>
        </div>
        {error && <p className="mt-3 text-rose-400 text-sm">⚠ {error}</p>}
      </section>

      {manager && (
        <>
          {/* Manager + GW stats */}
          <section className="grid md:grid-cols-2 gap-4 mb-8">
            <div className="card p-5">
              <h2 className="text-lg font-bold mb-3">{manager.name || "Team"}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat label="Manager" value={`${manager.player_first_name ?? ""} ${manager.player_last_name ?? ""}`.trim() || "—"} />
                <Stat label="Overall Rank" value={(manager.summary_overall_rank ?? "N/A").toLocaleString?.() ?? manager.summary_overall_rank ?? "N/A"} />
                <Stat label="Overall Points" value={manager.summary_overall_points ?? "N/A"} />
                <Stat label="Bank" value={`£${((manager.last_deadline_bank ?? 0) / 10).toFixed(1)}m`} />
                <Stat label="Transfers" value={manager.last_deadline_total_transfers ?? "N/A"} />
                <Stat label="Squad Value" value={`£${totalValue.toFixed(1)}m`} />
              </div>
            </div>
            <div className="card p-5">
              <h2 className="text-lg font-bold mb-3">
                Gameweek {gameweek} {activeChip && <span className="badge bg-violet-500/20 text-violet-300 ml-2">{activeChip}</span>}
              </h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat label="GW Points" value={entryHistory?.points ?? 0} accent />
                <Stat label="GW Rank" value={typeof entryHistory?.rank === "number" ? entryHistory.rank.toLocaleString() : "N/A"} />
                <Stat label="Calculated Points" value={totalGwPoints} />
                <Stat label="Transfers Made" value={entryHistory?.event_transfers ?? 0} />
                <Stat label="Points Hit" value={`-${entryHistory?.event_transfers_cost ?? 0}`} />
                <Stat label="Transfer Budget" value={`£${(squadSellValue + bank).toFixed(1)}m`} />
              </div>
            </div>
          </section>

          {/* Squad pitch view */}
          <section className="card p-5 mb-8">
            <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-bold">Squad — Gameweek {gameweek}</h2>
                <p className="text-xs text-[var(--muted)]">
                  {optResult
                    ? <>⚡ Optimal XI highlighted · Formation <strong>{optResult.formation}</strong> · Optimal pred <strong className="text-[var(--accent)]">{optResult.totalPred.toFixed(3)}</strong> vs current {optResult.currentTotal.toFixed(3)} · Gain <strong className="text-emerald-400">+{optResult.gain.toFixed(3)}</strong> · C: <strong>{optResult.captain ?? "—"}</strong> · VC: <strong>{optResult.viceCaptain ?? "—"}</strong>{optResult.gain <= 0 && <> · Current XI already optimal ✅</>}</>
                    : "Run the optimizer to highlight the best starting XI by model prediction (1 GKP, 3-5 DEF, 3-5 MID, 1-3 FWD)."}
                </p>
              </div>
              <button
                onClick={optimize}
                disabled={optimizing || squad.length !== 15}
                className="bg-[var(--accent)] text-[#04140b] font-bold px-5 py-2 rounded-lg hover:brightness-110 disabled:opacity-50 whitespace-nowrap"
              >
                {optimizing ? "Optimizing…" : optResult ? "Re-optimize" : "⚡ Optimize Team"}
              </button>
            </div>
            <Pitch teamRows={teamRows} optResult={optResult} gameweek={gameweek} squad={squad} />
            {noPred.length > 0 && (
              <p className="mt-3 text-xs text-[var(--muted)]">
                No model prediction (inactive/unavailable): {noPred.join(", ")}
              </p>
            )}
          </section>

          {/* Transfer suggestions */}
          <section className="card p-5 mb-8">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
              <h2 className="text-lg font-bold">🔮 Transfer Suggestions (ML-Powered)</h2>
              <button
                onClick={suggestBestTransfer}
                disabled={!predictions.length || suggestingTransfer}
                className="bg-[var(--accent)] text-[#04140b] font-bold px-4 py-2 rounded-lg hover:brightness-110 disabled:opacity-50"
              >
                {suggestingTransfer ? "Finding best transfer..." : "Suggest Best Transfer"}
              </button>
            </div>
            <p className="text-xs text-[var(--muted)] mb-4">
              Maximises model probability of scoring &gt;6 pts, respecting budget, 3-per-club limit and position limits.
              Clubs at 3-player limit: {Object.entries(clubCount).filter(([, n]) => n >= 3).map(([c]) => c).join(", ") || "none"}
            </p>
            {suggestingTransfer ? (
              <p className="text-sm text-[var(--muted)]">Checking every valid starting XI and transfer option...</p>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No transfers suggested — squad looks optimal for the budget.</p>
            ) : (
              <div className="space-y-4">
                {suggestions.map((s, i) => (
                  <div key={i} className="border border-[var(--border)] rounded-xl p-4 bg-[#0d1526]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="badge bg-[var(--accent)]/15 text-[var(--accent)]">{s.transferLabel}</span>
                      <span className="text-xs text-[var(--muted)]">Prediction gain: <strong className={s.improvement >= 0 ? "text-[var(--accent)]" : "text-rose-400"}>{s.improvement >= 0 ? "+" : ""}{s.improvement.toFixed(3)}</strong></span>
                    </div>
                    <div className="grid md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                      <div className="border border-rose-500/30 bg-rose-500/5 rounded-lg p-3">
                        <div className="text-xs uppercase text-rose-300 font-bold mb-1">OUT</div>
                        <div className="font-semibold">{s.out.name} <PosBadge pos={s.out.pos} /></div>
                        <div className="text-xs text-[var(--muted)]">
                          £{s.out.nowPrice.toFixed(1)}m{s.out.sellPrice !== s.out.nowPrice ? ` (sell £${s.out.sellPrice.toFixed(1)}m)` : ""} · pred {s.out.pred != null ? s.out.pred.toFixed(3) : "N/A"}
                        </div>
                      </div>
                      <div className="text-2xl text-center">➜</div>
                      <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-lg p-3">
                        <div className="text-xs uppercase text-emerald-300 font-bold mb-1">IN</div>
                        <div className="font-semibold">{s.in.name} <PosBadge pos={s.out.pos} /></div>
                        <div className="text-xs text-[var(--muted)]">
                          £{s.in.price.toFixed(1)}m · pred {s.in.pred.toFixed(3)} · form {s.in.form.toFixed(1)} · ppg {s.in.ppg.toFixed(1)} · {s.in.club} · cost {s.in.costDiff >= 0 ? "+" : ""}£{s.in.costDiff.toFixed(1)}m
                        </div>
                        <div className="text-xs mt-1 text-[var(--muted)]">
                          GW forecasts: {s.in.gw_predictions.map((g) => `GW${g.gw}: ${g.prob_gt_6.toFixed(2)}`).join("  ")}
                        </div>
                        <button
                          onClick={() => approveTransfer(s)}
                          className="mt-3 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-500/30"
                        >
                          Approve Transfer
                        </button>
                      </div>
                    </div>
                    {s.improvement <= 0 && (
                      <p className="mt-3 text-xs text-rose-300">No affordable transfer improves the optimized XI; this is the best available alternative.</p>
                    )}
                    {s.alternatives.length > 0 && (
                      <div className="mt-3 text-xs text-[var(--muted)]">
                        Alternatives:{" "}
                        {s.alternatives.map((a) => `${a.name} £${a.price.toFixed(1)}m (pred ${a.pred.toFixed(3)}, ${a.costDiff >= 0 ? "+" : ""}£${a.costDiff.toFixed(1)}m)`).join("  •  ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-[#0d1526] border border-[var(--border)] text-sm">
                <strong>Summary:</strong> {suggestions.length} transfer(s) · Total cost {totalCost >= 0 ? "+" : ""}£{totalCost.toFixed(1)}m · Bank after £{finalBank.toFixed(1)}m · Total prediction gain {totalGain >= 0 ? "+" : ""}{totalGain.toFixed(3)}
                {finalBank < 0 && <p className="text-rose-400 mt-1">⚠ Insufficient budget — these transfers cannot all be made.</p>}
                {suggestions.length > 1 && <p className="text-[var(--muted)] mt-1">Point hits: -{(suggestions.length - 1) * 4}</p>}
                {finalBank > 4.0 && <p className="text-[var(--muted)] mt-1">£{finalBank.toFixed(1)}m surplus — consider upgrading bench or saving for next week.</p>}
              </div>
            )}
          </section>
        </>
      )}

      <footer className="text-center text-xs text-[var(--muted)] py-6">
        Data: official FPL API + fpl schema (players, predictions, teams) · Deployed on Vercel
      </footer>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <div className="bg-[#0d1526] border border-[var(--border)] rounded-lg px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className={`font-bold ${accent ? "text-[var(--accent)] text-lg" : ""}`}>{value ?? "—"}</div>
    </div>
  );
}

const PHOTO_BASE = "https://resources.premierleague.com/premierleague/photos/players/110x140";
const ROW_ORDER = ["GKP", "DEF", "MID", "FWD"] as const;
const ROW_BG: Record<string, string> = {
  GKP: "bg-[#0a1f14]/70 border-emerald-900/40",
  DEF: "bg-[#0a1524]/70 border-sky-900/40",
  MID: "bg-[#0a1f14]/70 border-emerald-900/40",
  FWD: "bg-[#1f0a14]/70 border-rose-900/40",
};

function Pitch({ teamRows, optResult, gameweek, squad }: {
  teamRows: TeamRow[];
  optResult: OptimizeResult | null;
  gameweek: number | null;
  squad: SquadPlayer[];
}) {
  const rows = ROW_ORDER.map((pos) => ({ pos, players: teamRows.filter((r) => r.position === pos && r.is_starter) }));
  const bench = teamRows.filter((r) => !r.is_starter);

  return (
    <div
      className="rounded-xl overflow-hidden border border-[var(--border)]"
      style={{
        background:
          "repeating-linear-gradient(0deg, #0c2a18 0px, #0c2a18 44px, #0e3120 44px, #0e3120 88px)",
      }}
    >
      <div className="px-4 py-3 text-center text-[10px] uppercase tracking-widest text-emerald-200/60">
        Gameweek {gameweek} · Formation {optResult?.formation ?? "—"}
      </div>
      <div className="flex flex-col gap-2 px-3 pb-3">
        {rows.map(({ pos, players }) => (
          <div key={pos} className={`rounded-lg border ${ROW_BG[pos]} px-2 py-3`}>
            <div className="flex justify-center gap-2 flex-wrap">
              {players.length === 0 ? (
                <span className="text-xs text-[var(--muted)] py-4">—</span>
              ) : (
                players.map((r) => (
                  <PlayerCard
                    key={r.player_id}
                    row={r}
                    squad={squad}
                    onBench={!r.is_starter}
                    isOptXI={optResult?.xi.some((p) => p.name === r.player_name) ?? false}
                    isCaptain={optResult ? optResult.captain === r.player_name : r.is_captain}
                    isVice={optResult ? optResult.viceCaptain === r.player_name : r.is_vice_captain}
                  />
                ))
              )}
            </div>
          </div>
        ))}
        {/* Bench */}
        <div className="rounded-lg border border-[var(--border)] bg-black/30 px-2 py-3">
          <div className="flex justify-center gap-2 flex-wrap">
            {bench.map((r) => (
              <PlayerCard
                key={r.player_id}
                row={r}
                squad={squad}
                onBench
                isOptXI={false}
                dimmed={optResult?.bench.some((p) => p.name === r.player_name) ?? false}
                isCaptain={false}
                isVice={false}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerCard({
  row,
  squad,
  onBench,
  isOptXI,
  isCaptain,
  isVice,
  dimmed,
}: {
  row: TeamRow;
  squad: SquadPlayer[];
  onBench: boolean;
  isOptXI: boolean;
  isCaptain: boolean;
  isVice: boolean;
  dimmed?: boolean;
}) {
  const photo = (row as any).photo as string | undefined;
  const sp = squad.find((s) => s.name === row.player_name);
  return (
    <div
      className={`relative flex flex-col items-center w-[92px] rounded-lg p-1.5 transition
        ${isOptXI ? "bg-emerald-500/20 ring-2 ring-emerald-400" : "bg-black/40 ring-1 ring-white/10"}
        ${dimmed ? "opacity-60" : ""}`}
    >
      {isCaptain && (
        <span className="absolute -top-2 -left-1 z-10 w-5 h-5 rounded-full bg-amber-400 text-[#04140b] text-[10px] font-extrabold flex items-center justify-center shadow">
          C
        </span>
      )}
      {isVice && (
        <span className="absolute -top-2 -left-1 z-10 w-5 h-5 rounded-full bg-slate-300 text-[#04140b] text-[10px] font-extrabold flex items-center justify-center shadow">
          V
        </span>
      )}
      {isOptXI && <span className="absolute -top-2 right-1 z-10 text-[10px]">⚡</span>}
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${PHOTO_BASE}/p${photo}.png`}
          alt={row.player_name}
          className="w-14 h-[70px] object-contain drop-shadow"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
        />
      ) : (
        <div className="w-14 h-[70px] flex items-center justify-center text-2xl">👕</div>
      )}
      <div className="text-[11px] font-bold leading-tight text-center truncate w-full">{row.player_name}</div>
      <div className="text-[9px] text-[var(--muted)] text-center truncate w-full">{row.club}</div>
      <div className="flex items-center gap-1 mt-0.5">
        <span className={`badge ${POS_COLORS[row.position]} !text-[8px] !px-1 !py-0`}>{row.position}</span>
        <span className="text-[9px] font-semibold">£{row.price.toFixed(1)}m</span>
      </div>
      <div className="text-[9px] text-[var(--muted)]">
        GW {row.gameweek_points} · <span className="text-[var(--accent)]">{sp?.pred != null ? sp.pred.toFixed(2) : "N/A"}</span>
        {onBench && <span className="ml-1">🪑</span>}
      </div>
    </div>
  );
}
