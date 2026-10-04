/* Start/Sit bits the home screen needs. Kept out of StartSit.js so the
   lineup bank (≈125 KB gzipped) only downloads for people who open the game. */

export const LINEUP_LAUNCH = new Date(2026, 8, 7);
export const LINEUP_STORE = "pd_lineup_v1";

export const getLineupNumber = () => {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const l = new Date(LINEUP_LAUNCH); l.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((t - l) / 86400000)) + 1;
};

// calls/upsets/fades are running totals for the Locker Room; log keeps the
// last 30 daily results as { n, o: "W"|"L"|"P", hits }.
const blankStats = () => ({ played: 0, wins: 0, pushes: 0, streak: 0, best: 0, lastNumber: 0, recent: [],
  calls: 0, upsets: 0, fades: 0, bestPct: null, log: [] });
export const loadLineupStats = () => {
  try {
    const s = localStorage.getItem(LINEUP_STORE);
    return s ? { ...blankStats(), ...JSON.parse(s) } : blankStats();
  } catch { return blankStats(); }
};
export const saveLineupStats = s => {
  try { localStorage.setItem(LINEUP_STORE, JSON.stringify(s)); } catch {}
};
export const playedLineupToday = () => loadLineupStats().lastNumber === getLineupNumber();

/* "7-3" or "7-3-1" with pushes */
export const lineupRecord = st => {
  const losses = st.played - st.wins - (st.pushes || 0);
  return st.pushes ? `${st.wins}-${losses}-${st.pushes}` : `${st.wins}-${losses}`;
};

/* Last 7 days of daily lineups for the Locker Room game log. */
export const lineupLast7 = st => {
  const today = getLineupNumber();
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const e = (st.log || []).find(x => x.n === today - i);
    out.push({ label: d.toLocaleDateString(undefined, { weekday: "narrow" }), state: e ? e.o : "-", hits: e ? e.hits : null });
  }
  return out;
};
