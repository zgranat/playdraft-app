import { useState, useEffect, useRef } from "react";
import { LINEUP_BANK, LINEUP_LAUNCH } from "./lineupBank";

/* ------------------------------------------------------------------ *
 * Start/Sit — the daily fantasy call.
 *
 * Ten real players from real weeks. Start five, beat The House.
 * Scoring is 0.5 PPR; every stat line came from nflverse and was checked
 * against the raw box score by scripts/mine_lineups.py.
 *
 * Kept deliberately separate from Four Downs: its own storage key, its own
 * event names, its own streak. Sharing them would make it impossible to tell
 * which game is actually retaining anyone.
 * ------------------------------------------------------------------ */

const STORE = "pd_lineup_v1";
const ORDER = ["QB", "RB", "WR", "FLEX"];
const SHORT = { QB: "QB", RB: "RB", WR: "WR", FLEX: "FX" };

const C = {
  ink: "#0f1923", deep: "#0a1118", card: "#1b2733", cardHi: "#26343f",
  line: "#2f4150", cream: "#faf7f0", muted: "#93a3ae", dim: "#66788a",
  blue: "#3FA7D6", blueInk: "#04141d", grass: "#3f9e4d", brick: "#b04a36",
};

const CLUB = {
  ARI:"#97233F",ATL:"#A71930",BAL:"#241773",BUF:"#00338D",CAR:"#0085CA",CHI:"#C83803",
  CIN:"#FB4F14",CLE:"#FF3C00",DAL:"#7F9695",DEN:"#FB4F14",DET:"#0076B6",GB:"#FFB612",
  HOU:"#A71930",IND:"#0058A3",JAX:"#9F792C",KC:"#E31837",LA:"#866D4B",LAC:"#0080C6",
  LAR:"#866D4B",LV:"#A5ACAF",MIA:"#008E97",MIN:"#FFC62F",NE:"#C60C30",NO:"#D3BC8D",
  NYG:"#0B2265",NYJ:"#12674A",OAK:"#A5ACAF",PHI:"#A5ACAF",PIT:"#FFB612",SD:"#0080C6",
  SEA:"#69BE28",SF:"#AA0000",STL:"#866D4B",TB:"#D50A0A",TEN:"#4B92DB",WAS:"#FFB612",
};

/* ---------- dates: one lineup a day, counted from launch ---------- */
export const getLineupNumber = () => {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const l = new Date(LINEUP_LAUNCH); l.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((t - l) / 86400000)) + 1;
};
export const getTodaysLineupIndex = () =>
  (getLineupNumber() - 1) % LINEUP_BANK.length;
export const getTodaysLineup = () => LINEUP_BANK[getTodaysLineupIndex()];

/* Practice reaches backwards only. Everything released before today is fair
   game; today's lineup and anything after it is not. */
export const getPracticeLineup = (recent = []) => {
  const today = getTodaysLineupIndex();
  const released = LINEUP_BANK.slice(0, today);
  if (!released.length) return null;
  const fresh = released.filter(p => !recent.includes(p.id));
  const pool = fresh.length ? fresh : released;
  return pool[Math.floor(Math.random() * pool.length)];
};
export const hasLineupArchive = () => getTodaysLineupIndex() > 0;

/* ---------- stored record ---------- */
const blankStats = () => ({ played: 0, wins: 0, streak: 0, best: 0, lastNumber: 0, recent: [] });
export const loadLineupStats = () => {
  try { const s = localStorage.getItem(STORE); return s ? { ...blankStats(), ...JSON.parse(s) } : blankStats(); }
  catch { return blankStats(); }
};
const saveLineupStats = s => { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch {} };
export const playedLineupToday = () => loadLineupStats().lastNumber === getLineupNumber();

/* ---------- events: namespaced so the funnels never mix ---------- */
function ev(name, props = {}) {
  try {
    if (typeof window !== "undefined" && window.va)
      window.va("event", { name: `lineup_${name}`, ...props });
  } catch {}
}

/* ---------- helpers ---------- */
const f1 = n => (Math.round(n * 10) / 10).toFixed(1);
const ord = n => {
  const t = n % 100, u = n % 10;
  return n + (t >= 11 && t <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[u] || "th"));
};
const initials = n => {
  const p = String(n).trim().split(/\s+/);
  return ((p[0] || "")[0] || "") + ((p[p.length - 1] || "")[0] || "");
};
const bestOf = pod => [...pod.tiles].sort((a, b) => b.pts - a.pts)
  .slice(0, pod.start).map(t => t.id);

function verdictOf(t) {
  const soft = t.oppRank <= 10, tough = t.oppRank >= 23;
  const boom = t.weekRank <= 6, bust = t.weekRank >= 25 || t.pts <= t.ppg * 0.5;
  if (t.weekRank === 1) return { tone: "top", word: `TOP ${t.pos} OF THE WEEK` };
  if (boom && tough) return { tone: "boom", word: "SURPRISE" };
  if (boom) return { tone: "boom", word: "BOOM" };
  if (bust && soft) return { tone: "bust", word: "TRAP" };
  if (bust) return { tone: "bust", word: "BUST" };
  if (t.pts >= t.ppg) return { tone: "", word: "SOLID" };
  return { tone: "", word: "QUIET" };
}

/* The box score fills in as the number climbs, so it reads as a game being
   played rather than a total being revealed. */
function tickLine(s, e) {
  const out = [], yd = v => Math.round(v * e);
  const sc = (n, at) => Math.floor(Math.min(n, n * ((e - at) / (1 - at)) + 1e-9));
  if (s.pass) {
    const [c, a, y, td, i] = s.pass;
    out.push(`${Math.round(c * e)}/${Math.round(a * e)}, ${yd(y)} pass yd`);
    const t = td ? sc(td, 0.25) : 0; if (t) out.push(`${t} TD`);
    const n = i ? sc(i, 0.4) : 0; if (n) out.push(`${n} INT`);
  }
  if (s.rush) {
    const [c, y, td] = s.rush;
    out.push(`${Math.round(c * e)} car, ${yd(y)} yd`);
    const t = td ? sc(td, 0.3) : 0; if (t) out.push(`${t} TD`);
  }
  if (s.rec) {
    const [r, tg, y, td] = s.rec;
    out.push(`${Math.round(r * e)} rec, ${yd(y)} yd`);
    const t = td ? sc(td, 0.35) : 0; if (t) out.push(`${t} TD`);
  }
  if (s.fum && e > 0.6) out.push(`${s.fum} fumble lost`);
  return out.join("   ");
}

/* Photos are cached locally by scripts/fetch_headshots.py, with the remote
   URL as a fallback and initials behind both. A missing face must look
   deliberate, never broken. */
function Face({ t, size = 50 }) {
  const [step, setStep] = useState(0);
  const src = step === 0 ? `/players/${t.id.split("-")[0]}.png` : t.shot;
  return (
    <span style={{
      width: size, height: size, borderRadius: 2, flex: "none", position: "relative",
      overflow: "hidden", background: CLUB[t.team] || C.muted,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700,
        fontSize: size * 0.36, color: C.ink }}>{initials(t.name)}</span>
      {step < 2 && (
        <img alt="" loading="lazy" referrerPolicy="no-referrer" src={src}
          onError={() => setStep(step + 1)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "top center" }} />
      )}
    </span>
  );
}

/* ================================================================== */
export default function StartSit({ onExit, onCrossPromo, mode: initialMode = "daily" }) {
  const [mode, setMode] = useState(initialMode);
  const [puzzle, setPuzzle] = useState(() =>
    initialMode === "practice" ? (getPracticeLineup() || getTodaysLineup()) : getTodaysLineup());
  const [picks, setPicks] = useState({});
  const [phase, setPhase] = useState("set");   // set | run | done
  const [live, setLive] = useState({});        // tile id -> progress 0..1
  const [openPods, setOpenPods] = useState([]);
  const [me, setMe] = useState(0);
  const [hs, setHs] = useState(0);
  const [clock, setClock] = useState("");
  const [nudge, setNudge] = useState("");
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState(loadLineupStats);
  const raf = useRef(null);
  const timers = useRef([]);
  const practice = mode === "practice";

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    timers.current.forEach(clearTimeout);
  }, []);

  useEffect(() => { ev(practice ? "practice_opened" : "opened", { n: getLineupNumber() }); },
    [practice]);

  const chosen = pod => picks[pod.slot] || [];
  const ready = puzzle.pods.every(p => chosen(p).length === p.start);
  const filled = puzzle.pods.reduce((a, p) => a + chosen(p).length, 0);

  function toggle(pod, id) {
    const sel = picks[pod.slot] || [];
    if (sel.includes(id)) setPicks({ ...picks, [pod.slot]: sel.filter(x => x !== id) });
    else if (sel.length < pod.start) setPicks({ ...picks, [pod.slot]: [...sel, id] });
    else {
      setNudge(pod.start > 1
        ? `${pod.slot} is full. Tap a starter to bench him.`
        : `Tap your ${pod.slot} to change him.`);
      const t = setTimeout(() => setNudge(""), 2000);
      timers.current.push(t);
      return;
    }
    setNudge("");
  }

  const result = () => {
    let score = 0; const marks = [], byPod = {};
    puzzle.pods.forEach(pod => {
      const b = bestOf(pod); let hit = 0;
      chosen(pod).forEach(id => {
        const t = pod.tiles.find(x => x.id === id);
        score += t.pts;
        const ok = b.includes(id); marks.push(ok); if (ok) hit++;
      });
      byPod[pod.slot] = { hit, of: pod.start,
        pts: chosen(pod).reduce((s, id) => s + pod.tiles.find(x => x.id === id).pts, 0) };
    });
    score = Math.round(score * 10) / 10;
    const hits = marks.filter(Boolean).length;
    return { score, marks, hits, byPod, won: score > puzzle.house,
      perfect: hits === marks.length, pct: Math.round(score / puzzle.perfect * 100) };
  };

  function lock() {
    if (!ready) return;
    ev(practice ? "practice_locked" : "locked", { n: getLineupNumber() });
    setPhase("run");
    const reduce = typeof window !== "undefined" && window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return finish();

    let bm = 0, bh = 0, i = 0;
    const step = () => {
      if (i >= puzzle.pods.length) { setClock("Final"); return finish(); }
      const pod = puzzle.pods[i];
      setOpenPods(o => [...o, pod.slot]);
      setClock(pod.slot === "FLEX" ? "Flex is on the field" : `${pod.slot}s are playing`);
      const mine = chosen(pod).reduce((s, id) => s + pod.tiles.find(t => t.id === id).pts, 0);
      const his = puzzle.housePicks.reduce((s, id) => {
        const t = pod.tiles.find(x => x.id === id); return s + (t ? t.pts : 0); }, 0);
      const t0 = performance.now(), dur = 2300;
      const frame = now => {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 2.1);
        setLive(l => { const n = { ...l }; pod.tiles.forEach(t => { n[t.id] = e; }); return n; });
        setMe(bm + mine * e); setHs(bh + his * e);
        if (k < 1) raf.current = requestAnimationFrame(frame);
        else { bm += mine; bh += his; i++; timers.current.push(setTimeout(step, 430)); }
      };
      raf.current = requestAnimationFrame(frame);
    };
    timers.current.push(setTimeout(step, 300));
  }

  function finish() {
    const r = result();
    const done = {}; puzzle.pods.forEach(p => p.tiles.forEach(t => { done[t.id] = 1; }));
    setLive(done);
    setOpenPods(puzzle.pods.map(p => p.slot));
    setMe(r.score); setHs(puzzle.house); setClock("Final");
    setPhase("done");

    if (!practice) {
      const next = { ...stats };
      next.played++;
      if (r.won) { next.wins++; next.streak++; next.best = Math.max(next.best, next.streak); }
      else next.streak = 0;
      next.lastNumber = getLineupNumber();
      setStats(next); saveLineupStats(next);
    } else {
      const next = { ...stats, recent: [puzzle.id, ...stats.recent].slice(0, 12) };
      setStats(next); saveLineupStats(next);
    }
    ev(practice ? (r.won ? "practice_won" : "practice_lost") : (r.won ? "won" : "lost"),
       { calls: r.hits, pct: r.pct });
  }

  function nextPractice() {
    const p = getPracticeLineup(stats.recent);
    if (!p) return;
    if (!practice) ev("practice_started", { after: getLineupNumber() });
    if (raf.current) cancelAnimationFrame(raf.current);
    timers.current.forEach(clearTimeout); timers.current = [];
    setMode("practice"); setPuzzle(p); setPicks({}); setPhase("set");
    setLive({}); setOpenPods([]); setMe(0); setHs(0); setClock(""); setCopied(false);
    window.scrollTo(0, 0);
  }

  /* the one call that decided it against The House */
  const swing = () => {
    let out = null;
    puzzle.pods.forEach(pod => {
      const mine = pod.tiles.filter(t => chosen(pod).includes(t.id) && !puzzle.housePicks.includes(t.id));
      const his = pod.tiles.filter(t => puzzle.housePicks.includes(t.id) && !chosen(pod).includes(t.id));
      if (!mine.length || !his.length) return;
      const d = mine.reduce((s, t) => s + t.pts, 0) - his.reduce((s, t) => s + t.pts, 0);
      if (!out || Math.abs(d) > Math.abs(out.d)) out = { d, slot: pod.slot, you: mine[0], house: his[0] };
    });
    return out;
  };

  const loudest = () => {
    let s = null;
    puzzle.pods.forEach(pod => pod.tiles.forEach(t => {
      const d = Math.abs(t.pts - t.ppg); if (!s || d > s.d) s = { d, t }; }));
    return s.t;
  };

  const headline = r => {
    let benchedTop = null, startedBust = null;
    puzzle.pods.forEach(pod => pod.tiles.forEach(t => {
      const on = chosen(pod).includes(t.id);
      if (!on && t.weekRank === 1) benchedTop = t;
      if (on && (t.weekRank >= 25 || t.pts <= t.ppg * 0.5) && !startedBust) startedBust = t;
    }));
    if (r.perfect) return "Never had a doubt.";
    if (benchedTop) return `Benched the top ${benchedTop.pos} of the week.`;
    if (startedBust) return `Started the ${ord(startedBust.weekRank)} best ${startedBust.pos}. Ouch.`;
    if (r.won && r.hits >= 4) return "Right on almost every call.";
    if (r.won) return "Ugly, but a win is a win.";
    return "The House had the better week.";
  };

  const shareText = r => {
    const rows = ORDER.map(slot => {
      const pod = puzzle.pods.find(p => p.slot === slot), b = bestOf(pod);
      const sq = chosen(pod).map(id => {
        const t = pod.tiles.find(x => x.id === id);
        if (!b.includes(id)) return "\u{1F7E5}";
        return t.weekRank === 1 ? "\u{1F525}" : "\u{1F7E9}";
      }).join("");
      return `${SHORT[slot]} ${sq}`;
    }).join("\n");
    return `Start/Sit #${getLineupNumber()}\n${rows}\n${headline(r)}\n`
      + `${f1(r.score)} to ${f1(puzzle.house)}, ${r.hits} of 5`
      + (stats.streak > 1 ? `, ${stats.streak} straight` : "")
      + `\nplaydraft.app`;
  };

  const share = r => {
    const txt = shareText(r);
    ev(practice ? "practice_shared" : "shared", {});
    if (navigator.share) { navigator.share({ text: txt }).catch(() => {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(txt)
      .then(() => { setCopied(true); timers.current.push(setTimeout(() => setCopied(false), 2000)); })
      .catch(() => {});
  };

  /* ---------------- styles ---------------- */
  const s = {
    wrap: { maxWidth: 520, margin: "0 auto", background: C.ink, color: C.cream,
      fontFamily: "Barlow,'Helvetica Neue',Arial,sans-serif", paddingBottom: 92, minHeight: "100vh" },
    top: { display: "flex", alignItems: "center", gap: 12, padding: "13px 18px",
      borderBottom: `1px solid ${C.line}` },
    mark: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 700, flex: 1 },
    ghostBtn: { border: `1px solid ${C.line}`, borderRadius: 3, padding: "10px 18px",
      fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 600,
      color: C.muted, background: "none", cursor: "pointer" },
    solidBtn: { border: 0, borderRadius: 3, padding: "11px 22px",
      fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 700,
      background: C.blue, color: C.blueInk, cursor: "pointer" },
    pod: { borderBottom: `1px solid ${C.line}`, padding: "14px 18px" },
    slot: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 700 },
    bar: { position: "fixed", left: 0, right: 0, bottom: 0, maxWidth: 520, margin: "0 auto",
      background: C.deep, borderTop: `1px solid ${C.line}`,
      padding: "11px 18px calc(11px + env(safe-area-inset-bottom))",
      display: "flex", gap: 12, alignItems: "center", zIndex: 10 },
    num: { fontVariantNumeric: "tabular-nums" },
  };

  const r = phase === "done" ? result() : null;

  /* ---------------- set ---------------- */
  if (phase === "set") return (
    <div style={s.wrap}>
      <div style={s.top}>
        <button onClick={onExit} style={{ background: "none", border: 0, color: C.muted,
          fontSize: 13, fontWeight: 600, cursor: "pointer" }}>← Games</button>
        <span style={s.mark}>START<span style={{ color: C.blue }}>/</span>SIT</span>
        <span style={{ fontSize: 12, color: C.dim, fontWeight: 600 }}>
          {practice ? "Archive" : `${stats.wins}-${stats.played - stats.wins}`}</span>
      </div>

      <header style={{ padding: "18px 18px 15px", borderBottom: `1px solid ${C.line}` }}>
        {practice && <div style={{ display: "inline-block", fontSize: 11, fontWeight: 700,
          letterSpacing: ".04em", background: C.line, color: C.muted,
          padding: "3px 7px", borderRadius: 2, marginBottom: 9 }}>FROM THE ARCHIVE</div>}
        <h1 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 32, fontWeight: 700,
          lineHeight: 1, marginBottom: 11 }}>Start or sit</h1>
        <div style={{ display: "flex", gap: 11, alignItems: "center", background: C.deep,
          border: `1px solid ${C.line}`, borderRadius: 3, padding: "11px 13px" }}>
          <b style={{ ...s.num, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 31,
            fontWeight: 700, color: C.blue, lineHeight: 1 }}>{f1(puzzle.house)}</b>
          <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.35 }}>
            The House has already set his lineup. Beat that number and you take the week.</span>
        </div>
        <p style={{ fontSize: 12.5, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
          Real players, real weeks. You get where he finished that year, his average, how kind
          the defense was, and last week's score. What he did on the day is hidden.</p>
      </header>

      {puzzle.pods.map(pod => (
        <section key={pod.slot} style={s.pod}>
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "baseline", marginBottom: 8 }}>
            <span style={s.slot}>{pod.slot}</span>
            <span style={{ fontSize: 12, color: C.dim, fontWeight: 600 }}>
              Start {pod.start} of {pod.tiles.length}</span>
          </div>
          <div style={{ display: "grid", gap: 7 }}>
            {pod.tiles.map(t => {
              const on = chosen(pod).includes(t.id);
              const full = !on && chosen(pod).length >= pod.start;
              const dcol = t.oppRank <= 12 ? C.grass : t.oppRank >= 21 ? C.brick : C.cream;
              return (
                <button key={t.id} onClick={() => toggle(pod, t.id)} aria-pressed={on}
                  style={{ display: "flex", gap: 10, textAlign: "left", width: "100%",
                    background: on ? C.cardHi : C.card, border: 0,
                    borderLeft: `3px solid ${on ? C.blue : C.line}`, borderRadius: 2,
                    padding: "9px 10px 9px 8px", cursor: "pointer", opacity: full ? 0.5 : 1,
                    color: C.cream }}>
                  <Face t={t} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 21,
                        fontWeight: 600, lineHeight: 1.05, color: on ? C.blue : C.cream,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {t.name}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 5px",
                        borderRadius: 2, color: "#0e1416",
                        background: CLUB[t.team] || C.muted }}>{t.team}</span>
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 2 }}>
                      {t.season} Week {t.week}, against {t.opp}</span>
                    <span style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
                      gap: "3px 12px", marginTop: 7 }}>
                      <Stat label={t.season} value={`${t.pos}${t.finish}`} />
                      <Stat label="PER GAME" value={f1(t.ppg)} />
                      <Stat label="OPP" value={`${t.oppRank}/32`} color={dcol} />
                      <Stat label="LAST WK" value={t.prev == null ? "—" : f1(t.prev)} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <div style={s.bar}>
        <span style={{ fontSize: 13, flex: 1, lineHeight: 1.3,
          color: nudge ? C.blue : C.muted }}>
          {nudge || (filled === 5 ? "Lineup set. No changes after this." : `${filled} of 5 spots filled`)}
        </span>
        <button onClick={lock} disabled={!ready}
          style={{ ...s.solidBtn, background: ready ? C.blue : C.card,
            color: ready ? C.blueInk : C.dim, cursor: ready ? "pointer" : "not-allowed" }}>
          Lock lineup</button>
      </div>
    </div>
  );

  /* ---------------- run and result ---------------- */
  const sw = phase === "done" ? swing() : null;
  const loud = phase === "done" ? loudest() : null;

  return (
    <div style={s.wrap}>
      <div style={s.top}>
        <button onClick={onExit} style={{ background: "none", border: 0, color: C.muted,
          fontSize: 13, fontWeight: 600, cursor: "pointer" }}>← Games</button>
        <span style={s.mark}>START<span style={{ color: C.blue }}>/</span>SIT</span>
      </div>

      <div style={{ position: "sticky", top: 0, zIndex: 5, background: C.deep,
        borderBottom: `1px solid ${C.line}`, padding: "11px 18px", display: "grid",
        gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10 }}>
        <Score label="YOU" value={me} color={C.blue} />
        <span style={{ fontSize: 12, color: C.dim, fontWeight: 600 }}>vs</span>
        <Score label="THE HOUSE" value={hs} />
        <div style={{ gridColumn: "1/-1", textAlign: "center", fontSize: 12, color: C.muted,
          borderTop: `1px solid ${C.line}`, paddingTop: 7, minHeight: 16 }}>{clock}</div>
      </div>

      {puzzle.pods.map(pod => {
        const open = openPods.includes(pod.slot);
        const b = bestOf(pod), sel = chosen(pod);
        const hit = sel.filter(id => b.includes(id)).length;
        const settled = pod.tiles.every(t => (live[t.id] || 0) >= 1);
        const rows = [...pod.tiles.filter(t => sel.includes(t.id)),
                      ...pod.tiles.filter(t => !sel.includes(t.id))];
        return (
          <section key={pod.slot} style={{ borderBottom: `1px solid ${C.line}`,
            padding: "12px 18px", opacity: open ? 1 : 0.32, transition: "opacity .4s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 6 }}>
              <span style={s.slot}>{pod.slot}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 2,
                background: settled && hit === pod.start ? C.blue : C.line,
                color: settled && hit === pod.start ? C.blueInk : C.muted }}>
                {settled ? (hit === pod.start ? (pod.start > 1 ? "BOTH RIGHT" : "RIGHT CALL")
                                              : `${hit} of ${pod.start}`) : "\u00a0"}</span>
            </div>
            {rows.map(t => {
              const on = sel.includes(t.id), e = live[t.id] || 0, doneT = e >= 1;
              const right = b.includes(t.id);
              const v = doneT ? verdictOf(t) : null;
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 9,
                  padding: "5px 0", opacity: on ? 1 : 0.45 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, flex: "none",
                    background: !on ? "transparent"
                      : doneT ? (right ? C.grass : C.brick) : C.line }} />
                  <Face t={t} size={32} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18,
                      fontWeight: on ? 600 : 500, lineHeight: 1.15, display: "flex",
                      alignItems: "center", gap: 6, whiteSpace: "nowrap",
                      overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.name}
                      {puzzle.housePicks.includes(t.id) && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 4px",
                          borderRadius: 2, background: C.line, color: C.muted }}>HOUSE</span>)}
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: C.muted,
                      lineHeight: 1.3, minHeight: 15 }}>{tickLine(t.stats, e)}</span>
                    {v && (
                      <span style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".03em",
                          padding: "2px 6px", borderRadius: 2,
                          background: v.tone === "boom" ? C.grass : v.tone === "bust" ? C.brick
                            : v.tone === "top" ? C.blue : C.line,
                          color: v.tone ? (v.tone === "top" ? C.blueInk : "#fff") : C.muted }}>
                          {v.word}</span>
                        <span style={{ fontSize: 12, color: C.dim, fontWeight: 600 }}>
                          {t.pos}{t.weekRank} of {t.weekField} that week</span>
                      </span>
                    )}
                  </span>
                  <span style={{ ...s.num, fontSize: 19, fontWeight: 700, minWidth: 54,
                    textAlign: "right" }}>{f1(t.pts * e)}</span>
                </div>
              );
            })}
          </section>
        );
      })}

      {phase === "done" && (
        <div style={{ padding: "20px 18px" }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 32, fontWeight: 700,
            lineHeight: 1.05, color: r.perfect ? C.blue : r.won ? C.grass : C.brick }}>
            {r.perfect ? "Perfect lineup" : r.won ? "You beat the House" : "The House got you"}</div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 7, lineHeight: 1.5 }}>
            {r.won ? "By" : "Short by"} {f1(Math.abs(r.score - puzzle.house))} points.
            A perfect lineup was worth {f1(puzzle.perfect)}.</div>

          {sw && (
            <Note>The House started <b>{sw.house.name}</b> at {sw.slot} where you had{" "}
              <b>{sw.you.name}</b>. Worth {f1(Math.abs(sw.d))} points {sw.d > 0 ? "to you" : "to him"}.</Note>
          )}
          {loud && (
            <Note><b>{loud.name}</b>, {loud.season} week {loud.week} against {loud.opp}.{" "}
              {loud.pts >= loud.ppg ? "Put up" : "Managed"} {f1(loud.pts)} and finished{" "}
              {ord(loud.weekRank)} among {loud.pos}s that week.
              {loud.priorFinish ? ` He had been ${loud.pos}${loud.priorFinish} the year before.` : ""}</Note>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7,
            margin: "13px 0 6px" }}>
            {ORDER.map(slot => {
              const p = r.byPod[slot], clean = p.hit === p.of;
              return (
                <div key={slot} style={{ background: C.deep, borderRadius: 3, padding: "8px 6px",
                  textAlign: "center", border: `1px solid ${clean ? C.blue : C.line}` }}>
                  <span style={{ display: "block", fontSize: 11, color: C.dim, fontWeight: 700 }}>{slot}</span>
                  <b style={{ ...s.num, display: "block", fontSize: 21, fontWeight: 700,
                    fontFamily: "'Barlow Condensed',sans-serif",
                    color: clean ? C.blue : C.cream }}>{f1(p.pts)}</b>
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 14, color: C.muted, marginTop: 7, lineHeight: 1.5 }}>
            {r.hits} of 5 calls right, {r.pct}% of perfect.
            {!practice && ` Record ${stats.wins}-${stats.played - stats.wins}${
              stats.streak > 1 ? `, ${stats.streak} in a row` : ""}.`}</div>

          <div style={{ display: "flex", gap: 9, marginTop: 15, flexWrap: "wrap" }}>
            {!practice && <button style={s.ghostBtn} onClick={() => share(r)}>
              {copied ? "Copied" : "Share result"}</button>}
            {hasLineupArchive() && <button onClick={nextPractice}
              style={practice ? s.solidBtn : s.ghostBtn}>
              {practice ? "Another lineup" : "Play the archive"}</button>}
          </div>

          {onCrossPromo && <div style={{ marginTop: 13 }}>{onCrossPromo()}</div>}
        </div>
      )}

      {phase === "run" && (
        <div style={s.bar}>
          <span style={{ fontSize: 13, color: C.muted, flex: 1 }}>Games under way</span>
          <button style={s.ghostBtn} onClick={() => {
            if (raf.current) cancelAnimationFrame(raf.current);
            timers.current.forEach(clearTimeout); timers.current = [];
            finish();
          }}>Skip to final</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <span>
      <i style={{ fontStyle: "normal", fontSize: 10, color: "#66788a", fontWeight: 600 }}>{label}</i>
      <b style={{ fontSize: 14, fontWeight: 600, marginLeft: 5, fontVariantNumeric: "tabular-nums",
        color: color || "#faf7f0" }}>{value}</b>
    </span>
  );
}

function Score({ label, value, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <i style={{ fontStyle: "normal", display: "block", fontSize: 11, color: "#66788a",
        fontWeight: 600 }}>{label}</i>
      <b style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 35, fontWeight: 700,
        lineHeight: 1, display: "block", fontVariantNumeric: "tabular-nums",
        color: color || "#faf7f0" }}>{f1(value)}</b>
    </div>
  );
}

function Note({ children }) {
  return (
    <div style={{ background: "#0a1118", border: "1px solid #2f4150", borderLeft: "3px solid #3FA7D6",
      borderRadius: 2, padding: "11px 13px", marginTop: 13, fontSize: 13.5, lineHeight: 1.5 }}>
      {children}
    </div>
  );
}
