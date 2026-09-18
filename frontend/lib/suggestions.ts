import type { TeamRow } from "./fpl";
import type { PlayerRow, PredictionRow } from "./db";
import solver from "javascript-lp-solver";

export type StatsRow = PlayerRow;

/** Stats lookup keyed by FPL player id — never match players by name. */
export function statsByPlayerId(players: PlayerRow[]): Record<number, StatsRow> {
  const map: Record<number, StatsRow> = {};
  for (const p of players) map[p.player_id] = p;
  return map;
}

export type SquadPlayer = {
  player_id?: number;
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
  player_id: number;
  name: string;
  price: number;
  pred: number;
  club: string;
  form: number;
  ppg: number;
  costDiff: number;
  gw_predictions: { gw: number; prob_gt_6: number | null }[];
};

export type Suggestion = {
  out: SquadPlayer;
  in: Replacement;
  improvement: number;
  alternatives: Replacement[];
  transferLabel: string;
};

const POS_BY_ELEMENT: Record<number, string> = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };

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
      pred: pred ? pred.agg_pred_prob : null,
      starter: r.is_starter,
      club: r.club,
    };
  });
}

/**
 * Resolve a prediction to a stats entry by FPL player id (authoritative —
 * web_name matching is ambiguous, e.g. two players named "Fernandes").
 */
export function resolveStatsById(
  prediction: PredictionRow,
  stats: Record<number, StatsRow>
): StatsRow | undefined {
  return stats[prediction.player_id];
}

function findReplacements(
  outPos: string,
  outPrice: number,
  outClub: string,
  clubCount: Record<string, number>,
  budgetAvailable: number,
  predictions: PredictionRow[],
  squadIds: Set<number>,
  usedIds: Set<number>,
  stats: Record<number, StatsRow>,
  preferReinvest: boolean,
  excludedIds: Set<number> = new Set()
): Replacement[] {
  const candidates: Replacement[] = [];
  for (const pred of predictions) {
    if (pred.position !== outPos) continue;
    // Match stats by player_id — names are ambiguous.
    const s = stats[pred.player_id];
    if (!s || (s.status !== "a" && s.status !== "d")) continue;
    if (squadIds.has(s.player_id) || usedIds.has(s.player_id) || excludedIds.has(s.player_id)) continue;
    const targetClub = s.team_name;
    const tempCount = { ...clubCount };
    if (outClub === targetClub) tempCount[outClub] = (tempCount[outClub] ?? 0) - 1;
    if ((tempCount[targetClub] ?? 0) >= 3) continue;
    const costDiff = s.price - outPrice;
    if (costDiff > budgetAvailable) continue;
    candidates.push({
      player_id: s.player_id,
      name: s.web_name,
      price: s.price,
      pred: pred.agg_pred_prob,
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
  stats: Record<number, StatsRow>,
  bank: number
): { suggestions: Suggestion[]; remainingBank: number; clubCount: Record<string, number> } {
  const squadIds = new Set(squad.map((p) => p.player_id).filter((id): id is number => id != null));
  const usedIds = new Set<number>();
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
      predictions, squadIds, usedIds, stats, false
    );
    if (repls.length) {
      const best = repls[0];
      usedIds.add(best.player_id);
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
    .filter((p) => p.name !== first?.name && (stats[p.player_id ?? -1]?.selected_by_percent ?? 0) < 50);

  for (const player of remainingStarters) {
    if (suggestions.length >= 3) break;
    const preferReinvest = remainingBank > 3.0;
    const repls = findReplacements(
      player.pos, player.sellPrice, player.club, clubCount, remainingBank,
      predictions, squadIds, usedIds, stats, preferReinvest
    );
    if (!repls.length) continue;
    const best = repls[0];
    const improvement = best.pred - (player.pred ?? 0);
    if (improvement <= 0 && player.pred !== null) continue;
    usedIds.add(best.player_id);
    remainingBank -= best.costDiff;
    // alternatives (computed against pre-cost bank for display)
    const allRepls = findReplacements(
      player.pos, player.sellPrice, player.club, clubCount,
      remainingBank + best.costDiff, predictions, squadIds, usedIds, stats, preferReinvest
    );
    const alts = allRepls.filter((r) => r.player_id !== best.player_id && !usedIds.has(r.player_id)).slice(0, 2);
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

const DREAM_POOL_SIZE = 28;

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
      pred: prediction.agg_pred_prob,
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
  if (!candidates.length) return null;

  // Exact MILP (binary x_i per player):
  //   maximize sum(pred_i * x_i)
  //   s.t. sum(x_i) = 15; per-position exact counts (GKP 2, DEF 5, MID 5, FWD 3);
  //        sum(price_i * x_i) <= budget; max 3 players per club.
  const requirements: Record<string, number> = { GKP: 2, DEF: 5, MID: 5, FWD: 3 };
  const clubNames = [...new Set(candidates.map((player) => player.club))];

  const constraints: Record<string, { equal?: number; max?: number }> = { squad: { equal: 15 }, spent: { max: budget } };
  for (const [position, required] of Object.entries(requirements)) constraints[`pos_${position}`] = { equal: required };
  for (const club of clubNames) constraints[`club_${club}`] = { max: 3 };

  const variables: Record<string, Record<string, number>> = {};
  const upperBounds: Record<string, { max: number }> = {};
  for (const player of candidates) {
    const key = `${player.name} (${player.club})`;
    variables[key] = {
      squadPred: player.pred ?? 0,
      squad: 1,
      spent: player.nowPrice,
      [`pos_${player.pos}`]: 1,
      [`club_${player.club}`]: 1,
      [`ub_${key}`]: 1,
    };
    // Explicit x <= 1 + integrality = binary. The library's `ints` alone has no
    // default upper bound, so it can otherwise "select" a player multiple times.
    upperBounds[`ub_${key}`] = { max: 1 };
  }

  const solution = solver.Solve({
    optimize: "squadPred",
    opType: "max",
    constraints: { ...constraints, ...upperBounds },
    variables,
    ints: Object.fromEntries(Object.keys(variables).map((name) => [name, 1])),
  } as never) as Record<string, number | string>;

  const squad = candidates.filter((player) => solution[`${player.name} (${player.club})`] === 1);
  if (squad.length !== 15) {
    // Diagnostics to surface solver/model issues instead of failing silently.
    const values = candidates
      .map((player) => [player, solution[`${player.name} (${player.club})`]] as const)
      .filter(([, value]) => typeof value === "number" && value > 0)
      .sort((a, b) => (b[1] as number) - (a[1] as number));
    console.error("optimizeDream15: solver returned non-squad solution", { feasible: solution.feasible, picked: values.slice(0, 20) });
    return null;
  }

  const spent = squad.reduce((sum, player) => sum + player.nowPrice, 0);
  const bestXi = optimizeStartingEleven(squad);
  if (!bestXi || bestXi.xi.length !== 11) return null;
  const xi = bestXi.xi;
  const bench = bestXi.bench;
  return {
    squad,
    xi,
    bench,
    captain: bestXi.captain!,
    viceCaptain: bestXi.viceCaptain!,
    formation: bestXi.formation,
    totalPred: bestXi.totalPred,
    benchPred: bench.reduce((sum, player) => sum + (player.pred ?? 0), 0),
    squadPred: bestXi!.totalPred + bench.reduce((sum, player) => sum + (player.pred ?? 0), 0),
    spent,
    remainingBudget: budget - spent,
  };
}

/**
 * Exact MILP optimization of the starting XI from the current 15-man squad.
 * Rules: 1 GKP, 3-5 DEF, 3-5 MID, 1-3 FWD (sum 10 + GKP = 11).
 * Binary s_i per player: maximize sum(pred_i * s_i)
 *   s.t. sum(s_i) = 11; GKP starters = 1; 3 <= DEF <= 5; 3 <= MID <= 5; 1 <= FWD <= 3.
 * Max 3 players per club is automatically respected — the squad already
 * satisfies it and we never add external players.
 */
export function optimizeStartingEleven(squad: SquadPlayer[]): OptimizeResult | null {
  if (squad.length !== 15) return null;
  const pred = (p: SquadPlayer) => p.pred ?? 0;

  const clubCount: Record<string, number> = {};
  for (const p of squad) clubCount[p.club] = (clubCount[p.club] ?? 0) + 1;
  for (const c of Object.values(clubCount)) if (c > 3) return null; // invalid squad

  const variables: Record<string, Record<string, number>> = {};
  const upperBounds: Record<string, { max: number }> = {};
  squad.forEach((p, i) => {
    const key = `s${i}`;
    variables[key] = {
      total: pred(p),
      xi: 1,
      [`sp_${p.pos}`]: 1,
      [`ub_${key}`]: 1,
    };
    // Explicit x <= 1 + integrality = binary (library's `ints` alone is unbounded).
    upperBounds[`ub_${key}`] = { max: 1 };
  });

  const solution = solver.Solve({
    optimize: "total",
    opType: "max",
    constraints: {
      xi: { equal: 11 },
      sp_GKP: { equal: 1 },
      sp_DEF: { min: 3, max: 5 },
      sp_MID: { min: 3, max: 5 },
      sp_FWD: { min: 1, max: 3 },
      ...upperBounds,
    },
    variables,
    ints: Object.fromEntries(Object.keys(variables).map((name) => [name, 1])),
  } as never) as Record<string, number | string>;

  const xiSet = new Set(
    squad.filter((_, i) => solution[`s${i}`] === 1).map((p) => p.name)
  );
  if (xiSet.size !== 11) {
    console.error("optimizeStartingEleven: solver returned non-XI solution", { feasible: solution.feasible });
    return null;
  }

  const xi = squad.filter((p) => xiSet.has(p.name));
  const bench = squad.filter((p) => !xiSet.has(p.name));
  const total = xi.reduce((sum, p) => sum + pred(p), 0);
  const byPos = (pos: string) => xi.filter((p) => p.pos === pos).length;
  const captain = xi.reduce((a, b) => (pred(b) > pred(a) ? b : a), xi[0]).name;
  const vice = [...xi].sort((a, b) => pred(b) - pred(a))[1]?.name ?? null;

  const currentStarters = squad.filter((p) => p.starter);
  const currentTotal = currentStarters.reduce((s, p) => s + pred(p), 0);

  return {
    xi: [...xi].sort((a, b) => pred(b) - pred(a)),
    bench,
    captain,
    viceCaptain: vice,
    formation: `${byPos("DEF")}-${byPos("MID")}-${byPos("FWD")}`,
    totalPred: total,
    currentTotal,
    gain: total - currentTotal,
  };
}

/**
 * Exact best single transfer (starter-out / same-position-in) via MILP reasoning:
 *
 * 1. Solve the current optimal XI once (MILP).
 * 2. For each position, the provably best outgoing is the lowest-pred current-XI
 *    player there: swapping any non-XI starter leaves the XI unchanged, and for a
 *    fixed incoming player the XI after the swap is (old XI − out + in), whose
 *    value is pred(in) − pred(out) — maximized by the weakest XI member.
 * 3. Pick the best (position, incoming) pair under budget + club constraints.
 * 4. Verify by re-solving the XI (MILP) for the post-transfer squad.
 */
export function findBestTransfer(
  squad: SquadPlayer[],
  predictions: PredictionRow[],
  stats: Record<number, StatsRow>,
  bank: number,
  declinedIds: number[] = []
): Suggestion | null {
  const current = optimizeStartingEleven(squad);
  if (!current) return null;

  const clubCount: Record<string, number> = {};
  for (const player of squad) clubCount[player.club] = (clubCount[player.club] ?? 0) + 1;
  const squadIds = new Set(squad.map((p) => p.player_id).filter((id): id is number => id != null));
  const declined = new Set(Array.isArray(declinedIds) ? declinedIds : []);

  // Weakest current-XI player per position — the provably optimal outgoing.
  const weakestXiByPos: Record<string, SquadPlayer> = {};
  for (const player of current.xi) {
    const w = weakestXiByPos[player.pos];
    if (!w || (player.pred ?? 0) < (w.pred ?? 0)) weakestXiByPos[player.pos] = player;
  }

  let best: { out: SquadPlayer; in: Replacement; improvement: number } | null = null;

  for (const [pos, outgoing] of Object.entries(weakestXiByPos)) {
    const replacements = findReplacements(
      pos,
      outgoing.sellPrice,
      outgoing.club,
      clubCount,
      bank,
      predictions,
      squadIds,
      new Set<number>(),
      stats,
      false,
      declined
    );
    for (const incoming of replacements) {
      const improvement = incoming.pred - (outgoing.pred ?? 0);
      if (!best || improvement > best.improvement) {
        best = { out: outgoing, in: incoming, improvement };
      }
    }
  }

  if (!best) return null;

  // Verify: solve the post-transfer XI exactly and confirm the improvement.
  const incomingPlayer: SquadPlayer = {
    player_id: best.in.player_id,
    name: best.in.name,
    pos: best.out.pos,
    nowPrice: best.in.price,
    sellPrice: best.in.price,
    pred: best.in.pred,
    starter: best.out.starter,
    club: best.in.club,
  };
  const candidateSquad = squad.map((player) => player.name === best!.out.name ? incomingPlayer : player);
  const candidate = optimizeStartingEleven(candidateSquad);
  if (!candidate) return null;
  const verifiedImprovement = candidate.totalPred - current.totalPred;

  return {
    out: best.out,
    in: best.in,
    improvement: verifiedImprovement,
    alternatives: [],
    transferLabel: verifiedImprovement > 0 ? "BEST XI TRANSFER" : "BEST AVAILABLE TRANSFER",
  };
}

/** Find the best complete plan instead of greedily chaining single transfers. */
export function findBestTransferPlan(
  squad: SquadPlayer[],
  predictions: PredictionRow[],
  stats: Record<number, StatsRow>,
  bank: number,
  limit: 1 | 2 | 3,
  declinedIds: number[] = []
): Suggestion[] {
  const bestByDepth: Suggestion[][] = [];
  const scoreByDepth: number[] = [];
  const declined = new Set(declinedIds);

  const search = (currentSquad: SquadPlayer[], currentBank: number, plan: Suggestion[]) => {
    if (plan.length > 0) {
      const score = plan.reduce((total, suggestion) => total + suggestion.improvement, 0);
      if (!bestByDepth[plan.length] || score > scoreByDepth[plan.length]) {
        bestByDepth[plan.length] = plan;
        scoreByDepth[plan.length] = score;
      }
    }
    if (plan.length >= limit) return;

    const current = optimizeStartingEleven(currentSquad);
    if (!current) return;
    const clubCount: Record<string, number> = {};
    for (const player of currentSquad) clubCount[player.club] = (clubCount[player.club] ?? 0) + 1;
    const squadIds = new Set(currentSquad.map((player) => player.player_id).filter((id): id is number => id != null));
    const weakestXiByPos: Record<string, SquadPlayer> = {};
    for (const player of current.xi) {
      const weakest = weakestXiByPos[player.pos];
      if (!weakest || (player.pred ?? 0) < (weakest.pred ?? 0)) weakestXiByPos[player.pos] = player;
    }

    for (const outgoing of Object.values(weakestXiByPos)) {
      const replacements = findReplacements(
        outgoing.pos,
        outgoing.sellPrice,
        outgoing.club,
        clubCount,
        currentBank,
        predictions,
        squadIds,
        new Set(plan.map((suggestion) => suggestion.in.player_id)),
        stats,
        false,
        declined
      );
      for (const incoming of replacements) {
        const incomingPlayer: SquadPlayer = {
          player_id: incoming.player_id,
          name: incoming.name,
          pos: outgoing.pos,
          nowPrice: incoming.price,
          sellPrice: incoming.price,
          pred: incoming.pred,
          starter: outgoing.starter,
          club: incoming.club,
        };
        const nextSquad = currentSquad.map((player) => player.name === outgoing.name ? incomingPlayer : player);
        const nextResult = optimizeStartingEleven(nextSquad);
        if (!nextResult) continue;
        const suggestion: Suggestion = {
          out: outgoing,
          in: incoming,
          improvement: nextResult.totalPred - current.totalPred,
          alternatives: [],
          transferLabel: plan.length === 0 ? "BEST XI TRANSFER" : `Transfer ${plan.length + 1} (-4 pts)`,
        };
        search(nextSquad, currentBank - incoming.costDiff, [...plan, suggestion]);
      }
    }
  };

  search(squad, bank, []);
  return bestByDepth[limit] ?? bestByDepth[bestByDepth.length - 1] ?? [];
}

/**
 * All valid transfer options for one squad player, sorted by prediction (desc).
 * Constraints: same position, budget (bank + sell price), max 3 per club
 * (accounting for the outgoing player's club slot), availability, and not
 * already in the squad.
 */
export function listTransferOptions(
  out: SquadPlayer,
  squad: SquadPlayer[],
  predictions: PredictionRow[],
  stats: Record<number, StatsRow>,
  bank: number
): Replacement[] {
  const squadNames = new Set(squad.map((p) => p.name));
  const squadIds = new Set(squad.map((p) => p.player_id).filter((id): id is number => id != null));
  const clubCount: Record<string, number> = {};
  for (const p of squad) clubCount[p.club] = (clubCount[p.club] ?? 0) + 1;

  const budgetAvailable = bank + out.sellPrice - out.nowPrice;
  const candidates: Replacement[] = [];
  for (const pred of predictions) {
    if (pred.position !== out.pos) continue;
    // Match stats by player_id — names are ambiguous.
    const s = stats[pred.player_id];
    if (!s || (s.status !== "a" && s.status !== "d")) continue;
    if (squadIds.has(s.player_id)) continue;
    const targetClub = s.team_name;
    const tempCount = { ...clubCount };
    if (out.club === targetClub) tempCount[out.club] = (tempCount[out.club] ?? 0) - 1;
    if ((tempCount[targetClub] ?? 0) >= 3) continue;
    const costDiff = s.price - out.sellPrice;
    if (costDiff > budgetAvailable) continue;
    candidates.push({
      player_id: s.player_id,
      name: s.web_name,
      price: s.price,
      pred: pred.agg_pred_prob,
      club: targetClub,
      form: s.form,
      ppg: s.points_per_game,
      costDiff,
      gw_predictions: pred.gw_predictions,
    });
  }
  candidates.sort((a, b) => b.pred - a.pred);
  return candidates;
}
