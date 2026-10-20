import { useState, useEffect, useRef, useMemo } from "react";
import { LINEUP_BANK } from "./lineupBank";
import { getLineupNumber, loadLineupStats, saveLineupStats, lineupRecord } from "./lineupMeta";

/* ------------------------------------------------------------------ *
 * Start/Sit draft: six calls, one real NFL week.
 *
 * Each step is a head-to-head: pick 1 of 2 players at QB, RB, RB, WR, WR,
 * TE from the same season-week. Cards show only what a manager knew at
 * kickoff. After the sixth pick, real points reveal slot by slot.
 *
 *   Right call  = your pick outscored the other option (ties count).
 *   The House   = always takes the higher season average (the chalk).
 *   Win/loss    = your total vs the House's total.
 *
 * Daily week counts toward the season record. "Play another week" draws a
 * random released week. A challenge link (?c=<n>&s=<score*10>&h=<right>)
 * loads week n and shows the friend's result to beat.
 * ------------------------------------------------------------------ */

const IMG = "https://static.www.nfl.com/image/";
const STEPS = ["QB", "RB", "RB", "WR", "WR", "TE"];
const matchup = r => (r <= 10 ? "Easy" : r >= 23 ? "Tough" : "Fair");
export const DISPLAY = "'Barlow Condensed','Arial Narrow',sans-serif";
export const BODY = "'Barlow',system-ui,-apple-system,sans-serif";

const theme = dark => dark ? {
  bg: "#0B0F19", panel: "#131A26", panelHi: "#1B2433", line: "#263042",
  fg: "#F3F4F6", muted: "#A3ACBA", dim: "#8792A2", accent: "#60A5FA",
  ink: "#F3F4F6", onInk: "#0B0F19", win: "#4ADE80", loss: "#F87171",
  winBg: "#14321F", lossBg: "#3A1616", pick: "#1E293B",
} : {
  bg: "#F3F4F6", panel: "#FFFFFF", panelHi: "#F9FAFB", line: "#E5E7EB",
  fg: "#111827", muted: "#4B5563", dim: "#6B7280", accent: "#1D4ED8",
  ink: "#111827", onInk: "#FFFFFF", win: "#15803D", loss: "#B91C1C",
  winBg: "#DCFCE7", lossBg: "#FEE2E2", pick: "#EFF6FF",
};

const CLUB = {
  ARI:"#97233F",ATL:"#A71930",BAL:"#241773",BUF:"#00338D",CAR:"#0085CA",CHI:"#C83803",
  CIN:"#FB4F14",CLE:"#FF3C00",DAL:"#7F9695",DEN:"#FB4F14",DET:"#0076B6",GB:"#203731",
  HOU:"#A71930",IND:"#0058A3",JAX:"#9F792C",KC:"#E31837",LA:"#866D4B",LAC:"#0080C6",
  LAR:"#866D4B",LV:"#5f6266",MIA:"#008E97",MIN:"#4F2683",NE:"#002244",NO:"#9F8958",
  NYG:"#0B2265",NYJ:"#12674A",OAK:"#5f6266",PHI:"#004C54",PIT:"#101820",SD:"#0080C6",
  SEA:"#002244",SF:"#AA0000",STL:"#866D4B",TB:"#D50A0A",TEN:"#4B92DB",WAS:"#5A1414",
};

/* ---------- which week ---------- */
// Week number n maps to bank slot n-1, the same mapping the daily uses, so a
// challenge link for #43 is the same week everyone played on day 43.
const bankFor = n => LINEUP_BANK[((n - 1) % LINEUP_BANK.length + LINEUP_BANK.length) % LINEUP_BANK.length];
const todayN = () => getLineupNumber();
const randomReleasedN = (recent = []) => {
  const max = Math.min(todayN() - 1, LINEUP_BANK.length);
  if (max < 1) return null;
  const all = Array.from({ length: max }, (_, i) => i + 1);
  const fresh = all.filter(n => !recent.includes(n));
  const pool = fresh.length ? fresh : all;
  return pool[Math.floor(Math.random() * pool.length)];
};
const readChallenge = () => {
  try {
    const q = new URLSearchParams(window.location.search);
    const c = parseInt(q.get("c"), 10);
    if (!Number.isInteger(c) || c < 1 || c > todayN()) return null;
    const s = parseInt(q.get("s"), 10), h = parseInt(q.get("h"), 10);
    return { n: c, score: Number.isFinite(s) ? s / 10 : null, hits: Number.isInteger(h) ? h : null };
  } catch { return null; }
};
const clearChallengeFromUrl = () => {
  try { window.history.replaceState(null, "", window.location.pathname + window.location.hash); } catch {}
};

/* Six head-to-heads from the week's 12-man roster: pair players at each
   position by season average (1v2, 3v4) so every call is a close one. Which
   side each player sits on is fixed per week, so friends see the same board. */
function buildCalls(p) {
  const by = pos => p.tiles.filter(t => t.pos === pos).sort((a, b) => b.avg - a.avg);
  const q = by("QB"), r = by("RB"), w = by("WR"), te = by("TE");
  const pairs = [[q[0], q[1]], [r[0], r[1]], [r[2], r[3]], [w[0], w[1]], [w[2], w[3]], [te[0], te[1]]];
  let seed = [...p.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return pairs.map((pr, k) => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const flip = (seed >>> 16) & 1;
    const [a, b] = flip ? [pr[1], pr[0]] : pr;
    const chalk = pr[0].avg >= pr[1].avg ? pr[0] : pr[1];
    return { slot: STEPS[k], options: [a, b], chalk: chalk.id };
  });
}

/* ---------- events ---------- */
const SERVER_EVENTS = { opened: "lineup_open", locked: "lineup_start", won: "lineup_win",
  lost: "lineup_loss", push: "lineup_push", shared: "lineup_share", challenge: "lineup_challenge" };
const isMe = () => { try { return localStorage.getItem("pd_me") === "1"; } catch { return false; } };
const ident = () => {
  try { return { id: localStorage.getItem("pd_anon_id") || "unknown", src: localStorage.getItem("pd_src") || "unknown" }; }
  catch { return { id: "unknown", src: "unknown" }; }
};
function ev(name, props = {}) {
  try { if (typeof window !== "undefined" && window.va) window.va("event", { name: `lineup_${name}`, ...props }); } catch {}
  const type = SERVER_EVENTS[name];
  if (!type || isMe()) return;
  try {
    fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...ident() }) }).catch(() => {});
  } catch {}
}

/* ---------- helpers ---------- */
const f1 = n => (Math.round(n * 10) / 10).toFixed(1);
const ord = n => { const t = n % 100, u = n % 10; return n + (t >= 11 && t <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[u] || "th")); };
const initials = n => { const p = String(n).trim().split(/\s+/); return ((p[0] || "")[0] || "") + ((p[p.length - 1] || "")[0] || ""); };
const shortName = n => { const p = String(n).trim().split(/\s+/); return p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(" ")}` : n; };
function statLine(s) {
  const out = [];
  if (!s) return "";
  if (s.pass) { const [c, a, y, td, i] = s.pass; out.push(`${c}/${a}, ${y} yd`); if (td) out.push(`${td} TD`); if (i) out.push(`${i} INT`); }
  if (s.rush) { const [c, y, td] = s.rush; out.push(`${c} car, ${y} yd`); if (td) out.push(`${td} TD`); }
  if (s.rec) { const [r, , y, td] = s.rec; out.push(`${r} rec, ${y} yd`); if (td) out.push(`${td} TD`); }
  if (s.fum) out.push(`${s.fum} fum`);
  return out.join(" · ");
}

function Face({ t, size = 44 }) {
  const [step, setStep] = useState(0);
  const src = !t.shot ? null
    : step === 0 ? `${IMG}${t.shot.replace(/^(upload|private)\//, "$1/c_fill,g_face,w_120,h_120,")}` : `${IMG}${t.shot}`;
  return (
    <span style={{ width: size, height: size, borderRadius: size / 2, flex: "none", position: "relative", overflow: "hidden",
      background: CLUB[t.team] || "#6B7280", display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,.18), 0 0 0 1px rgba(127,127,127,.25)" }}>
      <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: size * 0.38, color: "#fff" }}>{initials(t.name)}</span>
      {src && step < 2 && (
        <img alt="" decoding="async" referrerPolicy="no-referrer" src={src} onError={() => setStep(step + 1)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
            objectPosition: "top center", background: CLUB[t.team] || "#6B7280" }} />
      )}
    </span>
  );
}

/* ================================================================== */
export default function StartSitDraft({ onExit, dark = false }) {
  const C = theme(dark);
  const [stats, setStats] = useState(loadLineupStats);
  const [challenge, setChallenge] = useState(readChallenge);
  // daily | replay (already played today) | random | challenge
  const [n, setN] = useState(() => {
    const ch = readChallenge();
    return ch ? ch.n : todayN();
  });
  // Fixed when a week starts: only a first daily play hits the season record.
  // (Frozen so finishing today's game doesn't flip it to "replay" mid-screen.)
  const [counts, setCounts] = useState(() => n === todayN() && loadLineupStats().lastNumber !== todayN());
  const puzzle = useMemo(() => bankFor(n), [n]);
  const calls = useMemo(() => buildCalls(puzzle), [puzzle]);

  const [picks, setPicks] = useState([]);                 // tile ids, one per step
  const [phase, setPhase] = useState("pick");             // pick | review | reveal | done
  const [shown, setShown] = useState(0);                  // rows revealed
  const [field, setField] = useState(null);
  const [copied, setCopied] = useState(false);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    ev("opened", { n });
    if (challenge) { ev("challenge", { n }); clearChallengeFromUrl(); }
  }, []);

  const step = picks.length;
  const pickedTiles = picks.map((id, k) => calls[k].options.find(o => o.id === id));
  const result = useMemo(() => {
    if (picks.length < STEPS.length) return null;
    const rows = calls.map((c, k) => {
      const me = c.options.find(o => o.id === picks[k]);
      const other = c.options.find(o => o.id !== picks[k]);
      const house = c.options.find(o => o.id === c.chalk);
      return { k, slot: c.slot, me, other, house, right: me.pts >= other.pts, fade: me.id !== c.chalk };
    });
    const score = Math.round(rows.reduce((a, r) => a + r.me.pts, 0) * 10) / 10;
    const houseScore = Math.round(rows.reduce((a, r) => a + r.house.pts, 0) * 10) / 10;
    const best = Math.round(rows.reduce((a, r) => a + Math.max(r.me.pts, r.other.pts), 0) * 10) / 10;
    const hits = rows.filter(r => r.right).length;
    const diff = Math.round((score - houseScore) * 10) / 10;
    return { rows, score, houseScore, best, hits, diff, perfect: hits === STEPS.length,
      fades: rows.filter(r => r.fade).length, fadeHits: rows.filter(r => r.fade && r.right).length,
      outcome: diff > 0 ? "won" : diff < 0 ? "lost" : "push" };
  }, [picks, calls]);

  function choose(id) {
    if (phase !== "pick") return;
    const next = [...picks, id];
    setPicks(next);
    if (next.length === STEPS.length) setPhase("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function undo() {
    if (phase === "review") setPhase("pick");
    setPicks(p => p.slice(0, -1));
  }

  function lock() {
    ev("locked", { n });
    setPhase("reveal"); setShown(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gap = reduce ? 0 : 650;
    for (let i = 1; i <= STEPS.length; i++) timers.current.push(setTimeout(() => setShown(i), 300 + gap * i));
    timers.current.push(setTimeout(finish, 300 + gap * STEPS.length + (reduce ? 0 : 450)));
  }

  function finish() {
    setPhase("done");
    const r = result;
    // First time this person finishes this week (daily, challenge or random):
    // that's a real game for the funnel. Re-plays of a week they already
    // finished aren't.
    const firstTime = counts || !(stats.recent || []).includes(n);
    const recent = [n, ...(stats.recent || []).filter(x => typeof x === "number" && x !== n)].slice(0, 20);
    let next = { ...stats, recent };
    if (counts) {
      next.played++;
      if (r.outcome === "won") { next.wins++; next.streak++; next.best = Math.max(next.best, next.streak); }
      else if (r.outcome === "push") next.pushes = (next.pushes || 0) + 1;
      else next.streak = 0;
      next.lastNumber = n;
      next.calls = (next.calls || 0) + r.hits;
      next.fades = (next.fades || 0) + r.fades;
      next.upsets = (next.upsets || 0) + r.fadeHits;
      next.perfects = (next.perfects || 0) + (r.perfect ? 1 : 0);
      next.log = [...(next.log || []), { n, o: r.outcome === "won" ? "W" : r.outcome === "push" ? "P" : "L",
        hits: r.hits, v: 3, ...(r.perfect ? { p: 1 } : {}) }].slice(-30);
    }
    if (firstTime) ev(r.outcome === "won" ? "won" : r.outcome === "push" ? "push" : "lost", { hits: r.hits, perfect: r.perfect ? 1 : 0 });
    else ev(r.outcome === "won" ? "replay_won" : "replay_lost", { hits: r.hits });
    setStats(next); saveLineupStats(next);
    // Join the field for this week either way (first finish per player wins),
    // so challenge and replay scores rank against everyone who played it.
    try {
      fetch("/api/lineup-score", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n, score: r.score, calls: r.hits, fades: r.fades, fadeHits: r.fadeHits,
          dry: isMe(), ...ident() }) })
        .then(x => x.json()).then(j => { if (j && j.ok) setField(j); }).catch(() => {});
    } catch {}
  }

  function anotherWeek() {
    const m = randomReleasedN([n, ...(stats.recent || [])]);
    if (!m) return;
    timers.current.forEach(clearTimeout); timers.current = [];
    setChallenge(null); setCounts(false); setN(m); setPicks([]); setPhase("pick"); setShown(0); setField(null); setCopied(false);
    ev("random_started", { n: m });
    window.scrollTo(0, 0);
  }

  const shareText = r => {
    const squares = r.rows.map(x => (x.right ? "\u{1F7E9}" : "\u{1F7E5}")).join("");
    const head = r.perfect ? `\u{1F3C6} ${r.hits}/6 PERFECT` : `\u{1F3AF} ${r.hits}/6 right calls`;
    const vs = r.outcome === "won" ? "beat the House" : r.outcome === "lost" ? "lost to the House" : "tied the House";
    const link = `playdraft.app/?c=${n}&s=${Math.round(r.score * 10)}&h=${r.hits}#/start-sit`;
    return `PlayDraft Start/Sit · ${puzzle.season} Week ${puzzle.week}\n${head} · ${f1(r.score)} pts, ${vs}\n${squares}\nBeat me: ${link}`;
  };
  const share = r => {
    const txt = shareText(r);
    ev("shared", { n, hits: r.hits });
    if (navigator.share) { navigator.share({ text: txt }).catch(() => {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(txt)
      .then(() => { setCopied(true); timers.current.push(setTimeout(() => setCopied(false), 2000)); }).catch(() => {});
  };

  /* ---------------- styles ---------------- */
  const s = {
    wrap: { maxWidth: 520, margin: "0 auto", background: C.bg, color: C.fg, fontFamily: BODY, paddingBottom: 170, minHeight: "100vh" },
    top: { display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: C.panel, borderBottom: `1px solid ${C.line}` },
    iconBtn: { width: 44, height: 44, border: 0, background: "transparent", color: C.fg, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 22 },
    label: { display: "flex", justifyContent: "space-between", padding: "16px 16px 6px", fontSize: 12,
      fontWeight: 700, letterSpacing: ".06em", color: C.muted },
    list: { background: C.panel, borderTop: `1px solid ${C.line}` },
    num: { fontVariantNumeric: "tabular-nums" },
    bar: { position: "fixed", left: 0, right: 0, bottom: 0, maxWidth: 520, margin: "0 auto", background: C.panel,
      borderTop: `1px solid ${C.line}`, padding: "12px 16px calc(14px + env(safe-area-inset-bottom))", zIndex: 10,
      display: "flex", flexDirection: "column", gap: 8 },
    primary: { height: 52, border: 0, borderRadius: 12, background: C.ink, color: C.onInk, fontFamily: DISPLAY,
      fontWeight: 800, fontSize: 20, letterSpacing: ".04em", cursor: "pointer", width: "100%" },
    secondary: { height: 48, borderRadius: 12, border: `1.5px solid ${C.line}`, background: C.panel, color: C.fg,
      fontFamily: DISPLAY, fontWeight: 700, fontSize: 17, letterSpacing: ".04em", cursor: "pointer", padding: "0 16px", width: "100%" },
  };

  const title = counts || n === todayN() ? `START/SIT #${n}` : `START/SIT · WEEK #${n}`;
  const topBar = (
    <div style={s.top}>
      <button onClick={onExit} aria-label="Back to games" style={s.iconBtn}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <div style={{ flex: 1, textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 21, letterSpacing: ".02em" }}>{title}</div>
      <span style={{ width: 44 }} />
    </div>
  );

  const season = (
    <div style={{ padding: "14px 16px 12px", background: C.panel, borderBottom: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", color: C.muted }}>THE SEASON</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 52, lineHeight: .9 }}>{puzzle.season}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", color: C.muted }}>WEEK</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 36, lineHeight: .95 }}>{puzzle.week}</div>
        </div>
      </div>
      {challenge && challenge.hits != null && (
        <div style={{ marginTop: 12, background: C.ink, color: C.onInk, borderRadius: 10, padding: "10px 12px", fontSize: 14.5, fontWeight: 600 }}>
          {"\u{1F94A}"} Your friend went {challenge.hits}/6{challenge.score != null ? ` with ${f1(challenge.score)} pts` : ""}. Beat it.
        </div>
      )}
      {!counts && !challenge && n === todayN() && (
        <div style={{ marginTop: 10, fontSize: 13, color: C.muted }}>You already played today. This replay won't change your record.</div>
      )}
    </div>
  );

  // Progress: one chip per slot, filled with the pick once made.
  const progress = (
    <div style={{ display: "flex", gap: 6, padding: "12px 16px 0" }}>
      {STEPS.map((slot, k) => {
        const t = pickedTiles[k], on = k === step && phase === "pick";
        return (
          <div key={k} style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            <div style={{ height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              background: t ? C.panel : on ? C.pick : C.panelHi, border: `1.5px solid ${on ? C.accent : C.line}` }}>
              {t ? <Face t={t} size={30} /> : <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, color: on ? C.accent : C.dim }}>{slot}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );

  const option = (t, onPick) => {
    const last3 = (t.log || []).slice(-3).map(x => x[1]);
    const oppColor = t.oppRank <= 10 ? C.win : t.oppRank >= 23 ? C.loss : C.muted;
    return (
      <button key={t.id} onClick={() => onPick(t.id)} aria-label={`Start ${t.name}`}
        style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left", width: "100%", cursor: "pointer",
          background: C.panel, color: C.fg, border: `1.5px solid ${C.line}`, borderRadius: 14, padding: "14px 14px 12px",
          fontFamily: BODY, boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Face t={t} size={52} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 19, fontWeight: 700, lineHeight: 1.15 }}>{t.name}</span>
            <span style={{ display: "block", fontSize: 13.5, color: C.muted, marginTop: 2 }}>
              {t.pos} · {t.team} {t.home ? "vs" : "@"} {t.opp}</span>
          </span>
          <span style={{ textAlign: "right" }}>
            <span style={{ display: "block", ...s.num, fontFamily: DISPLAY, fontWeight: 800, fontSize: 28, lineHeight: 1 }}>{t.avg.toFixed(1)}</span>
            <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.dim, letterSpacing: ".06em" }}>PTS/G</span>
          </span>
        </span>
        <span style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 13, color: C.muted }}>
          <span style={{ color: oppColor, fontWeight: 700 }}>{matchup(t.oppRank)} matchup ({ord(t.oppRank)})</span>
          <span>Last 3: <b style={{ ...s.num, color: C.fg }}>{last3.map(v => v.toFixed(0)).join(" · ") || "n/a"}</b></span>
          <span>{t.use.toFixed(0)} {t.useLabel}/G</span>
        </span>
      </button>
    );
  };

  /* ---------------- pick ---------------- */
  if (phase === "pick") {
    const c = calls[step];
    return (
      <div style={s.wrap}>
        {topBar}{season}{progress}
        <div style={{ padding: "16px 16px 6px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", color: C.muted }}>CALL {step + 1} OF 6</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 30, lineHeight: 1.05 }}>WHO'S YOUR {c.slot}?</div>
          <div style={{ fontSize: 13.5, color: C.muted, marginTop: 2 }}>Everything below is what you'd have known at kickoff.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 16px" }}>
          {c.options.map(t => option(t, choose))}
        </div>
        {step > 0 && (
          <div style={s.bar}><button onClick={undo} style={s.secondary}>Undo last pick</button></div>
        )}
      </div>
    );
  }

  /* ---------------- review ---------------- */
  if (phase === "review") {
    return (
      <div style={s.wrap}>
        {topBar}{season}{progress}
        <div style={s.label}><span>YOUR LINEUP</span><span>PTS/G</span></div>
        <div style={s.list}>
          {pickedTiles.map((t, k) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: `1px solid ${C.line}` }}>
              <span style={{ width: 34, fontFamily: DISPLAY, fontWeight: 700, color: C.accent }}>{STEPS[k]}</span>
              <Face t={t} size={36} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 16, fontWeight: 600 }}>{t.name}</span>
                <span style={{ display: "block", fontSize: 12.5, color: C.muted }}>over {shortName(calls[k].options.find(o => o.id !== t.id).name)}</span>
              </span>
              <span style={{ ...s.num, fontWeight: 700 }}>{t.avg.toFixed(1)}</span>
            </div>
          ))}
        </div>
        <div style={s.bar}>
          <button onClick={lock} style={s.primary}>LOCK LINEUP & PLAY</button>
          <button onClick={undo} style={{ ...s.secondary, height: 40, border: 0 }}>Change last pick</button>
        </div>
      </div>
    );
  }

  /* ---------------- reveal / done ---------------- */
  const r = result;
  const done = phase === "done";
  const beatFriend = challenge && challenge.hits != null
    ? (r.hits > challenge.hits || (r.hits === challenge.hits && challenge.score != null && r.score > challenge.score) ? "won"
      : r.hits === challenge.hits && (challenge.score == null || r.score === challenge.score) ? "tie" : "lost") : null;
  return (
    <div style={s.wrap}>
      {topBar}{season}
      {done && (
        <div style={{ padding: "16px 16px 4px" }}>
          <div style={{ background: r.perfect ? "#B45309" : C.ink, color: r.perfect ? "#fff" : C.onInk, borderRadius: 14, padding: "16px 16px 14px" }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 44, lineHeight: .95 }}>
              {r.hits}/6 {r.perfect ? "PERFECT" : "RIGHT CALLS"}</div>
            <div style={{ fontSize: 15, marginTop: 6, fontWeight: 600 }}>
              {f1(r.score)} pts · {r.outcome === "won" ? `beat the House by ${f1(r.diff)}` : r.outcome === "lost" ? `the House won by ${f1(-r.diff)}` : "tied the House"}
            </div>
            <div style={{ fontSize: 13.5, marginTop: 4, opacity: .85 }}>
              {r.perfect ? "Best possible lineup from these calls." : `Best possible was ${f1(r.best)}.`}
              {field && field.players >= 3 ? ` Better than ${field.pct}% of ${field.players} players on this week.` : ""}
            </div>
          </div>
          {beatFriend && (
            <div style={{ marginTop: 10, borderRadius: 12, padding: "12px 14px", fontSize: 15, fontWeight: 700,
              background: beatFriend === "won" ? C.winBg : beatFriend === "lost" ? C.lossBg : C.panelHi,
              color: beatFriend === "won" ? C.win : beatFriend === "lost" ? C.loss : C.fg }}>
              {beatFriend === "won" ? "You beat your friend's score." : beatFriend === "lost" ? "Your friend still has you." : "Dead even with your friend."}
              <span style={{ fontWeight: 500, color: C.muted }}> They went {challenge.hits}/6{challenge.score != null ? `, ${f1(challenge.score)} pts` : ""}.</span>
            </div>
          )}
          {counts && <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>You're {lineupRecord(stats)} against the House this season.</div>}
        </div>
      )}
      <div style={s.label}><span>YOUR CALLS</span><span>PTS</span></div>
      <div style={s.list}>
        {r.rows.map((x, k) => {
          const open = k < shown || done;
          return (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: `1px solid ${C.line}`,
              background: !open ? C.panel : x.right ? C.winBg : C.lossBg, transition: "background .25s ease" }}>
              <span style={{ width: 30, fontFamily: DISPLAY, fontWeight: 700, color: C.muted }}>{x.slot}</span>
              <Face t={x.me} size={36} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15.5, fontWeight: 700 }}>{shortName(x.me.name)}
                  <span style={{ fontWeight: 500, color: C.muted }}> over {shortName(x.other.name)}</span></span>
                <span style={{ display: "block", fontSize: 12, color: C.dim }}>
                  {open ? `${statLine(x.me.stats) || "No stats"} · ${shortName(x.other.name)} had ${f1(x.other.pts)}` : "…"}</span>
              </span>
              <span style={{ ...s.num, fontFamily: DISPLAY, fontWeight: 800, fontSize: 24, minWidth: 48, textAlign: "right",
                color: !open ? C.dim : x.right ? C.win : C.loss }}>{open ? f1(x.me.pts) : "—"}</span>
            </div>
          );
        })}
      </div>
      {done && (
        <div style={s.bar}>
          <button onClick={() => share(r)} style={s.primary}>{copied ? "COPIED" : "CHALLENGE YOUR FRIENDS"}</button>
          <button onClick={anotherWeek} style={s.secondary}>Play another week</button>
        </div>
      )}
    </div>
  );
}
