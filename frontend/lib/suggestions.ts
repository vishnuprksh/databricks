import type { TeamRow } from "./fpl";
import type { PlayerRow, PredictionRow } from "./db";

export type StatsRow = {
  web_name: string;
  position: string;
  price: number;
  team_name: string;
  status: string;
  news: string;
  total_points: number;
  form: number;
  points_per_game: number;
  selected_by_percent: number;
};

export type SquadPlayer = {
  name: string;
  pos: string;
  nowPrice: number;
  sellPrice: number;
  pred: number | null;
  starter: boolean;
  club: string;
  photo?: string; // FPL photo code, image at resources.premierleague.com/.../p{photo}.png
};

export type Replacement = {
  name: string;
  price: number;
  pred: number;
  club: string;
  form: number;
  ppg: number;
  costDiff: number;
  gw_predictions: { gw: number; prob_gt_6: number }[];
};

export type Suggestion = {
  out: SquadPlayer;
  in: Replacement;
  improvement: number;
  alternatives: Replacement[];
  transferLabel: string;
};

const POS_BY_ELEMENT: Record<number, string> = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };

export function statsByPlayerName(players: any[]): Record<string, StatsRow> {
  const map: Record<string, StatsRow> = {};
  for (const p of players) {
    map[p.web_name] = {
      web_name: p.web_name,
      position: p.position ?? POS_BY_ELEMENT[p.element_type] ?? "Unknown",
      price: p.now_cost != null ? p.now_cost / 10 : p.price ?? 0,
      team_name: p.team_name ?? p.club ?? "Unknown",
      status: p.status ?? "?",
      news: p.news ?? "",
      total_points: p.total_points ?? 0,
      form: parseFloat(p.form ?? 0) || 0,
      points_per_game: parseFloat(p.points_per_game ?? 0) || 0,
      selected_by_percent: parseFloat(p.selected_by_percent ?? 0) || 0,
    };
  }
  return map;
}

export type TransferRecord = { event: number; element_in: number; element_out: number; element_in_cost: number };

/** FPL rule: sell_price = min(purchase_price, current_price) */
export function computeSellPrices(
  teamRows: TeamRow[],
  transfers: TransferRecord[]
): Record<string, number> {
  const purchasePrices: Record<number, number> = {};
  for (const t of [...transfers].sort((a, b) => a.event - b.event)) {
    purchasePrices[t.element_in] = t.element_in_cost;
    if (t.element_out in purchasePrices) delete purchasePrices[t.element_out];
  }
  const sell: Record<string, number> = {};
  for (const r of teamRows) {
    const nowTenths = Math.round(r.price * 10);
    const buyTenths = purchasePrices[r.player_id] ?? nowTenths;
    sell[r.player_name] = Math.min(buyTenths, nowTenths) / 10;
  }
  return sell;
}

export function buildSquadWithPred(
  teamRows: TeamRow[],
  predByName: Record<string, PredictionRow>,
  sellPrices: Record<string, number>
): SquadPlayer[] {
  return teamRows.map((r) => {
    const pred = predByName[r.player_name];
    return {
      name: r.player_name,
      pos: r.position,
      nowPrice: r.price,
      sellPrice: sellPrices[r.player_name] ?? r.price,
      pred: pred ? pred.avg_prob_gt_6 : null,
      starter: r.is_starter,
      club: r.club,
    };
  });
}

function findReplacements(
  outPos: string,
  outPrice: number,
  outClub: string,
  clubCount: Record<string, number>,
  budgetAvailable: number,
  predictions: PredictionRow[],
  squadNames: Set<string>,
  usedIncoming: Set<string>,
  stats: Record<string, StatsRow>,
  preferReinvest: boolean
): Replacement[] {
  const candidates: Replacement[] = [];
  for (const pred of predictions) {
    if (pred.position !== outPos) continue;
    if (squadNames.has(pred.player_name) || usedIncoming.has(pred.player_name)) continue;
    const s = stats[pred.player_name];
    if (!s || (s.status !== "a" && s.status !== "d")) continue;
    const targetClub = s.team_name;
    const tempCount = { ...clubCount };
    if (outClub === targetClub) tempCount[outClub] = (tempCount[outClub] ?? 0) - 1;
    if ((tempCount[targetClub] ?? 0) >= 3) continue;
    const costDiff = s.price - outPrice;
    if (costDiff > budgetAvailable) continue;
    candidates.push({
      name: pred.player_name,
      price: s.price,
      pred: pred.avg_prob_gt_6,
      club: targetClub,
      form: s.form,
      ppg: s.points_per_game,
      costDiff,
      gw_predictions: pred.gw_predictions,
    });
  }
  candidates.sort((a, b) =>
    preferReinvest ? b.pred + b.price / 100 - (a.pred + a.price / 100) : b.pred - a.pred
  );
  return candidates.slice(0, 5);
}

export function generateSuggestions(
  squad: SquadPlayer[],
  predictions: PredictionRow[],
  stats: Record<string, StatsRow>,
  bank: number,
  squadNames: string[]
): { suggestions: Suggestion[]; remainingBank: number; clubCount: Record<string, number> } {
  const squadNamesSet = new Set(squadNames);
  const usedIncoming = new Set<string>();
  const clubCount: Record<string, number> = {};
  for (const p of squad) clubCount[p.club] = (clubCount[p.club] ?? 0) + 1;

  const starters = squad.filter((p) => p.starter);
  const startersSorted = [...starters].sort((a, b) => {
    if (a.pred === null && b.pred !== null) return -1;
    if (b.pred === null && a.pred !== null) return 1;
    return (a.pred ?? 0) - (b.pred ?? 0);
  });

  let remainingBank = bank;
  const suggestions: Suggestion[] = [];
  let first: SquadPlayer | null = null;

  // Phase 1: address biggest gap
  if (startersSorted.length) {
    first = startersSorted[0];
    const budget1 = remainingBank;
    const repls = findReplacements(
      first.pos, first.sellPrice, first.club, clubCount, budget1,
      predictions, squadNamesSet, usedIncoming, stats, false
    );
    if (repls.length) {
      const best = repls[0];
      usedIncoming.add(best.name);
      remainingBank -= best.costDiff;
      suggestions.push({
        out: first, in: best,
        improvement: best.pred - (first.pred ?? 0),
        alternatives: [],
        transferLabel: "FREE TRANSFER",
      });
    }
  }

  // Phase 2: reinvest freed budget into next weakest starters (skip >50% owned)
  const remainingStarters = startersSorted
    .slice(1)
    .filter((p) => p.name !== first?.name && (stats[p.name]?.selected_by_percent ?? 0) < 50);

  for (const player of remainingStarters) {
    if (suggestions.length >= 3) break;
    const preferReinvest = remainingBank > 3.0;
    const repls = findReplacements(
      player.pos, player.sellPrice, player.club, clubCount, remainingBank,
      predictions, squadNamesSet, usedIncoming, stats, preferReinvest
    );
    if (!repls.length) continue;
    const best = repls[0];
    const improvement = best.pred - (player.pred ?? 0);
    if (improvement <= 0 && player.pred !== null) continue;
    usedIncoming.add(best.name);
    remainingBank -= best.costDiff;
    // alternatives (computed against pre-cost bank for display)
    const allRepls = findReplacements(
      player.pos, player.sellPrice, player.club, clubCount,
      remainingBank + best.costDiff, predictions, squadNamesSet, usedIncoming, stats, preferReinvest
    );
    const alts = allRepls.filter((r) => r.name !== best.name && !usedIncoming.has(r.name)).slice(0, 2);
    suggestions.push({ out: player, in: best, improvement, alternatives: alts, transferLabel: `Transfer ${suggestions.length + 1} (-4 pts)` });
  }

  return { suggestions, remainingBank, clubCount };
}

export type OptimizeResult = {
  xi: SquadPlayer[];
  bench: SquadPlayer[];
  captain: string | null;
  viceCaptain: string | null;
  formation: string;
  totalPred: number;
  currentTotal: number;
  gain: number;
};

export type Dream15Result = {
  squad: SquadPlayer[];
  xi: SquadPlayer[];
  bench: SquadPlayer[];
  captain: string;
  viceCaptain: string;
  formation: string;
  totalPred: number;
  benchPred: number;
  squadPred: number;
  spent: number;
  remainingBudget: number;
};

type DreamOption = {
  players: SquadPlayer[];
  starters: SquadPlayer[];
  starterPred: number;
  benchPred: number;
  spent: number;
  clubCounts: Record<string, number>;
};

const DREAM_POOL_SIZE = 28;
const DREAM_BEAM_SIZE = 5000;

function dreamPlayers(players: PlayerRow[], predictions: PredictionRow[]): SquadPlayer[] {
  const predictionById = new Map(predictions.map((prediction) => [prediction.player_id, prediction]));
  const byPosition: Record<string, SquadPlayer[]> = {};
  for (const player of players) {
    const prediction = predictionById.get(player.player_id);
    if (!prediction || (player.status !== "a" && player.status !== "d")) continue;
    const candidate: SquadPlayer = {
      name: player.web_name,
      pos: player.position,
      nowPrice: player.price,
      sellPrice: player.price,
      pred: prediction.avg_prob_gt_6,
      starter: false,
      club: player.team_name,
    };
    (byPosition[player.position] ??= []).push(candidate);
  }
  return Object.values(byPosition).flatMap((positionPlayers) => {
    const byPrediction = [...positionPlayers].sort((a, b) => (b.pred ?? 0) - (a.pred ?? 0));
    const byPrice = [...positionPlayers].sort((a, b) => a.nowPrice - b.nowPrice);
    return [...new Map([...byPrediction.slice(0, DREAM_POOL_SIZE), ...byPrice.slice(0, 15)].map((player) => [player.name, player])).values()];
  });
}

export function optimizeDream15(players: PlayerRow[], predictions: PredictionRow[], budget = 100): Dream15Result | null {
  const candidates = dreamPlayers(players, predictions);
  const squadRequirements: Record<string, number> = { GKP: 2, DEF: 5, MID: 5, FWD: 3 };
  const positionOrder = ["GKP", "DEF", "MID", "FWD"];
  let states: DreamOption[] = [{ players: [], starters: [], starterPred: 0, benchPred: 0, spent: 0, clubCounts: {} }];

  for (const position of positionOrder) {
    const positionCandidates = candidates.filter((player) => player.pos === position);
    const required = squadRequirements[position];
    const positionStates: DreamOption[] = [{ players: [], starters: [], starterPred: 0, benchPred: 0, spent: 0, clubCounts: {} }];
    for (const candidate of positionCandidates) {
      const next = [...positionStates];
      for (const state of positionStates) {
        if (state.players.length >= required || state.spent + candidate.nowPrice > budget) continue;
        const clubCount = state.clubCounts[candidate.club] ?? 0;
        if (clubCount >= 3) continue;
        next.push({
          players: [...state.players, candidate],
          starters: [],
          starterPred: 0,
          benchPred: state.benchPred + (candidate.pred ?? 0),
          spent: state.spent + candidate.nowPrice,
          clubCounts: { ...state.clubCounts, [candidate.club]: clubCount + 1 },
        });
      }
      const bestByKey = new Map<string, DreamOption>();
      for (const state of next) {
        const key = `${state.players.length}|${Math.round(state.spent * 10)}|${Object.entries(state.clubCounts).sort().map(([club, count]) => `${club}:${count}`).join(",")}`;
        const previous = bestByKey.get(key);
        if (!previous || state.benchPred > previous.benchPred) bestByKey.set(key, state);
      }
      positionStates.splice(0, positionStates.length, ...[...bestByKey.values()].sort((a, b) => b.benchPred - a.benchPred).slice(0, DREAM_BEAM_SIZE));
    }
    const completed = positionStates.filter((state) => state.players.length === required);
    if (!completed.length) return null;
    const next: DreamOption[] = [];
    for (const combination of states) {
      for (const option of completed) {
        if (combination.spent + option.spent > budget) continue;
        const clubCounts = { ...combination.clubCounts };
        let valid = true;
        for (const [club, count] of Object.entries(option.clubCounts)) {
          clubCounts[club] = (clubCounts[club] ?? 0) + count;
          if (clubCounts[club] > 3) { valid = false; break; }
        }
        if (valid) next.push({ players: [...combination.players, ...option.players], starters: [], starterPred: 0, benchPred: combination.benchPred + option.benchPred, spent: combination.spent + option.spent, clubCounts });
      }
    }
    states = next.sort((a, b) => b.benchPred - a.benchPred).slice(0, DREAM_BEAM_SIZE);
    if (!states.length) return null;
  }

  let best: DreamOption | null = null;
  let bestXi: OptimizeResult | null = null;
  for (const state of states) {
    const xi = optimizeStartingEleven(state.players);
    if (xi && (!bestXi || xi.totalPred * 1000000 + state.benchPred > bestXi.totalPred * 1000000 + (best?.benchPred ?? 0))) {
      best = state;
      bestXi = xi;
    }
  }
  if (!best || !bestXi || bestXi.xi.length !== 11) return null;
  const xi = bestXi!.xi;
  const bench = bestXi!.bench;
  return { squad: best.players, xi, bench, captain: bestXi!.captain!, viceCaptain: bestXi!.viceCaptain!, formation: bestXi!.formation, totalPred: bestXi!.totalPred, benchPred: bench.reduce((sum, player) => sum + (player.pred ?? 0), 0), squadPred: bestXi!.totalPred + bench.reduce((sum, player) => sum + (player.pred ?? 0), 0), spent: best.spent, remainingBudget: budget - best.spent };
}

const VALID_FORMATIONS: [number, number, number][] = [];
for (let d = 3; d <= 5; d++)
  for (let m = 3; m <= 5; m++)
    for (let f = 1; f <= 3; f++) if (d + m + f === 10) VALID_FORMATIONS.push([d, m, f]);

/**
 * Exact optimization of the starting XI from the current 15-man squad.
 * Rules: 1 GKP, 3-5 DEF, 3-5 MID, 1-3 FWD (sum 10 + GKP = 11).
 * Max 3 players per club is automatically respected — the squad already
 * satisfies it and we never add external players.
 */
export function optimizeStartingEleven(squad: SquadPlayer[]): OptimizeResult | null {
  if (squad.length !== 15) return null;
  const byPos = (pos: string) =>
    squad
      .filter((p) => p.pos === pos)
      .sort((a, b) => (b.pred ?? 0) - (a.pred ?? 0));
  const gkps = byPos("GKP");
  const defs = byPos("DEF");
  const mids = byPos("MID");
  const fwds = byPos("FWD");
  if (!gkps.length) return null;

  const pred = (p: SquadPlayer) => p.pred ?? 0;
  const clubCount: Record<string, number> = {};
  for (const p of squad) clubCount[p.club] = (clubCount[p.club] ?? 0) + 1;
  for (const c of Object.values(clubCount)) if (c > 3) return null; // invalid squad

  let best: { xi: SquadPlayer[]; total: number; formation: [number, number, number] } | null = null;

  for (const [d, m, f] of VALID_FORMATIONS) {
    // Combinations via best-first: since we maximize sum, top-k picks per combo.
    const comboSums = (pool: SquadPlayer[], k: number): { picks: SquadPlayer[]; total: number }[] => {
      const results: { picks: SquadPlayer[]; total: number }[] = [];
      const rec = (start: number, picks: SquadPlayer[], total: number) => {
        if (picks.length === k) {
          results.push({ picks: [...picks], total });
          return;
        }
        for (let i = start; i < pool.length; i++) rec(i + 1, [...picks, pool[i]], total + pred(pool[i]));
      };
      rec(0, [], 0);
      return results;
    };

    for (const gk of gkps) {
      // cheap prune: club constraint checked after combo
      for (const D of comboSums(defs, d)) {
        for (const M of comboSums(mids, m)) {
          for (const F of comboSums(fwds, f)) {
            const counts: Record<string, number> = {};
            let ok = true;
            for (const p of [gk, ...D.picks, ...M.picks, ...F.picks]) {
              counts[p.club] = (counts[p.club] ?? 0) + 1;
              if (counts[p.club] > 3) { ok = false; break; }
            }
            if (!ok) continue;
            const total = pred(gk) + D.total + M.total + F.total;
            if (!best || total > best.total) {
              best = { xi: [gk, ...D.picks, ...M.picks, ...F.picks], total, formation: [d, m, f] };
            }
          }
        }
      }
    }
  }

  if (!best) return null;
  const xiNames = new Set(best.xi.map((p) => p.name));
  const bench = squad.filter((p) => !xiNames.has(p.name));
  const captain = best.xi.reduce((a, b) => (pred(b) > pred(a) ? b : a), best.xi[0]).name;
  const vice = [...best.xi].sort((a, b) => pred(b) - pred(a))[1]?.name ?? null;

  const currentStarters = squad.filter((p) => p.starter);
  const currentTotal = currentStarters.reduce((s, p) => s + pred(p), 0);

  return {
    xi: [...best.xi].sort((a, b) => pred(b) - pred(a)),
    bench,
    captain,
    viceCaptain: vice,
    formation: `${best.formation[0]}-${best.formation[1]}-${best.formation[2]}`,
    totalPred: best.total,
    currentTotal,
    gain: best.total - currentTotal,
  };
}

export function findBestTransfer(
  squad: SquadPlayer[],
  predictions: PredictionRow[],
  stats: Record<string, StatsRow>,
  bank: number,
  squadNames: string[]
): Suggestion | null {
  const current = optimizeStartingEleven(squad);
  if (!current) return null;

  const clubCount: Record<string, number> = {};
  for (const player of squad) clubCount[player.club] = (clubCount[player.club] ?? 0) + 1;
  const squadNamesSet = new Set(squadNames);
  let best: Suggestion | null = null;

  for (const outgoing of squad.filter((player) => player.starter)) {
    const replacements = findReplacements(
      outgoing.pos,
      outgoing.sellPrice,
      outgoing.club,
      clubCount,
      bank,
      predictions,
      squadNamesSet,
      new Set<string>(),
      stats,
      false
    );

    for (const incoming of replacements) {
      const incomingPlayer: SquadPlayer = {
        name: incoming.name,
        pos: outgoing.pos,
        nowPrice: incoming.price,
        sellPrice: incoming.price,
        pred: incoming.pred,
        starter: outgoing.starter,
        club: incoming.club,
      };
      const candidateSquad = squad.map((player) => player.name === outgoing.name ? incomingPlayer : player);
      const candidate = optimizeStartingEleven(candidateSquad);
      if (!candidate) continue;

      const improvement = candidate.totalPred - current.totalPred;
      if (!best || improvement > best.improvement) {
        best = {
          out: outgoing,
          in: incoming,
          improvement,
          alternatives: [],
          transferLabel: improvement > 0 ? "BEST XI TRANSFER" : "BEST AVAILABLE TRANSFER",
        };
      }
    }
  }

  return best;
}
