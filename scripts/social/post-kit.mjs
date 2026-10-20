// Daily "from the vault" social post kit for PlayDraft Start/Sit.
//
// Picks the biggest single-game fantasy line from a week in the lineup bank
// that has already been released as a daily (so the link never spoils today),
// skipping weeks already posted. Writes card.html + caption.txt + meta.json to
// the output dir; render.py turns card.html into card.png.
//
//   node scripts/social/post-kit.mjs <outDir> [--dry]
//
// --dry leaves scripts/social/posted.json untouched (for previews).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { LINEUP_BANK } from "../../src/lineupBank.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || "post-kit";
const dry = process.argv.includes("--dry");
fs.mkdirSync(out, { recursive: true });

// Same day numbering as src/lineupMeta.js (launch Sep 7 2026), in ET.
const etDay = d => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const today = daysBetween("2026-09-07", etDay(new Date())) + 1;
const released = Math.min(today - 1, LINEUP_BANK.length);

const postedPath = path.join(here, "posted.json");
const posted = fs.existsSync(postedPath) ? JSON.parse(fs.readFileSync(postedPath, "utf8")) : [];
const used = new Set(posted.map(p => p.n));

const candidates = [];
for (let n = 1; n <= released; n++) {
  if (used.has(n)) continue;
  const wk = LINEUP_BANK[n - 1];
  const hero = [...wk.tiles].sort((a, b) => b.pts - a.pts)[0];
  candidates.push({ n, wk, hero });
}
if (!candidates.length) { console.error("No unposted released weeks left."); process.exit(2); }
candidates.sort((a, b) => b.hero.pts - a.hero.pts);
const { n, wk, hero } = candidates[0];

const f1 = x => (Math.round(x * 10) / 10).toFixed(1);
function statParts(s = {}) {
  const parts = [];
  if (s.pass) { const [c, a, y, td, i] = s.pass; parts.push(`${c}/${a}, ${y} yds${td ? `, ${td} TD` : ""}${i ? `, ${i} INT` : ""}`); }
  if (s.rush && (s.rush[1] >= 20 || s.rush[2])) { const [c, y, td] = s.rush; parts.push(`${c} car, ${y} yds${td ? `, ${td} TD` : ""}`); }
  if (s.rec) { const [r, , y, td] = s.rec; parts.push(`${r} rec, ${y} yds${td ? `, ${td} TD` : ""}`); }
  return parts;
}
const parts = statParts(hero.stats);
const where = `${hero.home ? "vs" : "at"} ${hero.opp}`;
const link = `playdraft.app/?c=${n}&utm_source=x&utm_content=history#/start-sit`;
const tagline = "Start 'em or sit 'em. History already knows.";

const caption = [
  `Week ${wk.week}, ${wk.season}. ${hero.name} ${where}.`,
  `${parts.join(" · ")}. ${f1(hero.pts)} fantasy points.`,
  "",
  "You know how this one ended. Can you call the other five?",
  "",
  `${tagline}`,
  link,
].join("\n");

const font = f => `data:font/woff2;base64,${fs.readFileSync(path.join(here, "fonts", f)).toString("base64")}`;
const CLUB = { ARI:"#97233F",ATL:"#A71930",BAL:"#241773",BUF:"#00338D",CAR:"#0085CA",CHI:"#C83803",CIN:"#FB4F14",
  CLE:"#FF3C00",DAL:"#7F9695",DEN:"#FB4F14",DET:"#0076B6",GB:"#203731",HOU:"#A71930",IND:"#0058A3",JAX:"#9F792C",
  KC:"#E31837",LA:"#866D4B",LAC:"#0080C6",LAR:"#866D4B",LV:"#5f6266",MIA:"#008E97",MIN:"#4F2683",NE:"#002244",
  NO:"#9F8958",NYG:"#0B2265",NYJ:"#12674A",OAK:"#5f6266",PHI:"#004C54",PIT:"#101820",SD:"#0080C6",SEA:"#002244",
  SF:"#AA0000",STL:"#866D4B",TB:"#D50A0A",TEN:"#4B92DB",WAS:"#5A1414" };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const initials = hero.name.split(/\s+/).map(w => w[0]).filter(Boolean);
const ini = (initials[0] || "") + (initials[initials.length - 1] || "");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:BC;src:url(${font("barlow-condensed-latin-800-normal.woff2")});font-weight:800}
@font-face{font-family:BC;src:url(${font("barlow-condensed-latin-700-normal.woff2")});font-weight:700}
@font-face{font-family:B;src:url(${font("barlow-latin-500-normal.woff2")});font-weight:500}
@font-face{font-family:B;src:url(${font("barlow-latin-600-normal.woff2")});font-weight:600}
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1350px;background:#0B1730;color:#fff;font-family:B,sans-serif;position:relative;overflow:hidden}
.turf{position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 2px,transparent 2px 108px)}
.bar{position:absolute;left:0;right:0;top:0;height:14px;background:#E11D2E}
.wrap{position:absolute;inset:0;padding:96px 84px 80px;display:flex;flex-direction:column}
.kick{font-family:BC;font-weight:700;font-size:34px;letter-spacing:.16em;color:#F87171}
.when{font-family:BC;font-weight:800;font-size:150px;line-height:.9;margin-top:14px;letter-spacing:-.01em}
.who{display:flex;align-items:center;gap:30px;margin-top:64px}
.face{width:150px;height:150px;border-radius:75px;background:${CLUB[hero.team] || "#374151"};display:flex;align-items:center;justify-content:center;
  font-family:BC;font-weight:800;font-size:66px;box-shadow:0 0 0 6px rgba(255,255,255,.12)}
.name{font-family:BC;font-weight:800;font-size:86px;line-height:.95}
.meta{font-size:34px;font-weight:600;color:#A9B8D6;margin-top:10px}
.line{margin-top:56px;font-size:44px;font-weight:600;line-height:1.35}
.pts{margin-top:44px;display:flex;align-items:baseline;gap:22px}
.big{font-family:BC;font-weight:800;font-size:220px;line-height:.82;color:#FBBF24}
.unit{font-family:BC;font-weight:700;font-size:48px;letter-spacing:.06em;color:#FBBF24;line-height:1}
.foot{margin-top:auto;border-top:3px solid rgba(255,255,255,.15);padding-top:34px;display:flex;justify-content:space-between;align-items:flex-end;gap:30px}
.tag{font-family:BC;font-weight:700;font-size:40px;line-height:1.05;max-width:720px}
.cta{margin-top:72px;border-left:10px solid #E11D2E;padding:6px 0 6px 28px;font-family:BC;font-weight:700;font-size:54px;line-height:1.08}
.cta span{color:#A9B8D6}
.brand{text-align:right}
.mark{font-family:BC;font-weight:800;font-size:64px;letter-spacing:.02em;line-height:1}
.mark i{color:#E11D2E;font-style:normal}
.url{font-size:28px;font-weight:600;color:#A9B8D6;margin-top:4px}
</style></head><body><div class="turf"></div><div class="bar"></div><div class="wrap">
<div class="kick">FROM THE VAULT</div>
<div class="when">WEEK ${wk.week}, ${wk.season}</div>
<div class="who"><div class="face">${esc(ini)}</div><div>
  <div class="name">${esc(hero.name)}</div>
  <div class="meta">${esc(hero.pos)} · ${esc(hero.team)} ${esc(where)}</div></div></div>
<div class="line">${parts.map(esc).join("<br>")}</div>
<div class="pts"><div class="big">${f1(hero.pts)}</div><div class="unit">FANTASY<br>POINTS</div></div>
<div class="cta">You know how this one ended.<br><span>Can you call the other five?</span></div>
<div class="foot"><div class="tag">${esc(tagline)}</div>
  <div class="brand"><div class="mark">DRAFT<i>.</i></div><div class="url">playdraft.app</div></div></div>
</div></body></html>`;

fs.writeFileSync(path.join(out, "card.html"), html);
fs.writeFileSync(path.join(out, "caption.txt"), caption + "\n");
const meta = { n, season: wk.season, week: wk.week, player: hero.name, team: hero.team, pts: Math.round(hero.pts * 10) / 10, date: etDay(new Date()) };
fs.writeFileSync(path.join(out, "meta.json"), JSON.stringify(meta, null, 2));
if (!dry) fs.writeFileSync(postedPath, JSON.stringify([...posted, meta], null, 2) + "\n");
console.log(caption);
console.log(`\n[week #${n}; ${candidates.length - 1} unposted released weeks left after this]`);
