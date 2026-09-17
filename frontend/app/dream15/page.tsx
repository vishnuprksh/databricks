"use client";

import { useEffect, useState } from "react";
import type { PlayerRow, PredictionRow } from "@/lib/db";
import { optimizeDream15, type Dream15Result, type SquadPlayer } from "@/lib/suggestions";

const POS_COLORS: Record<string, string> = {
  GKP: "bg-amber-500/20 text-amber-300",
  DEF: "bg-sky-500/20 text-sky-300",
  MID: "bg-emerald-500/20 text-emerald-300",
  FWD: "bg-rose-500/20 text-rose-300",
};
const ROW_ORDER = ["GKP", "DEF", "MID", "FWD"];
const ROW_BG: Record<string, string> = {
  GKP: "bg-[#0a1f14]/70 border-emerald-900/40",
  DEF: "bg-[#0a1524]/70 border-sky-900/40",
  MID: "bg-[#0a1f14]/70 border-emerald-900/40",
  FWD: "bg-[#1f0a14]/70 border-rose-900/40",
};

export default function Dream15Page() {
  const [result, setResult] = useState<Dream15Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/data")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load player predictions");
        const optimized = optimizeDream15(data.players as PlayerRow[], data.predictions as PredictionRow[]);
        if (!optimized) throw new Error("No valid 15-player squad was found under the FPL constraints.");
        setResult(optimized);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <header className="mb-8">
        <nav className="text-sm text-[var(--muted)] mb-4">
          <a href="/" className="hover:text-[var(--accent)]">Team Manager</a>
          <span className="mx-2">/</span>
          <span className="text-[var(--text)]">Dream 15</span>
        </nav>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Dream <span className="text-[var(--accent)]">15</span>
        </h1>
        <p className="text-[var(--muted)] mt-1">The strongest predicted squad from the current player pool</p>
      </header>

      {loading && <p className="text-[var(--muted)]">Finding the best 15...</p>}
      {error && <p className="text-rose-400">{error}</p>}
      {result && <DreamView result={result} />}

      <footer className="text-center text-xs text-[var(--muted)] py-6">
        Current predictions · £100.0m budget · 2 GKP, 5 DEF, 5 MID, 3 FWD · max 3 per club
      </footer>
    </main>
  );
}

function DreamView({ result }: { result: Dream15Result }) {
  return (
    <>
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <Stat label="Starting XI" value={result.totalPred.toFixed(3)} accent />
        <Stat label="Bench" value={result.benchPred.toFixed(3)} />
        <Stat label="Squad total" value={result.squadPred.toFixed(3)} />
        <Stat label="Squad cost" value={`£${result.spent.toFixed(1)}m`} />
        <Stat label="Budget left" value={`£${result.remainingBudget.toFixed(1)}m`} />
      </section>

      <section className="card p-5 mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h2 className="text-lg font-bold">Best starting XI</h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              Optimized for the highest starting XI prediction first · Formation <strong>{result.formation}</strong> · C: <strong>{result.captain}</strong> · VC: <strong>{result.viceCaptain}</strong>
            </p>
          </div>
          <span className="badge bg-emerald-500/15 text-emerald-300">11 starters</span>
        </div>
        <DreamPitch result={result} />
      </section>

      <section className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h2 className="text-lg font-bold">Next four on the bench</h2>
            <p className="text-xs text-[var(--muted)] mt-1">The bench is selected after the best XI, then ranked by prediction.</p>
          </div>
          <span className="badge bg-sky-500/15 text-sky-300">4 bench players · {result.benchPred.toFixed(3)} predicted</span>
        </div>
        <div className="flex justify-center gap-2 flex-wrap rounded-xl border border-[var(--border)] bg-black/30 px-3 py-4">
          {result.bench.map((player) => <DreamPlayerCard key={player.name} player={player} onBench />)}
        </div>
      </section>
    </>
  );
}

function DreamPitch({ result }: { result: Dream15Result }) {
  return (
    <div className="rounded-xl overflow-hidden border border-[var(--border)]" style={{ background: "repeating-linear-gradient(0deg, #0c2a18 0px, #0c2a18 44px, #0e3120 44px, #0e3120 88px)" }}>
      <div className="px-4 py-3 text-center text-[10px] uppercase tracking-widest text-emerald-200/60">Dream 15 · {result.formation}</div>
      <div className="flex flex-col gap-2 px-3 pb-3">
        {ROW_ORDER.map((position) => {
          const players = result.xi.filter((player) => player.pos === position);
          return (
            <div key={position} className={`rounded-lg border ${ROW_BG[position]} px-2 py-3`}>
              <div className="flex justify-center gap-2 flex-wrap">
                {players.map((player) => (
                  <DreamPlayerCard key={player.name} player={player} isCaptain={player.name === result.captain} isVice={player.name === result.viceCaptain} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DreamPlayerCard({ player, onBench, isCaptain, isVice }: { player: SquadPlayer; onBench?: boolean; isCaptain?: boolean; isVice?: boolean }) {
  return (
    <div className={`relative flex flex-col items-center w-[110px] rounded-lg p-2 ${onBench ? "bg-black/40 ring-1 ring-white/10" : "bg-emerald-500/20 ring-2 ring-emerald-400"}`}>
      {isCaptain && <span className="absolute -top-2 -left-1 z-10 w-5 h-5 rounded-full bg-amber-400 text-[#04140b] text-[10px] font-extrabold flex items-center justify-center shadow">C</span>}
      {isVice && <span className="absolute -top-2 -left-1 z-10 w-5 h-5 rounded-full bg-slate-300 text-[#04140b] text-[10px] font-extrabold flex items-center justify-center shadow">V</span>}
      <div className="w-14 h-[58px] flex items-center justify-center text-2xl">👕</div>
      <div className="text-[11px] font-bold leading-tight text-center truncate w-full">{player.name}</div>
      <div className="text-[9px] text-[var(--muted)] text-center truncate w-full">{player.club}</div>
      <div className="flex items-center gap-1 mt-0.5">
        <span className={`badge ${POS_COLORS[player.pos]} !text-[8px] !px-1 !py-0`}>{player.pos}</span>
        <span className="text-[9px] font-semibold">£{player.nowPrice.toFixed(1)}m</span>
      </div>
      <div className="text-[9px] text-[var(--muted)]">Prediction <span className="text-[var(--accent)]">{player.pred?.toFixed(3) ?? "N/A"}</span>{onBench && <span className="ml-1">🪑</span>}</div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className="bg-[#0d1526] border border-[var(--border)] rounded-lg px-3 py-2"><div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</div><div className={`font-bold ${accent ? "text-[var(--accent)] text-lg" : ""}`}>{value}</div></div>;
}
