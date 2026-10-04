import { useState, useEffect, useRef, useMemo } from "react";
import { LINEUP_BANK } from "./lineupBank";
import { getLineupNumber, loadLineupStats, saveLineupStats, lineupRecord } from "./lineupMeta";

/* ------------------------------------------------------------------ *
 * Start/Sit — set a lineup from one real NFL week, head to head vs the House.
 *
 * Twelve-man roster (2 QB, 4 RB, 4 WR, 2 TE) from a single season-week. Seven
 * starters: QB, RB, RB, WR, WR, TE, FLEX. The House sets the same roster by season average,
 * so the only slots that decide the matchup are the ones where you differ.
 * Cards show only what a manager knew at kickoff (scripts/mine_rosters.py).
 * The season and week are on screen from the start.
 *
 * Own storage key, own events (lineup_*), separate from Four Downs.
 * ------------------------------------------------------------------ */

const IMG = "https://static.www.nfl.com/image/";
const SLOTS = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX"];
const SLOT_SHORT = ["QB", "RB", "RB", "WR", "WR", "TE", "FLX"];
const FLEX_AT = SLOTS.indexOf("FLEX");
const fits = (slot, pos) => (slot === "FLEX" ? pos === "RB" || pos === "WR" || pos === "TE" : slot === pos);
/* oppRank 1 = the defense that has allowed the most points to that position */
const matchup = r => (r <= 10 ? "Easy" : r >= 23 ? "Tough" : "Fair");

export const DISPLAY = "'Barlow Condensed','Arial Narrow',sans-serif";
export const BODY = "'Barlow',system-ui,-apple-system,sans-serif";

const theme = dark => dark ? {
  bg: "#0B0F19", panel: "#131A26", panelHi: "#1B2433", line: "#263042",
  fg: "#F3F4F6", muted: "#A3ACBA", dim: "#8792A2",
  accent: "#60A5FA", onAccent: "#0B0F19", ink: "#F3F4F6", onInk: "#0B0F19",
  call: "#FDBA74", callBg: "#2A1D12", callFill: "#C2410C",
  win: "#4ADE80", loss: "#F87171", winFill: "#16A34A", lossFill: "#DC2626", same: "#374151",
} : {
  bg: "#F3F4F6", panel: "#FFFFFF", panelHi: "#F9FAFB", line: "#E5E7EB",
  fg: "#111827", muted: "#4B5563", dim: "#6B7280",
  accent: "#1D4ED8", onAccent: "#FFFFFF", ink: "#111827", onInk: "#FFFFFF",
  call: "#9A3412", callBg: "#FFF7ED", callFill: "#9A3412",
  win: "#15803D", loss: "#B91C1C", winFill: "#16A34A", lossFill: "#DC2626", same: "#D1D5DB",
};

const CLUB = {
  ARI:"#97233F",ATL:"#A71930",BAL:"#241773",BUF:"#00338D",CAR:"#0085CA",CHI:"#C83803",
  CIN:"#FB4F14",CLE:"#FF3C00",DAL:"#7F9695",DEN:"#FB4F14",DET:"#0076B6",GB:"#203731",
  HOU:"#A71930",IND:"#0058A3",JAX:"#9F792C",KC:"#E31837",LA:"#866D4B",LAC:"#0080C6",
  LAR:"#866D4B",LV:"#5f6266",MIA:"#008E97",MIN:"#4F2683",NE:"#002244",NO:"#9F8958",
  NYG:"#0B2265",NYJ:"#12674A",OAK:"#5f6266",PHI:"#004C54",PIT:"#101820",SD:"#0080C6",
  SEA:"#002244",SF:"#AA0000",STL:"#866D4B",TB:"#D50A0A",TEN:"#4B92DB",WAS:"#5A1414",
};

/* ---------- which lineup ---------- */
export const getTodaysLineupIndex = () => (getLineupNumber() - 1) % LINEUP_BANK.length;
export const getTodaysLineup = () => LINEUP_BANK[getTodaysLineupIndex()];
export const getPracticeLineup = (recent = []) => {
  const released = LINEUP_BANK.slice(0, getTodaysLineupIndex());
  if (!released.length) return null;
  const fresh = released.filter(p => !recent.includes(p.id));
  const pool = fresh.length ? fresh : released;
  return pool[Math.floor(Math.random() * pool.length)];
};
export const hasLineupArchive = () => getTodaysLineupIndex() > 0;

/* ---------- events ---------- */
// Vercel custom events need a paid plan, so everything that matters also goes
// to /api/event (Redis), which is what the daily stats email reads.
const SERVER_EVENTS = { opened: "lineup_open", locked: "lineup_start",
  won: "lineup_win", lost: "lineup_loss", push: "lineup_push", shared: "lineup_share" };
const isMe = () => { try { return localStorage.getItem("pd_me") === "1"; } catch { return false; } };
const ident = () => {
  try {
    return { id: localStorage.getItem("pd_anon_id") || "unknown",
             src: localStorage.getItem("pd_src") || "unknown" };
  } catch { return { id: "unknown", src: "unknown" }; }
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
const ord = n => {
  const t = n % 100, u = n % 10;
  return n + (t >= 11 && t <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[u] || "th"));
};
const initials = n => {
  const p = String(n).trim().split(/\s+/);
  return ((p[0] || "")[0] || "") + ((p[p.length - 1] || "")[0] || "");
};
const shortName = n => {
  const p = String(n).trim().split(/\s+/);
  return p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(" ")}` : n;
};
const sum = (ids, byId, k) => ids.reduce((s, id) => s + byId[id][k], 0);

/* Line your starters up against the House's slot by slot, so a player you
   both started sits on the same row and only your real calls differ. */
function alignToHouse(lineup, houseIds, byId) {
  const mine = new Set(lineup);
  const out = Array(SLOTS.length).fill(null);
  houseIds.forEach((id, k) => { if (mine.has(id)) { out[k] = id; mine.delete(id); } });
  const rest = [...mine];
  SLOTS.forEach((slot, k) => {
    if (out[k] || slot === "FLEX") return;
    const i = rest.findIndex(id => byId[id].pos === slot);
    if (i >= 0) out[k] = rest.splice(i, 1)[0];
  });
  if (!out[FLEX_AT]) out[FLEX_AT] = rest.shift();
  SLOTS.forEach((_, k) => { if (!out[k]) out[k] = rest.shift(); });
  return out;
}

/* Every legal lineup, so a score reads as "better than X% of lineups". */
function allLineups(tiles) {
  const q = tiles.filter(t => t.pos === "QB"), r = tiles.filter(t => t.pos === "RB"),
    w = tiles.filter(t => t.pos === "WR"), te = tiles.filter(t => t.pos === "TE");
  const pairs = a => a.flatMap((x, i) => a.slice(i + 1).map(y => [x, y]));
  const seen = new Map();   // a starting six can be slotted more than one way; count it once
  q.forEach(qb => pairs(r).forEach(rs => pairs(w).forEach(ws => te.forEach(tt => {
    r.concat(w, te).filter(x => !rs.includes(x) && !ws.includes(x) && x !== tt).forEach(fx => {
      const seven = [qb, ...rs, ...ws, tt, fx];
      seen.set(seven.map(t => t.id).sort().join("|"), seven.reduce((s, t) => s + t.pts, 0));
    });
  }))));
  return [...seen.values()];
}
function lineupPercentile(tiles, score) {
  const sums = allLineups(tiles), r = x => Math.round(x * 10);
  const below = sums.filter(s => r(s) < r(score)).length;
  const ties = sums.filter(s => r(s) === r(score)).length;
  return { pct: Math.round(((below + (ties - 1) / 2) / (sums.length - 1)) * 100), n: sums.length };
}

/* The box score fills in as the number climbs. */
function statLine(s) {
  const out = [];
  if (s.pass) { const [c, a, y, td, i] = s.pass; out.push(`${c}/${a}, ${y} yd`); if (td) out.push(`${td} TD`); if (i) out.push(`${i} INT`); }
  if (s.rush) { const [c, y, td] = s.rush; out.push(`${c} car, ${y} yd`); if (td) out.push(`${td} TD`); }
  if (s.rec) { const [r, , y, td] = s.rec; out.push(`${r} rec, ${y} yd`); if (td) out.push(`${td} TD`); }
  if (s.fum) out.push(`${s.fum} fum`);
  return out.join(" · ");
}

/* Win probability for the reveal: how far ahead, against how much is left. */
const winProb = (margin, left) => {
  if (left <= 0.001) return margin > 0.05 ? 1 : margin < -0.05 ? 0 : 0.5;
  return 1 / (1 + Math.exp(-margin / (3 + 5 * left)));
};

function Face({ t, size = 40 }) {
  const [step, setStep] = useState(0);
  const src = !t.shot ? null
    : step === 0 ? `${IMG}${t.shot.replace(/^(upload|private)\//, "$1/c_fill,g_face,w_120,h_120,")}`
    : `${IMG}${t.shot}`;
  return (
    <span style={{ width: size, height: size, borderRadius: size / 2, flex: "none", position: "relative",
      overflow: "hidden", background: CLUB[t.team] || "#6B7280",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,.18), 0 0 0 1px rgba(127,127,127,.25)",
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: size * 0.38, color: "#fff" }}>{initials(t.name)}</span>
      {src && step < 2 && (
        <img alt="" decoding="async" referrerPolicy="no-referrer" src={src}
          onError={() => setStep(step + 1)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "top center", background: CLUB[t.team] || "#6B7280" }} />
      )}
    </span>
  );
}

/* ================================================================== */
export default function StartSit({ onExit, onCrossPromo, dark = false, mode: initialMode = "daily" }) {
  const C = theme(dark);
  const [mode, setMode] = useState(initialMode);
  const [puzzle, setPuzzle] = useState(() =>
    initialMode === "practice" ? (getPracticeLineup() || getTodaysLineup()) : getTodaysLineup());
  const [lineup, setLineup] = useState(() => puzzle.houseIds.slice());
  const [moving, setMoving] = useState(null);       // { slot } or { id } (bench player)
  const [card, setCard] = useState(null);            // tile id for the player sheet
  const [phase, setPhase] = useState("set");         // set | run | done
  const [live, setLive] = useState({});              // row index -> 0..1
  const [showHow, setShowHow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [field, setField] = useState(null);
  const [stats, setStats] = useState(loadLineupStats);
  const raf = useRef(null);
  const timers = useRef([]);
  const practice = mode === "practice";

  const byId = useMemo(() => Object.fromEntries(puzzle.tiles.map(t => [t.id, t])), [puzzle]);
  const bench = puzzle.tiles.filter(t => !lineup.includes(t.id));
  const house = puzzle.houseIds;

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    timers.current.forEach(clearTimeout);
  }, []);
  useEffect(() => { ev(practice ? "practice_opened" : "opened", { n: getLineupNumber() }); }, [practice]);

  const aligned = useMemo(() => alignToHouse(lineup, house, byId), [lineup, house, byId]);
  const callCount = aligned.filter((id, k) => id !== house[k]).length;
  const myProj = sum(lineup, byId, "avg"), houseProj = sum(house, byId, "avg");

  /* ---------- lineup moves ---------- */
  const targetsFor = sel => {
    if (!sel) return { slots: [], bench: [] };
    if (sel.id) {                                   // a bench player looking for a slot
      const pos = byId[sel.id].pos;
      return { slots: SLOTS.map((s, k) => (fits(s, pos) ? k : -1)).filter(k => k >= 0), bench: [] };
    }
    const k = sel.slot, cur = byId[lineup[k]];
    // only a swap with FLEX changes anything between two starters
    return {
      slots: SLOTS.map((sl, j) => (j !== k && (sl === "FLEX" || SLOTS[k] === "FLEX")
        && fits(sl, cur.pos) && fits(SLOTS[k], byId[lineup[j]].pos) ? j : -1)).filter(j => j >= 0),
      bench: bench.filter(b => fits(SLOTS[k], b.pos)).map(b => b.id),
    };
  };
  const tg = targetsFor(moving);

  function tapSlot(k) {
    if (moving && moving.id && tg.slots.includes(k)) {         // bench -> slot
      const next = lineup.slice(); next[k] = moving.id; setLineup(next); setMoving(null); return;
    }
    if (moving && moving.slot != null && tg.slots.includes(k)) { // slot <-> slot
      const next = lineup.slice(); [next[k], next[moving.slot]] = [next[moving.slot], next[k]];
      setLineup(next); setMoving(null); return;
    }
    setMoving(moving && moving.slot === k ? null : { slot: k });
  }
  function tapBench(id) {
    if (moving && moving.slot != null && tg.bench.includes(id)) {
      const next = lineup.slice(); next[moving.slot] = id; setLineup(next); setMoving(null); return;
    }
    setMoving(moving && moving.id === id ? null : { id });
  }
  function startFromCard(id) {
    const t = byId[id];
    if (lineup.includes(id)) return setCard(null);
    // swap him in for the weakest starter he can replace at his position, else FLEX
    const options = SLOTS.map((s, k) => k).filter(k => fits(SLOTS[k], t.pos));
    const same = options.filter(k => byId[lineup[k]].pos === t.pos);
    const k = (same.length ? same : options).sort((a, b) => byId[lineup[a]].avg - byId[lineup[b]].avg)[0];
    const next = lineup.slice(); next[k] = id; setLineup(next); setCard(null); setMoving(null);
  }
  function benchFromCard(id) {
    const k = lineup.indexOf(id);
    if (k < 0) return setCard(null);
    setCard(null); setMoving({ slot: k });
  }

  /* ---------- result ---------- */
  const result = useMemo(() => {
    const rows = aligned.map((id, k) => {
      const me = byId[id], hs = byId[house[k]];
      return { k, me, hs, call: id !== house[k],
        outcome: id === house[k] ? "same" : me.pts > hs.pts ? "won" : me.pts < hs.pts ? "lost" : "tie" };
    });
    const score = Math.round(sum(aligned, byId, "pts") * 10) / 10;
    const diff = Math.round((score - puzzle.house) * 10) / 10;
    const calls = rows.filter(r => r.call);
    return { rows, score, diff, calls, won: calls.filter(r => r.outcome === "won").length,
      outcome: diff > 0 ? "won" : diff < 0 ? "lost" : "push", ...lineupPercentile(puzzle.tiles, score) };
  }, [aligned, byId, house, puzzle]);

  /* Same starts tick in fast and cancel out; your calls score last. */
  const order = useMemo(() => {
    const same = result.rows.filter(r => !r.call).map(r => r.k);
    const calls = result.rows.filter(r => r.call).map(r => r.k);
    return [...same, ...calls];
  }, [result]);

  function lock() {
    setMoving(null);
    ev(practice ? "practice_locked" : "locked", { n: getLineupNumber(), calls: callCount });
    setPhase("run");
    window.scrollTo({ top: 0, behavior: "smooth" });
    const reduce = typeof window !== "undefined" && window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return finish();
    let step = 0;
    const next = () => {
      if (step >= order.length) return finish();
      const k = order[step], call = result.rows[k].call;
      const dur = call ? 1500 : 380, t0 = performance.now();
      const frame = now => {
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 2.2);
        setLive(l => ({ ...l, [k]: e }));
        if (p < 1) raf.current = requestAnimationFrame(frame);
        else { step++; timers.current.push(setTimeout(next, call ? 450 : 90)); }
      };
      raf.current = requestAnimationFrame(frame);
    };
    timers.current.push(setTimeout(next, 500));
  }

  function finish() {
    if (raf.current) cancelAnimationFrame(raf.current);
    timers.current.forEach(clearTimeout); timers.current = [];
    setLive(Object.fromEntries(SLOTS.map((_, k) => [k, 1])));
    setPhase("done");
    const r = result;
    if (!practice) {
      const next = { ...stats };
      next.played++;
      if (r.outcome === "won") { next.wins++; next.streak++; next.best = Math.max(next.best, next.streak); }
      else if (r.outcome === "push") next.pushes = (next.pushes || 0) + 1;
      else next.streak = 0;
      next.lastNumber = getLineupNumber();
      next.calls = (next.calls || 0) + r.won;
      next.upsets = (next.upsets || 0) + r.won;
      next.fades = (next.fades || 0) + r.calls.length;
      next.bestPct = Math.max(next.bestPct ?? 0, r.pct);
      next.log = [...(next.log || []),
        { n: getLineupNumber(), o: r.outcome === "won" ? "W" : r.outcome === "push" ? "P" : "L",
          hits: r.won, v: 2 }].slice(-30);
      setStats(next); saveLineupStats(next);
      ev(r.outcome === "won" ? "won" : r.outcome === "push" ? "push" : "lost", { calls: r.won, pct: r.pct });
      try {
        fetch("/api/lineup-score", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ n: getLineupNumber(), score: r.score, calls: r.won,
            fades: r.calls.length, fadeHits: r.won, dry: isMe(), ...ident() }) })
          .then(x => x.json()).then(j => { if (j && j.ok) setField(j); }).catch(() => {});
      } catch {}
    } else {
      const next = { ...stats, recent: [puzzle.id, ...(stats.recent || [])].slice(0, 12) };
      setStats(next); saveLineupStats(next);
      ev(r.outcome === "won" ? "practice_won" : "practice_lost", { calls: r.won });
    }
  }

  function nextPractice() {
    const p = getPracticeLineup(stats.recent);
    if (!p) return;
    if (!practice) ev("practice_started", { after: getLineupNumber() });
    if (raf.current) cancelAnimationFrame(raf.current);
    timers.current.forEach(clearTimeout); timers.current = [];
    setMode("practice"); setPuzzle(p); setLineup(p.houseIds.slice()); setMoving(null); setCard(null);
    setPhase("set"); setLive({}); setField(null); setCopied(false);
    window.scrollTo(0, 0);
  }

  const shareText = r => {
    const sq = r.rows.map(x => x.outcome === "same" ? "⬜" : x.outcome === "won" ? "\u{1F7E9}"
      : x.outcome === "lost" ? "\u{1F7E5}" : "\u{1F7E8}").join("");
    const line = r.outcome === "push" ? `Push ${f1(r.score)}-${f1(puzzle.house)}`
      : `${r.outcome === "won" ? "W" : "L"} ${f1(r.score)}-${f1(puzzle.house)}`;
    const fieldLine = field && field.players >= 5 ? `\nBetter than ${field.pct}% of players today` : "";
    return `PlayDraft Start/Sit #${getLineupNumber()} · ${puzzle.season}\n${sq}\n${line} vs the House${fieldLine}`
      + `\nplaydraft.app/#/start-sit`;
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
    wrap: { maxWidth: 520, margin: "0 auto", background: C.bg, color: C.fg, fontFamily: BODY,
      paddingBottom: 110, minHeight: "100vh" },
    top: { display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: C.panel,
      borderBottom: `1px solid ${C.line}` },
    iconBtn: { width: 44, height: 44, border: 0, background: "transparent", color: C.fg, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 22 },
    label: { display: "flex", justifyContent: "space-between", padding: "16px 16px 6px", fontSize: 12,
      fontWeight: 700, letterSpacing: ".06em", color: C.muted },
    list: { background: C.panel, borderTop: `1px solid ${C.line}` },
    num: { fontVariantNumeric: "tabular-nums" },
    bar: { position: "fixed", left: 0, right: 0, bottom: 0, maxWidth: 520, margin: "0 auto",
      background: C.panel, borderTop: `1px solid ${C.line}`,
      padding: "12px 16px calc(14px + env(safe-area-inset-bottom))", zIndex: 10,
      display: "flex", flexDirection: "column", gap: 8 },
    primary: { height: 52, border: 0, borderRadius: 12, background: C.ink, color: C.onInk,
      fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, letterSpacing: ".04em", cursor: "pointer", width: "100%" },
    secondary: { height: 48, borderRadius: 12, border: `1.5px solid ${C.line}`, background: C.panel, color: C.fg,
      fontFamily: DISPLAY, fontWeight: 700, fontSize: 17, letterSpacing: ".04em", cursor: "pointer", padding: "0 16px" },
  };

  const topBar = (title, sub) => (
    <div style={s.top}>
      <button onClick={onExit} aria-label="Back to games" style={s.iconBtn}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <div style={{ flex: 1, textAlign: "center" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 21, letterSpacing: ".02em", lineHeight: 1.1 }}>{title}</div>
        {sub && <div style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>{sub}</div>}
      </div>
      {phase === "set" ? (
        <button onClick={() => setShowHow(h => !h)} aria-label="How to play" aria-expanded={showHow} style={{ ...s.iconBtn, color: C.muted }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6" /><path d="M12 17.2h.01" /></svg>
        </button>
      ) : <span style={{ width: 44 }} />}
    </div>
  );

  /* ---------------- set ---------------- */
  if (phase === "set") {
    const oppColor = r => (r <= 10 ? C.win : r >= 23 ? C.loss : C.muted);
    const chip = (v, avg) => {
      const hot = v >= avg * 1.25, cold = v <= avg * 0.7;
      return { background: hot ? (dark ? "#14532D" : "#DCFCE7") : cold ? (dark ? "#7F1D1D" : "#FEE2E2") : C.panelHi,
        color: hot ? (dark ? "#BBF7D0" : "#14532D") : cold ? (dark ? "#FECACA" : "#7F1D1D") : C.fg };
    };
    const row = (t, slotIdx) => {
      const starter = slotIdx != null;
      const sel = moving && (starter ? moving.slot === slotIdx : moving.id === t.id);
      const target = starter ? tg.slots.includes(slotIdx) : tg.bench.includes(t.id);
      const houseK = house.indexOf(t.id);
      const isCall = starter ? aligned.indexOf(t.id) >= 0 && house[aligned.indexOf(t.id)] !== t.id : houseK >= 0;
      const last3 = t.log.slice(-3).map(x => x[1]);
      const pillColor = target ? C.call : starter ? C.accent : C.dim;
      return (
        <div key={starter ? `s${slotIdx}` : t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px 10px 12px",
          borderBottom: `1px solid ${C.line}`,
          background: sel ? (dark ? "#1E293B" : "#EFF6FF") : isCall && starter ? C.callBg : C.panel }}>
          <button onClick={() => (starter ? tapSlot(slotIdx) : tapBench(t.id))}
            aria-label={`${starter ? SLOTS[slotIdx] : "Bench"}: move ${t.name}`} aria-pressed={!!sel}
            style={{ width: 52, height: 34, flex: "none", borderRadius: 17, cursor: "pointer",
              border: `1.5px solid ${pillColor}`, background: target ? C.callBg : sel ? C.accent : C.panel,
              color: sel ? C.onAccent : pillColor, fontFamily: DISPLAY, fontWeight: 700, fontSize: 15,
              boxShadow: target ? `0 0 0 3px ${dark ? "rgba(253,186,116,.25)" : "rgba(154,52,18,.15)"}` : "none" }}>
            {target ? "HERE" : starter ? SLOT_SHORT[slotIdx] : "BE"}
          </button>
          <button onClick={() => setCard(t.id)} aria-label={`${t.name} details`}
            style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, background: "none",
              border: 0, padding: 0, textAlign: "left", color: C.fg, cursor: "pointer", fontFamily: BODY }}>
            <Face t={t} />
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 16.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {t.name} <span style={{ fontSize: 12, fontWeight: 600, color: C.dim }}>{t.pos} · {t.team}</span></span>
              <span style={{ fontSize: 13, color: C.muted }}>
                {t.home ? "vs" : "@"} {t.opp} · <span style={{ color: oppColor(t.oppRank), fontWeight: 600 }}>
                  {matchup(t.oppRank)} matchup ({ord(t.oppRank)})</span></span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.muted }}>
                Last 3
                {last3.map((v, i) => <span key={i} style={{ ...chip(v, t.avg), ...s.num, minWidth: 28, textAlign: "center",
                  borderRadius: 4, padding: "1px 4px", fontWeight: 700 }}>{v.toFixed(0)}</span>)}
                <span style={{ marginLeft: 4, whiteSpace: "nowrap" }}>{t.use.toFixed(0)} {t.useLabel}/G</span>
              </span>
              {starter && isCall && <span style={{ fontSize: 12, fontWeight: 700, color: C.call }}>
                YOUR CALL · House starts {shortName(byId[house[aligned.indexOf(t.id)]].name)}</span>}
              {!starter && houseK >= 0 && <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>House starts him</span>}
            </span>
          </button>
          <span style={{ ...s.num, fontSize: 17, fontWeight: 700, color: C.fg, minWidth: 36, textAlign: "right" }}>{t.avg.toFixed(1)}</span>
        </div>
      );
    };

    const ct = card ? byId[card] : null;
    return (
      <div style={s.wrap}>
        {topBar(`START/SIT #${getLineupNumber()}`, practice ? "From the archive" : stats.played ? `${lineupRecord(stats)} vs the House` : null)}

        <header style={{ background: C.panel, padding: "14px 16px 16px", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", color: C.muted }}>THE SEASON</div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 64, lineHeight: .9, letterSpacing: "-.01em" }}>{puzzle.season}</div>
            </div>
            <div style={{ textAlign: "right", paddingBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", color: C.muted }}>WEEK</div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 40, lineHeight: .95 }}>{puzzle.week}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginTop: 14 }}>
            <div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 19 }}>Your Team</div>
              <div style={{ fontSize: 13, color: C.muted }}>Proj <b style={{ ...s.num, color: C.fg }}>{f1(myProj)}</b></div>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, borderRadius: 999, padding: "5px 10px", whiteSpace: "nowrap",
              color: callCount ? C.call : C.muted, background: callCount ? C.callBg : C.panelHi }}>
              {callCount ? `${callCount} call${callCount > 1 ? "s" : ""} vs the House` : "Same as the House"}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 19 }}>The House</div>
              <div style={{ fontSize: 13, color: C.muted }}>Proj <b style={{ ...s.num, color: C.fg }}>{f1(houseProj)}</b></div>
            </div>
          </div>
          {showHow && (
            <div style={{ marginTop: 12, fontSize: 13.5, lineHeight: 1.5, color: C.muted, background: C.panelHi,
              borderRadius: 10, padding: "10px 12px" }}>
              Every player is from Week {puzzle.week} of the {puzzle.season} season, and every card shows only
              what you'd have known at kickoff. The House starts the best season average at every slot.
              Matchup: easy means that defense has given up a lot to his position, tough means it hasn't.
              You start with his lineup: tap a slot to swap players, tap a name for his season so far.
              <br /><b style={{ color: C.fg }}>Only the slots where you differ decide the game.</b> 0.5 PPR.
            </div>
          )}
          {!showHow && <div style={{ marginTop: 10, fontSize: 13, color: C.muted, lineHeight: 1.45 }}>
            Same roster as the House. He starts the best season average. Beat him where he's wrong.</div>}
        </header>

        <div style={s.label}><span>STARTERS</span><span>AVG</span></div>
        <div style={s.list}>{lineup.map((id, k) => row(byId[id], k))}</div>
        <div style={s.label}><span>BENCH</span><span>AVG</span></div>
        <div style={s.list}>{bench.map(t => row(t))}</div>

        <div style={s.bar}>
          {moving ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, fontSize: 14, color: C.muted }}>
                Moving <b style={{ color: C.fg }}>{shortName(byId[moving.id || lineup[moving.slot]].name)}</b>. Tap a highlighted spot.</span>
              <button onClick={() => setMoving(null)} style={{ ...s.secondary, height: 44 }}>Cancel</button>
            </div>
          ) : (
            <button onClick={lock} style={s.primary}>
              {callCount ? "LOCK LINEUP & PLAY" : "PLAY THE HOUSE'S LINEUP"}</button>
          )}
        </div>

        {ct && (
          <div role="dialog" aria-modal="true" aria-label={`${ct.name}, season so far`}
            onClick={() => setCard(null)}
            style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(17,24,39,.55)",
              display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 520, background: C.panel, color: C.fg, borderRadius: "20px 20px 0 0",
                padding: "10px 18px calc(22px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 16,
                maxHeight: "88vh", overflowY: "auto" }}>
              <div style={{ width: 40, height: 5, borderRadius: 3, background: C.line, alignSelf: "center" }} />
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Face t={ct} size={56} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 28, lineHeight: 1 }}>{ct.name.toUpperCase()}</div>
                  <div style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>
                    {ct.pos} · {ct.team} · <b style={{ color: C.fg }}>{ct.season}</b>
                    {ct.age ? ` · Age ${ct.age}` : ""}{ct.yr ? ` · ${ord(ct.yr)} season` : ""}</div>
                </div>
                <button onClick={() => setCard(null)} aria-label="Close" style={{ ...s.iconBtn, background: C.panelHi, color: C.muted }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                    strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 }}>
                {[["AVG", ct.avg.toFixed(1)], ["LAST 3", ct.l3.toFixed(1)],
                  [`${ct.useLabel}/G`, ct.use.toFixed(1)], ["TEAM", ct.rec || "—"]].map(([k, v]) => (
                  <div key={k} style={{ background: C.panelHi, borderRadius: 10, padding: "8px 10px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: ".04em" }}>{k}</div>
                    <div style={{ ...s.num, fontFamily: DISPLAY, fontWeight: 800, fontSize: 24 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700,
                  letterSpacing: ".06em", color: C.muted, marginBottom: 8 }}>
                  <span>{ct.season} SO FAR</span><span>PTS BY GAME</span></div>
                {(() => {
                  const mx = Math.max(10, ...ct.log.map(x => x[1]));
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${ct.log.length},minmax(0,1fr))`,
                      gap: 4, alignItems: "end", height: 120 }}>
                      {ct.log.map(([, v], i) => (
                        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center",
                          justifyContent: "flex-end", gap: 3, height: "100%" }}>
                          <span style={{ ...s.num, fontSize: 10.5, fontWeight: 700, color: C.muted }}>{v.toFixed(0)}</span>
                          <span style={{ width: "100%", borderRadius: "3px 3px 0 0", minHeight: 2,
                            height: `${Math.max(2, (v / mx) * 92)}px`,
                            background: v >= ct.avg * 1.25 ? C.winFill : v <= ct.avg * 0.7 ? C.lossFill : C.dim }} />
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <div style={{ fontSize: 11, color: C.dim, marginTop: 4, textAlign: "center" }}>
                  {ct.log.length} games before this week. Nothing after kickoff is shown.</div>
              </div>
              <div style={{ background: C.panelHi, borderRadius: 10, padding: 12, fontSize: 15, lineHeight: 1.45 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", color: C.muted, marginBottom: 4 }}>THIS WEEK</div>
                {ct.home ? "vs" : "@"} {ct.opp}: <b style={{ color: ct.oppRank <= 10 ? C.win : ct.oppRank >= 23 ? C.loss : C.fg }}>
                  {matchup(ct.oppRank).toLowerCase()} matchup</b>. They've allowed the {ord(ct.oppRank)} most points to {ct.pos}s
                {ct.priorFinish ? <><br />Finished {ct.pos}{ct.priorFinish} in {ct.season - 1}</> : null}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {lineup.includes(ct.id) ? (
                  <button onClick={() => benchFromCard(ct.id)} style={s.secondary}>SWAP HIM OUT</button>
                ) : <button onClick={() => setCard(null)} style={s.secondary}>KEEP ON BENCH</button>}
                {lineup.includes(ct.id) ? (
                  <button onClick={() => setCard(null)} style={{ ...s.primary, height: 48, fontSize: 17, background: C.accent, color: C.onAccent }}>KEEP STARTING</button>
                ) : (
                  <button onClick={() => startFromCard(ct.id)} style={{ ...s.primary, height: 48, fontSize: 17, background: C.accent, color: C.onAccent }}>START HIM</button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ---------------- run and done ---------------- */
  const r = result;
  const shown = k => live[k] || 0;
  const meNow = r.rows.reduce((t, x) => t + x.me.pts * shown(x.k), 0);
  const hsNow = r.rows.reduce((t, x) => t + x.hs.pts * shown(x.k), 0);
  const leftCalls = r.rows.filter(x => x.call).reduce((t, x) => t + (1 - shown(x.k)), 0);
  const p = phase === "done" ? winProb(r.diff, 0) : winProb(meNow - hsNow, leftCalls);
  const done = phase === "done";
  const liveRow = order.find(k => shown(k) > 0 && shown(k) < 1);

  return (
    <div style={s.wrap}>
      {topBar(`START/SIT #${getLineupNumber()}`, null)}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.line}`, padding: "14px 16px 16px",
        position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, letterSpacing: ".03em",
          color: C.call }}>{puzzle.season} · WEEK {puzzle.week}{done ? " · FINAL" : ""}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8 }}>
          <div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 18, color: C.muted }}>The House</div>
            <div style={{ ...s.num, fontFamily: DISPLAY, fontWeight: 800, fontSize: 50, lineHeight: 1,
              color: done && r.outcome === "won" ? C.dim : C.fg }}>{f1(hsNow)}</div>
            <div style={{ fontSize: 12.5, color: C.muted }}>Proj {f1(houseProj)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 18 }}>Your Team</div>
            <div style={{ ...s.num, fontFamily: DISPLAY, fontWeight: 800, fontSize: 50, lineHeight: 1,
              color: meNow > hsNow + 0.05 ? C.win : done && r.outcome === "lost" ? C.dim : C.fg }}>{f1(meNow)}</div>
            <div style={{ fontSize: 12.5, color: C.muted }}>Proj {f1(myProj)}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12.5, fontWeight: 700 }}>
          <span style={{ ...s.num, color: C.muted, minWidth: 34 }}>{Math.round((1 - p) * 100)}%</span>
          <div role="img" aria-label={`Your win probability ${Math.round(p * 100)} percent`}
            style={{ flex: 1, height: 8, borderRadius: 4, background: C.line, overflow: "hidden", display: "flex" }}>
            <div style={{ width: `${(1 - p) * 100}%`, background: C.dim, transition: "width .25s ease" }} />
            <div style={{ flex: 1, background: C.winFill }} />
          </div>
          <span style={{ ...s.num, color: C.win, minWidth: 34, textAlign: "right" }}>{Math.round(p * 100)}%</span>
        </div>
      </div>

      {done && (
        <div style={{ padding: "16px 16px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.ink, color: C.onInk,
            borderRadius: 12, padding: "12px 14px" }}>
            <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, background: C.onInk, color: C.ink,
              borderRadius: 6, padding: "0 9px" }}>{r.outcome === "won" ? "W" : r.outcome === "lost" ? "L" : "T"}</span>
            <span style={{ fontSize: 16, fontWeight: 600 }}>
              {r.outcome === "won" ? `You beat the House by ${f1(r.diff)}`
                : r.outcome === "lost" ? `The House won by ${f1(-r.diff)}`
                : r.calls.length ? "Dead even with the House" : "You started the House's lineup. Push."}</span>
          </div>
          <div style={{ fontSize: 13.5, color: C.muted, marginTop: 10, lineHeight: 1.45 }}>
            Your lineup beat {r.pct}% of the {r.n} lineups you could have set.
            {field && field.players >= 5 ? ` Better than ${field.pct}% of the ${field.players} players today.` : ""}
            {!practice && ` You're ${lineupRecord(stats)} against the House.`}
          </div>
        </div>
      )}

      {done && r.calls.length > 0 && (
        <>
          <div style={s.label}><span>YOUR CALLS</span><span>SWING</span></div>
          <div style={s.list}>
            {r.calls.map(x => {
              const d = x.me.pts - x.hs.pts;
              return (
                <div key={x.k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                  borderBottom: `1px solid ${C.line}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>Started {shortName(x.me.name)} over {shortName(x.hs.name)}</div>
                    <div style={{ ...s.num, fontSize: 13, color: C.muted }}>{f1(x.me.pts)} vs {f1(x.hs.pts)} at {SLOT_SHORT[x.k]}</div>
                  </div>
                  <div style={{ ...s.num, fontFamily: DISPLAY, fontWeight: 800, fontSize: 22,
                    color: d > 0 ? C.win : d < 0 ? C.loss : C.muted }}>{d > 0 ? "+" : ""}{f1(d)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div style={s.label}><span>{done ? "BOX SCORE" : "SCORING"}</span><span /></div>
      <div style={s.list}>
        {order.map(k => {
          const x = r.rows[k], e = shown(k), settled = e >= 1, isLive = k === liveRow;
          const meCol = !x.call ? C.dim : !settled ? C.fg : x.outcome === "won" ? C.win : x.outcome === "lost" ? C.loss : C.fg;
          const hsCol = !x.call ? C.dim : C.fg;
          return (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 54px minmax(0,1fr)",
              borderBottom: `1px solid ${C.line}`, background: x.call ? C.panel : C.panelHi,
              opacity: e === 0 && !done ? 0.55 : 1, transition: "opacity .2s ease" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "10px 8px 10px 14px", minWidth: 0 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: x.call ? C.fg : C.dim,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shortName(x.hs.name)}</div>
                  {done && <div style={{ fontSize: 11, color: C.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{statLine(x.hs.stats)}</div>}
                </div>
                <div style={{ ...s.num, fontSize: 17, fontWeight: 700, color: hsCol }}>{e ? f1(x.hs.pts * e) : "–"}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                background: x.call ? C.callFill : C.line, color: x.call ? "#fff" : C.muted,
                fontFamily: DISPLAY, fontWeight: 700, fontSize: 15 }}>
                <span>{SLOT_SHORT[k]}</span>
                {isLive && <span style={{ fontSize: 9.5, letterSpacing: ".1em" }}>LIVE</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "10px 14px 10px 8px", minWidth: 0 }}>
                <div style={{ ...s.num, fontSize: 17, fontWeight: 700, color: meCol }}>{e ? f1(x.me.pts * e) : "–"}</div>
                <div style={{ minWidth: 0, textAlign: "right" }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: x.call ? C.fg : C.dim,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shortName(x.me.name)}</div>
                  {done && <div style={{ fontSize: 11, color: C.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{statLine(x.me.stats)}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "8px 16px 0", fontSize: 12.5, color: C.muted }}>
        Gray rows: same start for both. Only your calls move the score.</div>

      {done && (
        <div style={{ padding: "18px 16px 0" }}>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", color: C.muted, marginBottom: 8 }}>SHARE PREVIEW</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>PlayDraft Start/Sit #{getLineupNumber()} · {puzzle.season}</div>
            <div style={{ display: "flex", gap: 6, margin: "8px 0" }}>
              {r.rows.map(x => (
                <div key={x.k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 6,
                    background: x.outcome === "same" ? C.same : x.outcome === "won" ? C.winFill : x.outcome === "lost" ? C.lossFill : "#EAB308" }} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>{SLOT_SHORT[x.k]}</div>
                </div>
              ))}
            </div>
            <div style={{ ...s.num, fontSize: 15 }}>{r.outcome === "won" ? "W" : r.outcome === "lost" ? "L" : "Push"} {f1(r.score)}–{f1(puzzle.house)} vs the House</div>
          </div>
          {!practice && (
            <button onClick={() => share(r)} style={{ ...s.primary, marginTop: 14, background: C.accent, color: C.onAccent }}>
              {copied ? "COPIED. GO PASTE IT" : "SEND IT TO THE GROUP CHAT"}</button>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            {hasLineupArchive() && <button onClick={nextPractice} style={{ ...s.secondary, flex: 1 }}>
              {practice ? "ANOTHER LINEUP" : "PLAY ONE FROM THE ARCHIVE"}</button>}
            {practice && <button style={{ ...s.secondary, flex: 1 }} onClick={onExit}>BACK TO GAMES</button>}
          </div>
          {onCrossPromo && <div style={{ marginTop: 13 }}>{onCrossPromo()}</div>}
        </div>
      )}

      {phase === "run" && (
        <div style={s.bar}>
          <button style={s.secondary} onClick={finish}>SKIP TO FINAL</button>
        </div>
      )}
    </div>
  );
}
