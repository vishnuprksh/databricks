"use client";

import { useCallback, useEffect, useState } from "react";
import type { TeamRow } from "@/lib/fpl";
import type { SquadPlayer, Suggestion, StatsRow } from "@/lib/suggestions";

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
  const [noPred, setNoPred] = useState<string[]>([]);

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

      const predByName: Record<string, any> = {};
      for (const p of data.predictions) predByName[p.player_name] = p;

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
        pred: predByName[r.player_name]?.avg_prob_gt_6 ?? null,
        starter: r.is_starter,
        club: r.club,
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

          {/* Squad table */}
          <section className="card p-5 mb-8">
            <h2 className="text-lg font-bold mb-4">Squad — Gameweek {gameweek}</h2>
            <div className="overflow-x-auto">
              <table className="data">
                <thead>
                  <tr>
                    <th>#</th><th>Player</th><th>Pos</th><th>Club</th><th>Price</th>
                    <th>Starter</th><th>C</th><th>VC</th><th>GW Pts</th><th>xMult</th>
                    <th>Total</th><th>Form</th><th>Own %</th><th>Pred</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRows.map((r) => {
                    const sp = squad.find((s) => s.name === r.player_name);
                    return (
                      <tr key={r.player_id}>
                        <td className="text-[var(--muted)]">{r.squad_position}</td>
                        <td className="font-semibold">{r.player_name}</td>
                        <td><PosBadge pos={r.position} /></td>
                        <td className="text-[var(--muted)]">{r.club}</td>
                        <td>£{r.price.toFixed(1)}m</td>
                        <td>{r.is_starter ? "✅" : "🪑"}</td>
                        <td>{r.is_captain ? "⭐" : ""}</td>
                        <td>{r.is_vice_captain ? "🅥" : ""}</td>
                        <td>{r.gameweek_points}</td>
                        <td>×{r.multiplier}</td>
                        <td>{r.total_points}</td>
                        <td>{r.form.toFixed(1)}</td>
                        <td>{r.selected_by_percent.toFixed(1)}%</td>
                        <td>{sp?.pred != null ? sp.pred.toFixed(3) : <span className="text-[var(--muted)]">N/A</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {noPred.length > 0 && (
              <p className="mt-3 text-xs text-[var(--muted)]">
                No model prediction (inactive/unavailable): {noPred.join(", ")}
              </p>
            )}
          </section>

          {/* Transfer suggestions */}
          <section className="card p-5 mb-8">
            <h2 className="text-lg font-bold mb-1">🔮 Transfer Suggestions (ML-Powered)</h2>
            <p className="text-xs text-[var(--muted)] mb-4">
              Maximises model probability of scoring &gt;6 pts, respecting budget, 3-per-club limit and position limits.
              Clubs at 3-player limit: {Object.entries(clubCount).filter(([, n]) => n >= 3).map(([c]) => c).join(", ") || "none"}
            </p>
            {suggestions.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No transfers suggested — squad looks optimal for the budget.</p>
            ) : (
              <div className="space-y-4">
                {suggestions.map((s, i) => (
                  <div key={i} className="border border-[var(--border)] rounded-xl p-4 bg-[#0d1526]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="badge bg-[var(--accent)]/15 text-[var(--accent)]">{s.transferLabel}</span>
                      <span className="text-xs text-[var(--muted)]">Prediction gain: <strong className="text-[var(--accent)]">+{s.improvement.toFixed(3)}</strong></span>
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
                      </div>
                    </div>
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
                <strong>Summary:</strong> {suggestions.length} transfer(s) · Total cost {totalCost >= 0 ? "+" : ""}£{totalCost.toFixed(1)}m · Bank after £{finalBank.toFixed(1)}m · Total prediction gain +{totalGain.toFixed(3)}
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
