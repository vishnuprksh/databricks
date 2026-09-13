# Databricks notebook source
# /// script
# [tool.databricks.environment]
# environment_version = "5"
# ///
# DBTITLE 1,Setup widgets
# Widgets for input parameters
dbutils.widgets.text("team_id", "", "FPL Team ID")
dbutils.widgets.text("gameweek", "", "Gameweek (leave empty for current)")

# COMMAND ----------

# DBTITLE 1,Import libraries
import json
import requests
from pyspark.sql import Row
from pyspark.sql.types import *
from datetime import datetime

# FPL API configuration
BASE_URL = "https://fantasy.premierleague.com/api"
HEADERS = {
    "User-Agent": "fpl-team-fetcher/databricks",
    "Accept": "application/json"
}

# COMMAND ----------

# DBTITLE 1,Fetch FPL JSON helper
def fetch_fpl_json(endpoint: str) -> dict:
    """Fetch and decode one FPL API endpoint."""
    url = f"{BASE_URL}/{endpoint.lstrip('/')}"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.HTTPError as exc:
        if exc.response.status_code == 404:
            raise RuntimeError(f"FPL returned 404 for {url}. Check the team ID and gameweek.") from exc
        raise RuntimeError(f"FPL returned HTTP {exc.response.status_code} for {url}.") from exc
    except requests.RequestException as exc:
        raise RuntimeError(f"Could not connect to FPL: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"FPL returned invalid JSON for {url}.") from exc

# COMMAND ----------

# DBTITLE 1,Choose gameweek helper
def choose_gameweek(events: list, requested: str = None) -> int:
    """Use the requested GW, otherwise current GW, then most recently finished GW."""
    valid_ids = {event["id"] for event in events}
    
    if requested and requested.strip():
        requested_int = int(requested)
        if requested_int not in valid_ids:
            raise ValueError(f"Gameweek must be one of: {min(valid_ids)}-{max(valid_ids)}")
        return requested_int
    
    # Try current gameweek
    current = next((event["id"] for event in events if event.get("is_current")), None)
    if current is not None:
        return current
    
    # Try most recently finished
    finished = [event["id"] for event in events if event.get("finished")]
    if finished:
        return max(finished)
    
    # Try next upcoming
    upcoming = next((event["id"] for event in events if event.get("is_next")), None)
    if upcoming is not None:
        return upcoming
    
    raise RuntimeError("Could not determine a gameweek from bootstrap-static.")

# COMMAND ----------

# DBTITLE 1,Build team rows helper
def build_team_rows(picks: list, players: list, teams: list, positions: list) -> list:
    """Join pick records to readable player, club, and position information."""
    player_by_id = {player["id"]: player for player in players}
    team_by_id = {team["id"]: team["name"] for team in teams}
    position_by_id = {position["id"]: position["singular_name_short"] for position in positions}
    
    rows = []
    for pick in sorted(picks, key=lambda item: item["position"]):
        player = player_by_id.get(pick["element"])
        if player is None:
            continue
        
        rows.append({
            "squad_position": pick["position"],
            "player_id": player["id"],
            "player_name": player["web_name"],
            "full_name": f"{player['first_name']} {player['second_name']}",
            "club": team_by_id.get(player["team"], "Unknown"),
            "position": position_by_id.get(player["element_type"], "Unknown"),
            "price": player["now_cost"] / 10,
            "selected_by_percent": float(player["selected_by_percent"]),
            "total_points": player["total_points"],
            "form": float(player["form"]),
            "gameweek_points": pick.get("points", 0),
            "multiplier": pick["multiplier"],
            "is_captain": pick["is_captain"],
            "is_vice_captain": pick["is_vice_captain"],
            "is_starter": pick["position"] <= 11
        })
    
    return rows

# COMMAND ----------

# DBTITLE 1,Get widget values and validate
# Get widget values
team_id_input = dbutils.widgets.get("team_id").strip()
gameweek_input = dbutils.widgets.get("gameweek").strip()

if not team_id_input:
    raise ValueError("Please provide a Team ID in the widget above")

team_id = int(team_id_input)
print(f"Fetching team {team_id}...")

# COMMAND ----------

# DBTITLE 1,Fetch bootstrap data and manager info
# Fetch bootstrap data (all players, teams, positions, gameweeks)
bootstrap = fetch_fpl_json("bootstrap-static/")

# Determine gameweek
gameweek = choose_gameweek(bootstrap["events"], gameweek_input)
print(f"Using Gameweek: {gameweek}")

# Fetch manager info
manager = fetch_fpl_json(f"entry/{team_id}/")
manager_name = f"{manager.get('player_first_name', '')} {manager.get('player_last_name', '')}".strip()
team_name = manager.get('name', 'Unknown')

print(f"Manager: {manager_name}")
print(f"Team: {team_name}")
print(f"Overall Rank: {manager.get('summary_overall_rank', 'N/A'):,}")
print(f"Overall Points: {manager.get('summary_overall_points', 'N/A')}")

# COMMAND ----------

# DBTITLE 1,Fetch team selection and build rows
# Fetch team selection for the gameweek
selection = fetch_fpl_json(f"entry/{team_id}/event/{gameweek}/picks/")

# Build team rows
team_rows = build_team_rows(
    selection["picks"],
    bootstrap["elements"],
    bootstrap["teams"],
    bootstrap["element_types"]
)

# Get gameweek history
entry_history = selection.get("entry_history", {})
gw_points = entry_history.get("points", 0)
gw_rank = entry_history.get("rank", "N/A")
active_chip = selection.get("active_chip")

print(f"\n--- Gameweek {gameweek} Stats ---")
print(f"Points: {gw_points}")
print(f"Rank: {gw_rank:,}" if isinstance(gw_rank, int) else f"Rank: {gw_rank}")
if active_chip:
    print(f"Active Chip: {active_chip}")

# COMMAND ----------

# DBTITLE 1,Display team as DataFrame
# Convert to Spark DataFrame for display
team_df = spark.createDataFrame([Row(**row) for row in team_rows])

# Reorder columns for better display
display_columns = [
    "squad_position",
    "player_name",
    "full_name",
    "position",
    "club",
    "price",
    "is_starter",
    "is_captain",
    "is_vice_captain",
    "gameweek_points",
    "multiplier",
    "total_points",
    "form",
    "selected_by_percent"
]

team_display = team_df.select(*display_columns).orderBy("squad_position")
display(team_display)

# COMMAND ----------

# DBTITLE 1,Show starters vs bench
# Show starters vs bench
starters_df = team_df.filter(team_df.is_starter == True).orderBy("squad_position")
bench_df = team_df.filter(team_df.is_starter == False).orderBy("squad_position")

print("\n=== STARTING XI ===")
starters_df.select(
    "squad_position", "player_name", "position", "club", 
    "gameweek_points", "is_captain", "is_vice_captain"
).show(11, truncate=False)

print("\n=== BENCH ===")
bench_df.select(
    "squad_position", "player_name", "position", "club", "gameweek_points"
).show(4, truncate=False)

# COMMAND ----------

# DBTITLE 1,Team summary stats
# Team summary stats
total_value = sum(row["price"] for row in team_rows)
total_gw_points = sum(row["gameweek_points"] * row["multiplier"] for row in team_rows if row["is_starter"])

print("\n=== TEAM SUMMARY ===")
print(f"Total Squad Value: £{total_value:.1f}m")
print(f"Gameweek Points (calculated): {total_gw_points}")
print(f"Bank: £{manager.get('last_deadline_bank', 0) / 10:.1f}m")
print(f"Transfers: {manager.get('last_deadline_total_transfers', 'N/A')}")

# COMMAND ----------

# DBTITLE 1,Transfer Suggestions Header
# MAGIC %md
# MAGIC ## Transfer Suggestions (ML-Powered)
# MAGIC Uses predictions from `fplgeek.gold.predictions` (generated by the FPL pipeline) for all active players to suggest transfers that maximise the model's probability of scoring >6 points, while respecting FPL squad constraints (budget, 3-player-per-club limit, position limits).

# COMMAND ----------

# DBTITLE 1,Fetch predictions and analyse squad
import json as _json
from pyspark.sql import functions as F

# ── 1. Load model predictions from gold layer ──────────────────────────────
_pred_rows = spark.sql("SELECT player_id, player_name, position, gw_predictions, avg_prob_gt_6 FROM fplgeek.gold.predictions").collect()
all_predictions = []
for _row in _pred_rows:
    _gws = _json.loads(_row['gw_predictions'])
    all_predictions.append({
        'position': _row['position'],
        'player_id': _row['player_id'],
        'player_name': _row['player_name'],
        'avg_prob_gt_6': _row['avg_prob_gt_6'],
        'gw_predictions': _gws
    })

pred_by_name = {p['player_name']: p for p in all_predictions}

# ── 2. Load player stats (prices, clubs, status) from bronze layer ─────────
_team_name = {}
for _r in spark.table("fplgeek.bronze.teams").collect():
    _td = _json.loads(_r['data'])
    _team_name[_td['id']] = _td['name']

_pos_map = {1: "GKP", 2: "DEF", 3: "MID", 4: "FWD"}
stats_by_name = {}
for _r in spark.table("fplgeek.bronze.players").collect():
    _p = _json.loads(_r['data'])
    stats_by_name[_p['web_name']] = {
        'web_name': _p['web_name'],
        'position': _pos_map.get(_p['element_type'], 'Unknown'),
        'price': _p.get('now_cost', 0) / 10,
        'team_name': _team_name.get(_p.get('team'), 'Unknown'),
        'status': _p.get('status', '?'),
        'news': _p.get('news', ''),
        'total_points': _p.get('total_points', 0),
        'form': float(_p.get('form', 0) or 0),
        'points_per_game': float(_p.get('points_per_game', 0) or 0),
        'selected_by_percent': float(_p.get('selected_by_percent', 0) or 0)
    }

# ── 3. Build current squad lookup from earlier cells ──────────────────────
squad_names = [r['player_name'] for r in team_rows]
squad_now_price = {r['player_name']: r['price'] for r in team_rows}  # current market price
squad_club = {r['player_name']: r['club'] for r in team_rows}
squad_pos = {r['player_name']: r['position'] for r in team_rows}
squad_starter = {r['player_name']: r['is_starter'] for r in team_rows}

# Fetch transfer history to compute actual selling prices.
# FPL rule: sell_price = min(purchase_price, current_price)
# Players bought cheaper whose price rose since can only sell at purchase price.
_transfers = fetch_fpl_json(f"entry/{team_id}/transfers/")
_purchase_prices = {}
for _t in sorted(_transfers, key=lambda x: x["event"]):
    _purchase_prices[_t["element_in"]] = _t["element_in_cost"]
    if _t["element_out"] in _purchase_prices:
        del _purchase_prices[_t["element_out"]]

squad_price = {}  # actual selling prices for budget calculations
for r in team_rows:
    _now_tenths = int(r['price'] * 10)
    _buy_tenths = _purchase_prices.get(r['player_id'], _now_tenths)  # default to now_cost if no transfer record
    squad_price[r['player_name']] = min(_buy_tenths, _now_tenths) / 10

club_count = {}
for n in squad_names:
    club_count[squad_club[n]] = club_count.get(squad_club[n], 0) + 1

bank = manager.get('last_deadline_bank', 0) / 10
squad_value = sum(squad_price.values())
squad_now_value = sum(squad_now_price.values())
sell_loss = squad_now_value - squad_value

print(f"Squad value: £{squad_now_value:.1f}m (sell: £{squad_value:.1f}m, loss: £{sell_loss:.1f}m)  |  Bank: £{bank:.1f}m  |  Transfer budget: £{squad_value + bank:.1f}m")
print(f"Clubs at 3-player limit: {[c for c, n in club_count.items() if n >= 3]}")

# ── 4. Rank current squad by prediction (find weak links) ─────────────────
print("\n=== CURRENT SQUAD: MODEL PREDICTIONS (GW4-GW6) ===")
print(f"{'Name':<20s} {'Pos':>4s} {'Now':>6s} {'Sell':>6s} {'Pred':>6s} {'Starter':>8s}  Status")
print("-" * 72)
squad_with_pred = []
for name in sorted(squad_names, key=lambda n: squad_starter[n], reverse=True):
    pred = pred_by_name.get(name)
    avg_p = pred['avg_prob_gt_6'] if pred else None
    s = stats_by_name.get(name, {})
    status = s.get('status', '?')
    pred_str = f"{avg_p:.3f}" if avg_p is not None else "  N/A"
    star = "Y" if squad_starter[name] else "N"
    sell_flag = " *" if squad_price[name] < squad_now_price[name] else ""
    print(f"{name:<20s} {squad_pos[name]:>4s} £{squad_now_price[name]:>4.1f}m £{squad_price[name]:>4.1f}m {pred_str:>6s} {star:>8s}  {status}{sell_flag}")
    squad_with_pred.append({
        'name': name, 'pos': squad_pos[name], 'price': squad_price[name],
        'pred': avg_p, 'starter': squad_starter[name], 'club': squad_club[name]
    })

# Identify players with no predictions (inactive or unavailable)
no_pred = [p for p in squad_with_pred if p['pred'] is None]
print(f"\nPlayers with NO model prediction (inactive or unavailable): {[p['name'] for p in no_pred]}")

# COMMAND ----------

# DBTITLE 1,Generate transfer suggestions
# ── 5. Generate transfer suggestions ─────────────────────────────────────
# Strategy: identify weakest starters, find replacements that improve prediction
# while respecting FPL constraints. Reinvest freed budget into other upgrades.

used_incoming = set()  # track players already suggested to avoid duplicates

def find_replacements(out_name, out_price, out_pos, out_club, budget_available, prefer_reinvest=False):
    """Find replacement candidates, optionally preferring ones that reinvest budget."""
    candidates = []
    for pred in all_predictions:
        if pred['position'] != out_pos:
            continue
        if pred['player_name'] in squad_names or pred['player_name'] in used_incoming:
            continue
        stats = stats_by_name.get(pred['player_name'])
        if not stats or stats['status'] not in ('a', 'd'):
            continue
        target_club = stats['team_name']
        temp_club_count = dict(club_count)
        if out_club == target_club:
            temp_club_count[out_club] = temp_club_count.get(out_club, 0) - 1
        if temp_club_count.get(target_club, 0) >= 3:
            continue
        cost_diff = stats['price'] - out_price
        if cost_diff > budget_available:
            continue
        candidates.append({
            'name': pred['player_name'],
            'price': stats['price'],
            'pred': pred['avg_prob_gt_6'],
            'club': target_club,
            'form': stats['form'],
            'ppg': stats['points_per_game'],
            'cost_diff': cost_diff,
            'gw_predictions': pred['gw_predictions']
        })
    if prefer_reinvest:
        candidates.sort(key=lambda c: (c['pred'], c['price']), reverse=True)
    else:
        candidates.sort(key=lambda c: c['pred'], reverse=True)
    return candidates[:5] if candidates else []

print("=" * 90)
print(f"TRANSFER SUGGESTIONS FOR GAMEWEEK {gameweek + 1}")
print("=" * 90)

# ── Phase 1: Address the biggest gap (starter with no/lowest prediction) ───
starters = [p for p in squad_with_pred if p['starter']]
starters_sorted = sorted(starters, key=lambda p: (
    p['pred'] is not None,     # no-pred first (weakest)
    p['pred'] if p['pred'] is not None else 0  # then by lowest pred
))

remaining_bank = bank
suggestions = []

first = starters_sorted[0]
budget_1 = remaining_bank
repls = find_replacements(first['name'], first['price'], first['pos'], first['club'], budget_1)
if repls:
    best = repls[0]
    used_incoming.add(best['name'])
    remaining_bank -= best['cost_diff']
    suggestions.append({'out': first, 'in': best, 'improvement': best['pred'] - (first['pred'] or 0)})

# ── Phase 2: Reinvest freed budget to upgrade next weakest starters ────────
# Skip players with >50% ownership (high must-own pressure) from outgoing suggestions
remaining_starters = [p for p in starters_sorted[1:] if p['name'] != first['name']
                      and stats_by_name.get(p['name'], {}).get('selected_by_percent', 0) < 50]

for player in remaining_starters:
    if len(suggestions) >= 3:
        break
    budget_for_this = remaining_bank
    prefer_reinvest = remaining_bank > 3.0
    repls = find_replacements(
        player['name'], player['price'], player['pos'], player['club'],
        budget_for_this, prefer_reinvest=prefer_reinvest
    )
    if not repls:
        continue
    best = repls[0]
    improvement = best['pred'] - (player['pred'] or 0)
    if improvement <= 0 and player['pred'] is not None:
        continue
    used_incoming.add(best['name'])
    remaining_bank -= best['cost_diff']
    suggestions.append({'out': player, 'in': best, 'improvement': improvement})

# ── Display suggestions ───────────────────────────────────────────────────
for i, s in enumerate(suggestions):
    out_p, in_p = s['out'], s['in']
    print(f"\n{'─' * 90}")
    transfer_label = "FREE TRANSFER" if i == 0 else f"Transfer {i+1} (-4 pts)"
    print(f"  Transfer {i+1}: {transfer_label}")
    pred_out = f"{out_p['pred']:.3f}" if out_p['pred'] is not None else "  N/A"
    _now = squad_now_price.get(out_p['name'], out_p['price'])
    _sell = out_p['price']
    _price_str = f"£{_now:.1f}m (sell £{_sell:.1f}m)" if _now != _sell else f"£{_sell:.1f}m"
    print(f"  OUT: {out_p['name']:<20s} {out_p['pos']:>4s}  {_price_str}  pred={pred_out}")
    print(f"   IN: {in_p['name']:<20s} {out_p['pos']:>4s}  £{in_p['price']:.1f}m  pred={in_p['pred']:.3f}  form={in_p['form']:.1f}  ppg={in_p['ppg']:.1f}")
    print(f"        Club: {in_p['club']}  |  Cost diff: £{in_p['cost_diff']:+.1f}m  |  Prediction gain: +{s['improvement']:.3f}")
    gw_str = '  '.join([f"GW{g['gw']}: {g['prob_gt_6']:.2f}" for g in in_p['gw_predictions']])
    print(f"        GW forecasts: {gw_str}")
    # Show alternatives
    all_repls = find_replacements(out_p['name'], out_p['price'], out_p['pos'], out_p['club'],
                                   remaining_bank + in_p['cost_diff'],
                                   prefer_reinvest=remaining_bank > 3.0)
    alts = [r for r in all_repls if r['name'] != in_p['name'] and r['name'] not in used_incoming][:2]
    if alts:
        print(f"  Alternatives:")
        for alt in alts:
            print(f"    • {alt['name']:<20s} £{alt['price']:.1f}m  pred={alt['pred']:.3f}  £{alt['cost_diff']:+.1f}m  ({alt['club']})")

# ── Note about players the model undervalues ────────────────────────────────
haaland_stats = stats_by_name.get('Haaland', {})
if haaland_stats and haaland_stats.get('selected_by_percent', 0) > 50:
    haaland_pred = pred_by_name.get('Haaland', {}).get('avg_prob_gt_6')
    if haaland_pred and haaland_pred < 0.40:
        print(f"\n{'─' * 90}")
        print(f"  NOTE: Haaland (pred={haaland_pred:.3f}, {haaland_stats['selected_by_percent']:.1f}% ownership)")
        print(f"  is undervalued by the model but owned by most players — dropping him")
        print(f"  is high-risk. Consider keeping him as captain and upgrading elsewhere.")

print(f"\n{'=' * 90}")
print(f"SUMMARY: {len(suggestions)} transfer(s) suggested")
if suggestions:
    total_cost = sum(s['in']['cost_diff'] for s in suggestions)
    total_gain = sum(s['improvement'] for s in suggestions)
    final_bank = bank - total_cost
    print(f"Total cost: £{total_cost:+.1f}m  |  Bank after: £{final_bank:.1f}m  |  Total prediction gain: +{total_gain:.3f}")
    if final_bank < 0:
        print(f"  WARNING: Insufficient budget! These transfers cannot all be made.")
    hits = max(0, len(suggestions) - 1)
    if hits > 0:
        print(f"Point hits: -{hits * 4} ({hits} extra transfer(s))")
    if final_bank > 4.0:
        print(f"\n  £{final_bank:.1f}m surplus — consider upgrading bench or saving for next week.")
print(f"{'=' * 90}")