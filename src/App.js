import { useState, useEffect, useRef } from "react";

// ============================================================
// PUZZLE DATA
// ============================================================
const PUZZLES = [
  {
    id: 1, title: "ROUND 1",
    players: ["BARRY SANDERS","ADRIAN PETERSON","DERRICK HENRY","SAQUON BARKLEY","DAN MARINO","WARREN MOON","DAN FOUTS","JIM KELLY","PEYTON MANNING","ANDREW LUCK","JEFF GEORGE","JOHN ELWAY","MEL BLOUNT","TOM BRADY","TOM DEMPSEY","ROY WILLIAMS"],
    groups: [
      { id:"A", players:["BARRY SANDERS","ADRIAN PETERSON","DERRICK HENRY","SAQUON BARKLEY"], label:"RUSHED FOR 2,000+ YARDS IN A SINGLE SEASON", color:"#B8860B", difficulty:1 },
      { id:"B", players:["DAN MARINO","WARREN MOON","DAN FOUTS","JIM KELLY"], label:"HALL OF FAME QUARTERBACKS WHO NEVER WON A SUPER BOWL", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["PEYTON MANNING","ANDREW LUCK","JEFF GEORGE","JOHN ELWAY"], label:"DRAFTED #1 OVERALL BY THE INDIANAPOLIS COLTS", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["MEL BLOUNT","TOM BRADY","TOM DEMPSEY","ROY WILLIAMS"], label:"FAMOUSLY INSPIRED AN NFL RULE CHANGE", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 2, title: "ROUND 2",
    players: ["TOM BRADY","PEYTON MANNING","AARON RODGERS","PATRICK MAHOMES","BRUCE SMITH","REGGIE WHITE","KEVIN GREENE","JULIUS PEPPERS","RYAN LEAF","JaMARCUS RUSSELL","TRENT RICHARDSON","VINCE YOUNG","TERRY BRADSHAW","BRETT FAVRE","DEION SANDERS","LAWRENCE TAYLOR"],
    groups: [
      { id:"A", players:["TOM BRADY","PEYTON MANNING","AARON RODGERS","PATRICK MAHOMES"], label:"WON NFL MVP MULTIPLE TIMES", color:"#B8860B", difficulty:1 },
      { id:"B", players:["BRUCE SMITH","REGGIE WHITE","KEVIN GREENE","JULIUS PEPPERS"], label:"TOP 5 ALL-TIME IN NFL CAREER SACKS", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["RYAN LEAF","JaMARCUS RUSSELL","TRENT RICHARDSON","VINCE YOUNG"], label:"TOP-5 DRAFT PICKS CONSIDERED ALL-TIME BUSTS", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["TERRY BRADSHAW","BRETT FAVRE","DEION SANDERS","LAWRENCE TAYLOR"], label:"ACTED IN A MAJOR HOLLYWOOD MOVIE", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 3, title: "ROUND 3",
    players: ["PEYTON MANNING","ELI MANNING","ARCHIE MANNING","COOPER MANNING","BO JACKSON","DEION SANDERS","RUSSELL WILSON","KYLER MURRAY","JOE HORN","BRANDON MARSHALL","ANTONIO BROWN","STEVIE JOHNSON","DAVID TYREE","SANTONIO HOLMES","LYNN SWANN","JOHN TAYLOR"],
    groups: [
      { id:"A", players:["PEYTON MANNING","ELI MANNING","ARCHIE MANNING","COOPER MANNING"], label:"THE MANNING FAMILY", color:"#B8860B", difficulty:1 },
      { id:"B", players:["BO JACKSON","DEION SANDERS","RUSSELL WILSON","KYLER MURRAY"], label:"DRAFTED BY BOTH AN NFL TEAM AND AN MLB TEAM", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["JOE HORN","BRANDON MARSHALL","ANTONIO BROWN","STEVIE JOHNSON"], label:"FINED BY THE NFL FOR A TOUCHDOWN CELEBRATION", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["DAVID TYREE","SANTONIO HOLMES","LYNN SWANN","JOHN TAYLOR"], label:"MADE THE DEFINING CATCH IN A SUPER BOWL-WINNING DRIVE", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 4, title: "ROUND 4",
    players: ["TOM BRADY","DREW BREES","MATTHEW STAFFORD","PATRICK MAHOMES","BARRY SANDERS","CALVIN JOHNSON","ANDREW LUCK","ROB GRONKOWSKI","JERRY RICE","TONY GONZALEZ","LARRY FITZGERALD","JASON WITTEN","JOE NAMATH","JOHNNY UNITAS","BART STARR","ROGER STAUBACH"],
    groups: [
      { id:"A", players:["TOM BRADY","DREW BREES","MATTHEW STAFFORD","PATRICK MAHOMES"], label:"THREW FOR 5,000+ YARDS IN A SINGLE SEASON", color:"#B8860B", difficulty:1 },
      { id:"B", players:["BARRY SANDERS","CALVIN JOHNSON","ANDREW LUCK","ROB GRONKOWSKI"], label:"RETIRED EARLY WHILE STILL PLAYING AT AN ELITE LEVEL", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["JERRY RICE","TONY GONZALEZ","LARRY FITZGERALD","JASON WITTEN"], label:"TOP 5 ALL-TIME IN NFL CAREER RECEPTIONS", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["JOE NAMATH","JOHNNY UNITAS","BART STARR","ROGER STAUBACH"], label:"WON A SUPER BOWL BEFORE 1980", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 5, title: "ROUND 5",
    players: ["CAM NEWTON","MATT RYAN","LAMAR JACKSON","JOSH ALLEN","JIM BROWN","JOHNNY UNITAS","WALTER PAYTON","DICK BUTKUS","JOHN ELWAY","ELI MANNING","BO JACKSON","JIM KELLY","ANTWAAN RANDLE EL","HINES WARD","JULIAN EDELMAN","TERRELLE PRYOR"],
    groups: [
      { id:"A", players:["CAM NEWTON","MATT RYAN","LAMAR JACKSON","JOSH ALLEN"], label:"WON NFL MVP AT LEAST ONCE", color:"#B8860B", difficulty:1 },
      { id:"B", players:["JIM BROWN","JOHNNY UNITAS","WALTER PAYTON","DICK BUTKUS"], label:"NAMED TO THE NFL 100 ALL-TIME TEAM", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["JOHN ELWAY","ELI MANNING","BO JACKSON","JIM KELLY"], label:"FAMOUSLY REFUSED TO PLAY FOR THE TEAM THAT DRAFTED THEM", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["ANTWAAN RANDLE EL","HINES WARD","JULIAN EDELMAN","TERRELLE PRYOR"], label:"PLAYED QUARTERBACK IN COLLEGE, SWITCHED TO WIDE RECEIVER IN THE NFL", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 6, title: "ROUND 6",
    players: ["JOE MONTANA","PATRICK MAHOMES","ELI MANNING","TROY AIKMAN","MARSHAWN LYNCH","JIM MORA SR.","DENNIS GREEN","HERM EDWARDS","JERRY RICE","RANDY MOSS","TERRELL OWENS","CRIS CARTER","BRETT FAVRE","TOM BRADY","ROB GRONKOWSKI","DEION SANDERS"],
    groups: [
      { id:"A", players:["JOE MONTANA","PATRICK MAHOMES","ELI MANNING","TROY AIKMAN"], label:"WON SUPER BOWL MVP", color:"#B8860B", difficulty:1 },
      { id:"B", players:["MARSHAWN LYNCH","JIM MORA SR.","DENNIS GREEN","HERM EDWARDS"], label:"DELIVERED A NOTORIOUS POST-GAME PRESS CONFERENCE", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["JERRY RICE","RANDY MOSS","TERRELL OWENS","CRIS CARTER"], label:"TOP 5 ALL-TIME IN NFL CAREER RECEIVING TOUCHDOWNS", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["BRETT FAVRE","TOM BRADY","ROB GRONKOWSKI","DEION SANDERS"], label:"RETIRED, THEN OFFICIALLY CAME BACK TO PLAY", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 7, title: "ROUND 7",
    players: ["PEYTON MANNING","CAM NEWTON","MYLES GARRETT","TREVOR LAWRENCE","TONY ROMO","TROY AIKMAN","CRIS COLLINSWORTH","KURT WARNER","DESMOND HOWARD","MARCUS ALLEN","JIM PLUNKETT","ROGER STAUBACH","DAVID TYREE","SANTONIO HOLMES","ODELL BECKHAM JR.","DWIGHT CLARK"],
    groups: [
      { id:"A", players:["PEYTON MANNING","CAM NEWTON","MYLES GARRETT","TREVOR LAWRENCE"], label:"FIRST OVERALL PICKS IN THE NFL DRAFT", color:"#B8860B", difficulty:1 },
      { id:"B", players:["TONY ROMO","TROY AIKMAN","CRIS COLLINSWORTH","KURT WARNER"], label:"WENT STRAIGHT TO THE BROADCAST BOOTH AFTER RETIRING", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["DESMOND HOWARD","MARCUS ALLEN","JIM PLUNKETT","ROGER STAUBACH"], label:"WON A HEISMAN TROPHY AND A SUPER BOWL MVP", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["DAVID TYREE","SANTONIO HOLMES","ODELL BECKHAM JR.","DWIGHT CLARK"], label:"FAMOUS FOR ONE ICONIC INDIVIDUAL CATCH", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 8, title: "ROUND 8",
    players: ["PEYTON MANNING","DAN MARINO","MATTHEW STAFFORD","PHILIP RIVERS","JERRY RICE","LARRY FITZGERALD","TERRELL OWENS","RANDY MOSS","WARREN MOON","ANTONIO GATES","JOHN RANDLE","WILLIE BROWN","EMMITT SMITH","HINES WARD","DONALD DRIVER","RASHAD JENNINGS"],
    groups: [
      { id:"A", players:["PEYTON MANNING","DAN MARINO","MATTHEW STAFFORD","PHILIP RIVERS"], label:"THREW FOR 4,000+ YARDS IN A SINGLE SEASON", color:"#B8860B", difficulty:1 },
      { id:"B", players:["JERRY RICE","LARRY FITZGERALD","TERRELL OWENS","RANDY MOSS"], label:"TOP 5 ALL-TIME IN NFL CAREER RECEIVING YARDS", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["WARREN MOON","ANTONIO GATES","JOHN RANDLE","WILLIE BROWN"], label:"UNDRAFTED HALL OF FAMERS", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["EMMITT SMITH","HINES WARD","DONALD DRIVER","RASHAD JENNINGS"], label:"WON DANCING WITH THE STARS", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 9, title: "ROUND 9",
    players: ["DERRICK HENRY","JULIO JONES","MARK INGRAM","TUA TAGOVAILOA","DAN MARINO","BARRY SANDERS","RANDY MOSS","ERIC DICKERSON","RAY LEWIS","ED REED","BRIAN URLACHER","JASON TAYLOR","CHAD JOHNSON","TERRELL OWENS","MARSHAWN LYNCH","BILLY WHITE SHOES JOHNSON"],
    groups: [
      { id:"A", players:["DERRICK HENRY","JULIO JONES","MARK INGRAM","TUA TAGOVAILOA"], label:"PLAYED COLLEGE FOOTBALL AT ALABAMA", color:"#B8860B", difficulty:1 },
      { id:"B", players:["DAN MARINO","BARRY SANDERS","RANDY MOSS","ERIC DICKERSON"], label:"HALL OF FAMERS WHO NEVER WON A SUPER BOWL", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["RAY LEWIS","ED REED","BRIAN URLACHER","JASON TAYLOR"], label:"WON DEFENSIVE PLAYER OF THE YEAR IN THE 2000s", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["CHAD JOHNSON","TERRELL OWENS","MARSHAWN LYNCH","BILLY WHITE SHOES JOHNSON"], label:"FAMOUS FOR A TOUCHDOWN CELEBRATION FINE", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 10, title: "ROUND 10",
    players: ["TOM BRADY","PEYTON MANNING","PATRICK MAHOMES","DAN MARINO","EMMITT SMITH","WALTER PAYTON","FRANK GORE","BARRY SANDERS","J.J. WATT","LUKE KUECHLY","KHALIL MACK","AARON DONALD","DESMOND HOWARD","MALCOLM SMITH","LARRY BROWN","DEXTER JACKSON"],
    groups: [
      { id:"A", players:["TOM BRADY","PEYTON MANNING","PATRICK MAHOMES","DAN MARINO"], label:"THREW FOR 40+ TOUCHDOWNS IN A SINGLE SEASON", color:"#B8860B", difficulty:1 },
      { id:"B", players:["EMMITT SMITH","WALTER PAYTON","FRANK GORE","BARRY SANDERS"], label:"TOP 5 ALL-TIME NFL RUSHING YARD LEADERS", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["J.J. WATT","LUKE KUECHLY","KHALIL MACK","AARON DONALD"], label:"WON DEFENSIVE PLAYER OF THE YEAR IN THE 2010s", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["DESMOND HOWARD","MALCOLM SMITH","LARRY BROWN","DEXTER JACKSON"], label:"WON SUPER BOWL MVP AS A NON-QUARTERBACK", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 11, title: "ROUND 11",
    players: ["TOM BRADY","JOE MONTANA","TROY AIKMAN","PATRICK MAHOMES","CAM NEWTON","SAQUON BARKLEY","ODELL BECKHAM JR.","DAK PRESCOTT","KURT WARNER","MARSHALL FAULK","ISAAC BRUCE","TORRY HOLT","BRETT FAVRE","JERRY RICE","EMMITT SMITH","ADAM VINATIERI"],
    groups: [
      { id:"A", players:["TOM BRADY","JOE MONTANA","TROY AIKMAN","PATRICK MAHOMES"], label:"WON 3+ SUPER BOWLS AS A STARTING QUARTERBACK", color:"#B8860B", difficulty:1 },
      { id:"B", players:["CAM NEWTON","SAQUON BARKLEY","ODELL BECKHAM JR.","DAK PRESCOTT"], label:"WON NFL OFFENSIVE ROOKIE OF THE YEAR", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["KURT WARNER","MARSHALL FAULK","ISAAC BRUCE","TORRY HOLT"], label:"PLAYED FOR \"THE GREATEST SHOW ON TURF\" RAMS", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["BRETT FAVRE","JERRY RICE","EMMITT SMITH","ADAM VINATIERI"], label:"CURRENTLY HOLDS AN ALL-TIME NFL CAREER RECORD", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 12, title: "ROUND 12",
    players: ["ERIC DICKERSON","CHRIS JOHNSON","JAMAL LEWIS","TERRELL DAVIS","TOM BRADY","GEORGE BLANDA","MORTEN ANDERSEN","ADAM VINATIERI","BRUCE SMITH","REGGIE WHITE","DEION SANDERS","WARREN SAPP","JOE MONTANA","TIM BROWN","JEROME BETTIS","JOE THEISMANN"],
    groups: [
      { id:"A", players:["ERIC DICKERSON","CHRIS JOHNSON","JAMAL LEWIS","TERRELL DAVIS"], label:"RUSHED FOR 2,000+ YARDS IN A SINGLE SEASON", color:"#B8860B", difficulty:1 },
      { id:"B", players:["TOM BRADY","GEORGE BLANDA","MORTEN ANDERSEN","ADAM VINATIERI"], label:"PLAYED 20+ NFL SEASONS", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["BRUCE SMITH","REGGIE WHITE","DEION SANDERS","WARREN SAPP"], label:"WON DEFENSIVE PLAYER OF THE YEAR IN THE 1990s", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["JOE MONTANA","TIM BROWN","JEROME BETTIS","JOE THEISMANN"], label:"PLAYED COLLEGE FOOTBALL AT NOTRE DAME", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 13, title: "ROUND 13",
    players: ["TOM BRADY","ROB GRONKOWSKI","JULIAN EDELMAN","WES WELKER","JOHN ELWAY","JEROME BETTIS","PEYTON MANNING","RAY LEWIS","ANDREW LUCK","JOE BURROW","ERIC BERRY","ALEX SMITH","TERRY BRADSHAW","FRANCO HARRIS","LYNN SWANN","MEAN JOE GREENE"],
    groups: [
      { id:"A", players:["TOM BRADY","ROB GRONKOWSKI","JULIAN EDELMAN","WES WELKER"], label:"PLAYED FOR THE NEW ENGLAND PATRIOTS DYNASTY (2001-2018)", color:"#B8860B", difficulty:1 },
      { id:"B", players:["JOHN ELWAY","JEROME BETTIS","PEYTON MANNING","RAY LEWIS"], label:"WON A SUPER BOWL IN THEIR FINAL NFL SEASON", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["ANDREW LUCK","JOE BURROW","ERIC BERRY","ALEX SMITH"], label:"WON AP NFL COMEBACK PLAYER OF THE YEAR", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["TERRY BRADSHAW","FRANCO HARRIS","LYNN SWANN","MEAN JOE GREENE"], label:"PLAYED ON THE PITTSBURGH STEELERS DYNASTY OF THE 1970s", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 14, title: "ROUND 14",
    players: ["ADRIAN PETERSON","LaDAINIAN TOMLINSON","MARSHALL FAULK","MARCUS ALLEN","LAMAR JACKSON","COOPER KUPP","JUSTIN JEFFERSON","SAQUON BARKLEY","JIM KELLY","THURMAN THOMAS","BRUCE SMITH","ANDRE REED","TOM BRADY","JOE MONTANA","TERRY BRADSHAW","PATRICK MAHOMES"],
    groups: [
      { id:"A", players:["ADRIAN PETERSON","LaDAINIAN TOMLINSON","MARSHALL FAULK","MARCUS ALLEN"], label:"RUSHED FOR 10,000+ CAREER YARDS", color:"#B8860B", difficulty:1 },
      { id:"B", players:["LAMAR JACKSON","COOPER KUPP","JUSTIN JEFFERSON","SAQUON BARKLEY"], label:"WON NFL OFFENSIVE PLAYER OF THE YEAR SINCE 2019", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["JIM KELLY","THURMAN THOMAS","BRUCE SMITH","ANDRE REED"], label:"PLAYED FOR THE BUFFALO BILLS TEAMS THAT LOST 4 STRAIGHT SUPER BOWLS (1990-93)", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["TOM BRADY","JOE MONTANA","TERRY BRADSHAW","PATRICK MAHOMES"], label:"WON SUPER BOWL MVP MULTIPLE TIMES", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 15, title: "ROUND 15",
    players: ["CAM NEWTON","LAMAR JACKSON","JOE BURROW","CHARLES WOODSON","AARON DONALD","T.J. WATT","NICK BOSA","MYLES GARRETT","LARRY FITZGERALD","ELI MANNING","RUSSELL WILSON","DAK PRESCOTT","TOM BRADY","TERRELL DAVIS","SHANNON SHARPE","ANTONIO BROWN"],
    groups: [
      { id:"A", players:["CAM NEWTON","LAMAR JACKSON","JOE BURROW","CHARLES WOODSON"], label:"WON THE HEISMAN TROPHY", color:"#B8860B", difficulty:1 },
      { id:"B", players:["AARON DONALD","T.J. WATT","NICK BOSA","MYLES GARRETT"], label:"WON NFL DEFENSIVE PLAYER OF THE YEAR IN THE 2020s", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["LARRY FITZGERALD","ELI MANNING","RUSSELL WILSON","DAK PRESCOTT"], label:"WON THE WALTER PAYTON NFL MAN OF THE YEAR AWARD", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["TOM BRADY","TERRELL DAVIS","SHANNON SHARPE","ANTONIO BROWN"], label:"DRAFTED IN THE 6TH ROUND OR LATER, BECAME A PRO BOWL PLAYER", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 16, title: "ROUND 16",
    players: ["TROY AIKMAN","EMMITT SMITH","MICHAEL IRVIN","DEION SANDERS","RUSSELL WILSON","DREW BREES","DOUG FLUTIE","FRAN TARKENTON","ADRIAN PETERSON","JAMAL LEWIS","WALTER PAYTON","COREY DILLON","KURT WARNER","TONY ROMO","JAMES HARRISON","WES WELKER"],
    groups: [
      { id:"A", players:["TROY AIKMAN","EMMITT SMITH","MICHAEL IRVIN","DEION SANDERS"], label:"PLAYED FOR THE DALLAS COWBOYS 1990s SUPER BOWL TEAMS", color:"#B8860B", difficulty:1 },
      { id:"B", players:["RUSSELL WILSON","DREW BREES","DOUG FLUTIE","FRAN TARKENTON"], label:"LISTED SHORTER THAN 6'1\" AS AN NFL QUARTERBACK", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["ADRIAN PETERSON","JAMAL LEWIS","WALTER PAYTON","COREY DILLON"], label:"RUSHED FOR 250+ YARDS IN A SINGLE NFL GAME", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["KURT WARNER","TONY ROMO","JAMES HARRISON","WES WELKER"], label:"UNDRAFTED FREE AGENT WHO BECAME A PRO BOWL PLAYER", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 17, title: "ROUND 17",
    players: ["TONY GONZALEZ","REGGIE WHITE","BRUCE MATTHEWS","JUNIOR SEAU","JOE MONTANA","JERRY RICE","ROGER CRAIG","CHARLES HALEY","MATT RYAN","PATRICK MAHOMES","JARED GOFF","JAKE DELHOMME","JIM BROWN","CARL WEATHERS","BUBBA SMITH","HOWIE LONG"],
    groups: [
      { id:"A", players:["TONY GONZALEZ","REGGIE WHITE","BRUCE MATTHEWS","JUNIOR SEAU"], label:"PLAYED IN 10+ NFL PRO BOWLS", color:"#B8860B", difficulty:1 },
      { id:"B", players:["JOE MONTANA","JERRY RICE","ROGER CRAIG","CHARLES HALEY"], label:"PLAYED FOR THE SAN FRANCISCO 49ers 1980s DYNASTY", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["MATT RYAN","PATRICK MAHOMES","JARED GOFF","JAKE DELHOMME"], label:"LOST TO TOM BRADY IN THE SUPER BOWL", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["JIM BROWN","CARL WEATHERS","BUBBA SMITH","HOWIE LONG"], label:"ACTED IN A MAJOR HOLLYWOOD MOVIE", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 18, title: "ROUND 18",
    players: ["ERIC DICKERSON","ADRIAN PETERSON","SAQUON BARKLEY","CURTIS MARTIN","RAY LEWIS","ED REED","MICHAEL IRVIN","SEAN TAYLOR","DREW BREES","BRETT FAVRE","WARREN MOON","GEORGE BLANDA","STEVE YOUNG","JOE MONTANA","DOUG WILLIAMS","TROY AIKMAN"],
    groups: [
      { id:"A", players:["ERIC DICKERSON","ADRIAN PETERSON","SAQUON BARKLEY","CURTIS MARTIN"], label:"RUSHED FOR 1,300+ YARDS AS A ROOKIE", color:"#B8860B", difficulty:1 },
      { id:"B", players:["RAY LEWIS","ED REED","MICHAEL IRVIN","SEAN TAYLOR"], label:"PLAYED COLLEGE FOOTBALL AT \"THE U\" (UNIVERSITY OF MIAMI)", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["DREW BREES","BRETT FAVRE","WARREN MOON","GEORGE BLANDA"], label:"STARTED IN THE NFL PAST AGE 40 AS A QUARTERBACK", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["STEVE YOUNG","JOE MONTANA","DOUG WILLIAMS","TROY AIKMAN"], label:"THREW 4+ TOUCHDOWNS IN A SINGLE SUPER BOWL", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 19, title: "ROUND 19",
    players: ["PHIL SIMMS","JIM McMAHON","DOUG WILLIAMS","JOE THEISMANN","LAWRENCE TAYLOR","PATRICK WILLIS","BRIAN URLACHER","KHALIL MACK","BOB GRIESE","LARRY CSONKA","NICK BUONICONTI","PAUL WARFIELD","FRAN TARKENTON","DAN MARINO","BRETT FAVRE","PEYTON MANNING"],
    groups: [
      { id:"A", players:["PHIL SIMMS","JIM McMAHON","DOUG WILLIAMS","JOE THEISMANN"], label:"WON THE SUPER BOWL AS A STARTING QUARTERBACK IN THE 1980s", color:"#B8860B", difficulty:1 },
      { id:"B", players:["LAWRENCE TAYLOR","PATRICK WILLIS","BRIAN URLACHER","KHALIL MACK"], label:"WON AP NFL DEFENSIVE ROOKIE OF THE YEAR", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["BOB GRIESE","LARRY CSONKA","NICK BUONICONTI","PAUL WARFIELD"], label:"PLAYED ON THE 1972 MIAMI DOLPHINS PERFECT SEASON TEAM", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["FRAN TARKENTON","DAN MARINO","BRETT FAVRE","PEYTON MANNING"], label:"HELD THE NFL ALL-TIME CAREER TOUCHDOWN PASS RECORD AT SOME POINT", color:"#8B1A2A", difficulty:4 }
    ]
  },
  {
    id: 20, title: "ROUND 20",
    players: ["WALTER PAYTON","JIM McMAHON","MIKE SINGLETARY","WILLIAM PERRY","JOE MONTANA","TERRY BRADSHAW","CHARLES HALEY","MEAN JOE GREENE","JIM PLUNKETT","MARCUS ALLEN","HOWIE LONG","FRED BILETNIKOFF","EDDIE GEORGE","SHAUN ALEXANDER","TROY POLAMALU","DAUNTE CULPEPPER"],
    groups: [
      { id:"A", players:["WALTER PAYTON","JIM McMAHON","MIKE SINGLETARY","WILLIAM PERRY"], label:"PLAYED FOR THE 1985 CHICAGO BEARS SUPER BOWL XX TEAM", color:"#B8860B", difficulty:1 },
      { id:"B", players:["JOE MONTANA","TERRY BRADSHAW","CHARLES HALEY","MEAN JOE GREENE"], label:"WON 4+ SUPER BOWLS AS A PLAYER", color:"#2E6B3E", difficulty:2 },
      { id:"C", players:["JIM PLUNKETT","MARCUS ALLEN","HOWIE LONG","FRED BILETNIKOFF"], label:"PLAYED FOR THE OAKLAND RAIDERS SUPER BOWL-WINNING TEAMS", color:"#1B4F8A", difficulty:3 },
      { id:"D", players:["EDDIE GEORGE","SHAUN ALEXANDER","TROY POLAMALU","DAUNTE CULPEPPER"], label:"WAS ON THE COVER OF EA SPORTS MADDEN NFL", color:"#8B1A2A", difficulty:4 }
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
// CHANGE THIS WHEN YOU OFFICIALLY LAUNCH — resets daily puzzle counter to start fresh
const LAUNCH_DATE = new Date('2026-06-06');

// CHANGE THIS to your real feedback destination — either a Google Form URL or mailto link.
// Examples:
//   const FEEDBACK_URL = "https://forms.gle/your-form-id-here";
//   const FEEDBACK_URL = "mailto:you@example.com?subject=DRAFT Feedback";
const FEEDBACK_URL = "https://forms.gle/s2Jk2vvLfLTJLPLd8";

const getTodaysPuzzle = () => {
  const today = new Date();
  today.setHours(0,0,0,0);
  const launch = new Date(LAUNCH_DATE);
  launch.setHours(0,0,0,0);
  const daysSinceLaunch = Math.max(0, Math.floor((today - launch) / 86400000));
  return PUZZLES[daysSinceLaunch % PUZZLES.length];
};
const getTodaysPuzzleNumber = () => {
  const today = new Date();
  today.setHours(0,0,0,0);
  const launch = new Date(LAUNCH_DATE);
  launch.setHours(0,0,0,0);
  return Math.max(0, Math.floor((today - launch) / 86400000)) + 1;
};
const getPuzzle = (mode, idx) => mode==="daily" ? getTodaysPuzzle() : PUZZLES[idx % PUZZLES.length];

// Pick a random practice puzzle, avoiding today's daily and recently played
const getRandomPracticePuzzle = (recentlyPlayed = []) => {
  const todayId = getTodaysPuzzle().id;
  const available = PUZZLES.filter(p => p.id !== todayId && !recentlyPlayed.includes(p.id));
  // If we've exhausted, just exclude today's daily
  const pool = available.length > 0 ? available : PUZZLES.filter(p => p.id !== todayId);
  return pool[Math.floor(Math.random() * pool.length)];
};

const buildShare = (puzzle, solved, wrong, ms, streak) => {
  const rows=[1,2,3,4].map(d=>{const g=solved.find(s=>s.difficulty===d);return g?DIFF_EMOJIS[d].repeat(4):"⬛⬛⬛⬛";}).join("\n");
  const clean = wrong === 0 ? "\n🔒 CLEAN GAME" : "";
  const streakLine = streak>=3 ? `\n🔥 ${streak}-day streak` : "";
  return `DRAFT — ${puzzle.title} 🏈\n⚡ ${fmt(ms)}${clean}${streakLine}\n\n${rows}\n\nplaydraft.app`;
};

// ============================================================
// HEADER
// ============================================================
function Header({dark,onDark,onStats,onHome,onHow,onScoring,mode,onMode}) {
  return (
    <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 14px",height:"56px",background:dark?"#0a0a0a":"#0f1923",borderBottom:`2px solid #C8A96E`,position:"sticky",top:0,zIndex:100,gap:"8px"}}>
      <button onClick={onHome} style={{fontFamily:"'Bebas Neue',cursive",fontSize:"26px",letterSpacing:"5px",color:"#C8A96E",background:"none",border:"none",cursor:"pointer",padding:0,flexShrink:0}}>DRAFT</button>
      <div style={{display:"flex",gap:"4px"}}>
        {["daily","practice"].map(m=>(
          <button key={m} onClick={()=>onMode(m)} style={{fontFamily:"'Bebas Neue',cursive",fontSize:"12px",letterSpacing:"2px",padding:"6px 12px",borderRadius:"3px",cursor:"pointer",border:"1px solid",borderColor:mode===m?"#C8A96E":"#333",background:mode===m?"#C8A96E":"transparent",color:mode===m?"#0f1923":"#555",transition:"all 0.15s"}}>
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
        <button onClick={onHow} style={{fontFamily:"'Bebas Neue',cursive",fontSize:"11px",letterSpacing:"1px",padding:"5px 10px",background:"transparent",border:"1px solid #333",color:"#888",borderRadius:"3px",cursor:"pointer"}}>HOW</button>
        <button onClick={onScoring} style={{fontFamily:"'Bebas Neue',cursive",fontSize:"14px",letterSpacing:"1px",padding:"5px 8px",background:"transparent",border:"1px solid #333",color:"#888",borderRadius:"3px",cursor:"pointer"}}>⭐</button>
        <button onClick={onStats} style={{background:"none",border:"none",cursor:"pointer",fontSize:"18px",padding:"2px"}}>📊</button>
        <button onClick={onDark} style={{background:"none",border:"none",cursor:"pointer",fontSize:"18px",padding:"2px"}}>{dark?"☀️":"🌙"}</button>
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
      fontSize:"clamp(12px,3.6vw,16px)",
      letterSpacing:"0.3px",
      padding:"4px 2px",
      aspectRatio:"1 / 1",
      width:"100%",
      display:"flex",alignItems:"center",justifyContent:"center",
      textAlign:"center",lineHeight:1.15,
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
      <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"12px",letterSpacing:"1px",color:"rgba(255,255,255,0.8)",marginTop:"5px"}}>{group.players.join(" · ")}</div>
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
// RESULT PANEL — inline, shown below the revealed board
// ============================================================
function ResultPanel({puzzle,solved,wrong,ms,onPlayAgain,dark,won}) {
  const [copied,setCopied]=useState(false);
  const bg=dark?"#111":"#faf7f0",fg=dark?"#e0d5c5":"#1a1a2e";
  const st=loadStats();
  const cleanGame=wrong===0;
  const shareText=buildShare(puzzle,solved,wrong,ms,st.streak);

  const copy=()=>{navigator.clipboard.writeText(shareText).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2200);});};
  const shareToX=()=>window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,"_blank");
  const nativeShare=()=>{ if(navigator.share){navigator.share({title:"DRAFT",text:shareText,url:"https://playdraft.app"});}else{copy();} };

  return (
    <div style={{background:bg,borderRadius:"12px",padding:"24px 18px 28px",width:"100%",maxWidth:"460px",margin:"16px auto 0",border:`2px solid ${won?"#C8A96E":"#8B1A2A"}`,animation:"fadeUp 0.5s ease"}}>

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
              {copied?"✓ COPIED":"COPY"}
            </button>
          </div>
        </div>

        <button onClick={onPlayAgain} style={{width:"100%",fontFamily:"'Bebas Neue',cursive",fontSize:"14px",letterSpacing:"2px",padding:"14px",background:"transparent",color:fg,border:`2px solid ${dark?"#333":"#c8bfae"}`,borderRadius:"8px",cursor:"pointer"}}>
          PLAY AGAIN
        </button>

        {/* Feedback link */}
        <div style={{marginTop:"16px",textAlign:"center"}}>
          <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" style={{fontFamily:"'Bebas Neue',cursive",fontSize:"10px",letterSpacing:"2px",color:dark?"#555":"#999",textDecoration:"none",borderBottom:`1px dashed ${dark?"#333":"#c8bfae"}`,paddingBottom:"2px"}}>
            SPOT AN ERROR? SEND FEEDBACK →
          </a>
        </div>
    </div>
  );
}


// ============================================================
// SCORING PAGE
// ============================================================
function ScoringPage({dark,onClose}) {
  const bg=dark?"#0a0a0a":"#faf7f0", fg=dark?"#d4c9b8":"#1a1a2e", card=dark?"#141414":"#fff", border=dark?"#222":"#e8e0d0";
  return (
    <div style={{background:bg,minHeight:"calc(100vh - 52px)",padding:"20px 16px 40px",overflowY:"auto"}}>
      <div style={{maxWidth:"480px",margin:"0 auto"}}>
        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"clamp(32px,8vw,48px)",letterSpacing:"4px",color:"#C8A96E",marginBottom:"4px"}}>HOW SCORING WORKS</div>
        <div style={{fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"15px",color:dark?"#666":"#888",fontStyle:"italic",marginBottom:"24px",lineHeight:1.6}}>Speed and accuracy are everything. Everyone can win — the best players win faster.</div>

        {/* Time is the score */}
        <div style={{background:card,border:`1px solid ${border}`,borderRadius:"10px",padding:"20px",marginBottom:"12px"}}>
          <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"13px",letterSpacing:"2px",color:fg,marginBottom:"8px"}}>⚡ TIME IS YOUR SCORE</div>
          <div style={{fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"14px",color:dark?"#888":"#666",lineHeight:1.6}}>Your final time is what you share with friends. Solve all 4 groups as fast as possible. Wrong guesses add time penalties — accuracy matters as much as speed.</div>
        </div>

        {/* Clean game */}
        <div style={{background:card,border:`1px solid ${border}`,borderRadius:"10px",padding:"20px",marginBottom:"12px"}}>
          <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"13px",letterSpacing:"2px",color:fg,marginBottom:"8px"}}>🔒 CLEAN GAME BADGE</div>
          <div style={{fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"14px",color:dark?"#888":"#666",lineHeight:1.6}}>Solve all 4 groups with zero wrong guesses and your share card shows the coveted CLEAN GAME badge. The ultimate flex.</div>
          <div style={{marginTop:"12px",background:dark?"#0a0a0a":"#f5f0e8",borderRadius:"8px",padding:"12px",fontFamily:"'Courier New',monospace",fontSize:"13px",color:dark?"#C8A96E":"#0f1923",lineHeight:1.8}}>
            DRAFT #7 🏈<br/>
            ⚡ 1:43 🔒 CLEAN GAME<br/>
            🟨🟨🟨🟨<br/>
            🟩🟩🟩🟩<br/>
            🟦🟦🟦🟦<br/>
            🟥🟥🟥🟥
          </div>
        </div>

        {/* Wrong downs */}
        <div style={{background:card,border:`1px solid ${border}`,borderRadius:"10px",padding:"20px",marginBottom:"12px"}}>
          <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"13px",letterSpacing:"2px",color:fg,marginBottom:"8px"}}>🏴 4 DOWNS</div>
          <div style={{fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"14px",color:dark?"#888":"#666",lineHeight:1.6}}>You get 4 wrong guesses before game over. Each wrong guess costs you a down. Lose all 4 and the puzzle is over — categories are revealed but no time is recorded.</div>
        </div>

        {/* Streaks */}
        <div style={{background:card,border:`1px solid ${border}`,borderRadius:"10px",padding:"20px",marginBottom:"12px"}}>
          <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"13px",letterSpacing:"2px",color:fg,marginBottom:"8px"}}>🔥 STREAKS</div>
          <div style={{fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"14px",color:dark?"#888":"#666",lineHeight:1.6}}>Solve the daily puzzle every day to build your streak. Miss a day and it resets. Your current streak appears on your share card when it hits 3+ days.</div>
        </div>

        {/* One away */}
        <div style={{background:card,border:`1px solid ${border}`,borderRadius:"10px",padding:"20px",marginBottom:"20px"}}>
          <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"13px",letterSpacing:"2px",color:fg,marginBottom:"8px"}}>👀 ONE AWAY</div>
          <div style={{fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"14px",color:dark?"#888":"#666",lineHeight:1.6}}>If 3 of your 4 selected players belong to the same group, you'll get a hint. You're close — but not quite.</div>
        </div>

        <button onClick={onClose} style={{width:"100%",fontFamily:"'Bebas Neue',cursive",fontSize:"16px",letterSpacing:"3px",padding:"16px",background:"#C8A96E",color:"#0f1923",border:"none",borderRadius:"8px",cursor:"pointer"}}>GOT IT</button>
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
    <div style={{background:bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",padding:"32px 20px 40px",textAlign:"center"}}>

      <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"clamp(60px,17vw,96px)",letterSpacing:"3px",color:"#C8A96E",lineHeight:0.9,marginBottom:"14px",textShadow:`3px 3px 0 ${dark?"rgba(0,0,0,0.5)":"rgba(15,25,35,0.2)"}`}}>DRAFT</div>

      <div style={{fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"clamp(16px,4.5vw,19px)",color:dark?"#888":"#666",fontStyle:"italic",marginBottom:"28px",maxWidth:"320px",lineHeight:1.7}}>
        {isPractice ? "Sharpen your game. No streak on the line." : <span>Test your NFL knowledge.<br/>Group the players.<br/>Find the connection.</span>}
      </div>

      {/* Demo tiles */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"10px",maxWidth:"330px",width:"100%",marginBottom:"12px"}}>
        {["RANDY MOSS","TERRELL OWENS","CHAD JOHNSON","ANTONIO BROWN"].map((p,i)=>(
          <div key={p} style={{fontFamily:"'Bebas Neue',cursive",fontSize:"14px",letterSpacing:"0.5px",padding:"18px 6px",textAlign:"center",background:dark?"#181818":"#fff",border:`2px solid ${dark?"#2a2a2a":"#ddd6c4"}`,borderRadius:"8px",color:fg,animation:`fadeUp 0.4s ease ${i*0.08}s both`}}>{p}</div>
        ))}
      </div>


      <div style={{fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"clamp(14px,4vw,16px)",color:fg,fontStyle:"italic",marginBottom:"28px",background:dark?"#181818":"#f0ebe0",padding:"14px 22px",borderRadius:"8px",border:`1px solid ${dark?"#2a2a2a":"#ddd6c4"}`,maxWidth:"330px"}}>
        Famous for being impossible to coach 😤
      </div>

      <button
        onClick={onPlay}
        style={{fontFamily:"'Bebas Neue',cursive",fontSize:"20px",letterSpacing:"4px",padding:"20px 0",width:"100%",maxWidth:"330px",background:"#C8A96E",color:"#0f1923",border:"none",borderRadius:"10px",cursor:"pointer",boxShadow:"0 4px 20px rgba(200,169,110,0.4)",marginBottom:"24px",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}
      >
        {isPractice ? "PRACTICE MODE" : "PLAY TODAY'S DRAFT"}
      </button>

      {/* Sports pills */}
      <div style={{display:"flex",gap:"8px",marginBottom:"24px",flexWrap:"wrap",justifyContent:"center"}}>
        {sports.map(s=>(
          <div key={s.name} style={{display:"flex",alignItems:"center",gap:"5px",padding:"7px 12px",borderRadius:"20px",border:`1px solid ${s.status==="live"?"#C8A96E":(dark?"#222":"#e0d8cc")}`,background:s.status==="live"?(dark?"rgba(200,169,110,0.1)":"rgba(200,169,110,0.08)"):"transparent"}}>
            <span style={{fontSize:"12px"}}>{s.icon}</span>
            <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:"12px",letterSpacing:"2px",color:s.status==="live"?"#C8A96E":(dark?"#555":"#999")}}>{s.name}</span>
            {s.status==="live"
              ?<span style={{fontFamily:"'Bebas Neue',cursive",fontSize:"7px",letterSpacing:"1px",color:"#4A7C59",background:dark?"rgba(74,124,89,0.2)":"rgba(74,124,89,0.15)",padding:"1px 4px",borderRadius:"3px"}}>LIVE</span>
              :<span style={{fontFamily:"'Bebas Neue',cursive",fontSize:"7px",letterSpacing:"1px",color:dark?"#444":"#bbb",background:dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.05)",padding:"1px 4px",borderRadius:"3px"}}>SOON</span>
            }
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:"16px",flexWrap:"wrap",justifyContent:"center"}}>
        {[["🏈","16 PLAYERS"],["🏴","4 DOWNS"],["⚡","BEAT THE CLOCK"],["🤯","FIND THE CONNECTION"]].map(([ic,tx])=>(
          <div key={tx} style={{fontFamily:"'Bebas Neue',cursive",fontSize:"11px",letterSpacing:"2px",color:dark?"#555":"#999",display:"flex",alignItems:"center",gap:"5px"}}>
            <span style={{fontSize:"14px"}}>{ic}</span>{tx}
          </div>
        ))}
      </div>

      {/* Feedback link */}
      <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" style={{marginTop:"32px",fontFamily:"'Bebas Neue',cursive",fontSize:"11px",letterSpacing:"2px",color:dark?"#555":"#999",textDecoration:"none",borderBottom:`1px dashed ${dark?"#333":"#c8bfae"}`,paddingBottom:"2px"}}>
        SPOT AN ERROR? SEND FEEDBACK →
      </a>
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
  const [revealedGroups,setRevealedGroups]=useState([]);  // Auto-reveal on loss
  const [triedCombos,setTriedCombos]=useState([]);  // Track previously tried combinations
  const toastRef=useRef(null);
  const bg=dark?"#0a0a0a":"#faf7f0";

  const showToast=(msg,dur=1800)=>{clearTimeout(toastRef.current);setToast(msg);toastRef.current=setTimeout(()=>setToast(null),dur);};
  const handleTile=name=>{if(over)return;setSelected(prev=>prev.includes(name)?prev.filter(p=>p!==name):prev.length<4?[...prev,name]:prev);};

  const handleSubmit=()=>{
    if(selected.length!==4||over)return;
    // Check if this exact combination was already tried (no penalty)
    const comboKey=[...selected].sort().join("|");
    if(triedCombos.includes(comboKey)){
      showToast("ALREADY RAN THAT PLAY 🔁",1800);
      return;
    }
    const group=puzzle.groups.find(g=>selected.every(p=>g.players.includes(p))&&g.players.every(p=>selected.includes(p)));
    if(group){
      const ns=[...solved,group];setSolved(ns);setSelected([]);
      showToast(["LOCKED IN 🔒","TOUCHDOWN! 🏈","YOU GOT IT!","NICE READ! 🎯","FIRST DOWN! ✅"][Math.floor(Math.random()*5)]);
      if(ns.length===4){
        setTimerOn(false);setOver(true);
        // Show result panel after last category lock-in animation completes
        setTimeout(()=>setShowResult(true),900);
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
      const nw=wrong+1;setWrong(nw);
      setTriedCombos(prev=>[...prev,comboKey]);
      // Keep tiles selected so user can swap one without re-picking all 4
      if(nw>=4){
        setTimerOn(false);setOver(true);
        // Reveal remaining groups one at a time, easiest first
        const remaining = puzzle.groups
          .filter(g=>!solved.some(s=>s.id===g.id))
          .sort((a,b)=>a.difficulty-b.difficulty);
        remaining.forEach((g,i)=>{
          setTimeout(()=>setRevealedGroups(prev=>[...prev,g]),700+(i*600));
        });
        // Show result panel after all reveals complete
        setTimeout(()=>setShowResult(true),700+(remaining.length*600)+400);
        const st=loadStats(),today=new Date().toDateString();
        st.played++;st.scores=[...(st.scores||[]),"DNF"];st.streak=0;st.lastPlayed=today;saveStats(st);
      }
    }
  };

  const unsolved=tiles.filter(p=>!solved.some(g=>g.players.includes(p)) && !revealedGroups.some(g=>g.players.includes(p)));

  return (
    <div style={{background:bg,display:"flex",flexDirection:"column",padding:"16px 12px 32px"}}>
      <div style={{maxWidth:"460px",margin:"0 auto",width:"100%",display:"flex",flexDirection:"column"}}>

        {/* Top bar */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
          <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:"13px",letterSpacing:"3px",color:dark?"#666":"#999"}}>{puzzle.title}</div>
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

        {/* Solved + auto-revealed (on loss) rows — all in difficulty order */}
        {[...solved, ...revealedGroups].sort((a,b)=>a.difficulty-b.difficulty).map(g=>(
          <SolvedRow key={g.id} group={g} dark={dark}/>
        ))}

        {/* Grid — fills available space */}
        {unsolved.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"16px"}}>
            {unsolved.map(name=>(
              <Tile key={name} name={name} selected={selected.includes(name)} onClick={()=>handleTile(name)} dark={dark} shaking={shaking.includes(name)}/>
            ))}
          </div>
        )}

        {/* Controls — bottom anchored, thumb-friendly */}
        {!over&&(
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={()=>setTiles(shuffle(unsolved))} style={{flex:1,fontFamily:"'Bebas Neue',cursive",fontSize:"14px",letterSpacing:"2px",padding:"16px",background:"transparent",color:dark?"#888":"#888",border:`1px solid ${dark?"#2a2a2a":"#ccc"}`,borderRadius:"8px",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>SHUFFLE</button>
              <button onClick={()=>setSelected([])} disabled={!selected.length} style={{flex:1,fontFamily:"'Bebas Neue',cursive",fontSize:"14px",letterSpacing:"2px",padding:"16px",background:"transparent",color:selected.length?(dark?"#d4c9b8":"#1a1a2e"):"#888",border:`1px solid ${selected.length?(dark?"#444":"#999"):(dark?"#222":"#ddd")}`,borderRadius:"8px",cursor:selected.length?"pointer":"default",WebkitTapHighlightColor:"transparent"}}>CLEAR</button>
              <button onClick={handleSubmit} disabled={selected.length!==4} style={{flex:2,fontFamily:"'Bebas Neue',cursive",fontSize:"16px",letterSpacing:"2px",padding:"16px",background:selected.length===4?"#C8A96E":(dark?"#1e1e1e":"#ece4d4"),color:selected.length===4?"#0f1923":(dark?"#333":"#bbb"),border:"none",borderRadius:"8px",cursor:selected.length===4?"pointer":"default",transition:"background 0.15s",WebkitTapHighlightColor:"transparent"}}>SUBMIT</button>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast&&(
          <div style={{position:"fixed",top:"64px",left:"50%",transform:"translateX(-50%)",fontFamily:"'Bebas Neue',cursive",fontSize:"16px",letterSpacing:"3px",background:dark?"#1a1a1a":"#0f1923",color:"#C8A96E",padding:"10px 22px",borderRadius:"8px",boxShadow:"0 4px 20px rgba(0,0,0,0.5)",zIndex:200,border:"1px solid rgba(200,169,110,0.3)",whiteSpace:"nowrap",animation:"toastIn 0.2s ease"}}>
            {toast}
          </div>
        )}

        {showResult&&<ResultPanel puzzle={puzzle} solved={[...solved,...revealedGroups]} wrong={wrong} ms={timeMs} dark={dark} onPlayAgain={onFinish} won={solved.length===4}/>}
      </div>
    </div>
  );
}

// ============================================================
// ROOT
// ============================================================
export default function App() {
  // CRITICAL: Inject viewport meta tag for mobile rendering
  useEffect(() => {
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    viewport.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  }, []);

  const [dark,setDark]=useState(false);
  const [screen,setScreen]=useState("home");
  const [showStats,setShowStats]=useState(false);
  const [showScoring,setShowScoring]=useState(false);
  const [mode,setMode]=useState("daily");
  const [practicePuzzle,setPracticePuzzle]=useState(()=>getRandomPracticePuzzle());
  const [recentPractice,setRecentPractice]=useState([]);
  const puzzle = mode==="daily" ? getTodaysPuzzle() : practicePuzzle;
  const handleModeChange=m=>{
    setMode(m);
    setScreen("home");
    // When switching to practice, pick a fresh puzzle
    if(m==="practice"){
      const newRecent=[...recentPractice,practicePuzzle.id].slice(-Math.max(1,PUZZLES.length-2));
      setRecentPractice(newRecent);
      setPracticePuzzle(getRandomPracticePuzzle(newRecent));
    }
  };
  const handleFinish=()=>{
    if(mode==="practice"){
      // Pick a new random puzzle for next round
      const newRecent=[...recentPractice,practicePuzzle.id].slice(-Math.max(1,PUZZLES.length-2));
      setRecentPractice(newRecent);
      setPracticePuzzle(getRandomPracticePuzzle(newRecent));
    }
    setScreen("home");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{background:${dark?"#0a0a0a":"#faf7f0"};margin:0;padding:0;min-height:100vh;}
        @keyframes popIn{from{opacity:0;transform:translateY(-10px) scale(0.97);}to{opacity:1;transform:translateY(0) scale(1);}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-6px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
        @keyframes shake{0%,100%{transform:translateX(0);}20%{transform:translateX(-5px);}40%{transform:translateX(5px);}60%{transform:translateX(-3px);}80%{transform:translateX(3px);}}
        button:focus-visible{outline:2px solid #C8A96E;outline-offset:2px;}
        button{-webkit-tap-highlight-color:transparent;}
      `}</style>
      <Header dark={dark} onDark={()=>setDark(d=>!d)} onStats={()=>setShowStats(true)} onHome={()=>setScreen("home")} onHow={()=>setScreen("howto")} onScoring={()=>setScreen("scoring")} mode={mode} onMode={handleModeChange}/>
      {screen==="home"&&<Landing onPlay={()=>setScreen("game")} dark={dark} mode={mode}/>}
      {screen==="game"&&<Game key={`${puzzle.id}-${mode}`} puzzle={puzzle} dark={dark} onFinish={handleFinish}/>}
      {screen==="howto"&&<HowTo dark={dark} onClose={()=>setScreen("home")}/>}
      {screen==="scoring"&&<ScoringPage dark={dark} onClose={()=>setScreen("home")}/>}
      {showStats&&<StatsModal onClose={()=>setShowStats(false)} dark={dark}/>}
    </>
  );
}
