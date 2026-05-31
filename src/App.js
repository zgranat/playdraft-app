import React, { useState, useEffect, useRef } from "react";

// ============================================================
// PUZZLE DATA
// ============================================================
const PUZZLES = [
  {
    id: 1,
    title: "DRAFT #1",
    players: [
      "RANDY MOSS", "TERRELL OWENS", "CHAD JOHNSON", "ANTONIO BROWN",
      "BRETT FAVRE", "PEYTON MANNING", "DAN MARINO", "JOHN ELWAY",
      "BARRY SANDERS", "EMMITT SMITH", "ERIC DICKERSON", "MARSHALL FAULK",
      "LAWRENCE TAYLOR", "REGGIE WHITE", "DEION SANDERS", "ROD WOODSON"
    ],
    groups: [
      { id:"A", players:["RANDY MOSS","TERRELL OWENS","CHAD JOHNSON","ANTONIO BROWN"], label:"FAMOUS FOR BEING IMPOSSIBLE TO COACH", color:"#B8860B", difficulty:1 },
      { id:"B", players:["BRETT FAVRE","PEYTON MANNING","DAN MARINO","JOHN ELWAY"], label:"HALL OF FAMERS WITH EXACTLY ONE SUPER BOWL WIN OR LESS", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["BARRY SANDERS","EMMITT SMITH","ERIC DICKERSON","MARSHALL FAULK"], label:"RUSHED FOR 2,000+ YARDS IN A SINGLE SEASON", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["LAWRENCE TAYLOR","REGGIE WHITE","DEION SANDERS","ROD WOODSON"], label:"NAMED TO THE NFL 75TH ANNIVERSARY ALL-TIME TEAM ON DEFENSE", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 2,
    title: "DRAFT #2",
    players: [
      "RYAN LEAF", "JaMARCUS RUSSELL", "TONY MANDARICH", "JOHNNY MANZIEL",
      "KURT WARNER", "TONY ROMO", "JEFF GARCIA", "BRAD JOHNSON",
      "ROB GRONKOWSKI", "JIMMY GRAHAM", "ANTONIO GATES", "TONY GONZALEZ",
      "JAMES HARRISON", "ALBERT HAYNESWORTH", "RANDY MOSS", "TERRELL OWENS"
    ],
    groups: [
      { id:"A", players:["RYAN LEAF","JaMARCUS RUSSELL","TONY MANDARICH","JOHNNY MANZIEL"], label:"CONSENSUS ALL-TIME NFL DRAFT BUSTS", color:"#B8860B", difficulty:1 },
      { id:"B", players:["KURT WARNER","TONY ROMO","JEFF GARCIA","BRAD JOHNSON"], label:"REACHED THE SUPER BOWL AS AN UNDRAFTED QUARTERBACK", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["ROB GRONKOWSKI","JIMMY GRAHAM","ANTONIO GATES","TONY GONZALEZ"], label:"TIGHT ENDS WHO PLAYED COLLEGE BASKETBALL", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["JAMES HARRISON","ALBERT HAYNESWORTH","RANDY MOSS","TERRELL OWENS"], label:"FINED OR SUSPENDED FOR CONDUCT $100K+ IN A SINGLE SEASON", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 3,
    title: "DRAFT #3",
    players: [
      "BO JACKSON", "DEION SANDERS", "BRIAN JORDAN", "D.J. DOZIER",
      "PEYTON MANNING", "ELI MANNING", "ARCHIE MANNING", "COOPER MANNING",
      "MARSHAWN LYNCH", "JIM MCMAHON", "ICKEY WOODS", "BILLY WHITE SHOES JOHNSON",
      "DAVID TYREE", "SANTONIO HOLMES", "LYNN SWANN", "JOHN TAYLOR"
    ],
    groups: [
      { id:"A", players:["BO JACKSON","DEION SANDERS","BRIAN JORDAN","D.J. DOZIER"], label:"PLAYED BOTH NFL AND MLB PROFESSIONALLY", color:"#B8860B", difficulty:1 },
      { id:"B", players:["PEYTON MANNING","ELI MANNING","ARCHIE MANNING","COOPER MANNING"], label:"THE MANNING FAMILY", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["MARSHAWN LYNCH","JIM MCMAHON","ICKEY WOODS","BILLY WHITE SHOES JOHNSON"], label:"FINED BY THE NFL FOR A TOUCHDOWN CELEBRATION", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["DAVID TYREE","SANTONIO HOLMES","LYNN SWANN","JOHN TAYLOR"], label:"MADE THE DEFINING CATCH IN A SUPER BOWL-WINNING DRIVE", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 4,
    title: "DRAFT #4",
    players: [
      "COLIN KAEPERNICK", "JIM PLUNKETT", "VINCE YOUNG", "MARK SANCHEZ",
      "ARIAN FOSTER", "PRIEST HOLMES", "JAMES STARKS", "ALFRED MORRIS",
      "RICKY WILLIAMS", "ROBERT SMITH", "CALVIN JOHNSON", "BARRY SANDERS",
      "TOM BRADY", "DREW BREES", "AARON RODGERS", "PATRICK MAHOMES"
    ],
    groups: [
      { id:"A", players:["COLIN KAEPERNICK","JIM PLUNKETT","VINCE YOUNG","MARK SANCHEZ"], label:"WENT TO THE SUPER BOWL THEN NEVER WON ANOTHER PLAYOFF GAME", color:"#B8860B", difficulty:1 },
      { id:"B", players:["ARIAN FOSTER","PRIEST HOLMES","JAMES STARKS","ALFRED MORRIS"], label:"WAIVER WIRE ADDS WHO WON SOMEONE A FANTASY CHAMPIONSHIP", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["RICKY WILLIAMS","ROBERT SMITH","CALVIN JOHNSON","BARRY SANDERS"], label:"RETIRED EARLY AND LEFT TENS OF MILLIONS ON THE TABLE", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["TOM BRADY","DREW BREES","AARON RODGERS","PATRICK MAHOMES"], label:"THREW FOR 5,000+ YARDS IN A SINGLE NFL SEASON", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 6,
    title: "DRAFT #6",
    players: [
      "MARSHAWN LYNCH", "JIM MORA SR.", "DENNIS GREEN", "MIKE DITKA",
      "CHAD JOHNSON", "GRONKOWSKI", "TERRELL OWENS", "ANTONIO BROWN",
      "COLIN KAEPERNICK", "ERIC REID", "BRANDON MARSHALL", "KENNY STILLS",
      "BRETT FAVRE", "TIKI BARBER", "BARRY SANDERS", "JEROME BETTIS"
    ],
    groups: [
      { id:"A", players:["MARSHAWN LYNCH","JIM MORA SR.","DENNIS GREEN","MIKE DITKA"], label:"DELIVERED AN ALL-TIME NOTORIOUS POST-GAME PRESS CONFERENCE", color:"#B8860B", difficulty:1 },
      { id:"B", players:["CHAD JOHNSON","GRONKOWSKI","TERRELL OWENS","ANTONIO BROWN"], label:"MADE HEADLINES OFF THE FIELD MORE THAN ON IT — SAME SEASON", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["COLIN KAEPERNICK","ERIC REID","BRANDON MARSHALL","KENNY STILLS"], label:"TOOK A KNEE OR RAISED A FIST DURING THE NATIONAL ANTHEM", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["BRETT FAVRE","TIKI BARBER","BARRY SANDERS","JEROME BETTIS"], label:"RETIRED, THEN EITHER CAME BACK OR SERIOUSLY CONSIDERED IT", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 7,
    title: "DRAFT #7",
    players: [
      "50 CENT", "CARLY RAE JEPSEN", "SNOOP DOGG", "JOHN WALL",
      "PEYTON MANNING", "JERRY RICE", "EMMITT SMITH", "MIKE SINGLETARY",
      "MARSHAWN LYNCH", "RICHARD SHERMAN", "CHAD JOHNSON", "TERRELL OWENS",
      "ANTONIO CROMARTIE", "PLAXICO BURRESS", "PACMAN JONES", "TANK JOHNSON"
    ],
    groups: [
      { id:"A", players:["50 CENT","CARLY RAE JEPSEN","SNOOP DOGG","JOHN WALL"], label:"THREW A CEREMONIAL FIRST PITCH THAT WENT INSTANTLY VIRAL FOR ALL THE WRONG REASONS", color:"#B8860B", difficulty:1 },
      { id:"B", players:["PEYTON MANNING","JERRY RICE","EMMITT SMITH","MIKE SINGLETARY"], label:"WENT STRAIGHT FROM THE FIELD TO THE BROADCASTING BOOTH", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["MARSHAWN LYNCH","RICHARD SHERMAN","CHAD JOHNSON","TERRELL OWENS"], label:"FINED FOR SOMETHING THEY SAID OR DID IN A POST-GAME INTERVIEW", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["ANTONIO CROMARTIE","PLAXICO BURRESS","PACMAN JONES","TANK JOHNSON"], label:"SUSPENDED BY THE NFL FOR AN OFF-FIELD INCIDENT INVOLVING LAW ENFORCEMENT", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 5,
    title: "DRAFT #5",
    players: [
      "CHAD JOHNSON", "JOE HORN", "TERRELL OWENS", "STEVE SMITH SR.",
      "MIKE SINGLETARY", "BUDDY RYAN", "BILL PARCELLS", "JOHN MADDEN",
      "WARREN SAPP", "NDAMUKONG SUH", "JACK TATUM", "DICK BUTKUS",
      "JOHN ELWAY", "ELI MANNING", "PHILIP RIVERS", "JOHN HADL"
    ],
    groups: [
      { id:"A", players:["CHAD JOHNSON","JOE HORN","TERRELL OWENS","STEVE SMITH SR."], label:"PULLED A PROP OUT DURING A TOUCHDOWN CELEBRATION", color:"#B8860B", difficulty:1 },
      { id:"B", players:["MIKE SINGLETARY","BUDDY RYAN","BILL PARCELLS","JOHN MADDEN"], label:"HEAD COACHES FAMOUS FOR SIDELINE CONFRONTATIONS WITH OPPONENTS OR OWN STAFF", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["WARREN SAPP","NDAMUKONG SUH","JACK TATUM","DICK BUTKUS"], label:"VOTED THE MOST FEARED DEFENSIVE PLAYER OF THEIR ERA", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["JOHN ELWAY","ELI MANNING","PHILIP RIVERS","JOHN HADL"], label:"FAMOUSLY REFUSED TO PLAY FOR THE TEAM THAT DRAFTED THEM", color:"#8B1A2A", difficulty:4 }
    ]
  }
];

const DIFF_LABELS = ["", "1ST & EASY", "2ND DOWN", "3RD & LONG", "4TH & GOAL"];
const DIFF_EMOJIS = { 1:"🟨", 2:"🟩", 3:"🟦", 4:"🟥" };

// ============================================================
// UTILS
// ============================================================
const getTodaysPuzzle = () => PUZZLES[new Date().getDay() % PUZZLES.length];
const getPuzzle = (mode, idx) => mode === "daily" ? getTodaysPuzzle() : PUZZLES[idx % PUZZLES.length];

const loadStats = () => {
  try { const s = localStorage.getItem("draft_v1_stats"); return s ? JSON.parse(s) : defaultStats(); }
  catch { return defaultStats(); }
};
const defaultStats = () => ({ streak:0, bestStreak:0, played:0, won:0, scores:[], lastPlayed:null });
const saveStats = s => { try { localStorage.setItem("draft_v1_stats", JSON.stringify(s)); } catch {} };

const fmt = ms => { const s=Math.floor(ms/1000),m=Math.floor(s/60); return `${m}:${String(s%60).padStart(2,"0")}`; };

const shuffle = arr => {
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]; }
  return a;
};

const buildShareText = (puzzle, solved, wrong, ms, score) => {
  const rows = [1,2,3,4].map(d => {
    const g = solved.find(s=>s.difficulty===d);
    return g ? DIFF_EMOJIS[d].repeat(4) : "⬛⬛⬛⬛";
  }).join("\n");
  return `DRAFT ${puzzle.title.split("#")[1]} 🏈\n⏱ ${fmt(ms)}  🏴 ${4-wrong} downs left  ⭐ ${score} pts\n\n${rows}\n\ndraftgame.com`;
};

// ============================================================
// HEADER
// ============================================================
function Header({ dark, onDark, onStats, onHome, mode, onMode }) {
  return (
    <header style={{
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"0 20px", height:"58px",
      background: dark ? "#0a0a0a" : "#0f1923",
      borderBottom:`2px solid ${dark?"#1a1a1a":"#C8A96E"}`,
      position:"sticky", top:0, zIndex:100, gap:"12px"
    }}>
      <button onClick={onHome} style={{
        fontFamily:"'Bebas Neue',cursive", fontSize:"26px", letterSpacing:"5px",
        color:"#C8A96E", background:"none", border:"none", cursor:"pointer", padding:0, flexShrink:0
      }}>DRAFT</button>

      <div style={{ display:"flex", gap:"6px" }}>
        {["daily","practice"].map(m => (
          <button key={m} onClick={()=>onMode(m)} style={{
            fontFamily:"'Bebas Neue',cursive", fontSize:"12px", letterSpacing:"2px",
            padding:"5px 12px", borderRadius:"3px", cursor:"pointer", border:"1px solid",
            borderColor: mode===m ? "#C8A96E" : "#333",
            background: mode===m ? "#C8A96E" : "transparent",
            color: mode===m ? "#0f1923" : "#666",
            transition:"all 0.15s"
          }}>{m.toUpperCase()}</button>
        ))}
      </div>

      <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
        <button onClick={onStats} style={{ background:"none",border:"none",cursor:"pointer",fontSize:"18px",padding:"4px" }} title="Stats">📊</button>
        <button onClick={onDark} style={{ background:"none",border:"none",cursor:"pointer",fontSize:"16px",padding:"4px" }} title="Theme">{dark?"☀️":"🌙"}</button>
      </div>
    </header>
  );
}

// ============================================================
// TILE
// ============================================================
function Tile({ name, selected, onClick, dark, shaking }) {
  return (
    <button onClick={onClick} style={{
      fontFamily:"'Bebas Neue',cursive",
      fontSize:"clamp(10px,1.6vw,14px)",
      letterSpacing:"1px",
      padding:"10px 4px",
      minHeight:"62px",
      width:"100%",
      display:"flex", alignItems:"center", justifyContent:"center",
      textAlign:"center", lineHeight:1.25,
      background: selected ? (dark?"#1e2d4a":"#0f1923") : (dark?"#181818":"#ffffff"),
      color: selected ? "#C8A96E" : (dark?"#d4c9b8":"#1a1a2e"),
      border:`2px solid ${selected ? "#C8A96E" : (dark?"#2a2a2a":"#ddd6c4")}`,
      borderRadius:"6px",
      cursor:"pointer",
      transform: selected ? "scale(1.03)" : "scale(1)",
      boxShadow: selected ? "0 0 0 3px rgba(200,169,110,0.2)" : "0 1px 3px rgba(0,0,0,0.08)",
      transition:"all 0.15s ease",
      animation: shaking ? "shake 0.5s ease" : "none"
    }}>
      {name}
    </button>
  );
}

// ============================================================
// SOLVED ROW
// ============================================================
function SolvedRow({ group, dark }) {
  return (
    <div style={{
      background: group.color, borderRadius:"8px",
      padding:"14px 18px", marginBottom:"7px",
      animation:"popIn 0.35s cubic-bezier(0.34,1.56,0.64,1)",
      display:"flex", flexDirection:"column", gap:"3px"
    }}>
      <div style={{ fontFamily:"'Bebas Neue',cursive", fontSize:"10px", letterSpacing:"3px", color:"rgba(255,255,255,0.65)" }}>
        {DIFF_LABELS[group.difficulty]}
      </div>
      <div style={{
        fontFamily:"'Crimson Pro',Georgia,serif", fontSize:"clamp(14px,2.2vw,19px)",
        fontWeight:"700", fontStyle:"italic", color:"#fff", letterSpacing:"0.3px"
      }}>
        {group.label}
      </div>
      <div style={{ fontFamily:"'Bebas Neue',cursive", fontSize:"11px", letterSpacing:"2px", color:"rgba(255,255,255,0.75)", marginTop:"1px" }}>
        {group.players.join(" · ")}
      </div>
    </div>
  );
}

// ============================================================
// DOWNS
// ============================================================
function Downs({ remaining, dark }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
      <span style={{ fontFamily:"'Bebas Neue',cursive", fontSize:"11px", letterSpacing:"2px", color:dark?"#555":"#888" }}>DOWNS</span>
      {[...Array(4)].map((_,i) => (
        <div key={i} style={{
          width:"16px", height:"16px", borderRadius:"50%",
          background: i < remaining ? "#C8A96E" : (dark?"#222":"#e0d8cc"),
          border:`2px solid ${i < remaining ? "#C8A96E" : (dark?"#333":"#ccc")}`,
          transition:"background 0.3s, border-color 0.3s"
        }}/>
      ))}
    </div>
  );
}

// ============================================================
// TIMER (self-contained)
// ============================================================
function Timer({ running, onTick, dark }) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    if (running) {
      startRef.current = Date.now() - elapsed;
      const tick = () => {
        const e = Date.now() - startRef.current;
        setElapsed(e);
        onTick(e);
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(frameRef.current);
    }
    return () => cancelAnimationFrame(frameRef.current);
  }, [running]);

  const s = Math.floor(elapsed/1000), m = Math.floor(s/60);
  const warn = elapsed > 180000;
  return (
    <div style={{
      fontFamily:"'Courier New',monospace", fontSize:"20px", fontWeight:"700",
      color: warn ? "#c0392b" : (dark?"#C8A96E":"#0f1923"),
      letterSpacing:"3px", minWidth:"64px", textAlign:"center"
    }}>{`${m}:${String(s%60).padStart(2,"0")}`}</div>
  );
}

// ============================================================
// STATS MODAL
// ============================================================
function StatsModal({ onClose, dark }) {
  const st = loadStats();
  const bg = dark?"#111":"#faf7f0", fg = dark?"#e0d5c5":"#1a1a2e", border = dark?"#222":"#e0d5c0";
  const winPct = st.played > 0 ? Math.round((st.won/st.played)*100) : 0;
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:"20px" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:bg,border:`2px solid ${border}`,borderRadius:"12px",padding:"30px",maxWidth:"380px",width:"100%" }}>
        <div style={{ fontFamily:"'Bebas Neue',cursive",fontSize:"26px",letterSpacing:"5px",color:"#C8A96E",textAlign:"center",marginBottom:"24px" }}>YOUR STATS</div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"12px",marginBottom:"24px" }}>
          {[["PLAYED",st.played],["WIN %",`${winPct}%`],["STREAK",st.streak],["BEST",st.bestStreak]].map(([l,v])=>(
            <div key={l} style={{ textAlign:"center",background:dark?"#1a1a1a":"#f0ebe0",padding:"14px 6px",borderRadius:"8px" }}>
              <div style={{ fontFamily:"'Bebas Neue',cursive",fontSize:"30px",color:fg,lineHeight:1 }}>{v}</div>
              <div style={{ fontFamily:"'Bebas Neue',cursive",fontSize:"9px",letterSpacing:"2px",color:"#888",marginTop:"3px" }}>{l}</div>
            </div>
          ))}
        </div>
        {st.scores.length > 0 && <>
          <div style={{ fontFamily:"'Bebas Neue',cursive",fontSize:"11px",letterSpacing:"3px",color:"#888",marginBottom:"10px" }}>RECENT SCORES</div>
          <div style={{ display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"4px" }}>
            {st.scores.slice(-12).reverse().map((s,i)=>(
              <div key={i} style={{ fontFamily:"'Bebas Neue',cursive",fontSize:"15px",color:"#C8A96E",background:dark?"#1a1a1a":"#f0ebe0",padding:"5px 10px",borderRadius:"4px" }}>{s}</div>
            ))}
          </div>
        </>}
        <button onClick={onClose} style={{ marginTop:"24px",width:"100%",fontFamily:"'Bebas Neue',cursive",fontSize:"15px",letterSpacing:"3px",padding:"13px",background:"#C8A96E",color:"#0f1923",border:"none",borderRadius:"6px",cursor:"pointer" }}>CLOSE</button>
      </div>
    </div>
  );
}

// ============================================================
// RESULT MODAL
// ============================================================
function ResultModal({ puzzle, solved, wrong, ms, score, onPlayAgain, dark }) {
  const [copied, setCopied] = useState(false);
  const won = solved.length === 4;
  const bg = dark?"#111":"#faf7f0", fg = dark?"#e0d5c5":"#1a1a2e";

  const copy = () => {
    navigator.clipboard.writeText(buildShareText(puzzle,solved,wrong,ms,score))
      .then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2200); });
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:"16px" }}>
      <div style={{ background:bg,borderRadius:"14px",padding:"28px",maxWidth:"440px",width:"100%",border:`2px solid ${won?"#C8A96E":"#8B1A2A"}` }}>
        <div style={{ fontFamily:"'Bebas Neue',cursive",fontSize:"40px",letterSpacing:"4px",color:won?"#C8A96E":"#8B1A2A",textAlign:"center",lineHeight:1,marginBottom:"6px" }}>
          {won ? "NICE WORK" : "GAME OVER"}
        </div>
        <div style={{ fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"15px",color:"#888",textAlign:"center",marginBottom:"22px",fontStyle:"italic" }}>{puzzle.title}</div>

        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"12px",marginBottom:"22px" }}>
          {[["SCORE",score],["TIME",fmt(ms)],["DOWNS LEFT",4-wrong]].map(([l,v])=>(
            <div key={l} style={{ textAlign:"center",background:dark?"#181818":"#f0ebe0",padding:"14px 6px",borderRadius:"8px" }}>
              <div style={{ fontFamily:"'Bebas Neue',cursive",fontSize:"26px",color:fg,lineHeight:1 }}>{v}</div>
              <div style={{ fontFamily:"'Bebas Neue',cursive",fontSize:"9px",letterSpacing:"2px",color:"#888",marginTop:"3px" }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom:"20px" }}>
          {puzzle.groups.sort((a,b)=>a.difficulty-b.difficulty).map(g=>{
            const s = solved.find(x=>x.id===g.id);
            return (
              <div key={g.id} style={{ display:"flex",alignItems:"center",gap:"10px",padding:"8px 0",borderBottom:`1px solid ${dark?"#1e1e1e":"#ece4d4"}` }}>
                <div style={{ width:"13px",height:"13px",borderRadius:"3px",background:s?g.color:"#444",flexShrink:0 }}/>
                <div style={{ fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"13px",fontStyle:"italic",color:s?fg:"#666" }}>{g.label}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display:"flex",gap:"10px" }}>
          <button onClick={copy} style={{ flex:1,fontFamily:"'Bebas Neue',cursive",fontSize:"14px",letterSpacing:"2px",padding:"13px",background:copied?"#2E6B3E":"#C8A96E",color:"#0f1923",border:"none",borderRadius:"6px",cursor:"pointer",transition:"background 0.2s" }}>
            {copied ? "COPIED ✓" : "SHARE RESULT"}
          </button>
          <button onClick={onPlayAgain} style={{ flex:1,fontFamily:"'Bebas Neue',cursive",fontSize:"14px",letterSpacing:"2px",padding:"13px",background:"transparent",color:fg,border:`2px solid ${dark?"#333":"#c8bfae"}`,borderRadius:"6px",cursor:"pointer" }}>
            PLAY AGAIN
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LANDING
// ============================================================
function Landing({ onPlay, dark }) {
  const bg = dark?"#0a0a0a":"#faf7f0", fg = dark?"#d4c9b8":"#1a1a2e";
  const demoPlayers = ["RANDY MOSS","TERRELL OWENS","CHAD JOHNSON","ANTONIO BROWN"];

  return (
    <div style={{ minHeight:"calc(100vh - 58px)",background:bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 20px",textAlign:"center" }}>
      <div style={{ fontFamily:"'Bebas Neue',cursive",fontSize:"clamp(72px,18vw,130px)",letterSpacing:"6px",color:"#C8A96E",lineHeight:0.85,marginBottom:"6px",textShadow:`3px 3px 0 ${dark?"rgba(0,0,0,0.5)":"rgba(15,25,35,0.2)"}` }}>DRAFT</div>

      <div style={{ fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"clamp(15px,2.5vw,20px)",color:dark?"#666":"#777",fontStyle:"italic",marginBottom:"36px",maxWidth:"400px",lineHeight:1.6 }}>
        Not your average sports trivia.<br/>
        Find the weird, wild, and infamous connections<br/>hiding between 16 NFL players.
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"8px",maxWidth:"300px",width:"100%",marginBottom:"16px" }}>
        {demoPlayers.map((p,i)=>(
          <div key={p} style={{
            fontFamily:"'Bebas Neue',cursive",fontSize:"12px",letterSpacing:"1px",
            padding:"13px 6px",textAlign:"center",
            background:dark?"#181818":"#fff",
            border:`2px solid ${dark?"#2a2a2a":"#ddd6c4"}`,
            borderRadius:"6px",color:fg,
            animation:`fadeUp 0.4s ease ${i*0.08}s both`
          }}>{p}</div>
        ))}
      </div>

      <div style={{ fontFamily:"'Bebas Neue',cursive",fontSize:"10px",letterSpacing:"3px",color:"#C8A96E",marginBottom:"6px" }}>FIND THE CONNECTION</div>

      <div style={{
        fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"clamp(13px,2vw,17px)",
        color:fg,fontStyle:"italic",marginBottom:"36px",
        background:dark?"#181818":"#f0ebe0",padding:"11px 22px",borderRadius:"6px",
        border:`1px solid ${dark?"#2a2a2a":"#ddd6c4"}`,maxWidth:"340px"
      }}>Famous for being impossible to coach 😤</div>

      <button
        onClick={onPlay}
        onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 10px 32px rgba(200,169,110,0.45)";}}
        onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 4px 18px rgba(200,169,110,0.35)";}}
        style={{ fontFamily:"'Bebas Neue',cursive",fontSize:"19px",letterSpacing:"4px",padding:"16px 44px",background:"#C8A96E",color:"#0f1923",border:"none",borderRadius:"8px",cursor:"pointer",boxShadow:"0 4px 18px rgba(200,169,110,0.35)",transition:"transform 0.2s,box-shadow 0.2s" }}
      >
        PLAY TODAY'S DRAFT
      </button>

      <div style={{ marginTop:"40px",display:"flex",gap:"24px",flexWrap:"wrap",justifyContent:"center" }}>
        {[["🏈","16 NFL PLAYERS"],["🏴","4 DOWNS"],["⏱","BEAT THE CLOCK"],["🤯","FIND THE CONNECTION"]].map(([ic,tx])=>(
          <div key={tx} style={{ fontFamily:"'Bebas Neue',cursive",fontSize:"11px",letterSpacing:"2px",color:dark?"#444":"#aaa",display:"flex",alignItems:"center",gap:"6px" }}>
            <span style={{fontSize:"15px"}}>{ic}</span>{tx}
          </div>
        ))}
      </div>

      <div style={{ marginTop:"48px",fontFamily:"'Bebas Neue',cursive",fontSize:"10px",letterSpacing:"2px",color:dark?"#333":"#ccc" }}>
        NFL · NBA · MLB · MORE COMING SOON
      </div>
    </div>
  );
}

// ============================================================
// GAME
// ============================================================
function Game({ puzzle, dark, onFinish }) {
  const [tiles, setTiles] = useState(()=>shuffle(puzzle.players));
  const [selected, setSelected] = useState([]);
  const [solved, setSolved] = useState([]);
  const [wrong, setWrong] = useState(0);
  const [timeMs, setTimeMs] = useState(0);
  const [timerOn, setTimerOn] = useState(true);
  const [score, setScore] = useState(1000);
  const [over, setOver] = useState(false);
  const [shaking, setShaking] = useState([]);
  const [toast, setToast] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const toastRef = useRef(null);

  const bg = dark?"#0a0a0a":"#faf7f0";

  const showToast = (msg, dur=1800) => {
    clearTimeout(toastRef.current);
    setToast(msg);
    toastRef.current = setTimeout(()=>setToast(null), dur);
  };

  const handleTile = name => {
    if (over) return;
    setSelected(prev => prev.includes(name) ? prev.filter(p=>p!==name) : prev.length < 4 ? [...prev,name] : prev);
  };

  const handleSubmit = () => {
    if (selected.length !== 4 || over) return;
    const group = puzzle.groups.find(g =>
      selected.every(p=>g.players.includes(p)) && g.players.every(p=>selected.includes(p))
    );

    if (group) {
      const newSolved = [...solved, group];
      setSolved(newSolved);
      setSelected([]);
      const tBonus = Math.max(0, 150 - Math.floor(timeMs/1000));
      const pts = (5-group.difficulty)*70 + tBonus;
      setScore(s => s + pts);
      showToast(["LOCKED IN 🔒","THAT'S IT!","YOU GOT IT!","NICE READ!"][Math.floor(Math.random()*4)]);

      if (newSolved.length === 4) {
        setTimerOn(false);
        setOver(true);
        const finalScore = score + pts;
        setTimeout(()=>setShowResult(true), 700);
        const st = loadStats(), today = new Date().toDateString(), yest = new Date(Date.now()-86400000).toDateString();
        st.played++; st.won++;
        st.scores = [...(st.scores||[]), finalScore];
        if (st.lastPlayed !== today) st.streak = st.lastPlayed === yest ? st.streak+1 : 1;
        st.bestStreak = Math.max(st.streak, st.bestStreak);
        st.lastPlayed = today;
        saveStats(st);
      }
    } else {
      const oneAway = puzzle.groups.some(g => selected.filter(p=>g.players.includes(p)).length === 3);
      setShaking([...selected]);
      setTimeout(()=>setShaking([]), 550);
      if (oneAway) showToast("ONE AWAY... 👀", 2200);
      else showToast(["NOT QUITE.","WRONG DOWN.","KEEP THINKING."][Math.floor(Math.random()*3)]);

      const newW = wrong + 1;
      setWrong(newW);
      setScore(s => Math.max(0, s - (150 + newW*20)));
      setSelected([]);

      if (newW >= 4) {
        setTimerOn(false);
        setOver(true);
        setTimeout(()=>setShowResult(true), 500);
        const st = loadStats(), today = new Date().toDateString();
        st.played++;
        st.scores = [...(st.scores||[]), 0];
        st.streak = 0;
        st.lastPlayed = today;
        saveStats(st);
      }
    }
  };

  const unsolved = tiles.filter(p => !solved.some(g=>g.players.includes(p)));

  return (
    <div style={{ background:bg, minHeight:"calc(100vh - 58px)", padding:"16px 14px 40px" }}>
      <div style={{ maxWidth:"580px", margin:"0 auto" }}>

        {/* Top bar */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px",padding:"0 2px" }}>
          <div style={{ fontFamily:"'Bebas Neue',cursive",fontSize:"12px",letterSpacing:"3px",color:dark?"#444":"#aaa" }}>{puzzle.title}</div>
          <Timer running={timerOn} onTick={setTimeMs} dark={dark} />
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:"'Bebas Neue',cursive",fontSize:"10px",letterSpacing:"2px",color:dark?"#444":"#aaa" }}>SCORE</div>
            <div style={{ fontFamily:"'Bebas Neue',cursive",fontSize:"26px",color:"#C8A96E",lineHeight:1,letterSpacing:"1px" }}>{score}</div>
          </div>
        </div>

        {/* Solved rows */}
        {solved.sort((a,b)=>a.difficulty-b.difficulty).map(g=>(
          <SolvedRow key={g.id} group={g} dark={dark} />
        ))}

        {/* Grid */}
        {unsolved.length > 0 && (
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"7px",marginBottom:"14px" }}>
            {unsolved.map(name=>(
              <Tile key={name} name={name} selected={selected.includes(name)}
                onClick={()=>handleTile(name)} dark={dark} shaking={shaking.includes(name)} />
            ))}
          </div>
        )}

        {/* Controls */}
        {!over && (
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"10px",marginTop:"6px" }}>
            <Downs remaining={4-wrong} dark={dark} />
            <div style={{ display:"flex",gap:"8px" }}>
              <button onClick={()=>setTiles(shuffle([...unsolved,...solved.flatMap(g=>g.players)]))} style={{ fontFamily:"'Bebas Neue',cursive",fontSize:"12px",letterSpacing:"2px",padding:"9px 14px",background:"transparent",color:dark?"#666":"#888",border:`1px solid ${dark?"#2a2a2a":"#ccc"}`,borderRadius:"5px",cursor:"pointer" }}>SHUFFLE</button>
              <button onClick={()=>setSelected([])} disabled={!selected.length} style={{ fontFamily:"'Bebas Neue',cursive",fontSize:"12px",letterSpacing:"2px",padding:"9px 14px",background:"transparent",color:selected.length?(dark?"#d4c9b8":"#1a1a2e"):"#888",border:`1px solid ${selected.length?(dark?"#444":"#999"):(dark?"#222":"#ddd")}`,borderRadius:"5px",cursor:selected.length?"pointer":"default" }}>CLEAR</button>
              <button onClick={handleSubmit} disabled={selected.length!==4} style={{ fontFamily:"'Bebas Neue',cursive",fontSize:"14px",letterSpacing:"2px",padding:"9px 22px",background:selected.length===4?"#C8A96E":(dark?"#1e1e1e":"#ece4d4"),color:selected.length===4?"#0f1923":(dark?"#333":"#bbb"),border:"none",borderRadius:"5px",cursor:selected.length===4?"pointer":"default",transition:"background 0.15s" }}>SUBMIT</button>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{ position:"fixed",top:"74px",left:"50%",transform:"translateX(-50%)",fontFamily:"'Bebas Neue',cursive",fontSize:"17px",letterSpacing:"3px",background:dark?"#1a1a1a":"#0f1923",color:"#C8A96E",padding:"11px 26px",borderRadius:"8px",boxShadow:"0 4px 20px rgba(0,0,0,0.5)",zIndex:200,border:"1px solid rgba(200,169,110,0.3)",whiteSpace:"nowrap",animation:"toastIn 0.2s ease" }}>
            {toast}
          </div>
        )}

        {/* Result */}
        {showResult && (
          <ResultModal puzzle={puzzle} solved={solved} wrong={wrong} ms={timeMs} score={score} dark={dark} onPlayAgain={onFinish} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// ROOT
// ============================================================
export default function App() {
  const [dark, setDark] = useState(false);
  const [screen, setScreen] = useState("home");
  const [showStats, setShowStats] = useState(false);
  const [mode, setMode] = useState("daily");
  const [practiceIdx, setPracticeIdx] = useState(0);

  const puzzle = getPuzzle(mode, practiceIdx);

  const handleModeChange = m => { setMode(m); setScreen("home"); };
  const handleFinish = () => {
    if (mode==="practice") setPracticeIdx(i=>(i+1)%PUZZLES.length);
    setScreen("home");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:${dark?"#0a0a0a":"#faf7f0"};}
        @keyframes popIn{from{opacity:0;transform:translateY(-10px) scale(0.97);}to{opacity:1;transform:translateY(0) scale(1);}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-6px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
        @keyframes shake{0%,100%{transform:translateX(0);}20%{transform:translateX(-5px);}40%{transform:translateX(5px);}60%{transform:translateX(-3px);}80%{transform:translateX(3px);}}
        button:focus-visible{outline:2px solid #C8A96E;outline-offset:2px;}
        ::-webkit-scrollbar{width:5px;}
        ::-webkit-scrollbar-thumb{background:#C8A96E33;border-radius:3px;}
      `}</style>

      <Header dark={dark} onDark={()=>setDark(d=>!d)} onStats={()=>setShowStats(true)} onHome={()=>setScreen("home")} mode={mode} onMode={handleModeChange} />

      {screen==="home" && <Landing onPlay={()=>setScreen("game")} dark={dark} />}
      {screen==="game" && <Game key={`${puzzle.id}-${mode}-${practiceIdx}`} puzzle={puzzle} dark={dark} onFinish={handleFinish} />}
      {showStats && <StatsModal onClose={()=>setShowStats(false)} dark={dark} />}
    </>
  );
}
