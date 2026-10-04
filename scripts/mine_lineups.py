#!/usr/bin/env python3
"""
Regenerate src/lineupBank.js for Start/Sit.

    python3 scripts/mine_lineups.py --days 120

THE GAME
Nine start/sit calls: QB, RB, RB, WR, WR, WR, TE, FLEX, FLEX. Each call is two
real player-weeks. The House always starts whoever has the higher season
average. You beat him by spotting where he's wrong.

WHAT A CARD SHOWS
Only what a manager knew at kickoff that week. Nothing on a card may include
the game being played or anything after it:
  AVG    fantasy points per game so far this season   (what the House reads)
  L3     average over his last three games            (form)
  USE    touches (RB), targets (WR/TE) or dropbacks+runs (QB), last 3 games
  OPP    where the defense ranks in points allowed to his position so far
         (1 = most generous)
  VEGAS  his team's implied points from the closing line

WHY THE BANK IS CURATED
Measured on 1999-2024, those signals barely move a single call: a regression
on all of them picks the right player 58-60% of the time against 57-60% for
just starting the higher average. One NFL week is mostly noise. A game built on
raw random weeks would therefore be a coin flip no matter how well you read
the card.

So each day is assembled from four kinds of calls, all real, all unedited:
  chalk  the card favours the House's pick and he delivers
  upset  the card clearly favours the other guy and the other guy delivers
  beat   the card favours the other guy, the House's pick wins anyway
  shock  the card favours the House's pick and the other guy wins anyway
Most days are chalk plus two to four upsets, with the occasional beat or
shock so reading the card is a strong edge rather than a guaranteed one.
Every call is decided by at least MARGIN points so nothing turns on a decimal.

Requires: pandas, numpy, requests.
"""
import argparse, json, random, sys
from itertools import product
from pathlib import Path

import numpy as np
import pandas as pd
import requests

SEASONS = range(1999, 2025)
BASE = ("https://github.com/nflverse/nflverse-data/releases/download/"
        "player_stats/player_stats_{year}.csv")
GAMES = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv"
OUT = Path("src/lineupBank.js")

SLOTS = ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "FLEX", "FLEX"]
MIN_AVG = {"QB": 14, "RB": 9, "WR": 9, "TE": 6}          # a real fantasy starter
FAME = {"QB": 2200, "RB": 1600, "WR": 1500, "TE": 1100}  # career points: a name people know
AVG_GAP = (1.0, 5.0)    # the House's pick looks better on season average by this much
MARGIN = 5.0            # every call is decided by at least this many points
# what counts as a clear edge on one signal, by position
EDGE = {
    "l3":  {"QB": 2.5, "RB": 2.0, "WR": 2.0, "TE": 1.5},
    "use": {"QB": 3.0, "RB": 3.0, "WR": 1.5, "TE": 1.2},
    "opp": 8,      # rank places
    "imp": 2.5,    # implied team points
}
USE_LABEL = {"QB": "ATT", "RB": "TCH", "WR": "TGT", "TE": "TGT"}

# nflverse stamps rows with the franchise's current code; put the era's back.
RELOCATIONS = {"LAC": ("SD", 2017), "LA": ("STL", 2016), "LAR": ("STL", 2016), "LV": ("OAK", 2020)}
GAME_CODE = {"OAK": "LV", "SD": "LAC", "STL": "LA", "LAR": "LA"}   # games.csv -> stats codes


def historic(code, season):
    move = RELOCATIONS.get(code)
    if move and season < move[1]:
        return move[0]
    return "LAR" if code == "LA" else code


def fetch(cache, force=False):
    cache.mkdir(parents=True, exist_ok=True)
    frames = []
    for y in SEASONS:
        f = cache / f"{y}.csv"
        if force or not f.exists() or f.stat().st_size < 1000:
            r = requests.get(BASE.format(year=y), timeout=120)
            if r.status_code != 200:
                sys.exit(f"{y}: download failed ({r.status_code})")
            f.write_bytes(r.content)
        d = pd.read_csv(f, low_memory=False)
        if "team" not in d.columns and "recent_team" in d.columns:
            d = d.rename(columns={"recent_team": "team"})
        if "interceptions" not in d.columns and "passing_interceptions" in d.columns:
            d = d.rename(columns={"passing_interceptions": "interceptions"})
        frames.append(d)
    g = cache / "games.csv"
    if force or not g.exists():
        g.write_bytes(requests.get(GAMES, timeout=120).content)
    return pd.concat(frames, ignore_index=True), pd.read_csv(g)


def score(df):
    """0.5 PPR."""
    g = lambda c: df[c].fillna(0) if c in df.columns else 0
    return (g("passing_yards") / 25 + g("passing_tds") * 4 - g("interceptions") * 2
            + g("rushing_yards") / 10 + g("rushing_tds") * 6
            + g("receiving_yards") / 10 + g("receiving_tds") * 6 + g("receptions") * 0.5
            - (g("rushing_fumbles_lost") + g("receiving_fumbles_lost") + g("sack_fumbles_lost")) * 2
            + (g("passing_2pt_conversions") + g("rushing_2pt_conversions")
               + g("receiving_2pt_conversions")) * 2
            + g("special_teams_tds") * 6).round(2)


def features(raw, games):
    """Every number here is computed from games BEFORE the week in question."""
    d = raw[(raw.season_type == "REG") & raw.position.isin(["QB", "RB", "WR", "TE"])].copy()
    d["fp"] = score(d)
    for c in ("attempts", "carries", "targets"):
        d[c] = d[c].fillna(0)
    d = d[(d.attempts + d.carries + d.targets) > 0]
    d["use"] = np.where(d.position == "QB", d.attempts + d.carries,
               np.where(d.position == "RB", d.carries + d.targets, d.targets))

    # how he ranked that week among everyone at his position (shown after lock)
    grp = d.groupby(["season", "week", "position"]).fp
    d["weekRank"] = grp.rank(ascending=False, method="min").astype(int)
    d["weekField"] = grp.transform("size").astype(int)

    d = d.sort_values(["player_id", "season", "week"])
    gp = d.groupby(["player_id", "season"])
    d["gnum"] = gp.cumcount()
    d["avg"] = gp.fp.transform(lambda s: s.shift().expanding().mean())
    d["l3"] = gp.fp.transform(lambda s: s.shift().rolling(3, min_periods=3).mean())
    d["use3"] = gp.use.transform(lambda s: s.shift().rolling(3, min_periods=3).mean())

    a = (d.groupby(["season", "week", "opponent_team", "position"]).fp.sum()
           .reset_index().sort_values(["season", "opponent_team", "position", "week"]))
    ga = a.groupby(["season", "opponent_team", "position"])
    a["allow"] = ga.fp.transform(lambda s: s.shift().expanding().mean())
    a["allowN"] = ga.cumcount()
    a["oppRank"] = a.groupby(["season", "week", "position"]).allow.rank(ascending=False, method="min")
    d = d.merge(a[["season", "week", "opponent_team", "position", "allow", "allowN", "oppRank"]],
                on=["season", "week", "opponent_team", "position"], how="left")

    g = games[games.game_type == "REG"]
    rows = []
    for r in g.itertuples():
        if pd.isna(r.spread_line) or pd.isna(r.total_line):
            continue
        rows.append((r.season, r.week, GAME_CODE.get(r.home_team, r.home_team),
                     (r.total_line + r.spread_line) / 2, True))
        rows.append((r.season, r.week, GAME_CODE.get(r.away_team, r.away_team),
                     (r.total_line - r.spread_line) / 2, False))
    v = pd.DataFrame(rows, columns=["season", "week", "tm", "imp", "home"])
    d["tm"] = d.team.map(lambda t: GAME_CODE.get(t, t))
    d = d.merge(v, on=["season", "week", "tm"], how="left")

    s = d.groupby(["player_id", "season", "position"]).fp.sum().reset_index()
    s["finish"] = s.groupby(["season", "position"]).fp.rank(ascending=False, method="min").astype(int)
    prior = s[["player_id", "season", "finish"]].copy()
    prior["season"] += 1
    d = d.merge(prior.rename(columns={"finish": "priorFinish"}), on=["player_id", "season"], how="left")

    career = d.groupby("player_id").fp.sum()
    d = d[(d.gnum >= 3) & (d.allowN >= 3) & d.l3.notna() & d.imp.notna() & d.oppRank.notna()]
    d = d[d.apply(lambda r: r.avg >= MIN_AVG[r.position]
                  and career[r.player_id] >= FAME[r.position], axis=1)]
    return d


def edges(a, b, pos):
    """Clear edges a holds over b, on the four signals the House ignores."""
    n = 0
    n += a.l3 - b.l3 >= EDGE["l3"][pos]
    n += a.use3 - b.use3 >= EDGE["use"][pos]
    n += b.oppRank - a.oppRank >= EDGE["opp"]
    n += a.imp - b.imp >= EDGE["imp"]
    return int(n)


def classify(fav, dog, pos):
    """fav = the House's pick (higher season average)."""
    gap = fav.avg - dog.avg
    if not (AVG_GAP[0] <= gap <= AVG_GAP[1]):
        return None
    if abs(fav.fp - dog.fp) < MARGIN:
        return None
    ef, ed = edges(fav, dog, pos), edges(dog, fav, pos)
    card = "dog" if ed >= 3 and ef == 0 else "fav" if ef >= 2 and ed == 0 else None
    if card is None:
        return None
    won = "fav" if fav.fp > dog.fp else "dog"
    return {("fav", "fav"): "chalk", ("dog", "dog"): "upset",
            ("dog", "fav"): "beat", ("fav", "dog"): "shock"}[(card, won)]


def mine(d, pos, seed, per_kind=900, tries=400000):
    """Random pairs at one position, binned by kind."""
    x = d[d.position == pos].reset_index(drop=True)
    rng = np.random.default_rng(seed)
    pools = {k: [] for k in ("chalk", "upset", "beat", "shock")}
    seen = set()
    i = rng.integers(0, len(x), tries)
    j = rng.integers(0, len(x), tries)
    for p, q in zip(i, j):
        a, b = x.iloc[p], x.iloc[q]
        if a.player_id == b.player_id:
            continue
        fav, dog = (a, b) if a.avg > b.avg else (b, a)
        kind = classify(fav, dog, pos)
        if not kind or len(pools[kind]) >= per_kind:
            continue
        key = (fav.player_id, fav.season, fav.week, dog.player_id, dog.season, dog.week)
        if key in seen:
            continue
        seen.add(key)
        pools[kind].append((fav, dog))
        if all(len(v) >= per_kind for v in pools.values()):
            break
    return pools


def tile(r):
    s = {}
    if r.attempts:
        s["pass"] = [int(r.completions), int(r.attempts), int(r.passing_yards),
                     int(r.passing_tds), int(r.interceptions)]
    if r.carries:
        s["rush"] = [int(r.carries), int(r.rushing_yards), int(r.rushing_tds)]
    if r.targets:
        s["rec"] = [int(r.receptions), int(r.targets), int(r.receiving_yards), int(r.receiving_tds)]
    fum = int(np.nan_to_num(r.rushing_fumbles_lost) + np.nan_to_num(r.receiving_fumbles_lost)
              + np.nan_to_num(r.sack_fumbles_lost))
    if fum:
        s["fum"] = fum
    season = int(r.season)
    return {
        "id": f"{r.player_id}-{season}-{int(r.week)}",
        "name": r.player_display_name, "pos": r.position,
        "season": season, "week": int(r.week),
        "team": historic(r.team, season), "opp": historic(r.opponent_team, season),
        "home": bool(r.home),
        "avg": round(float(r.avg), 1), "l3": round(float(r.l3), 1),
        "use": round(float(r.use3), 1), "useLabel": USE_LABEL[r.position],
        "oppRank": int(r.oppRank), "imp": round(float(r.imp), 1),
        "priorFinish": None if pd.isna(r.priorFinish) else int(r.priorFinish),
        "pts": float(r.fp), "weekRank": int(r.weekRank), "weekField": int(r.weekField),
        # stored without the CDN prefix; the client rebuilds it (saves ~80 KB)
        "shot": (r.headshot_url.split("/image/", 1)[1]
                 if isinstance(r.headshot_url, str) and "/image/" in r.headshot_url else ""),
        "stats": s,
    }


def assemble(pools, days, seed):
    rng = random.Random(seed)
    used, prev, out = set(), set(), []
    cursor = {k: 0 for k in pools}
    for p in pools.values():
        for v in p.values():
            rng.shuffle(v)

    def grab(pos, kind, banned):
        lst = pools[pos][kind]
        for k in range(len(lst)):
            fav, dog = lst[(cursor[pos] + k) % len(lst)]
            names = {fav.player_display_name, dog.player_display_name}
            ids = {(fav.player_id, fav.season, fav.week), (dog.player_id, dog.season, dog.week)}
            if names & banned or ids & used:
                continue
            lst.pop((cursor[pos] + k) % len(lst))
            used.update(ids)
            return fav, dog
        sys.exit(f"ran out of {pos} {kind} calls; lower --days")

    for day in range(days):
        n_upset = rng.choice([2, 3, 3, 3, 4])
        n_beat = rng.choice([0, 1, 1, 2, 2])
        n_shock = rng.choice([0, 1, 1])
        kinds = (["upset"] * n_upset + ["beat"] * n_beat + ["shock"] * n_shock)
        kinds += ["chalk"] * (len(SLOTS) - len(kinds))
        rng.shuffle(kinds)
        banned = set(prev)
        pairs = []
        for slot, kind in zip(SLOTS, kinds):
            pos = rng.choice(["RB", "WR", "TE"]) if slot == "FLEX" else slot
            fav, dog = grab(pos, kind, banned)
            banned |= {fav.player_display_name, dog.player_display_name}
            a, b = tile(fav), tile(dog)
            tiles = [a, b]
            rng.shuffle(tiles)
            pairs.append({"slot": slot, "house": a["id"], "tiles": tiles})
        house = round(sum(next(t for t in p["tiles"] if t["id"] == p["house"])["pts"] for p in pairs), 1)
        perfect = round(sum(max(t["pts"] for t in p["tiles"]) for p in pairs), 1)
        out.append({"id": f"ss-{day + 1:03d}", "house": house, "perfect": perfect, "pairs": pairs})
        prev = {t["name"] for p in pairs for t in p["tiles"]}
    return out


def verify(bank, raw):
    """Check tiles against the raw box score, and the shape of every day."""
    df = raw[raw.season_type == "REG"].copy()
    df["fp"] = score(df)
    idx = df.set_index(["player_id", "season", "week"]).sort_index()
    bad = 0
    for day in bank:
        names = [t["name"] for p in day["pairs"] for t in p["tiles"]]
        if len(set(names)) != len(names):
            print(f"  {day['id']}: a player appears twice"); bad += 1
        if [p["slot"] for p in day["pairs"]] != SLOTS:
            print(f"  {day['id']}: wrong slots"); bad += 1
        for p in day["pairs"]:
            fav = next(t for t in p["tiles"] if t["id"] == p["house"])
            dog = next(t for t in p["tiles"] if t["id"] != p["house"])
            if fav["avg"] < dog["avg"]:
                print(f"  {day['id']} {p['slot']}: House pick is not the higher average"); bad += 1
            if abs(fav["pts"] - dog["pts"]) < MARGIN - 0.01:
                print(f"  {day['id']} {p['slot']}: call decided by under {MARGIN}"); bad += 1
            for t in p["tiles"]:
                pid = t["id"].rsplit("-", 2)[0]
                try:
                    r = idx.loc[(pid, t["season"], t["week"])]
                except KeyError:
                    print(f"  {t['name']} {t['season']} wk{t['week']}: no source row"); bad += 1
                    continue
                if isinstance(r, pd.DataFrame):
                    r = r.iloc[0]
                if abs(r.fp - t["pts"]) > 0.02:
                    print(f"  {t['name']}: {t['pts']} vs source {r.fp}"); bad += 1
                # nothing on the card may include this week
                prior = df[(df.player_id == pid) & (df.season == t["season"]) & (df.week < t["week"])]
                if abs(prior.fp.mean() - t["avg"]) > 0.06:
                    print(f"  {t['name']} {t['season']} wk{t['week']}: AVG leaks or is wrong"); bad += 1
    return bad


def simulate(bank, seed=1):
    """How different ways of playing do against the House. Reading the card
    must beat guessing by a wide margin, or the curation has failed."""
    rng = random.Random(seed)

    def card_pick(p):
        fav = next(t for t in p["tiles"] if t["id"] == p["house"])
        dog = next(t for t in p["tiles"] if t["id"] != p["house"])
        pos = fav["pos"]
        e = lambda a, b: ((a["l3"] - b["l3"] >= EDGE["l3"][pos]) + (a["use"] - b["use"] >= EDGE["use"][pos])
                          + (b["oppRank"] - a["oppRank"] >= EDGE["opp"]) + (a["imp"] - b["imp"] >= EDGE["imp"]))
        return dog if e(dog, fav) >= 3 else fav

    styles = {
        "random": lambda p: rng.choice(p["tiles"]),
        "always the House": lambda p: next(t for t in p["tiles"] if t["id"] == p["house"]),
        "reads the card": card_pick,
        "reads it 70% of the time": lambda p: card_pick(p) if rng.random() < 0.7 else rng.choice(p["tiles"]),
    }
    res = {}
    for name, pick in styles.items():
        w = push = calls = n = 0
        for _ in range(300 if name.startswith(("random", "reads it")) else 1):
            for day in bank:
                sc = hits = 0
                for p in day["pairs"]:
                    t = pick(p)
                    sc += t["pts"]
                    hits += t["pts"] == max(x["pts"] for x in p["tiles"])
                sc = round(sc, 1)
                w += sc > day["house"]
                push += sc == day["house"]
                calls += hits
                n += 1
        res[name] = (w / n, push / n, calls / n)
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=120)
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--cache", default=".nflverse-cache")
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args()

    print("loading nflverse")
    raw, games = fetch(Path(a.cache), a.refresh)
    print("computing what was known at kickoff")
    d = features(raw, games)
    print(f"  {len(d):,} eligible player-weeks")

    pools = {}
    for i, pos in enumerate(["QB", "RB", "WR", "TE"]):
        pools[pos] = mine(d, pos, a.seed + i)
        print(f"  {pos}: " + ", ".join(f"{k} {len(v)}" for k, v in pools[pos].items()))

    bank = assemble(pools, a.days, a.seed)
    print(f"\nverifying {len(bank) * 18} tiles")
    bad = verify(bank, raw)
    if bad:
        sys.exit(f"{bad} problems. Nothing written.")
    print("  clean")

    print("\nhow it plays against the House")
    for name, (w, push, calls) in simulate(bank).items():
        print(f"  {name:26} wins {w:4.0%}  pushes {push:4.0%}  {calls:.1f} of 9 calls right")

    body = ",\n".join(json.dumps(p, separators=(",", ":")) for p in bank)
    src = ("// Generated by scripts/mine_lineups.py. Do not edit by hand.\n"
           "// Nine start/sit calls a day. Every tile is a real player-week from nflverse;\n"
           "// card stats use only games before that week. `house` on a pair is the\n"
           "// tile the House starts (the higher season average). 0.5 PPR.\n"
           f"export const LINEUP_BANK = [\n{body}\n];\n")
    Path(a.out).write_text(src)
    print(f"\nwrote {a.out}: {len(bank)} days, {len(src) // 1024} KB")


if __name__ == "__main__":
    main()
