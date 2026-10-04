#!/usr/bin/env python3
"""
Cache the player photos used by Start/Sit into public/players/.

    python3 scripts/fetch_headshots.py

Reads src/lineupBank.js, downloads each distinct player's headshot once, and
writes it as public/players/<player_id>.png -- which is exactly where the Face
component looks first, falling back to the remote URL and then to initials.

Why bother: the URLs in the bank point at NFL's own CDN. Hotlinking works until
it doesn't, and the failure mode is every face on the page vanishing at once,
on someone else's schedule. Roughly 90 players for a 60-day bank, a few hundred
KB in total.

Re-run it after regenerating the bank. Existing files are skipped, so it is
cheap to run repeatedly.
"""
import json, re, sys, time
from pathlib import Path

import requests

BANK = Path("src/lineupBank.js")
OUT = Path("public/players")
UA = "playdraft-headshot-cache/1.0 (+https://playdraft.app)"


def load_players():
    if not BANK.exists():
        sys.exit(f"{BANK} not found. Run scripts/mine_lineups.py first.")
    m = re.search(r"export const LINEUP_BANK = (\[.*?\]);", BANK.read_text(), re.S)
    if not m:
        sys.exit("Could not find LINEUP_BANK in the bank file.")
    bank = json.loads(m.group(1))
    seen = {}
    for pz in bank:
        for pod in pz["pods"]:
            for t in pod["tiles"]:
                pid = t["id"].rsplit("-", 2)[0]
                if t.get("shot") and pid not in seen:
                    seen[pid] = (t["shot"], t["name"])
    return seen


def main():
    players = load_players()
    OUT.mkdir(parents=True, exist_ok=True)
    have = skipped = got = failed = 0
    misses = []

    for pid, (url, name) in sorted(players.items()):
        dest = OUT / f"{pid}.png"
        if dest.exists() and dest.stat().st_size > 0:
            have += 1
            continue
        try:
            r = requests.get(url, timeout=30, headers={"User-Agent": UA})
            if r.status_code != 200 or not r.content:
                failed += 1; misses.append(f"{name} ({r.status_code})"); continue
            dest.write_bytes(r.content)
            got += 1
            time.sleep(0.15)          # no reason to hammer them
        except Exception as e:
            failed += 1; misses.append(f"{name} ({type(e).__name__})")

    print(f"{len(players)} players in the bank")
    print(f"  already cached : {have}")
    print(f"  downloaded     : {got}")
    print(f"  failed         : {failed}")
    if misses:
        print("\nThese will fall back to the remote URL, then to initials:")
        for m in misses[:20]:
            print(f"  {m}")
    total = sum(f.stat().st_size for f in OUT.glob("*.png"))
    print(f"\npublic/players/ is now {total/1024:.0f} KB across {len(list(OUT.glob('*.png')))} files")


if __name__ == "__main__":
    main()
