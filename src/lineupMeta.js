/* Start/Sit bits the home screen needs. Kept out of StartSit.js so the
   lineup bank (≈125 KB gzipped) only downloads for people who open the game. */

export const LINEUP_LAUNCH = new Date(2026, 8, 7);
export const LINEUP_STORE = "pd_lineup_v1";

export const getLineupNumber = () => {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const l = new Date(LINEUP_LAUNCH); l.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((t - l) / 86400000)) + 1;
};

const blankStats = () => ({ played: 0, wins: 0, pushes: 0, streak: 0, best: 0, lastNumber: 0, recent: [] });
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
