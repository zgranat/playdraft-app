#!/usr/bin/env python3
"""
Regenerate src/lineupBank.js for Start/Sit (lineup version).

    python3 scripts/mine_rosters.py --days 120

THE GAME
One real NFL week from one season. A twelve-man roster: 2 QB, 4 RB, 4 WR, 2 TE.
Set seven starters: QB, RB, RB, WR, WR, TE, FLEX (RB/WR/TE), like ESPN minus
K and D/ST. The House sets the same roster by season average, top to bottom.
You beat him where he's wrong.

HOW A DAY IS BUILT
Everything on a card is what a manager knew at kickoff (see mine_lineups.py,
whose loaders and features this reuses). One raw week is mostly noise, so each
roster is built around four real decisions, all from the same week:

  QB    two quarterbacks; the House starts the higher average
  RB    an anchor RB, a pair, and a deep-bench RB; the House starts the pair's higher average
  WR    two anchor WRs plus a pair; the House flexes the better WR of the pair
  TE    two tight ends; the House starts the higher average

Each decision is one of mine_lineups.py's kinds (chalk / upset / beat / shock)
and is settled by at least MARGIN points. Every day has at least one upset, so
reading the cards is a real edge over following the House, never a lock.

Requires: pandas, numpy, requests.
"""
import argparse, json, random, sys
from itertools import combinations
from pathlib import Path

import numpy as np
import pandas as pd
import requests

sys.path.insert(0, str(Path(__file__).parent))
import mine_lineups as ml  # noqa: E402

PLAYERS = "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv"
OUT = Path("src/lineupBank.js")
SLOTS = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX"]
ANCHOR_GAP = 1.0        # anchors out-average the contested starter by at least this much
OPEN_GAP = (0.5, 6.0)   # an unclassified call still needs the House to have a reason
SEASON_GAP = 4      # a season doesn't repeat within this many days

KIND_WEIGHTS = {"upset": 0.42, "chalk": 0.33, "beat": 0.15, "shock": 0.10}


def players_table(cache):
    f = cache / "players.csv"
    if not f.exists():
        f.write_bytes(requests.get(PLAYERS, timeout=180).content)
    p = pd.read_csv(f, low_memory=False, usecols=["gsis_id", "birth_date", "rookie_season"])
    return p.dropna(subset=["gsis_id"]).set_index("gsis_id")


def team_records(games):
    """W-L(-T) for each team before each week."""
    g = games[(games.game_type == "REG") & games.home_score.notna()].copy()
    rows = []
    for r in g.itertuples():
        h, a = ml.GAME_CODE.get(r.home_team, r.home_team), ml.GAME_CODE.get(r.away_team, r.away_team)
        res = np.sign(r.home_score - r.away_score)
        rows.append((r.season, r.week, h, 1 if res > 0 else 0, 1 if res < 0 else 0, 1 if res == 0 else 0))
        rows.append((r.season, r.week, a, 1 if res < 0 else 0, 1 if res > 0 else 0, 1 if res == 0 else 0))
    t = pd.DataFrame(rows, columns=["season", "week", "tm", "w", "l", "t"])
    rec = {}
    for (season, tm), grp in t.sort_values("week").groupby(["season", "tm"]):
        w = l = ti = 0
        for r in grp.itertuples():
            rec[(season, tm, r.week)] = (w, l, ti)
            w, l, ti = w + r.w, l + r.l, ti + r.t
    return rec


def game_logs(raw):
    """(player_id, season) -> [(week, fp), ...] for regular-season games."""
    d = raw[(raw.season_type == "REG") & raw.position.isin(["QB", "RB", "WR", "TE"])].copy()
    d["fp"] = ml.score(d)
    for c in ("attempts", "carries", "targets"):
        d[c] = d[c].fillna(0)
    d = d[(d.attempts + d.carries + d.targets) > 0]     # same games features() counts
    logs = {}
    for (pid, season), grp in d.sort_values("week").groupby(["player_id", "season"]):
        logs[(pid, season)] = list(zip(grp.week.astype(int), grp.fp.astype(float)))
    return logs


def contests(d):
    """Every classified pair inside each season-week, by position."""
    out = {}
    for (season, week, pos), grp in d[d.position.isin(["QB", "RB", "WR", "TE"])].groupby(["season", "week", "position"]):
        rows = list(grp.itertuples())
        found = {k: [] for k in list(KIND_WEIGHTS) + ["open", "any"]}
        for a, b in combinations(rows, 2):
            if a.player_id == b.player_id:
                continue
            fav, dog = (a, b) if a.avg > b.avg else (b, a)
            if fav.avg > dog.avg:
                found["any"].append((fav, dog))     # last resort: any two at the position
            kind = ml.classify(fav, dog, pos)
            if kind:
                found[kind].append((fav, dog))
            elif OPEN_GAP[0] <= fav.avg - dog.avg <= OPEN_GAP[1] and abs(fav.fp - dog.fp) >= ml.MARGIN:
                found["open"].append((fav, dog))   # a real call the card doesn't settle
        out[(season, week, pos)] = (found, rows)
    return out


def build_day(cs, season, week, kinds, banned, rng, used_ids=frozenset()):
    """Try to build a roster for one season-week with the given kinds per decision."""
    qb, rb, wr, te = (cs.get((season, week, p)) for p in ("QB", "RB", "WR", "TE"))
    if not (qb and rb and wr and te):
        return None
    ok = lambda r: r.player_display_name not in banned and (r.player_id, r.season, r.week) not in used_ids

    def pool(found, prefs):
        out = []
        for k in prefs:
            lst = [(f, dg, k) for f, dg in found[k] if ok(f) and ok(dg)]
            rng.shuffle(lst)
            out += lst
        return out
    qbs, rbs, wrs, tes = (pool(x[0], k) for x, k in zip((qb, rb, wr, te), kinds))
    if not (qbs and rbs and wrs and tes):
        return None

    for qf, qd, qk in qbs[:5]:
        for tf, td, tk in tes[:5]:
            for rf, rd, rk in rbs[:10]:
                ra = [r for r in rb[1] if ok(r) and r.player_id not in (rf.player_id, rd.player_id)
                      and r.avg >= rf.avg + ANCHOR_GAP]
                deep = [r for r in rb[1] if ok(r) and r.player_id not in (rf.player_id, rd.player_id)
                        and r.avg < rd.avg]
                if not ra or not deep:
                    continue
                r_anchor, r_deep = rng.choice(ra), rng.choice(deep)
                for wf, wd, wk in wrs[:10]:
                    # the House flexes the WR fav: it must out-average every other bench option
                    if wf.avg <= max(rd.avg, td.avg):
                        continue
                    wa = [w for w in wr[1] if ok(w) and w.player_id not in (wf.player_id, wd.player_id)
                          and w.avg >= wf.avg + ANCHOR_GAP]
                    if len(wa) < 2:
                        continue
                    w1, w2 = rng.sample(wa, 2)
                    group = (qf, qd, r_anchor, rf, rd, r_deep, w1, w2, wf, wd, tf, td)
                    if len({x.player_display_name for x in group}) < 12:
                        continue
                    return {"rows": group, "kinds": [qk, rk, wk, tk], "season": qf.season}
    return None


def tile(r, logs, ptab, recs):
    t = ml.tile(r)
    season, week = t["season"], t["week"]
    prior = [(w, fp) for w, fp in logs.get((r.player_id, season), []) if w < week]
    t["log"] = [[w, round(fp, 1)] for w, fp in prior]
    age = yr = None
    if r.player_id in ptab.index:
        p = ptab.loc[r.player_id]
        if isinstance(p, pd.DataFrame):
            p = p.iloc[0]
        if isinstance(p.birth_date, str) and len(p.birth_date) >= 10:
            b = pd.Timestamp(p.birth_date[:10])
            age = int(season - b.year - ((9, 1) < (b.month, b.day)))
        if not pd.isna(p.rookie_season):
            yr = int(season - int(p.rookie_season) + 1)
    t["age"], t["yr"] = age, yr
    w, l, ti = recs.get((season, ml.GAME_CODE.get(r.team, r.team), week), (None, None, None))
    t["rec"] = None if w is None else (f"{w}-{l}" + (f"-{ti}" if ti else ""))
    for k in ("useLabel",):
        pass
    t.pop("imp", None)          # no Vegas lines on the card
    return t


def house_lineup(tiles):
    """By season average: QB, 2 RB, 2 WR, TE, then the best remaining RB/WR/TE at FLEX."""
    by = lambda pos: sorted([t for t in tiles if t["pos"] == pos], key=lambda t: -t["avg"])
    q, r, w, e = by("QB"), by("RB"), by("WR"), by("TE")
    flex = max(r[2:] + w[2:] + e[1:], key=lambda t: t["avg"])
    return [q[0]["id"], r[0]["id"], r[1]["id"], w[0]["id"], w[1]["id"], e[0]["id"], flex["id"]]


def all_lineups(tiles):
    """Every legal starting seven, once each, as a list of starter ids."""
    q = [t for t in tiles if t["pos"] == "QB"]
    r = [t for t in tiles if t["pos"] == "RB"]
    w = [t for t in tiles if t["pos"] == "WR"]
    e = [t for t in tiles if t["pos"] == "TE"]
    seen = {}
    for qb in q:
        for rs in combinations(r, 2):
            for ws in combinations(w, 2):
                for te in e:
                    for fx in [x for x in r + w + e if x not in rs and x not in ws and x is not te]:
                        ids = [qb["id"]] + [x["id"] for x in rs] + [x["id"] for x in ws] + [te["id"], fx["id"]]
                        seen[tuple(sorted(ids))] = ids
    return list(seen.values())


def assemble(cs, logs, ptab, recs, days, seed):
    rng = random.Random(seed)
    weeks = sorted({(s, w) for (s, w, _) in cs})
    out, prev_names, recent_seasons = [], set(), []
    used_ids = set()
    used = {}          # season-week -> times used (a week can host two different rosters)
    kinds_list = list(KIND_WEIGHTS)
    weights = list(KIND_WEIGHTS.values())
    for day in range(days):
        made = None
        for attempt in range(24000):
            first = rng.choices(kinds_list, weights, k=4)
            must = rng.randrange(4)
            # one decision is an upset; late in the search, settle for a real open call there
            lead = ["upset"] if attempt < 12000 else ["upset", "beat", "open"]
            kinds = [lead if i == must else [first[i], "chalk", "open", "any"] for i in range(4)]
            season, week = rng.choice(weeks)
            if season in recent_seasons or used.get((season, week), 0) >= 3:
                continue
            made = build_day(cs, season, week, kinds, prev_names, rng, used_ids)
            if made:
                used[(season, week)] = used.get((season, week), 0) + 1
                break
        if not made:
            sys.exit(f"day {day + 1}: could not build a roster; lower --days")
        rows = list(made["rows"])
        used_ids.update((r.player_id, r.season, r.week) for r in rows)
        tiles = [tile(r, logs, ptab, recs) for r in rows]
        house = house_lineup(tiles)
        pts = {t["id"]: t["pts"] for t in tiles}
        lineups = all_lineups(tiles)
        best = max(lineups, key=lambda L: sum(pts[i] for i in L))
        order = {"QB": 0, "RB": 1, "WR": 2, "TE": 3}
        tiles.sort(key=lambda t: (order[t["pos"]], -t["avg"]))
        out.append({
            "id": f"ss2-{day + 1:03d}", "season": int(tiles[0]["season"]), "week": int(tiles[0]["week"]),
            "house": round(sum(pts[i] for i in house), 1), "houseIds": house,
            "perfect": round(sum(pts[i] for i in best), 1),
            "kinds": made["kinds"], "tiles": tiles,
        })
        prev_names = {t["name"] for t in tiles}
        recent_seasons = (recent_seasons + [made["season"]])[-SEASON_GAP:]
    return out


def verify(bank, raw):
    df = raw[raw.season_type == "REG"].copy()
    df["fp"] = ml.score(df)
    idx = df.set_index(["player_id", "season", "week"]).sort_index()
    bad = 0
    for day in bank:
        ts = day["tiles"]
        if len({t["name"] for t in ts}) != 12:
            print(f"  {day['id']}: repeat player"); bad += 1
        if len({(t["season"], t["week"]) for t in ts}) != 1:
            print(f"  {day['id']}: mixed weeks"); bad += 1
        if [sum(t["pos"] == p for t in ts) for p in ("QB", "RB", "WR", "TE")] != [2, 4, 4, 2]:
            print(f"  {day['id']}: wrong roster shape"); bad += 1
        for t in ts:
            pid = t["id"].rsplit("-", 2)[0]
            try:
                r = idx.loc[(pid, t["season"], t["week"])]
            except KeyError:
                print(f"  {t['name']}: no source row"); bad += 1; continue
            if isinstance(r, pd.DataFrame):
                r = r.iloc[0]
            if abs(r.fp - t["pts"]) > 0.02:
                print(f"  {t['name']}: pts mismatch"); bad += 1
            if any(w >= t["week"] for w, _ in t["log"]):
                print(f"  {t['name']}: log leaks this week"); bad += 1
            if t["log"] and abs(np.mean([fp for _, fp in t["log"]]) - t["avg"]) > 0.11:   # both sides are rounded to 0.1
                print(f"  {t['name']} {t['season']} wk{t['week']}: AVG mismatch"); bad += 1
    return bad


def simulate(bank, seed=1):
    """Random lineups vs a card reader who swaps a bench player in when 2+ card
    signals favour him over the weakest House starter at his position."""
    rng = random.Random(seed)
    sig = lambda a, c: ((a["l3"] - c["l3"] >= ml.EDGE["l3"][a["pos"]])
                        + (a["use"] - c["use"] >= ml.EDGE["use"][a["pos"]])
                        + (c["oppRank"] - a["oppRank"] >= ml.EDGE["opp"]))

    def card_lineup(day):
        ts = {t["id"]: t for t in day["tiles"]}
        L = list(day["houseIds"])
        for b in sorted([t for t in day["tiles"] if t["id"] not in L], key=lambda t: -t["avg"]):
            same = [i for i in L if ts[i]["pos"] == b["pos"]]
            if not same:
                continue
            s = min(same, key=lambda i: ts[i]["avg"])
            if sig(b, ts[s]) >= 2 and sig(ts[s], b) == 0:
                L[L.index(s)] = b["id"]
        return L

    res = {}
    for name in ("random", "reads the card"):
        w = push = n = 0
        for _ in range(100 if name == "random" else 1):
            for day in bank:
                pts = {t["id"]: t["pts"] for t in day["tiles"]}
                L = rng.choice(all_lineups(day["tiles"])) if name == "random" else card_lineup(day)
                sc = round(sum(pts[i] for i in L), 1)
                w += sc > day["house"]; push += sc == day["house"]; n += 1
        res[name] = (w / n, push / n)
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=120)
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--cache", default=".nflverse-cache")
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args()
    cache = Path(a.cache)

    print("loading nflverse")
    raw, games = ml.fetch(cache)
    ptab = players_table(cache)
    print("computing what was known at kickoff")
    d = ml.features(raw, games)
    print(f"  {len(d):,} eligible player-weeks")
    logs = game_logs(raw)
    recs = team_records(games)
    print("finding decisions inside each week")
    cs = contests(d)

    bank = assemble(cs, logs, ptab, recs, a.days, a.seed)
    print(f"verifying {sum(len(d['tiles']) for d in bank)} tiles")
    bad = verify(bank, raw)
    if bad:
        sys.exit(f"{bad} problems. Nothing written.")
    print("  clean")
    for name, (w, p) in simulate(bank).items():
        print(f"  {name:16} beats the House {w:4.0%}  pushes {p:4.0%}")

    body = ",\n".join(json.dumps(p, separators=(",", ":")) for p in bank)
    src = ("// Generated by scripts/mine_rosters.py. Do not edit by hand.\n"
           "// One real NFL week per day: 2 QB, 4 RB, 4 WR, 2 TE. Card stats use only games\n"
           "// before that week. `houseIds` is the House's lineup by season average\n"
           "// (QB, RB, RB, WR, WR, TE, FLEX). 0.5 PPR.\n"
           f"export const LINEUP_BANK = [\n{body}\n];\n")
    Path(a.out).write_text(src)
    print(f"wrote {a.out}: {len(bank)} days, {len(src) // 1024} KB")


if __name__ == "__main__":
    main()
