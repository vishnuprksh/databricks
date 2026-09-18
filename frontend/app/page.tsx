"use client";

import { useCallback, useEffect, useState } from "react";
import type { TeamRow } from "@/lib/fpl";
import {
  findBestTransfer,
  listTransferOptions,
  optimizeStartingEleven,
} from "@/lib/suggestions";
import type {
  SquadPlayer,
  Suggestion,
  StatsRow,
  OptimizeResult,
  Replacement,
} from "@/lib/suggestions";
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
  const [stats, setStats] = useState<Record<number, StatsRow>>({});
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [noPred, setNoPred] = useState<string[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [suggestingTransfer, setSuggestingTransfer] = useState(false);
  const [optResult, setOptResult] = useState<OptimizeResult | null>(null);
  const [transferModal, setTransferModal] = useState<{ out: SquadPlayer; options: Replacement[] } | null>(null);
  const [skipped, setSkipped] = useState<Suggestion[]>([]);

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

  const suggestBestTransfer = async (skippedSuggestions: Suggestion[] = skipped) => {
    setSuggestingTransfer(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    try {
      const best = findBestTransfer(
        squad, predictions, stats, bank,
        skippedSuggestions.map((s) => s.in.player_id)
      );
      setSuggestions(best ? [best] : []);
      const nextClubCount: Record<string, number> = {};
      for (const player of squad) nextClubCount[player.club] = (nextClubCount[player.club] ?? 0) + 1;
      setClubCount(nextClubCount);
    } finally {
      setSuggestingTransfer(false);
    }
  };

  const skipTransfer = (suggestion: Suggestion) => {
    const nextSkipped = [...skipped, suggestion];
    setSkipped(nextSkipped);
    suggestBestTransfer(nextSkipped);
  };

  const approveTransfer = (suggestion: Suggestion) => {
    const outgoing = teamRows.find((r) => r.player_name === suggestion.out.name);
    if (!outgoing) return;
    // The replacement carries its FPL player_id — use it directly (names are ambiguous).
    const incomingStats = stats[suggestion.in.player_id];
    if (!incomingStats) return;
    setSkipped((prev) => prev.filter((s) => s.in.name !== suggestion.in.name));

    const incomingRow: TeamRow = {
      ...outgoing,
      player_id: incomingStats.player_id,
      player_name: suggestion.in.name,
      full_name: `${incomingStats.first_name} ${incomingStats.second_name}`.trim() || suggestion.in.name,
      club: suggestion.in.club,
      price: suggestion.in.price,
      selected_by_percent: incomingStats.selected_by_percent,
      total_points: incomingStats.total_points,
      form: incomingStats.form,
    };
    const incomingSquadPlayer: SquadPlayer = {
      player_id: incomingStats.player_id,
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
    const bestNextTransfer = findBestTransfer(
      nextSquad, predictions, stats, nextBank,
      skipped.map((s) => s.in.player_id)
    );
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

  const openTransferModal = (playerName: string) => {
    const out = squad.find((p) => p.name === playerName);
    if (!out || !predictions.length) return;
    const options = listTransferOptions(out, squad, predictions, stats, bank);
    setTransferModal({ out, options });
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

      const statsMap: Record<number, StatsRow> = {};
      for (const p of data.players) {
        // Key stats by FPL player_id — web_name is not unique (e.g. two Fernandes).
        statsMap[p.player_id] = p;
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
        player_id: r.player_id,
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

      // 5. Single best free transfer suggestion (declines reset on fresh load)
      const best = findBestTransfer(
        squadPlayers,
        data.predictions,
        statsMap,
        bankVal
      );
      setSuggestions(best ? [best] : []);
      setSkipped([]);
      const nextClubCount: Record<string, number> = {};
      for (const player of squadPlayers) nextClubCount[player.club] = (nextClubCount[player.club] ?? 0) + 1;
      setClubCount(nextClubCount);
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
        <h1 className="text-3xl font-extrabold tracking-tight">
          ⚽ <span className="text-[var(--accent)]">offside</span>
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
            <Pitch teamRows={teamRows} optResult={optResult} gameweek={gameweek} squad={squad} onPlayerClick={openTransferModal} />
            {noPred.length > 0 && (
              <p className="mt-3 text-xs text-[var(--muted)]">
                No model prediction (inactive/unavailable): {noPred.join(", ")}
              </p>
            )}
          </section>

          {/* Transfer suggestions */}
          <section className="card p-5 mb-8">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
              <h2 className="text-lg font-bold">🔮 Transfer Suggestion (ML-Powered)</h2>
            </div>
            <p className="text-xs text-[var(--muted)] mb-4">
              Maximises model probability of scoring &gt;6 pts, respecting budget, 3-per-club limit and position limits.
              Clubs at 3-player limit: {Object.entries(clubCount).filter(([, n]) => n >= 3).map(([c]) => c).join(", ") || "none"}
            </p>
            {suggestingTransfer ? (
              <p className="text-sm text-[var(--muted)]">Checking every valid starting XI and transfer option...</p>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No transfer suggested — squad looks optimal for the budget.
                {skipped.length > 0 && <> Skipped players excluded: {skipped.map((s) => s.in.name).join(", ")}.</>}
              </p>
            ) : (
              suggestions.slice(0, 1).map((s) => (
                  <div key={s.in.name} className="border border-[var(--border)] rounded-xl p-4 bg-[#0d1526]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="badge bg-[var(--accent)]/15 text-[var(--accent)]">
                        {s.improvement > 0 ? "BEST FREE TRANSFER" : "BEST AVAILABLE TRANSFER"}
                      </span>
                      <span className="text-xs text-[var(--muted)]">Prediction gain: <strong className={s.improvement >= 0 ? "text-[var(--accent)]" : "text-rose-400"}>{s.improvement >= 0 ? "+" : ""}{s.improvement.toFixed(3)}</strong></span>
                    </div>
                    <div className="grid md:grid-cols-[minmax(0,2fr)_auto_minmax(0,3fr)] gap-3 items-stretch">
                      <div className="border border-rose-500/30 bg-rose-500/5 rounded-lg p-3 flex flex-col justify-center">
                        <div className="text-xs uppercase text-rose-300 font-bold mb-1">Out</div>
                        <div className="font-semibold">{s.out.name} <PosBadge pos={s.out.pos} /></div>
                        <div className="text-xs text-[var(--muted)] mt-1">
                          £{s.out.nowPrice.toFixed(1)}m{s.out.sellPrice !== s.out.nowPrice ? ` (sell £${s.out.sellPrice.toFixed(1)}m)` : ""} · pred {s.out.pred != null ? s.out.pred.toFixed(3) : "N/A"}
                        </div>
                      </div>
                      <div className="flex items-center text-2xl text-[var(--muted)]">➜</div>
                      <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-lg p-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="text-xs uppercase text-emerald-300 font-bold">In</div>
                          <div className="text-xs text-[var(--muted)]">{s.in.club} · cost {s.in.costDiff >= 0 ? "+" : ""}£{s.in.costDiff.toFixed(1)}m</div>
                        </div>
                        <div className="font-semibold">{s.in.name} <PosBadge pos={s.out.pos} /></div>
                        <div className="text-xs text-[var(--muted)] mt-1">
                          £{s.in.price.toFixed(1)}m · pred {s.in.pred.toFixed(3)} · form {s.in.form.toFixed(1)} · ppg {s.in.ppg.toFixed(1)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-xs text-[var(--muted)]">
                        GW forecasts: {s.in.gw_predictions.map((g) => `GW${g.gw}: ${g.prob_gt_6.toFixed(2)}`).join("  ")}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => approveTransfer(s)}
                          className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-500/30"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => skipTransfer(s)}
                          className="bg-rose-500/10 text-rose-300 border border-rose-500/40 font-semibold px-3 py-1.5 rounded-lg hover:bg-rose-500/20"
                        >
                          ✕ Skip
                        </button>
                      </div>
                    </div>
                    {s.improvement <= 0 && (
                      <p className="mt-3 text-xs text-rose-300">No affordable transfer improves the optimized XI; this is the best available alternative.</p>
                    )}
                  </div>
              ))
            )}
            {suggestions.length > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-[#0d1526] border border-[var(--border)] text-sm">
                <strong>Summary:</strong> 1 free transfer · Cost {totalCost >= 0 ? "+" : ""}£{totalCost.toFixed(1)}m · Bank after £{finalBank.toFixed(1)}m · Prediction gain {totalGain >= 0 ? "+" : ""}{totalGain.toFixed(3)}
                {finalBank < 0 && <p className="text-rose-400 mt-1">⚠ Insufficient budget — this transfer cannot be made.</p>}
              </div>
            )}

            {/* Skipped transfers — user can approve later */}
            {skipped.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-bold mb-2 text-[var(--muted)]">⤵ Skipped ({skipped.length})</h3>
                <div className="space-y-2">
                  {skipped.map((s) => (
                    <div key={s.in.name} className="flex items-center justify-between gap-3 flex-wrap border border-[var(--border)] rounded-lg px-3 py-2 bg-[#0d1526] text-sm">
                      <div>
                        <span className="font-semibold">{s.in.name}</span> <PosBadge pos={s.out.pos} />
                        <span className="text-xs text-[var(--muted)] ml-2">
                          {s.in.club} · £{s.in.price.toFixed(1)}m · pred {s.in.pred.toFixed(3)} · in for {s.out.name}
                        </span>
                      </div>
                      <button
                        onClick={() => approveTransfer(s)}
                        className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold px-3 py-1 rounded-lg hover:bg-emerald-500/30 text-xs"
                      >
                        ✓ Approve
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Player transfer options modal */}
          {transferModal && (
            <TransferModal
              out={transferModal.out}
              options={transferModal.options}
              bank={bank}
              onClose={() => setTransferModal(null)}
              onApprove={(opt) => {
                const s: Suggestion = {
                  out: transferModal.out,
                  in: opt,
                  improvement: opt.pred - (transferModal.out.pred ?? 0),
                  alternatives: [],
                  transferLabel: "MANUAL TRANSFER",
                };
                approveTransfer(s);
                setTransferModal(null);
              }}
            />
          )}
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

function Pitch({ teamRows, optResult, gameweek, squad, onPlayerClick }: {
  teamRows: TeamRow[];
  optResult: OptimizeResult | null;
  gameweek: number | null;
  squad: SquadPlayer[];
  onPlayerClick: (name: string) => void;
}) {
  // When an optimization result exists, rearrange the pitch to show the
  // optimal XI grouped by position (per the new formation), with subbed-out
  // players moved to the bench. Otherwise show the original lineup.
  const displayRows: { pos: string; players: TeamRow[] }[] = optResult
    ? ROW_ORDER.map((pos) => ({
        pos,
        players: optResult.xi
          .filter((p) => p.pos === pos)
          .map((p) => teamRows.find((r) => r.player_name === p.name))
          .filter((r): r is TeamRow => !!r),
      }))
    : ROW_ORDER.map((pos) => ({ pos, players: teamRows.filter((r) => r.position === pos && r.is_starter) }));

  const bench = optResult
    ? optResult.bench
        .map((p) => teamRows.find((r) => r.player_name === p.name))
        .filter((r): r is TeamRow => !!r)
    : teamRows.filter((r) => !r.is_starter);

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
        {displayRows.map(({ pos, players }) => (
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
                    onBench={false}
                    isOptXI={true}
                    isCaptain={optResult ? optResult.captain === r.player_name : r.is_captain}
                    isVice={optResult ? optResult.viceCaptain === r.player_name : r.is_vice_captain}
                    onClick={onPlayerClick}
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
                dimmed={!!optResult}
                isCaptain={false}
                isVice={false}
                onClick={onPlayerClick}
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
  onClick,
}: {
  row: TeamRow;
  squad: SquadPlayer[];
  onBench: boolean;
  isOptXI: boolean;
  isCaptain: boolean;
  isVice: boolean;
  dimmed?: boolean;
  onClick?: (name: string) => void;
}) {
  const photo = (row as any).photo as string | undefined;
  const sp = squad.find((s) => s.name === row.player_name);
  return (
    <div
      onClick={() => onClick?.(row.player_name)}
      title="Click to see possible transfers"
      className={`relative flex flex-col items-center w-[92px] rounded-lg p-1.5 transition cursor-pointer hover:ring-2 hover:ring-[var(--accent)]
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

function TransferModal({
  out,
  options,
  bank,
  onClose,
  onApprove,
}: {
  out: SquadPlayer;
  options: Replacement[];
  bank: number;
  onClose: () => void;
  onApprove: (opt: Replacement) => void;
}) {
  const budget = bank + out.sellPrice;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="card p-5 w-full max-w-3xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold">Possible Transfers — Out: {out.name}</h3>
            <p className="text-xs text-[var(--muted)] mt-1">
              <PosBadge pos={out.pos} /> · Sell £{out.sellPrice.toFixed(1)}m · Budget £{budget.toFixed(1)}m (bank £{bank.toFixed(1)}m + sell) · Max 3 per club · Sorted by prediction
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--text)] text-xl leading-none px-2"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {options.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No valid replacements found — budget or 3-per-club limits exclude every {out.pos}.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-[#0d1526] text-[10px] uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="text-left px-3 py-2">Player</th>
                  <th className="text-left px-3 py-2">Club</th>
                  <th className="text-right px-3 py-2">Price</th>
                  <th className="text-right px-3 py-2">Cost Δ</th>
                  <th className="text-right px-3 py-2">Pred</th>
                  <th className="text-right px-3 py-2">Gain</th>
                  <th className="text-right px-3 py-2">Form</th>
                  <th className="text-right px-3 py-2">PPG</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {options.map((o) => {
                  const gain = o.pred - (out.pred ?? 0);
                  return (
                    <tr key={o.name} className="border-t border-[var(--border)] hover:bg-[#0d1526]">
                      <td className="px-3 py-2 font-semibold">{o.name} <PosBadge pos={out.pos} /></td>
                      <td className="px-3 py-2 text-[var(--muted)]">{o.club}</td>
                      <td className="px-3 py-2 text-right">£{o.price.toFixed(1)}m</td>
                      <td className={`px-3 py-2 text-right ${o.costDiff > 0 ? "text-rose-400" : o.costDiff < 0 ? "text-emerald-400" : ""}`}>
                        {o.costDiff >= 0 ? "+" : ""}£{o.costDiff.toFixed(1)}m
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-[var(--accent)]">{o.pred.toFixed(3)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${gain > 0 ? "text-emerald-400" : gain < 0 ? "text-rose-400" : ""}`}>
                        {gain >= 0 ? "+" : ""}{gain.toFixed(3)}
                      </td>
                      <td className="px-3 py-2 text-right text-[var(--muted)]">{o.form.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right text-[var(--muted)]">{o.ppg.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => onApprove(o)}
                          className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold px-2.5 py-1 rounded-lg hover:bg-emerald-500/30 whitespace-nowrap"
                        >
                          Transfer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[10px] text-[var(--muted)]">
          Constraints applied: same position ({out.pos}), budget ≤ £{budget.toFixed(1)}m, max 3 players per club, player not in squad, available to play.
        </p>
      </div>
    </div>
  );
}
