#!/usr/bin/env python3
"""
Regenerate src/lineupBank.js for Start/Sit.

    python3 scripts/mine_lineups.py --days 60

Pulls weekly player stats from nflverse, scores them at 0.5 PPR, finds pods
where a clear favourite faces an underdog, assembles daily lineups, then checks
every tile back against the raw box score before writing anything.

The one thing to understand before changing the tuning: a pod only has a
decision in it if the favourite is *visibly* better. Pairs matched on season
average are a coin flip -- the better player wins 54% of the time, which is
noise. At a 2.5-5.0 point gap he wins 64-71%, and with the softer matchup on
top of that, 73-80%. That gap is the entire game. Narrowing PPG_GAP to make
pods "look closer" will quietly turn this back into a guessing game.

Requires: pandas, requests.
"""
import argparse, io, json, random, sys
from itertools import combinations, product
from pathlib import Path

import numpy as np
import pandas as pd
import requests

SEASONS = range(1999, 2026)
BASE = ("https://github.com/nflverse/nflverse-data/releases/download/"
        "player_stats/player_stats_{year}.csv")
CACHE = Path(".nflverse-cache")
OUT = Path("src/lineupBank.js")

PPG_GAP = (2.5, 5.0)      # how much better the favourite looks on paper
OPP_GAP = 8               # how much softer his matchup is, in rank
WIN_BY = 6                # a chalk pod needs the favourite to actually deliver
LOSE_BY = 8               # a trap needs the underdog to clearly win
FAME = {"QB": 2200, "RB": 1600, "WR": 1500, "TE": 1100}   # career points in-era
STARTER = {"QB": 20, "RB": 30, "WR": 36, "TE": 16}        # positional finish
# how many of the five calls reward starting the favourite; drawn per day so no
# mechanical strategy wins every time
CHALK_MIX = ([5] * 12) + ([4] * 38) + ([3] * 34) + ([2] * 16)


def fetch(force=False):
    CACHE.mkdir(exist_ok=True)
    frames = []
    for y in SEASONS:
        f = CACHE / f"{y}.csv"
        if force or not f.exists():
            r = requests.get(BASE.format(year=y), timeout=120)
            if r.status_code != 200:
                print(f"  {y}: not available ({r.status_code}), skipping")
                continue
            f.write_bytes(r.content)
        d = normalise(pd.read_csv(f, low_memory=False))
        frames.append(d)
        print(f"  {y}: {len(d):,} rows")
    return pd.concat(frames, ignore_index=True)


# nflverse has renamed columns between releases. Map them explicitly and fail
# loudly on anything missing: silently defaulting a stat to zero produces a bank
# that looks fine and scores wrong. A five-interception game read as clean once
# put a quarterback ten points above his real total.
ALIASES = {
    "interceptions": ["interceptions", "passing_interceptions"],
    "team": ["team", "recent_team"],
    "sack_fumbles_lost": ["sack_fumbles_lost"],
}
SCORING_COLS = ["completions", "attempts", "passing_yards", "passing_tds", "interceptions",
                "sack_fumbles_lost", "carries", "rushing_yards", "rushing_tds",
                "rushing_fumbles_lost", "receptions", "targets", "receiving_yards",
                "receiving_tds", "receiving_fumbles_lost"]
# genuinely absent in some seasons, and worth nothing when absent
OPTIONAL = ["passing_2pt_conversions", "rushing_2pt_conversions",
            "receiving_2pt_conversions", "special_teams_tds"]


def normalise(df):
    for canon, names in ALIASES.items():
        if canon in df.columns:
            continue
        found = next((n for n in names if n in df.columns), None)
        if found:
            df = df.rename(columns={found: canon})
    missing = [c for c in SCORING_COLS if c not in df.columns]
    if missing:
        sys.exit(f"nflverse schema changed: no column for {missing}. "
                 f"Add an alias in ALIASES rather than defaulting it to zero.")
    for c in OPTIONAL:
        if c not in df.columns:
            df[c] = 0
    return df


def score(df):
    """0.5 PPR. Kickers and defenses are excluded on purpose: nobody has a read
    on a 1994 kicker, so those slots would be pure coin flips."""
    g = lambda c: df[c].fillna(0)
    return (g("passing_yards") / 25 + g("passing_tds") * 4 - g("interceptions") * 2
            + g("rushing_yards") / 10 + g("rushing_tds") * 6
            + g("receiving_yards") / 10 + g("receiving_tds") * 6 + g("receptions") * 0.5
            - (g("rushing_fumbles_lost") + g("receiving_fumbles_lost")
               + g("sack_fumbles_lost")) * 2
            + (g("passing_2pt_conversions") + g("rushing_2pt_conversions")
               + g("receiving_2pt_conversions")) * 2
            + g("special_teams_tds") * 6).round(2)


def build(raw):
    df = raw[(raw.season_type == "REG") & raw.position.isin(["QB", "RB", "WR", "TE"])].copy()
    df["fp"] = score(df)
    df = df[(df.attempts.fillna(0) + df.carries.fillna(0) + df.targets.fillna(0)) > 0]

    season = (df.groupby(["player_id", "player_display_name", "position", "season"])
                .fp.agg(g="size", total="sum", ppg="mean").reset_index())
    season["ppg"] = season.ppg.round(1)
    season = season[season.g >= 9]
    season["posrank"] = (season.groupby(["position", "season"]).total
                         .rank(ascending=False, method="min").astype(int))

    allowed = (df.groupby(["season", "opponent_team", "position"]).fp.mean()
                 .reset_index(name="allowed"))
    allowed["oppRank"] = (allowed.groupby(["season", "position"]).allowed
                          .rank(ascending=False, method="min").astype(int))

    df = df.sort_values(["player_id", "season", "week"])
    df["weekRank"] = (df.groupby(["season", "week", "position"]).fp
                      .rank(ascending=False, method="min").astype(int))
    df["weekField"] = df.groupby(["season", "week", "position"]).fp.transform("size").astype(int)
    df["prev"] = df.groupby(["player_id", "season"]).fp.shift()

    prior = season[["player_id", "season", "posrank"]].copy()
    prior["season"] += 1
    prior = prior.rename(columns={"posrank": "priorFinish"})

    w = (df.merge(season[["player_id", "season", "ppg", "posrank"]], on=["player_id", "season"])
           .merge(allowed[["season", "opponent_team", "position", "oppRank"]],
                  on=["season", "opponent_team", "position"])
           .merge(prior, on=["player_id", "season"], how="left"))

    career = w.groupby("player_id").fp.sum().rename("career")
    w = w.merge(career, on="player_id")
    w = w[w.apply(lambda r: r.career >= FAME[r.position], axis=1)]
    w = w[w.apply(lambda r: r.posrank <= STARTER[r.position], axis=1)]
    return w


def tile(r):
    s = {}
    if r.attempts:
        s["pass"] = [int(r.completions), int(r.attempts), int(r.passing_yards),
                     int(r.passing_tds), int(r.interceptions)]
    if r.carries:
        s["rush"] = [int(r.carries), int(r.rushing_yards), int(r.rushing_tds)]
    if r.targets:
        s["rec"] = [int(r.receptions), int(r.targets), int(r.receiving_yards),
                    int(r.receiving_tds)]
    fum = int((r.rushing_fumbles_lost or 0) + (r.receiving_fumbles_lost or 0)
              + (r.sack_fumbles_lost or 0))
    if fum:
        s["fum"] = fum
    return {
        "id": f"{r.player_id}-{int(r.season)}-{int(r.week)}",
        "name": r.player_display_name, "pos": r.position,
        "season": int(r.season), "week": int(r.week),
        "team": r.team, "opp": r.opponent_team,
        "ppg": float(r.ppg), "oppRank": int(r.oppRank), "finish": int(r.posrank),
        "priorFinish": None if pd.isna(r.priorFinish) else int(r.priorFinish),
        "weekRank": int(r.weekRank), "weekField": int(r.weekField),
        "prev": None if pd.isna(r.prev) else float(r.prev),
        "pts": float(r.fp),
        "shot": r.headshot_url if isinstance(getattr(r, "headshot_url", None), str) else "",
        "stats": s,
    }


def pods_for(w, pos, chalk, seed, limit=700):
    d = w[w.position == pos].copy()
    d["bin"] = (d.ppg * 2).round().astype(int)
    by_bin = {b: g for b, g in d.groupby("bin")}
    out, seen = [], set()
    for _, a in d.sample(min(len(d), 9000), random_state=seed).iterrows():
        lo, hi = int(round((a.ppg - PPG_GAP[1]) * 2)), int(round((a.ppg - PPG_GAP[0]) * 2))
        buckets = [by_bin[b] for b in range(lo, hi + 1) if b in by_bin]
        if not buckets:
            continue
        c = pd.concat(buckets)
        c = c[(c.player_id != a.player_id) & (c.oppRank >= a.oppRank + OPP_GAP)]
        c = c[a.fp - c.fp >= WIN_BY] if chalk else c[c.fp - a.fp >= LOSE_BY]
        if not len(c):
            continue
        b = c.sample(1, random_state=seed).iloc[0]
        key = tuple(sorted([a.player_display_name, b.player_display_name]))
        if key in seen:
            continue
        seen.add(key)
        out.append({"fav": tile(a), "dog": tile(b)})
        if len(out) >= limit:
            break
    return out


def assemble(w, days, seed):
    rng = random.Random(seed)
    pool = {(p, c): pods_for(w, p, c, seed) for p in ("QB", "RB", "WR", "TE") for c in (True, False)}
    for k, v in pool.items():
        print(f"  {k[0]:3} {'chalk' if k[1] else 'trap '}: {len(v)}")

    used, prev, out = set(), set(), []
    def grab(pos, chalk, banned):
        free = [p for p in pool[(pos, chalk)]
                if p["fav"]["name"] not in banned and p["dog"]["name"] not in banned
                and p["fav"]["id"] not in used and p["dog"]["id"] not in used]
        return rng.choice(free) if free else None

    for day in range(days):
        banned = set(prev)
        chalks = rng.choice(CHALK_MIX)
        flags = [True] * chalks + [False] * (5 - chalks)
        rng.shuffle(flags)
        pods = []
        for slot, flag in zip(["QB", "RB", "FLEX"], flags[:3]):
            pos = slot if slot != "FLEX" else rng.choice(["RB", "WR", "TE"])
            p = grab(pos, flag, banned)
            if p is None:
                raise SystemExit(f"ran out of {pos} pods on day {day+1}; lower --days")
            for t in (p["fav"], p["dog"]):
                banned.add(t["name"]); used.add(t["id"])
            tiles = [p["fav"], p["dog"]]; rng.shuffle(tiles)
            pods.append({"slot": slot, "start": 1, "tiles": tiles})

        quad = []
        for flag in flags[3:]:
            p = grab("WR", flag, banned)
            if p is None:
                raise SystemExit(f"ran out of WR pods on day {day+1}; lower --days")
            for t in (p["fav"], p["dog"]):
                banned.add(t["name"]); used.add(t["id"]); quad.append(t)
        rng.shuffle(quad)
        pods.append({"slot": "WR", "start": 2, "tiles": quad})
        pods.sort(key=lambda p: {"QB": 0, "RB": 1, "WR": 2, "FLEX": 3}[p["slot"]])

        # The House plays a real lineup, not an average: of everything on the
        # board he fields the one closest to the coin-flip expectation. Keeps the
        # target fair while giving the player a set of picks to argue with.
        mean = sum(np.mean([t["pts"] for t in p["tiles"]]) * p["start"] for p in pods)
        opts = [list(combinations(p["tiles"], p["start"])) for p in pods]
        line = min(product(*opts), key=lambda c: abs(sum(t["pts"] for gp in c for t in gp) - mean))

        out.append({
            "id": f"lineup-{day+1:03d}",
            "house": round(sum(t["pts"] for gp in line for t in gp), 1),
            "housePicks": [t["id"] for gp in line for t in gp],
            "perfect": round(sum(sum(sorted([t["pts"] for t in p["tiles"]],
                                            reverse=True)[:p["start"]]) for p in pods), 1),
            "floor": round(sum(sum(sorted([t["pts"] for t in p["tiles"]])[:p["start"]])
                               for p in pods), 1),
            "pods": pods,
        })
        prev = {t["name"] for p in pods for t in p["tiles"]}
    return out


def verify(bank, raw):
    """Check the generated bank against the source data, not against itself."""
    df = raw[raw.season_type == "REG"].copy()
    df["fp"] = score(df)
    active = df[(df.attempts.fillna(0) + df.carries.fillna(0) + df.targets.fillna(0)) > 0]
    seas = active.groupby(["player_id", "season"]).fp.mean()
    bad = 0
    for pz in bank:
        tiles = {t["id"]: t for p in pz["pods"] for t in p["tiles"]}
        if len(tiles) != 10:
            print(f"  {pz['id']}: {len(tiles)} distinct tiles"); bad += 1
        if len({t["name"] for t in tiles.values()}) != 10:
            print(f"  {pz['id']}: a player appears twice"); bad += 1
        for p in pz["pods"]:
            n = sum(1 for t in p["tiles"] if t["id"] in pz["housePicks"])
            if n != p["start"]:
                print(f"  {pz['id']} {p['slot']}: House fielded {n}, needs {p['start']}"); bad += 1
        if abs(sum(tiles[i]["pts"] for i in pz["housePicks"]) - pz["house"]) > 0.06:
            print(f"  {pz['id']}: house total does not match its picks"); bad += 1
        if not pz["floor"] < pz["house"] < pz["perfect"]:
            print(f"  {pz['id']}: house is outside floor..perfect"); bad += 1
        for t in tiles.values():
            pid = t["id"].rsplit("-", 2)[0]
            r = df[(df.player_id == pid) & (df.season == t["season"]) & (df.week == t["week"])]
            if len(r) != 1:
                print(f"  {t['name']} {t['season']} wk{t['week']}: {len(r)} source rows"); bad += 1
                continue
            r = r.iloc[0]
            if abs(r.fp - t["pts"]) > 0.02:
                print(f"  {t['name']}: points {t['pts']} vs source {r.fp}"); bad += 1
            if r.opponent_team != t["opp"]:
                print(f"  {t['name']}: opponent {t['opp']} vs source {r.opponent_team}"); bad += 1
            if abs(seas.loc[(pid, t["season"])] - t["ppg"]) > 0.06:
                print(f"  {t['name']}: season average is wrong"); bad += 1
    return bad


def simulate(bank, seed=1):
    """How the three ways of playing actually do. If 'favourite' is not clearly
    ahead of 'random', the pods have lost their signal and the tuning is wrong."""
    rng = random.Random(seed)
    res = {}
    for how in ("random", "favourite", "matchup"):
        wins = calls = n = 0
        for _ in range(2000):
            for pz in bank:
                sc = hits = 0
                for pod in pz["pods"]:
                    ts = pod["tiles"]
                    pick = (rng.sample(ts, pod["start"]) if how == "random"
                            else sorted(ts, key=lambda t: -t["ppg"])[:pod["start"]] if how == "favourite"
                            else sorted(ts, key=lambda t: t["oppRank"])[:pod["start"]])
                    top = {id(t) for t in sorted(ts, key=lambda t: -t["pts"])[:pod["start"]]}
                    sc += sum(t["pts"] for t in pick)
                    hits += sum(1 for t in pick if id(t) in top)
                wins += sc > pz["house"]; calls += hits; n += 1
        res[how] = (wins / n, calls / n)
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=60)
    ap.add_argument("--seed", type=int, default=88)
    ap.add_argument("--launch", default="2026-09-15")
    ap.add_argument("--refresh", action="store_true", help="re-download nflverse")
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args()

    print("fetching nflverse weekly stats")
    raw = fetch(a.refresh)
    print(f"\nbuilding pool from {len(raw):,} rows")
    w = build(raw)
    print(f"  {len(w):,} eligible player-weeks, {w.player_id.nunique()} players\n")
    print("mining pods")
    bank = assemble(w, a.days, a.seed)

    print(f"\nverifying {len(bank)*10} tiles against the source")
    bad = verify(bank, raw)
    if bad:
        sys.exit(f"\n{bad} problems found. Nothing written.")
    print("  clean")

    sim = simulate(bank)
    print("\nhow it plays")
    for how, (win, calls) in sim.items():
        print(f"  {how:10} beats the House {win:.0%}, {calls:.2f} of 5 calls right")
    if sim["favourite"][1] - sim["random"][1] < 0.5:
        print("\n  WARNING: starting the favourite is barely better than guessing.")
        print("  Widen PPG_GAP or OPP_GAP before shipping this bank.")

    y, m, d = (int(x) for x in a.launch.split("-"))
    body = ",\n".join(json.dumps(p, separators=(",", ":")) for p in bank)
    src = ("// Generated by scripts/mine_lineups.py. Do not edit by hand.\n"
           "// Every tile is a real player-week from nflverse, checked against the raw\n"
           "// box score. Scoring is 0.5 PPR. `house` is a real lineup, not an average:\n"
           "// `housePicks` lists the five tile ids The House started.\n"
           f"export const LINEUP_BANK = [\n{body}\n];\n\n"
           f"export const LINEUP_LAUNCH = new Date({y}, {m-1}, {d});\n")
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(src)
    print(f"\nwrote {a.out}: {len(bank)} days, {len(src):,} bytes")


if __name__ == "__main__":
    main()
