import { useState, useEffect, useRef, useMemo } from "react";
import { LINEUP_BANK } from "./lineupBank";
import { getLineupNumber, loadLineupStats, saveLineupStats, lineupRecord } from "./lineupMeta";

/* ------------------------------------------------------------------ *
 * Start/Sit — nine fantasy calls a day.
 *
 * Every call is two real player-weeks. The House always starts whoever has
 * the higher season average; you beat him by spotting where he's wrong.
 * Cards show only what a manager knew at kickoff (see scripts/mine_lineups.py).
 *
 * Luck is real in fantasy, so the score that matters is relative: how your
 * lineup ranks against all 512 lineups you could have set, and against
 * everyone who played today. Same players, same outcomes, so luck cancels.
 *
 * Own storage key, own events (lineup_*), separate from Four Downs.
 * ------------------------------------------------------------------ */

const IMG = "https://static.www.nfl.com/image/";
const GROUPS = [["QB", [0]], ["RB", [1, 2]], ["WR", [3, 4, 5]], ["TE", [6]], ["FLEX", [7, 8]]];
const SHORT = { QB: "QB", RB: "RB", WR: "WR", TE: "TE", FLEX: "FX" };

const theme = dark => dark ? {
  bg: "#0a0a0a", panel: "#141414", panelHi: "#1c1c1c", line: "#2a2a2a",
  fg: "#d4c9b8", muted: "#8a8a8a", dim: "#5f5f5f",
  blue: "#3FA7D6", onBlue: "#0f1923", grass: "#4A9C69", brick: "#C0394B", gold: "#C8A96E",
} : {
  bg: "#faf7f0", panel: "#fff", panelHi: "#f4efe4", line: "#ddd6c4",
  fg: "#1a1a2e", muted: "#666", dim: "#949494",
  blue: "#2B7FA8", onBlue: "#fff", grass: "#2E6B3E", brick: "#8B1A2A", gold: "#9A7A3C",
};
const DISPLAY = "'Bebas Neue',cursive";
const BODY = "'Crimson Pro',Georgia,serif";

const CLUB = {
  ARI:"#97233F",ATL:"#A71930",BAL:"#241773",BUF:"#00338D",CAR:"#0085CA",CHI:"#C83803",
  CIN:"#FB4F14",CLE:"#FF3C00",DAL:"#7F9695",DEN:"#FB4F14",DET:"#0076B6",GB:"#FFB612",
  HOU:"#A71930",IND:"#0058A3",JAX:"#9F792C",KC:"#E31837",LA:"#866D4B",LAC:"#0080C6",
  LAR:"#866D4B",LV:"#A5ACAF",MIA:"#008E97",MIN:"#FFC62F",NE:"#C60C30",NO:"#D3BC8D",
  NYG:"#0B2265",NYJ:"#12674A",OAK:"#A5ACAF",PHI:"#A5ACAF",PIT:"#FFB612",SD:"#0080C6",
  SEA:"#69BE28",SF:"#AA0000",STL:"#866D4B",TB:"#D50A0A",TEN:"#4B92DB",WAS:"#FFB612",
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
const slotLabel = (puzzle, i) => {
  const slot = puzzle.pairs[i].slot;
  const same = puzzle.pairs.map((p, k) => [p.slot, k]).filter(([s]) => s === slot);
  return same.length > 1 ? `${slot} ${same.findIndex(([, k]) => k === i) + 1}` : slot;
};
const houseTile = p => p.tiles.find(t => t.id === p.house);
const winner = p => (p.tiles[0].pts >= p.tiles[1].pts ? p.tiles[0] : p.tiles[1]);

/* Every lineup you could have set (2^9 = 512), so a score can be read as
   "better than X% of possible lineups". Same outcomes for everyone. */
function lineupPercentile(puzzle, score) {
  let sums = [0];
  puzzle.pairs.forEach(p => {
    const next = [];
    sums.forEach(s => p.tiles.forEach(t => next.push(s + t.pts)));
    sums = next;
  });
  const r = x => Math.round(x * 10);
  const below = sums.filter(s => r(s) < r(score)).length;
  const ties = sums.filter(s => r(s) === r(score)).length;
  return Math.round(((below + (ties - 1) / 2) / (sums.length - 1)) * 100);
}

/* The box score fills in as the number climbs. */
function tickLine(s, e) {
  const out = [], yd = v => Math.round(v * e);
  const sc = (n, at) => Math.floor(Math.min(n, n * ((e - at) / (1 - at)) + 1e-9));
  if (s.pass) {
    const [c, a, y, td, i] = s.pass;
    out.push(`${Math.round(c * e)}/${Math.round(a * e)}, ${yd(y)} yd`);
    const t = td ? sc(td, 0.25) : 0; if (t) out.push(`${t} TD`);
    const n = i ? sc(i, 0.4) : 0; if (n) out.push(`${n} INT`);
  }
  if (s.rush) {
    const [c, y, td] = s.rush;
    out.push(`${Math.round(c * e)} car, ${yd(y)} yd`);
    const t = td ? sc(td, 0.3) : 0; if (t) out.push(`${t} TD`);
  }
  if (s.rec) {
    const [r, , y, td] = s.rec;
    out.push(`${Math.round(r * e)} rec, ${yd(y)} yd`);
    const t = td ? sc(td, 0.35) : 0; if (t) out.push(`${t} TD`);
  }
  if (s.fum && e > 0.6) out.push(`${s.fum} fum`);
  return out.join(" · ");
}

/* NFL's CDN serves originals at 1400-3400px; ask for a 120px face crop.
   Initials sit underneath so a missing photo looks deliberate. */
function Face({ t, size = 46 }) {
  const [step, setStep] = useState(0);
  const src = !t.shot ? null
    : step === 0 ? `${IMG}${t.shot.replace(/^(upload|private)\//, "$1/c_fill,g_face,w_120,h_120,")}`
    : `${IMG}${t.shot}`;
  return (
    <span style={{ width: size, height: size, borderRadius: 3, flex: "none", position: "relative",
      overflow: "hidden", background: CLUB[t.team] || "#777",
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: size * 0.38,
        color: "#fff", opacity: .85 }}>{initials(t.name)}</span>
      {src && step < 2 && (
        <img alt="" decoding="async" referrerPolicy="no-referrer" src={src}
          onError={() => setStep(step + 1)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "top center" }} />
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
  const [picks, setPicks] = useState({});        // pair index -> tile id
  const [phase, setPhase] = useState("set");     // set | run | done
  const [live, setLive] = useState({});          // tile id -> reveal progress 0..1
  const [openGroups, setOpenGroups] = useState([]);
  const [me, setMe] = useState(0);
  const [hs, setHs] = useState(0);
  const [clock, setClock] = useState("");
  const [copied, setCopied] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [field, setField] = useState(null);      // { players, pct } from today's players
  const [stats, setStats] = useState(loadLineupStats);
  const raf = useRef(null);
  const timers = useRef([]);
  const pairRefs = useRef([]);
  const practice = mode === "practice";

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    timers.current.forEach(clearTimeout);
  }, []);
  useEffect(() => { ev(practice ? "practice_opened" : "opened", { n: getLineupNumber() }); }, [practice]);

  const filled = Object.keys(picks).length;
  const ready = filled === puzzle.pairs.length;
  const fades = puzzle.pairs.filter((p, i) => picks[i] && picks[i] !== p.house).length;

  function pick(i, id) {
    const wasEmpty = !picks[i];
    setPicks(prev => ({ ...prev, [i]: id }));   // functional: quick taps must not overwrite each other
    if (!wasEmpty) return;
    // move on to the next open call
    const next = puzzle.pairs.findIndex((_, k) => k > i && !picks[k]);
    const el = next >= 0 && pairRefs.current[next];
    if (el && el.scrollIntoView) {
      timers.current.push(setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 220));
    }
  }

  const result = useMemo(() => {
    if (!ready) return null;
    let score = 0, hits = 0, fadesTried = 0, fadesHit = 0;
    const calls = puzzle.pairs.map((p, i) => {
      const t = p.tiles.find(x => x.id === picks[i]);
      const right = t.id === winner(p).id;
      const fade = t.id !== p.house;
      score += t.pts; if (right) hits++;
      if (fade) { fadesTried++; if (right) fadesHit++; }
      return { t, right, fade, other: p.tiles.find(x => x.id !== t.id) };
    });
    score = Math.round(score * 10) / 10;
    const diff = Math.round((score - puzzle.house) * 10) / 10;
    return { score, hits, fadesTried, fadesHit, calls, diff,
      outcome: diff > 0 ? "won" : diff < 0 ? "lost" : "push",
      pct: lineupPercentile(puzzle, score) };
  }, [ready, picks, puzzle]);

  function lock() {
    if (!ready) return;
    ev(practice ? "practice_locked" : "locked", { n: getLineupNumber() });
    setPhase("run");
    window.scrollTo({ top: 0, behavior: "smooth" });
    const reduce = typeof window !== "undefined" && window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return finish();

    let bm = 0, bh = 0, g = 0;
    const step = () => {
      if (g >= GROUPS.length) { setClock("Final"); return finish(); }
      const [label, idx] = GROUPS[g];
      setOpenGroups(o => [...o, label]);
      setClock(label === "FLEX" ? "Flex is on the field" : `${label}s are playing`);
      const tiles = idx.flatMap(i => puzzle.pairs[i].tiles);
      const mine = idx.reduce((s, i) => s + puzzle.pairs[i].tiles.find(t => t.id === picks[i]).pts, 0);
      const his = idx.reduce((s, i) => s + houseTile(puzzle.pairs[i]).pts, 0);
      const t0 = performance.now(), dur = 1500;
      const frame = now => {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 2.1);
        setLive(l => { const n = { ...l }; tiles.forEach(t => { n[t.id] = e; }); return n; });
        setMe(bm + mine * e); setHs(bh + his * e);
        if (k < 1) raf.current = requestAnimationFrame(frame);
        else { bm += mine; bh += his; g++; timers.current.push(setTimeout(step, 380)); }
      };
      raf.current = requestAnimationFrame(frame);
    };
    timers.current.push(setTimeout(step, 450));
  }

  function finish() {
    const r = result;
    const done = {}; puzzle.pairs.forEach(p => p.tiles.forEach(t => { done[t.id] = 1; }));
    setLive(done);
    setOpenGroups(GROUPS.map(g => g[0]));
    setMe(r.score); setHs(puzzle.house); setClock("Final");
    setPhase("done");

    if (!practice) {
      const next = { ...stats };
      next.played++;
      if (r.outcome === "won") { next.wins++; next.streak++; next.best = Math.max(next.best, next.streak); }
      else if (r.outcome === "push") next.pushes = (next.pushes || 0) + 1;
      else next.streak = 0;
      next.lastNumber = getLineupNumber();
      setStats(next); saveLineupStats(next);
      ev(r.outcome === "won" ? "won" : r.outcome === "push" ? "push" : "lost",
         { calls: r.hits, pct: r.pct });
      // Rank against everyone who played this lineup. The owner's plays are
      // read-only (dry) so they never move the field.
      try {
        fetch("/api/lineup-score", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ n: getLineupNumber(), score: r.score, calls: r.hits,
            fades: r.fadesTried, fadeHits: r.fadesHit, dry: isMe(), ...ident() }) })
          .then(x => x.json()).then(j => { if (j && j.ok) setField(j); }).catch(() => {});
      } catch {}
    } else {
      const next = { ...stats, recent: [puzzle.id, ...stats.recent].slice(0, 12) };
      setStats(next); saveLineupStats(next);
      ev(r.outcome === "won" ? "practice_won" : "practice_lost", { calls: r.hits });
    }
  }

  function nextPractice() {
    const p = getPracticeLineup(stats.recent);
    if (!p) return;
    if (!practice) ev("practice_started", { after: getLineupNumber() });
    if (raf.current) cancelAnimationFrame(raf.current);
    timers.current.forEach(clearTimeout); timers.current = [];
    setMode("practice"); setPuzzle(p); setPicks({}); setPhase("set"); setField(null);
    setLive({}); setOpenGroups([]); setMe(0); setHs(0); setClock(""); setCopied(false);
    window.scrollTo(0, 0);
  }

  /* the single call that mattered most */
  const bigCall = r => {
    const fadesHit = r.calls.filter(c => c.fade && c.right);
    if (fadesHit.length) {
      const c = [...fadesHit].sort((a, b) => (b.t.pts - b.other.pts) - (a.t.pts - a.other.pts))[0];
      return { good: true, c };
    }
    const misses = r.calls.filter(c => !c.right);
    if (!misses.length) return null;
    return { good: false, c: [...misses].sort((a, b) => (b.other.pts - b.t.pts) - (a.other.pts - a.t.pts))[0] };
  };

  const headline = r => {
    if (r.hits === 9) return "Nine for nine.";
    if (r.outcome === "push") return "Matched the House call for call.";
    if (r.fadesHit >= 3) return "Saw the upsets coming.";
    if (r.outcome === "won") return r.fadesHit ? "Faded the House and got paid." : "Ugly, but a win is a win.";
    if (r.fadesTried && !r.fadesHit) return "Every fade went the House's way.";
    return "The House had the better week.";
  };

  const shareText = r => {
    const rows = GROUPS.map(([label, idx]) => `${SHORT[label]} ${idx.map(i => {
      const c = r.calls[i];
      return !c.right ? "\u{1F7E5}" : c.fade ? "\u{1F3AF}" : "\u{1F7E9}";
    }).join("")}`).join("\n");
    const vs = r.outcome === "push" ? "push with the House"
      : `${r.diff > 0 ? "+" : ""}${f1(r.diff)} vs the House`;
    const fieldLine = field && field.players >= 5 ? `\nBetter than ${field.pct}% of players today` : "";
    return `Start/Sit #${getLineupNumber()}\n${rows}\n${r.hits}/9 calls · ${vs}`
      + `\nBeat ${r.pct}% of possible lineups${fieldLine}\nplaydraft.app/#/start-sit`;
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
    wrap: { maxWidth: 520, margin: "0 auto", background: C.bg, color: C.fg,
      fontFamily: BODY, paddingBottom: 96, minHeight: "100vh" },
    top: { display: "flex", alignItems: "center", gap: 12, padding: "13px 16px",
      borderBottom: `1px solid ${C.line}` },
    mark: { fontFamily: DISPLAY, fontSize: 20, fontWeight: 700, flex: 1 },
    ghostBtn: { border: `1px solid ${C.line}`, borderRadius: 3, padding: "10px 18px",
      fontFamily: DISPLAY, fontSize: 16, color: C.muted, background: "none", cursor: "pointer" },
    solidBtn: { border: 0, borderRadius: 3, padding: "11px 20px",
      fontFamily: DISPLAY, fontSize: 18, background: C.blue, color: C.onBlue, cursor: "pointer" },
    bar: { position: "fixed", left: 0, right: 0, bottom: 0, maxWidth: 520, margin: "0 auto",
      background: C.panelHi, borderTop: `1px solid ${C.line}`,
      padding: "11px 16px calc(11px + env(safe-area-inset-bottom))",
      display: "flex", gap: 12, alignItems: "center", zIndex: 10 },
    num: { fontVariantNumeric: "tabular-nums" },
    tag: { fontSize: 9.5, fontWeight: 700, letterSpacing: ".04em", padding: "1px 5px",
      borderRadius: 2, fontFamily: BODY, flex: "none" },
  };
  const topBar = right => (
    <div style={s.top}>
      <button onClick={onExit} style={{ background: "none", border: 0, color: C.muted,
        fontSize: 13, fontWeight: 600, cursor: "pointer" }}>← Games</button>
      <span style={s.mark}>START<span style={{ color: C.blue }}>/</span>SIT</span>
      {right}
    </div>
  );

  /* ---------------- set ---------------- */
  if (phase === "set") return (
    <div style={s.wrap}>
      {topBar(<span style={{ fontSize: 12, color: C.dim, fontWeight: 600 }}>
        {practice ? "Archive" : stats.played ? lineupRecord(stats) : ""}</span>)}

      <header style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${C.line}` }}>
        {practice && <div style={{ display: "inline-block", fontSize: 11, fontWeight: 700,
          background: C.line, color: C.muted, padding: "3px 7px", borderRadius: 2, marginBottom: 9 }}>
          FROM THE ARCHIVE</div>}
        <h1 style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 700, lineHeight: 1, marginBottom: 10 }}>
          Nine calls. Beat the House.</h1>
        <div style={{ background: C.panelHi, border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.gold}`,
          borderRadius: 3, padding: "10px 12px", fontSize: 14, lineHeight: 1.45 }}>
          The House always starts the player with the higher season average.
          Follow him and you push. <b>Beat him by finding the calls where he's wrong.</b>
        </div>
        <button onClick={() => setShowHow(h => !h)}
          style={{ background: "none", border: 0, cursor: "pointer", padding: "9px 0 0",
            fontFamily: DISPLAY, fontSize: 12, letterSpacing: "2px", color: C.dim }}>
          READING THE CARDS {showHow ? "▲" : "▼"}
        </button>
        {showHow && (
          <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.55 }}>
            Every player is a real week from a real season, and the card shows only what you'd
            have known at kickoff.<br />
            <b>AVG</b> points per game this season, the only thing the House looks at.{" "}
            <b>L3</b> points per game over his last three.{" "}
            <b>TCH / TGT / ATT</b> touches, targets or dropbacks per game, last three.{" "}
            <b>OPP</b> how generous the defense has been to his position, 1st is the softest.{" "}
            <b>VEGAS</b> points his team was expected to score.<br />
            0.5 PPR. Each call goes to whoever actually scored more that week.
          </div>
        )}
      </header>

      {puzzle.pairs.map((p, i) => (
        <section key={i} ref={el => { pairRefs.current[i] = el; }}
          style={{ borderBottom: `1px solid ${C.line}`, padding: "12px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
            marginBottom: 7 }}>
            <span style={{ fontFamily: DISPLAY, fontSize: 19, letterSpacing: "1px" }}>{slotLabel(puzzle, i)}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700,
              color: picks[i] && picks[i] !== p.house ? C.gold : C.dim }}>
              {!picks[i] ? "START ONE" : picks[i] === p.house ? "WITH THE HOUSE" : "FADING THE HOUSE"}</span>
          </div>
          {p.tiles.map((t, k) => (
            <div key={t.id}>
              {k === 1 && <div style={{ textAlign: "center", fontSize: 11, color: C.dim,
                fontStyle: "italic", margin: "-1px 0 2px" }}>or</div>}
              <Card t={t} C={C} s={s} house={t.id === p.house}
                on={picks[i] === t.id} off={!!picks[i] && picks[i] !== t.id}
                onClick={() => pick(i, t.id)} />
            </div>
          ))}
        </section>
      ))}

      <div style={s.bar}>
        <span style={{ fontSize: 13, flex: 1, lineHeight: 1.3, color: C.muted }}>
          <b style={{ color: C.fg }}>{filled}/9</b> calls
          {fades ? <> · <b style={{ color: C.gold }}>{fades}</b> against the House</> : ""}
          {ready && <><br />No changes after this.</>}
        </span>
        <button onClick={lock} disabled={!ready}
          style={{ ...s.solidBtn, background: ready ? C.blue : C.panel,
            color: ready ? C.onBlue : C.dim, cursor: ready ? "pointer" : "not-allowed" }}>
          Lock lineup</button>
      </div>
    </div>
  );

  /* ---------------- run and result ---------------- */
  const r = phase === "done" ? result : null;
  const big = r ? bigCall(r) : null;

  return (
    <div style={s.wrap}>
      {topBar(null)}

      <div style={{ position: "sticky", top: 0, zIndex: 5, background: C.panelHi,
        borderBottom: `1px solid ${C.line}`, padding: "10px 16px", display: "grid",
        gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10 }}>
        <Score C={C} label="YOU" value={me} color={C.blue} />
        <span style={{ fontSize: 12, color: C.dim, fontWeight: 600 }}>vs</span>
        <Score C={C} label="THE HOUSE" value={hs} />
        <div style={{ gridColumn: "1/-1", textAlign: "center", fontSize: 12, color: C.muted,
          borderTop: `1px solid ${C.line}`, paddingTop: 6, minHeight: 16 }}>{clock}</div>
      </div>

      {r && (
        <div style={{ padding: "18px 16px 6px" }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 32, lineHeight: 1.05,
            color: r.outcome === "won" ? C.grass : r.outcome === "push" ? C.gold : C.brick }}>
            {r.outcome === "won" ? "You beat the House" : r.outcome === "push" ? "Push" : "The House got you"}</div>
          <div style={{ fontSize: 15, marginTop: 3 }}>{headline(r)}{" "}
            <span style={{ color: C.muted }}>
              {r.outcome === "push" ? "Same score." : `${r.outcome === "won" ? "By" : "Short by"} ${f1(Math.abs(r.diff))}.`}
            </span></div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7, margin: "13px 0 6px" }}>
            <Big C={C} label="CALLS RIGHT" value={`${r.hits}/9`} />
            <Big C={C} label="UPSETS CALLED" value={`${r.fadesHit}/${r.fadesTried}`}
              color={r.fadesHit ? C.gold : undefined} />
            <Big C={C} label="LINEUPS BEATEN" value={`${r.pct}%`} color={C.blue} />
          </div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.45 }}>
            Your nine calls beat {r.pct}% of the 512 lineups you could have set.
            {field && field.players >= 5 ? ` Better than ${field.pct}% of the ${field.players} players today.` : ""}
            {!practice && ` You're ${lineupRecord(stats)} against the House.`}
          </div>

          {big && (
            <Note C={C} accent={big.good ? C.gold : C.brick}>
              {big.good
                ? <>Best call: <b>{big.c.t.name}</b> over {big.c.other.name}. The House sat him,
                    and he won the call by {f1(big.c.t.pts - big.c.other.pts)}.</>
                : <>Costliest call: <b>{big.c.t.name}</b> over {big.c.other.name}, a{" "}
                    {f1(big.c.other.pts - big.c.t.pts)}-point swing.</>}
            </Note>
          )}

          {!practice && (
            <button onClick={() => share(r)}
              style={{ width: "100%", marginTop: 14, fontFamily: DISPLAY, fontSize: 19,
                letterSpacing: "3px", padding: "17px 0", background: C.blue, color: C.onBlue,
                border: 0, borderRadius: 10, cursor: "pointer", boxShadow: "0 4px 20px rgba(63,167,214,0.35)" }}>
              {copied ? "COPIED. GO PASTE IT" : "SEND IT TO THE GROUP CHAT"}
            </button>
          )}
          <div style={{ display: "flex", gap: 9, marginTop: 12, flexWrap: "wrap" }}>
            {hasLineupArchive() && <button onClick={nextPractice} style={practice ? s.solidBtn : s.ghostBtn}>
              {practice ? "Another lineup" : "Play one from the archive"}</button>}
            {practice && <button style={s.ghostBtn} onClick={onExit}>Back to games</button>}
          </div>
          {onCrossPromo && <div style={{ marginTop: 13 }}>{onCrossPromo()}</div>}
          <div style={{ fontFamily: DISPLAY, fontSize: 12, letterSpacing: "2px", color: C.dim,
            margin: "20px 0 0" }}>THE BOX SCORE</div>
        </div>
      )}

      {GROUPS.map(([label, idx]) => {
        const open = openGroups.includes(label);
        return (
          <section key={label} style={{ borderBottom: `1px solid ${C.line}`, padding: "10px 16px",
            opacity: open ? 1 : 0.3, transition: "opacity .4s ease" }}>
            {idx.map(i => {
              const p = puzzle.pairs[i];
              const mine = p.tiles.find(t => t.id === picks[i]);
              const rows = [mine, p.tiles.find(t => t.id !== picks[i])];
              const settled = p.tiles.every(t => (live[t.id] || 0) >= 1);
              const right = mine.id === winner(p).id, fade = mine.id !== p.house;
              const badge = !settled ? null
                : right && fade ? ["UPSET CALLED", C.gold]
                : right ? ["RIGHT CALL", C.grass]
                : fade ? ["HOUSE WAS RIGHT", C.brick]
                : ["UPSET MISSED", C.brick];
              return (
                <div key={i} style={{ padding: "4px 0 8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    marginBottom: 3 }}>
                    <span style={{ fontFamily: DISPLAY, fontSize: 16, letterSpacing: "1px", color: C.muted }}>
                      {slotLabel(puzzle, i)}</span>
                    {badge && <span style={{ ...s.tag, background: badge[1], color: "#fff" }}>{badge[0]}</span>}
                  </div>
                  {rows.map(t => {
                    const on = t.id === mine.id, e = live[t.id] || 0;
                    return (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 9,
                        padding: "3px 0", opacity: on ? 1 : 0.5 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, flex: "none",
                          background: !on ? "transparent" : settled ? (right ? C.grass : C.brick) : C.line }} />
                        <Face t={t} size={32} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontFamily: DISPLAY, fontSize: 17, lineHeight: 1.15, display: "flex",
                            alignItems: "center", gap: 6, whiteSpace: "nowrap", overflow: "hidden" }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                            {t.id === p.house && <span style={{ ...s.tag, background: C.line, color: C.muted }}>HOUSE</span>}
                          </span>
                          <span style={{ display: "block", fontSize: 12, color: C.muted, lineHeight: 1.3,
                            minHeight: 15 }}>
                            {e >= 1 ? `${tickLine(t.stats, 1)} · ${t.pos}${t.weekRank} that week`
                                    : tickLine(t.stats, e)}</span>
                        </span>
                        <span style={{ ...s.num, fontSize: 18, fontWeight: 700, minWidth: 48,
                          textAlign: "right" }}>{f1(t.pts * e)}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </section>
        );
      })}

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

function Card({ t, C, s, house, on, off, onClick }) {
  const oppCol = t.oppRank <= 10 ? C.grass : t.oppRank >= 23 ? C.brick : C.fg;
  return (
    <button onClick={onClick} aria-pressed={on}
      style={{ display: "flex", gap: 10, textAlign: "left", width: "100%", color: C.fg,
        background: on ? C.panelHi : C.panel, border: `1px solid ${on ? C.blue : C.line}`,
        borderLeft: `4px solid ${on ? C.blue : C.line}`, borderRadius: 3,
        padding: "9px 10px 9px 9px", cursor: "pointer", opacity: off ? 0.55 : 1,
        transition: "opacity .15s ease", marginBottom: 3, fontFamily: BODY }}>
      <Face t={t} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: DISPLAY, fontSize: 20, lineHeight: 1.05, color: on ? C.blue : C.fg,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
          {house && <span style={{ ...s.tag, background: C.gold, color: "#fff" }}>HOUSE</span>}
          {on && <span style={{ ...s.tag, background: C.blue, color: C.onBlue, marginLeft: "auto" }}>START</span>}
        </span>
        <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 1 }}>
          {t.season} · Week {t.week} · {t.team} {t.home ? "vs" : "@"} {t.opp}</span>
        <span style={{ display: "grid", gridTemplateColumns: "repeat(5,auto)", justifyContent: "space-between",
          gap: 6, marginTop: 6 }}>
          <Stat C={C} label="AVG" value={t.avg.toFixed(1)} />
          <Stat C={C} label="L3" value={t.l3.toFixed(1)} />
          <Stat C={C} label={`${t.useLabel}/G`} value={t.use.toFixed(1)} />
          <Stat C={C} label="OPP" value={ord(t.oppRank)} color={oppCol} />
          <Stat C={C} label="VEGAS" value={t.imp.toFixed(1)} />
        </span>
      </span>
    </button>
  );
}

function Stat({ label, value, color, C }) {
  return (
    <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
      <i style={{ fontStyle: "normal", fontSize: 9.5, color: C.dim, fontWeight: 700, letterSpacing: ".03em" }}>{label}</i>
      <b style={{ fontSize: 14.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: color || C.fg }}>{value}</b>
    </span>
  );
}

function Score({ label, value, color, C }) {
  return (
    <div style={{ textAlign: "center" }}>
      <i style={{ fontStyle: "normal", display: "block", fontSize: 11, color: C.dim, fontWeight: 600 }}>{label}</i>
      <b style={{ fontFamily: DISPLAY, fontSize: 34, lineHeight: 1, display: "block",
        fontVariantNumeric: "tabular-nums", color: color || C.fg }}>{f1(value)}</b>
    </div>
  );
}

function Big({ label, value, color, C }) {
  return (
    <div style={{ background: C.panelHi, border: `1px solid ${C.line}`, borderRadius: 3,
      padding: "8px 6px", textAlign: "center" }}>
      <b style={{ fontFamily: DISPLAY, fontSize: 25, lineHeight: 1, display: "block",
        fontVariantNumeric: "tabular-nums", color: color || C.fg }}>{value}</b>
      <i style={{ fontStyle: "normal", fontSize: 10, color: C.dim, fontWeight: 700 }}>{label}</i>
    </div>
  );
}

function Note({ children, C, accent }) {
  return (
    <div style={{ background: C.panelHi, border: `1px solid ${C.line}`, borderLeft: `3px solid ${accent || C.blue}`,
      borderRadius: 2, padding: "10px 12px", marginTop: 12, fontSize: 13.5, lineHeight: 1.5 }}>
      {children}
    </div>
  );
}
