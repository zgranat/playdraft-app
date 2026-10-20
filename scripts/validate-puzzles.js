// Structural checks for PlayDraft puzzle data. Usage: node scripts/validate-puzzles.js [repoRoot]
// Early-bank (R1-R29) consecutive repeats and duplicate labels are pre-existing; judge only new rounds.
const fs = require("fs");
const s = fs.readFileSync((process.argv[2] || ".") + "/src/App.js", "utf8");
const grab = name => { const a = s.indexOf(name); const b = s.indexOf("\n];", a); return eval(s.slice(s.indexOf("[", a), b + 2)); };
const P = grab("const PUZZLES"), F = grab("const FEATURED_PUZZLES");
let errs = [];
const check = (p, tag) => {
  const flat = p.groups.flatMap(g => g.players);
  if (new Set(flat).size !== 16) errs.push(tag + ": not 16 unique");
  if (JSON.stringify([...flat].sort()) !== JSON.stringify([...p.players].sort())) errs.push(tag + ": players[] mismatch");
  if (p.groups.map(g => g.difficulty).join() !== "1,2,3,4") errs.push(tag + ": difficulty order");
  p.groups.forEach(g => { if (g.players.length !== 4) errs.push(tag + ": group size"); });
};
P.forEach((p, i) => { check(p, "R" + p.id); if (p.id !== i + 1) errs.push("id gap at " + i); });
F.forEach(f => check(f, f.id));
const labels = P.flatMap(p => p.groups.map(g => g.label));
const dup = labels.filter((l, i) => labels.indexOf(l) !== i);
if (dup.length) errs.push("dup labels: " + [...new Set(dup)].join(" | "));
for (let i = 1; i < P.length; i++) {
  const rep = P[i].players.filter(x => P[i - 1].players.includes(x));
  if (rep.length) errs.push(`consecutive repeat R${P[i-1].id}->R${P[i].id}: ${rep.join(",")}`);
}
const L = new Date(2026, 6, 3);
const last = new Date(L.getTime() + (P.length - 1) * 864e5);
const pick = k => F.find(f => k >= f.activeFrom && k < f.activeUntil)?.id || "FALLBACK";
console.log("bank", P.length, "last day", last.toDateString());
console.log("featured 10-20 05:59?", pick("2026-10-19"), "| 10-20:", pick("2026-10-20"), "| 10-26:", pick("2026-10-26"), "| 10-27:", pick("2026-10-27"));
console.log(errs.length ? errs.join("\n") : "ALL CHECKS PASS");
