import { useState, useEffect, useRef } from "react";

// ============================================================
// PUZZLE DATA
// ============================================================
const PUZZLES = [
  {
    id: 1, title: "DRAFT #1",
    players: ["RANDY MOSS","TERRELL OWENS","CHAD JOHNSON","ANTONIO BROWN","BRETT FAVRE","PEYTON MANNING","DAN MARINO","JOHN ELWAY","BARRY SANDERS","EMMITT SMITH","ERIC DICKERSON","MARSHALL FAULK","LAWRENCE TAYLOR","REGGIE WHITE","DEION SANDERS","ROD WOODSON"],
    groups: [
      { id:"A", players:["RANDY MOSS","TERRELL OWENS","CHAD JOHNSON","ANTONIO BROWN"], label:"FAMOUS FOR BEING IMPOSSIBLE TO COACH", color:"#B8860B", difficulty:1 },
      { id:"B", players:["BRETT FAVRE","PEYTON MANNING","DAN MARINO","JOHN ELWAY"], label:"HALL OF FAMERS WITH EXACTLY ONE SUPER BOWL WIN OR LESS", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["BARRY SANDERS","EMMITT SMITH","ERIC DICKERSON","MARSHALL FAULK"], label:"RUSHED FOR 2,000+ YARDS IN A SINGLE SEASON", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["LAWRENCE TAYLOR","REGGIE WHITE","DEION SANDERS","ROD WOODSON"], label:"NAMED TO THE NFL 75TH ANNIVERSARY ALL-TIME TEAM — DEFENSE", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 2, title: "DRAFT #2",
    players: ["RYAN LEAF","JaMARCUS RUSSELL","TONY MANDARICH","JOHNNY MANZIEL","KURT WARNER","TONY ROMO","JEFF GARCIA","BRAD JOHNSON","ROB GRONKOWSKI","JIMMY GRAHAM","ANTONIO GATES","TONY GONZALEZ","JAMES HARRISON","ALBERT HAYNESWORTH","RANDY MOSS","TERRELL OWENS"],
    groups: [
      { id:"A", players:["RYAN LEAF","JaMARCUS RUSSELL","TONY MANDARICH","JOHNNY MANZIEL"], label:"CONSENSUS ALL-TIME NFL DRAFT BUSTS", color:"#B8860B", difficulty:1 },
      { id:"B", players:["KURT WARNER","TONY ROMO","JEFF GARCIA","BRAD JOHNSON"], label:"REACHED THE SUPER BOWL AS AN UNDRAFTED QUARTERBACK", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["ROB GRONKOWSKI","JIMMY GRAHAM","ANTONIO GATES","TONY GONZALEZ"], label:"TIGHT ENDS WHO PLAYED COLLEGE BASKETBALL", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["JAMES HARRISON","ALBERT HAYNESWORTH","RANDY MOSS","TERRELL OWENS"], label:"FINED OR SUSPENDED FOR CONDUCT $100K+ IN A SINGLE SEASON", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 3, title: "DRAFT #3",
    players: ["BO JACKSON","DEION SANDERS","BRIAN JORDAN","D.J. DOZIER","PEYTON MANNING","ELI MANNING","ARCHIE MANNING","COOPER MANNING","MARSHAWN LYNCH","JIM MCMAHON","ICKEY WOODS","BILLY WHITE SHOES JOHNSON","DAVID TYREE","SANTONIO HOLMES","LYNN SWANN","JOHN TAYLOR"],
    groups: [
      { id:"A", players:["BO JACKSON","DEION SANDERS","BRIAN JORDAN","D.J. DOZIER"], label:"PLAYED BOTH NFL AND MLB PROFESSIONALLY", color:"#B8860B", difficulty:1 },
      { id:"B", players:["PEYTON MANNING","ELI MANNING","ARCHIE MANNING","COOPER MANNING"], label:"THE MANNING FAMILY", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["MARSHAWN LYNCH","JIM MCMAHON","ICKEY WOODS","BILLY WHITE SHOES JOHNSON"], label:"FINED BY THE NFL FOR A TOUCHDOWN CELEBRATION", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["DAVID TYREE","SANTONIO HOLMES","LYNN SWANN","JOHN TAYLOR"], label:"MADE THE DEFINING CATCH IN A SUPER BOWL-WINNING DRIVE", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 4, title: "DRAFT #4",
    players: ["COLIN KAEPERNICK","JIM PLUNKETT","VINCE YOUNG","MARK SANCHEZ","ARIAN FOSTER","PRIEST HOLMES","JAMES STARKS","ALFRED MORRIS","RICKY WILLIAMS","ROBERT SMITH","CALVIN JOHNSON","BARRY SANDERS","TOM BRADY","DREW BREES","AARON RODGERS","PATRICK MAHOMES"],
    groups: [
      { id:"A", players:["COLIN KAEPERNICK","JIM PLUNKETT","VINCE YOUNG","MARK SANCHEZ"], label:"WENT TO THE SUPER BOWL THEN NEVER WON ANOTHER PLAYOFF GAME", color:"#B8860B", difficulty:1 },
      { id:"B", players:["ARIAN FOSTER","PRIEST HOLMES","JAMES STARKS","ALFRED MORRIS"], label:"WAIVER WIRE ADDS WHO WON SOMEONE A FANTASY CHAMPIONSHIP", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["RICKY WILLIAMS","ROBERT SMITH","CALVIN JOHNSON","BARRY SANDERS"], label:"RETIRED EARLY AND LEFT TENS OF MILLIONS ON THE TABLE", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["TOM BRADY","DREW BREES","AARON RODGERS","PATRICK MAHOMES"], label:"THREW FOR 5,000+ YARDS IN A SINGLE NFL SEASON", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 5, title: "DRAFT #5",
    players: ["CHAD JOHNSON","JOE HORN","TERRELL OWENS","STEVE SMITH SR.","MIKE SINGLETARY","BUDDY RYAN","BILL PARCELLS","JOHN MADDEN","WARREN SAPP","NDAMUKONG SUH","JACK TATUM","DICK BUTKUS","JOHN ELWAY","ELI MANNING","PHILIP RIVERS","JOHN HADL"],
    groups: [
      { id:"A", players:["CHAD JOHNSON","JOE HORN","TERRELL OWENS","STEVE SMITH SR."], label:"PULLED A PROP OUT DURING A TOUCHDOWN CELEBRATION", color:"#B8860B", difficulty:1 },
      { id:"B", players:["MIKE SINGLETARY","BUDDY RYAN","BILL PARCELLS","JOHN MADDEN"], label:"COACHES FAMOUS FOR SIDELINE CONFRONTATIONS", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["WARREN SAPP","NDAMUKONG SUH","JACK TATUM","DICK BUTKUS"], label:"VOTED THE MOST FEARED DEFENSIVE PLAYER OF THEIR ERA", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["JOHN ELWAY","ELI MANNING","PHILIP RIVERS","JOHN HADL"], label:"FAMOUSLY REFUSED TO PLAY FOR THE TEAM THAT DRAFTED THEM", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 6, title: "DRAFT #6",
    players: ["MARSHAWN LYNCH","JIM MORA SR.","DENNIS GREEN","MIKE DITKA","CHAD JOHNSON","ROB GRONKOWSKI","TERRELL OWENS","ANTONIO BROWN","COLIN KAEPERNICK","ERIC REID","BRANDON MARSHALL","KENNY STILLS","BRETT FAVRE","TIKI BARBER","BARRY SANDERS","JEROME BETTIS"],
    groups: [
      { id:"A", players:["MARSHAWN LYNCH","JIM MORA SR.","DENNIS GREEN","MIKE DITKA"], label:"DELIVERED AN ALL-TIME NOTORIOUS POST-GAME PRESS CONFERENCE", color:"#B8860B", difficulty:1 },
      { id:"B", players:["CHAD JOHNSON","ROB GRONKOWSKI","TERRELL OWENS","ANTONIO BROWN"], label:"MADE HEADLINES OFF THE FIELD MORE THAN ON IT — SAME SEASON", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["COLIN KAEPERNICK","ERIC REID","BRANDON MARSHALL","KENNY STILLS"], label:"TOOK A KNEE OR RAISED A FIST DURING THE NATIONAL ANTHEM", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["BRETT FAVRE","TIKI BARBER","BARRY SANDERS","JEROME BETTIS"], label:"RETIRED, THEN CAME BACK OR SERIOUSLY CONSIDERED IT", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 7, title: "DRAFT #7",
    players: ["50 CENT","CARLY RAE JEPSEN","SNOOP DOGG","JOHN WALL","PEYTON MANNING","JERRY RICE","EMMITT SMITH","MIKE SINGLETARY","MARSHAWN LYNCH","RICHARD SHERMAN","CHAD JOHNSON","TERRELL OWENS","ANTONIO CROMARTIE","PLAXICO BURRESS","PACMAN JONES","TANK JOHNSON"],
    groups: [
      { id:"A", players:["50 CENT","CARLY RAE JEPSEN","SNOOP DOGG","JOHN WALL"], label:"THREW A CEREMONIAL FIRST PITCH THAT WENT VIRAL FOR THE WRONG REASONS", color:"#B8860B", difficulty:1 },
      { id:"B", players:["PEYTON MANNING","JERRY RICE","EMMITT SMITH","MIKE SINGLETARY"], label:"WENT STRAIGHT FROM THE FIELD TO THE BROADCASTING BOOTH", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["MARSHAWN LYNCH","RICHARD SHERMAN","CHAD JOHNSON","TERRELL OWENS"], label:"FINED FOR SOMETHING SAID OR DONE IN A POST-GAME INTERVIEW", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["ANTONIO CROMARTIE","PLAXICO BURRESS","PACMAN JONES","TANK JOHNSON"], label:"SUSPENDED FOR AN OFF-FIELD INCIDENT INVOLVING LAW ENFORCEMENT", color:"#8B1A2A", difficulty:4 }
    ]
  }
];

const DIFF_LABELS = ["","1ST & EASY","2ND DOWN","3RD & LONG","4TH & GOAL"];
const DIFF_EMOJIS = {1:"🟨",2:"🟩",3:"🟦",4:"🟥"};

const shuffle = arr => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const fmt = ms => { const s=Math.floor(ms/1000),m=Math.floor(s/60); return `${m}:${String(s%60).padStart(2,"0")}`; };
const defaultStats = () => ({streak:0,bestStreak:0,played:0,won:0,scores:[],lastPlayed:null});
const loadStats = () => { try{const s=localStorage.getItem("draft_v1");return s?JSON.parse(s):defaultStats();}catch{return defaultStats();} };
const saveStats = s => { try{localStorage.setItem("draft_v1",JSON.stringify(s));}catch{} };
const getTodaysPuzzle = () => PUZZLES[new Date().getDay() % PUZZLES.length];
const getPuzzle = (mode, idx) => mode==="daily" ? getTodaysPuzzle() : PUZZLES[idx % PUZZLES.length];

const buildShare = (puzzle, solved, wrong, ms, streak) => {
  const rows=[1,2,3,4].map(d=>{const g=solved.find(s=>s.difficulty===d);return g?DIFF_EMOJIS[d].repeat(4):"⬛⬛⬛⬛";}).join("\n");
  const clean = wrong === 0 ? "\n🔒 CLEAN GAME" : "";
  const streakLine = streak>=3 ? `\n🔥 ${streak}-day streak` : "";
  return `DRAFT ${puzzle.title.split("#")[1]} 🏈\n⚡ ${fmt(ms)}${clean}${streakLine}\n\n${rows}\n\nplaydraft.app`;
};

// ============================================================
// HEADER
// ============================================================
function Header({dark,onDark,onStats,onHome,onHow,mode,onMode}) {
  return (
    <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 14px",height:"52px",background:dark?"#0a0a0a":"#0f1923",borderBottom:`2px solid #C8A96E`,position:"sticky",top:0,zIndex:100,gap:"8px"}}>
      <button onClick={onHome} style={{fontFamily:"'Bebas Neue',cursive",fontSize:"22px",letterSpacing:"5px",color:"#C8A96E",background:"none",border:"none",cursor:"pointer",padding:0,flexShrink:0}}>DRAFT</button>
      <div style={{display:"flex",gap:"4px"}}>
        {["daily","practice"].map(m=>(
          <button key={m} onClick={()=>onMode(m)} style={{fontFamily:"'Bebas Neue',cursive",fontSize:"11px",letterSpacing:"2px",padding:"5px 10px",borderRadius:"3px",cursor:"pointer",border:"1px solid",borderColor:mode===m?"#C8A96E":"#333",background:mode===m?"#C8A96E":"transparent",color:mode===m?"#0f1923":"#555",transition:"all 0.15s"}}>
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
        <button onClick={onHow} style={{fontFamily:"'Bebas Neue',cursive",fontSize:"10px",letterSpacing:"1px",padding:"4px 8px",background:"transparent",border:"1px solid #333",color:"#666",borderRadius:"3px",cursor:"pointer"}}>HOW</button>
        <button onClick={onStats} style={{background:"none",border:"none",cursor:"pointer",fontSize:"16px",padding:"2px"}}>📊</button>
        <button onClick={onDark} style={{background:"none",border:"none",cursor:"pointer",fontSize:"15px",padding:"2px"}}>{dark?"☀️":"🌙"}</button>
      </div>
    </header>
  );
}

// ============================================================
// HOW TO PLAY
// ============================================================
function HowTo({dark,onClose}) {
  const bg=dark?"#0a0a0a":"#faf7f0", fg=dark?"#d4c9b8":"#1a1a2e", card=dark?"#141414":"#fff", border=dark?"#222":"#e8e0d0";
  return (
    <div style={{background:bg,minHeight:"calc(100vh - 52px)",padding:"20px 16px 40px",overflowY:"auto"}}>
      <div style={{maxWidth:"480px",margin:"0 auto"}}>
        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"clamp(32px,8vw,48px)",letterSpacing:"4px",color:"#C8A96E",marginBottom:"4px"}}>HOW TO PLAY</div>
        <div style={{fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"15px",color:dark?"#666":"#888",fontStyle:"italic",marginBottom:"24px",lineHeight:1.6}}>Group the players. Find the connection. Beat your time.</div>
        {[
          {n:"01",icon:"🏈",title:"16 PLAYERS",desc:"Every puzzle gives you 16 NFL players hiding in 4 secret groups of 4."},
          {n:"02",icon:"🤯",title:"FIND THE CONNECTION",desc:"What connects each group? Categories go beyond stats — expect the unexpected."},
          {n:"03",icon:"🏴",title:"4 DOWNS",desc:"4 wrong guesses and it's game over. You'll know when you're one away."},
          {n:"04",icon:"⚡",title:"SPEED WINS",desc:"Solve fast, make no mistakes. Your time is what you share with friends."},
          {n:"05",icon:"🔒",title:"CLEAN GAME",desc:"Solve all 4 with zero wrong downs and earn the CLEAN GAME badge on your share card."},
        ].map(s=>(
          <div key={s.n} style={{display:"flex",gap:"14px",marginBottom:"14px",background:card,border:`1px solid ${border}`,borderRadius:"10px",padding:"16px"}}>
            <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"24px",color:"#C8A96E",flexShrink:0,lineHeight:1,marginTop:"2px"}}>{s.n}</div>
            <div>
              <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"13px",letterSpacing:"2px",color:fg,marginBottom:"3px"}}>{s.icon} {s.title}</div>
              <div style={{fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"13px",color:dark?"#888":"#666",lineHeight:1.5}}>{s.desc}</div>
            </div>
          </div>
        ))}
        <div style={{background:card,border:`1px solid ${border}`,borderRadius:"10px",padding:"16px",marginBottom:"16px"}}>
          <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"12px",letterSpacing:"2px",color:fg,marginBottom:"10px"}}>🎨 DIFFICULTY</div>
          {[["#B8860B","1ST & EASY","Most players get this right away"],["#2E6B3E","2ND DOWN","You watch the games"],["#1B4F8A","3RD & LONG","You follow closely"],["#8B1A2A","4TH & GOAL","You live and breathe NFL"]].map(([c,t,d],i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:"10px",padding:"6px 0",borderBottom:i<3?`1px solid ${border}`:"none"}}>
              <div style={{width:"11px",height:"11px",borderRadius:"3px",background:c,flexShrink:0}}/>
              <div>
                <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:"12px",letterSpacing:"1px",color:fg}}>{t}</span>
                <span style={{fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"12px",color:dark?"#666":"#888",fontStyle:"italic",marginLeft:"8px"}}>{d}</span>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{width:"100%",fontFamily:"'Bebas Neue',cursive",fontSize:"16px",letterSpacing:"3px",padding:"16px",background:"#C8A96E",color:"#0f1923",border:"none",borderRadius:"8px",cursor:"pointer"}}>LET'S PLAY</button>
      </div>
    </div>
  );
}

// ============================================================
// TILE — mobile optimized
// ============================================================
function Tile({name,selected,onClick,dark,shaking}) {
  return (
    <button onClick={onClick} style={{
      fontFamily:"'Bebas Neue',cursive",
      fontSize:"clamp(10px,3.2vw,14px)",
      letterSpacing:"0.5px",
      padding:"0",
      height:"64px",
      width:"100%",
      display:"flex",alignItems:"center",justifyContent:"center",
      textAlign:"center",lineHeight:1.2,
      background:selected?(dark?"#1e2d4a":"#0f1923"):(dark?"#1c1c1c":"#ffffff"),
      color:selected?"#C8A96E":(dark?"#d4c9b8":"#1a1a2e"),
      border:`2px solid ${selected?"#C8A96E":(dark?"#2a2a2a":"#ddd6c4")}`,
      borderRadius:"8px",
      cursor:"pointer",
      transform:selected?"scale(1.02)":"scale(1)",
      boxShadow:selected?"0 0 0 3px rgba(200,169,110,0.15)":"0 1px 3px rgba(0,0,0,0.06)",
      transition:"all 0.15s ease",
      animation:shaking?"shake 0.5s ease":"none",
      WebkitTapHighlightColor:"transparent",
      touchAction:"manipulation"
    }}>{name}</button>
  );
}

// ============================================================
// SOLVED ROW
// ============================================================
function SolvedRow({group}) {
  return (
    <div style={{background:group.color,borderRadius:"8px",padding:"12px 14px",marginBottom:"6px",animation:"popIn 0.35s cubic-bezier(0.34,1.56,0.64,1)"}}>
      <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"9px",letterSpacing:"3px",color:"rgba(255,255,255,0.6)",marginBottom:"2px"}}>{DIFF_LABELS[group.difficulty]}</div>
      <div style={{fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"clamp(13px,3.5vw,17px)",fontWeight:"700",fontStyle:"italic",color:"#fff",lineHeight:1.2}}>{group.label}</div>
      <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"10px",letterSpacing:"1.5px",color:"rgba(255,255,255,0.7)",marginTop:"4px"}}>{group.players.join(" · ")}</div>
    </div>
  );
}

// ============================================================
// TIMER
// ============================================================
function Timer({running,onTick,dark}) {
  const [elapsed,setElapsed]=useState(0);
  const startRef=useRef(null),frameRef=useRef(null);
  useEffect(()=>{
    if(running){startRef.current=Date.now()-elapsed;const tick=()=>{const e=Date.now()-startRef.current;setElapsed(e);onTick(e);frameRef.current=requestAnimationFrame(tick);};frameRef.current=requestAnimationFrame(tick);}
    else cancelAnimationFrame(frameRef.current);
    return()=>cancelAnimationFrame(frameRef.current);
  },[running]);
  const s=Math.floor(elapsed/1000),m=Math.floor(s/60);
  return (
    <div style={{fontFamily:"'Courier New',monospace",fontSize:"20px",fontWeight:"700",color:elapsed>180000?"#c0392b":(dark?"#C8A96E":"#0f1923"),letterSpacing:"3px",textAlign:"center"}}>
      {`${m}:${String(s%60).padStart(2,"0")}`}
    </div>
  );
}

// ============================================================
// STATS MODAL
// ============================================================
function StatsModal({onClose,dark}) {
  const st=loadStats(),bg=dark?"#111":"#faf7f0",fg=dark?"#e0d5c5":"#1a1a2e",border=dark?"#222":"#e0d5c0";
  const winPct=st.played>0?Math.round((st.won/st.played)*100):0;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:"16px"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:bg,border:`2px solid ${border}`,borderRadius:"12px",padding:"24px",maxWidth:"340px",width:"100%"}}>
        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"24px",letterSpacing:"5px",color:"#C8A96E",textAlign:"center",marginBottom:"20px"}}>YOUR STATS</div>
        {st.streak>=3&&<div style={{textAlign:"center",fontFamily:"'Bebas Neue',cursive",fontSize:"18px",color:"#C8A96E",marginBottom:"14px",letterSpacing:"2px"}}>🔥 {st.streak}-DAY STREAK</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"10px",marginBottom:"20px"}}>
          {[["PLAYED",st.played],["WIN %",`${winPct}%`],["STREAK",st.streak],["BEST",st.bestStreak]].map(([l,v])=>(
            <div key={l} style={{textAlign:"center",background:dark?"#1a1a1a":"#f0ebe0",padding:"12px 4px",borderRadius:"8px"}}>
              <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"26px",color:fg,lineHeight:1}}>{v}</div>
              <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"8px",letterSpacing:"2px",color:"#888",marginTop:"2px"}}>{l}</div>
            </div>
          ))}
        </div>
        {st.scores.length>0&&(
          <div style={{marginBottom:"4px"}}>
            <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"10px",letterSpacing:"3px",color:"#888",marginBottom:"8px"}}>RECENT TIMES</div>
            <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
              {st.scores.slice(-10).reverse().map((s,i)=>(
                <div key={i} style={{fontFamily:"'Bebas Neue',cursive",fontSize:"13px",color:"#C8A96E",background:dark?"#1a1a1a":"#f0ebe0",padding:"4px 8px",borderRadius:"4px"}}>{s}</div>
              ))}
            </div>
          </div>
        )}
        <button onClick={onClose} style={{marginTop:"20px",width:"100%",fontFamily:"'Bebas Neue',cursive",fontSize:"14px",letterSpacing:"3px",padding:"14px",background:"#C8A96E",color:"#0f1923",border:"none",borderRadius:"6px",cursor:"pointer"}}>CLOSE</button>
      </div>
    </div>
  );
}

// ============================================================
// RESULT MODAL — mobile optimized
// ============================================================
function ResultModal({puzzle,solved,wrong,ms,onPlayAgain,dark}) {
  const [copied,setCopied]=useState(false);
  const won=solved.length===4,bg=dark?"#111":"#faf7f0",fg=dark?"#e0d5c5":"#1a1a2e";
  const st=loadStats();
  const cleanGame=wrong===0;
  const shareText=buildShare(puzzle,solved,wrong,ms,st.streak);

  const copy=()=>{navigator.clipboard.writeText(shareText).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2200);});};
  const shareToX=()=>window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,"_blank");
  const nativeShare=()=>{ if(navigator.share){navigator.share({title:"DRAFT",text:shareText,url:"https://playdraft.app"});}else{copy();} };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:300,padding:"0"}}>
      <div style={{background:bg,borderRadius:"16px 16px 0 0",padding:"24px 20px 36px",width:"100%",maxWidth:"480px",border:`2px solid ${won?"#C8A96E":"#8B1A2A"}`,borderBottom:"none",maxHeight:"90vh",overflowY:"auto"}}>
        {/* Handle bar */}
        <div style={{width:"40px",height:"4px",background:dark?"#333":"#ddd",borderRadius:"2px",margin:"0 auto 20px"}}/>

        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"38px",letterSpacing:"4px",color:won?"#C8A96E":"#8B1A2A",textAlign:"center",lineHeight:1,marginBottom:"4px"}}>
          {won?(cleanGame?"CLEAN GAME 🔒":"NICE WORK"):"GAME OVER"}
        </div>

        {st.streak>=3&&won&&(
          <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"16px",color:"#C8A96E",textAlign:"center",marginBottom:"6px",letterSpacing:"2px"}}>🔥 {st.streak}-DAY STREAK</div>
        )}

        <div style={{fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"13px",color:"#888",textAlign:"center",marginBottom:"20px",fontStyle:"italic"}}>{puzzle.title}</div>

        {/* Time prominent */}
        <div style={{textAlign:"center",marginBottom:"20px"}}>
          <div style={{fontFamily:"'Courier New',monospace",fontSize:"42px",fontWeight:"700",color:fg,letterSpacing:"2px",lineHeight:1}}>{fmt(ms)}</div>
          <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"10px",letterSpacing:"3px",color:"#888",marginTop:"4px"}}>FINAL TIME</div>
        </div>

        {/* Stats row */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"20px"}}>
          {[["DOWNS LEFT",4-wrong],["RESULT",won?(cleanGame?"CLEAN":"WIN"):"LOSS"]].map(([l,v])=>(
            <div key={l} style={{textAlign:"center",background:dark?"#181818":"#f0ebe0",padding:"12px 6px",borderRadius:"8px"}}>
              <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"22px",color:fg,lineHeight:1}}>{v}</div>
              <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"9px",letterSpacing:"2px",color:"#888",marginTop:"2px"}}>{l}</div>
            </div>
          ))}
        </div>

        {/* Category reveals */}
        <div style={{marginBottom:"20px"}}>
          {puzzle.groups.sort((a,b)=>a.difficulty-b.difficulty).map(g=>{
            const s=solved.find(x=>x.id===g.id);
            return (
              <div key={g.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"7px 0",borderBottom:`1px solid ${dark?"#1e1e1e":"#ece4d4"}`}}>
                <div style={{width:"11px",height:"11px",borderRadius:"3px",background:s?g.color:"#444",flexShrink:0}}/>
                <div style={{fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"12px",fontStyle:"italic",color:s?fg:"#666"}}>{g.label}</div>
              </div>
            );
          })}
        </div>

        {/* Share buttons */}
        <div style={{marginBottom:"10px"}}>
          <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"10px",letterSpacing:"3px",color:"#888",textAlign:"center",marginBottom:"10px"}}>SHARE YOUR RESULT</div>
          <div style={{display:"flex",gap:"8px",marginBottom:"8px"}}>
            <button onClick={nativeShare} style={{flex:2,fontFamily:"'Bebas Neue',cursive",fontSize:"14px",letterSpacing:"2px",padding:"14px",background:"#C8A96E",color:"#0f1923",border:"none",borderRadius:"8px",cursor:"pointer"}}>
              📲 SHARE
            </button>
            <button onClick={shareToX} style={{flex:1,fontFamily:"'Bebas Neue',cursive",fontSize:"14px",letterSpacing:"2px",padding:"14px",background:"#000",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer"}}>
              𝕏 POST
            </button>
            <button onClick={copy} style={{flex:1,fontFamily:"'Bebas Neue',cursive",fontSize:"14px",letterSpacing:"2px",padding:"14px",background:copied?"#2E6B3E":(dark?"#222":"#f0ebe0"),color:copied?"#fff":(dark?"#888":"#999"),border:"none",borderRadius:"8px",cursor:"pointer",transition:"background 0.2s"}}>
              {copied?"✓":"📋"}
            </button>
          </div>
        </div>

        <button onClick={onPlayAgain} style={{width:"100%",fontFamily:"'Bebas Neue',cursive",fontSize:"14px",letterSpacing:"2px",padding:"14px",background:"transparent",color:fg,border:`2px solid ${dark?"#333":"#c8bfae"}`,borderRadius:"8px",cursor:"pointer"}}>
          PLAY AGAIN
        </button>
      </div>
    </div>
  );
}

// ============================================================
// LANDING — mobile first
// ============================================================
function Landing({onPlay,dark,mode}) {
  const bg=dark?"#0a0a0a":"#faf7f0",fg=dark?"#d4c9b8":"#1a1a2e";
  const isPractice=mode==="practice";
  const sports=[{icon:"🏈",name:"NFL",status:"live"},{icon:"🏀",name:"NBA",status:"soon"},{icon:"⚾",name:"MLB",status:"soon"},{icon:"🏒",name:"NHL",status:"soon"}];

  return (
    <div style={{minHeight:"calc(100vh - 52px)",background:bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px 40px",textAlign:"center"}}>

      <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"clamp(72px,22vw,120px)",letterSpacing:"4px",color:"#C8A96E",lineHeight:0.85,marginBottom:"10px",textShadow:`3px 3px 0 ${dark?"rgba(0,0,0,0.5)":"rgba(15,25,35,0.2)"}`}}>DRAFT</div>

      <div style={{fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"clamp(14px,4vw,18px)",color:dark?"#666":"#777",fontStyle:"italic",marginBottom:"28px",maxWidth:"320px",lineHeight:1.6}}>
        {isPractice ? "Sharpen your game. No streak on the line." : "Think you know NFL? Prove it."}
      </div>

      {/* Demo tiles */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"8px",maxWidth:"280px",width:"100%",marginBottom:"12px"}}>
        {["RANDY MOSS","TERRELL OWENS","CHAD JOHNSON","ANTONIO BROWN"].map((p,i)=>(
          <div key={p} style={{fontFamily:"'Bebas Neue',cursive",fontSize:"12px",letterSpacing:"1px",padding:"14px 6px",textAlign:"center",background:dark?"#181818":"#fff",border:`2px solid ${dark?"#2a2a2a":"#ddd6c4"}`,borderRadius:"8px",color:fg,animation:`fadeUp 0.4s ease ${i*0.08}s both"}`}}>{p}</div>
        ))}
      </div>

      <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"9px",letterSpacing:"3px",color:"#C8A96E",marginBottom:"5px"}}>FIND THE CONNECTION</div>
      <div style={{fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"clamp(12px,3.5vw,15px)",color:fg,fontStyle:"italic",marginBottom:"28px",background:dark?"#181818":"#f0ebe0",padding:"10px 20px",borderRadius:"6px",border:`1px solid ${dark?"#2a2a2a":"#ddd6c4"}`,maxWidth:"300px"}}>
        Famous for being impossible to coach 😤
      </div>

      <button
        onClick={onPlay}
        style={{fontFamily:"'Bebas Neue',cursive",fontSize:"18px",letterSpacing:"4px",padding:"18px 0",width:"100%",maxWidth:"300px",background:"#C8A96E",color:"#0f1923",border:"none",borderRadius:"10px",cursor:"pointer",boxShadow:"0 4px 20px rgba(200,169,110,0.4)",marginBottom:"28px",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}
      >
        {isPractice ? "PRACTICE MODE" : "PLAY TODAY'S DRAFT"}
      </button>

      {/* Sports pills */}
      <div style={{display:"flex",gap:"8px",marginBottom:"24px",flexWrap:"wrap",justifyContent:"center"}}>
        {sports.map(s=>(
          <div key={s.name} style={{display:"flex",alignItems:"center",gap:"5px",padding:"5px 10px",borderRadius:"20px",border:`1px solid ${s.status==="live"?"#C8A96E":(dark?"#222":"#e0d8cc")}`,background:s.status==="live"?(dark?"rgba(200,169,110,0.1)":"rgba(200,169,110,0.08)"):"transparent"}}>
            <span style={{fontSize:"12px"}}>{s.icon}</span>
            <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:"10px",letterSpacing:"2px",color:s.status==="live"?"#C8A96E":(dark?"#333":"#bbb")}}>{s.name}</span>
            {s.status==="live"
              ?<span style={{fontFamily:"'Bebas Neue',cursive",fontSize:"7px",letterSpacing:"1px",color:"#4A7C59",background:dark?"rgba(74,124,89,0.2)":"rgba(74,124,89,0.15)",padding:"1px 4px",borderRadius:"3px"}}>LIVE</span>
              :<span style={{fontFamily:"'Bebas Neue',cursive",fontSize:"7px",letterSpacing:"1px",color:dark?"#444":"#bbb",background:dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.05)",padding:"1px 4px",borderRadius:"3px"}}>SOON</span>
            }
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:"16px",flexWrap:"wrap",justifyContent:"center"}}>
        {[["🏈","16 PLAYERS"],["🏴","4 DOWNS"],["⚡","BEAT THE CLOCK"],["🤯","FIND THE CONNECTION"]].map(([ic,tx])=>(
          <div key={tx} style={{fontFamily:"'Bebas Neue',cursive",fontSize:"10px",letterSpacing:"2px",color:dark?"#444":"#aaa",display:"flex",alignItems:"center",gap:"4px"}}>
            <span style={{fontSize:"12px"}}>{ic}</span>{tx}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// GAME — mobile optimized
// ============================================================
function Game({puzzle,dark,onFinish}) {
  const [tiles,setTiles]=useState(()=>shuffle(puzzle.players));
  const [selected,setSelected]=useState([]);
  const [solved,setSolved]=useState([]);
  const [wrong,setWrong]=useState(0);
  const [timeMs,setTimeMs]=useState(0);
  const [timerOn,setTimerOn]=useState(true);
  const [over,setOver]=useState(false);
  const [shaking,setShaking]=useState([]);
  const [toast,setToast]=useState(null);
  const [showResult,setShowResult]=useState(false);
  const toastRef=useRef(null);
  const bg=dark?"#0a0a0a":"#faf7f0";

  const showToast=(msg,dur=1800)=>{clearTimeout(toastRef.current);setToast(msg);toastRef.current=setTimeout(()=>setToast(null),dur);};
  const handleTile=name=>{if(over)return;setSelected(prev=>prev.includes(name)?prev.filter(p=>p!==name):prev.length<4?[...prev,name]:prev);};

  const handleSubmit=()=>{
    if(selected.length!==4||over)return;
    const group=puzzle.groups.find(g=>selected.every(p=>g.players.includes(p))&&g.players.every(p=>selected.includes(p)));
    if(group){
      const ns=[...solved,group];setSolved(ns);setSelected([]);
      showToast(["LOCKED IN 🔒","TOUCHDOWN! 🏈","YOU GOT IT!","NICE READ! 🎯","FIRST DOWN! ✅"][Math.floor(Math.random()*5)]);
      if(ns.length===4){
        setTimerOn(false);setOver(true);
        setTimeout(()=>setShowResult(true),700);
        const st=loadStats(),today=new Date().toDateString(),yest=new Date(Date.now()-86400000).toDateString();
        st.played++;st.won++;st.scores=[...(st.scores||[]),fmt(timeMs)];
        if(st.lastPlayed!==today)st.streak=st.lastPlayed===yest?st.streak+1:1;
        st.bestStreak=Math.max(st.streak,st.bestStreak);st.lastPlayed=today;saveStats(st);
      }
    } else {
      const oneAway=puzzle.groups.some(g=>selected.filter(p=>g.players.includes(p)).length===3);
      setShaking([...selected]);setTimeout(()=>setShaking([]),550);
      if(oneAway)showToast("ONE AWAY... 👀",2200);
      else showToast(["FUMBLE 😬","INTERCEPTION! 🙈","DELAY OF GAME 🚩","TURNOVER! 😤","SACKED! 🏃"][Math.floor(Math.random()*5)]);
      const nw=wrong+1;setWrong(nw);setSelected([]);
      if(nw>=4){setTimerOn(false);setOver(true);setTimeout(()=>setShowResult(true),500);
        const st=loadStats(),today=new Date().toDateString();
        st.played++;st.scores=[...(st.scores||[]),"DNF"];st.streak=0;st.lastPlayed=today;saveStats(st);}
    }
  };

  const unsolved=tiles.filter(p=>!solved.some(g=>g.players.includes(p)));

  return (
    <div style={{background:bg,minHeight:"calc(100vh - 52px)",display:"flex",flexDirection:"column",padding:"12px 12px 24px"}}>
      <div style={{maxWidth:"480px",margin:"0 auto",width:"100%",flex:1,display:"flex",flexDirection:"column"}}>

        {/* Top bar */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
          <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"11px",letterSpacing:"3px",color:dark?"#444":"#aaa"}}>{puzzle.title}</div>
          <Timer running={timerOn} onTick={setTimeMs} dark={dark}/>
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"8px",letterSpacing:"2px",color:dark?"#444":"#aaa"}}>DOWNS</div>
            <div style={{display:"flex",gap:"4px",justifyContent:"flex-end",marginTop:"2px"}}>
              {[...Array(4)].map((_,i)=>(
                <div key={i} style={{width:"10px",height:"10px",borderRadius:"50%",background:i<(4-wrong)?"#C8A96E":(dark?"#222":"#e0d8cc"),transition:"background 0.3s"}}/>
              ))}
            </div>
          </div>
        </div>

        {/* Solved rows */}
        {solved.sort((a,b)=>a.difficulty-b.difficulty).map(g=>(
          <SolvedRow key={g.id} group={g} dark={dark}/>
        ))}

        {/* Grid — fills available space */}
        {unsolved.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"6px",marginBottom:"12px",flex:1}}>
            {unsolved.map(name=>(
              <Tile key={name} name={name} selected={selected.includes(name)} onClick={()=>handleTile(name)} dark={dark} shaking={shaking.includes(name)}/>
            ))}
          </div>
        )}

        {/* Controls — bottom anchored, thumb-friendly */}
        {!over&&(
          <div style={{display:"flex",flexDirection:"column",gap:"8px",marginTop:"auto"}}>
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={()=>setTiles(shuffle(unsolved))} style={{flex:1,fontFamily:"'Bebas Neue',cursive",fontSize:"13px",letterSpacing:"2px",padding:"14px",background:"transparent",color:dark?"#666":"#888",border:`1px solid ${dark?"#2a2a2a":"#ccc"}`,borderRadius:"8px",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>SHUFFLE</button>
              <button onClick={()=>setSelected([])} disabled={!selected.length} style={{flex:1,fontFamily:"'Bebas Neue',cursive",fontSize:"13px",letterSpacing:"2px",padding:"14px",background:"transparent",color:selected.length?(dark?"#d4c9b8":"#1a1a2e"):"#888",border:`1px solid ${selected.length?(dark?"#444":"#999"):(dark?"#222":"#ddd")}`,borderRadius:"8px",cursor:selected.length?"pointer":"default",WebkitTapHighlightColor:"transparent"}}>CLEAR</button>
              <button onClick={handleSubmit} disabled={selected.length!==4} style={{flex:2,fontFamily:"'Bebas Neue',cursive",fontSize:"15px",letterSpacing:"2px",padding:"14px",background:selected.length===4?"#C8A96E":(dark?"#1e1e1e":"#ece4d4"),color:selected.length===4?"#0f1923":(dark?"#333":"#bbb"),border:"none",borderRadius:"8px",cursor:selected.length===4?"pointer":"default",transition:"background 0.15s",WebkitTapHighlightColor:"transparent"}}>SUBMIT</button>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast&&(
          <div style={{position:"fixed",top:"64px",left:"50%",transform:"translateX(-50%)",fontFamily:"'Bebas Neue',cursive",fontSize:"16px",letterSpacing:"3px",background:dark?"#1a1a1a":"#0f1923",color:"#C8A96E",padding:"10px 22px",borderRadius:"8px",boxShadow:"0 4px 20px rgba(0,0,0,0.5)",zIndex:200,border:"1px solid rgba(200,169,110,0.3)",whiteSpace:"nowrap",animation:"toastIn 0.2s ease"}}>
            {toast}
          </div>
        )}

        {showResult&&<ResultModal puzzle={puzzle} solved={solved} wrong={wrong} ms={timeMs} dark={dark} onPlayAgain={onFinish}/>}
      </div>
    </div>
  );
}

// ============================================================
// ROOT
// ============================================================
export default function App() {
  const [dark,setDark]=useState(false);
  const [screen,setScreen]=useState("home");
  const [showStats,setShowStats]=useState(false);
  const [mode,setMode]=useState("daily");
  const [practiceIdx,setPracticeIdx]=useState(0);
  const puzzle=getPuzzle(mode,practiceIdx);
  const handleModeChange=m=>{setMode(m);setScreen("home");};
  const handleFinish=()=>{if(mode==="practice")setPracticeIdx(i=>(i+1)%PUZZLES.length);setScreen("home");};

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{height:100%;background:${dark?"#0a0a0a":"#faf7f0"};}
        @keyframes popIn{from{opacity:0;transform:translateY(-10px) scale(0.97);}to{opacity:1;transform:translateY(0) scale(1);}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-6px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
        @keyframes shake{0%,100%{transform:translateX(0);}20%{transform:translateX(-5px);}40%{transform:translateX(5px);}60%{transform:translateX(-3px);}80%{transform:translateX(3px);}}
        button:focus-visible{outline:2px solid #C8A96E;outline-offset:2px;}
        button{-webkit-tap-highlight-color:transparent;}
      `}</style>
      <Header dark={dark} onDark={()=>setDark(d=>!d)} onStats={()=>setShowStats(true)} onHome={()=>setScreen("home")} onHow={()=>setScreen("howto")} mode={mode} onMode={handleModeChange}/>
      {screen==="home"&&<Landing onPlay={()=>setScreen("game")} dark={dark} mode={mode}/>}
      {screen==="game"&&<Game key={`${puzzle.id}-${mode}-${practiceIdx}`} puzzle={puzzle} dark={dark} onFinish={handleFinish}/>}
      {screen==="howto"&&<HowTo dark={dark} onClose={()=>setScreen("home")}/>}
      {showStats&&<StatsModal onClose={()=>setShowStats(false)} dark={dark}/>}
    </>
  );
}
