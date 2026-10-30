// Runs daily via Vercel Cron. Emails yesterday's readout for both games.
//
// Layout, most important first:
//   1. Yesterday: visitors, then Four Downs vs Start/Sit side by side
//      (opened, finished, won, shared), plus how many visitors never opened
//      a game at all.
//   2. The sharing loop, last 7 days: finishers -> sharers -> challenge links
//      opened -> new players who arrived through a share. This is the growth
//      lever, so it gets its own block.
//   3. Coming back: 3-day return by first-touch source, reminder signups and
//      the subscriber count.
//   4. Game detail (7 days), Featured Puzzle, traffic sources.
//
// The subject line covers both games. The old one only knew about the Four
// Downs daily, so a day with Start/Sit games read "no finishers".
//
// FEATURED_WINDOWS mirrors the `id` / `activeFrom` / `activeUntil` fields of
// FEATURED_PUZZLES in src/App.js. Featured events are keyed by puzzle id, so
// the Featured line is cumulative for the week. Add a row whenever a new
// Featured Puzzle ships; if you forget, this falls back to the latest window.
const FEATURED_WINDOWS = [
  { id: 'wk-2026-08-23', activeFrom: '2026-08-23', activeUntil: '2026-09-01' },
  { id: 'wk-2026-09-01', activeFrom: '2026-09-01', activeUntil: '2026-09-08' },
  { id: 'wk-2026-09-08', activeFrom: '2026-09-08', activeUntil: '2026-09-15' },
  { id: 'wk-2026-09-15', activeFrom: '2026-09-15', activeUntil: '2026-09-22' },
  { id: 'wk-2026-09-22', activeFrom: '2026-09-22', activeUntil: '2026-09-29' },
  { id: 'wk-2026-09-29', activeFrom: '2026-09-29', activeUntil: '2026-10-06' },
  { id: 'wk-2026-10-06', activeFrom: '2026-10-06', activeUntil: '2026-10-13' },
  { id: 'wk-2026-10-13', activeFrom: '2026-10-13', activeUntil: '2026-10-20' },
  { id: 'wk-2026-10-20', activeFrom: '2026-10-20', activeUntil: '2026-10-27' },
  { id: 'wk-2026-10-27', activeFrom: '2026-10-27', activeUntil: '2026-11-03' },
];

function resolveFeatured(dateKey) {
  if (!FEATURED_WINDOWS.length) return { id: '', source: 'none' };
  const hit = FEATURED_WINDOWS.find(f => dateKey >= f.activeFrom && dateKey < f.activeUntil);
  if (hit) return { id: hit.id, source: 'active' };
  return { id: FEATURED_WINDOWS[FEATURED_WINDOWS.length - 1].id, source: 'fallback' };
}

const etDay = (daysAgo) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
  .format(new Date(Date.now() - daysAgo * 86400000));

// A rate with no denominator is unmeasured, not zero: show n/a.
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : null);
const avg = (n, d) => (d > 0 ? Math.round((n / d) * 10) / 10 : null);
const show = (v, suffix = '') => (v === null ? 'n/a' : `${v}${suffix}`);

export default async function handler(req, res) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, RESEND_API_KEY, ALERT_EMAIL } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN || !RESEND_API_KEY || !ALERT_EMAIL) {
    return res.status(500).json({ error: 'Missing required environment variables' });
  }

  try {
    const base = UPSTASH_REDIS_REST_URL.replace(/\/+$/, '');
    // One round trip per batch of commands.
    const pipe = async (cmds) => {
      if (!cmds.length) return [];
      const r = await fetch(`${base}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cmds),
      });
      if (!r.ok) throw new Error(`upstash pipeline ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return (await r.json()).map(x => x.result);
    };
    const hashOf = (arr) => {
      const out = {};
      for (let i = 0; i + 1 < (arr || []).length; i += 2) out[arr[i]] = Number(arr[i + 1]) || 0;
      return out;
    };

    const yesterday = etDay(1);
    const week = [1, 2, 3, 4, 5, 6, 7].map(etDay);           // ending yesterday
    const cohortDays = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => ({ d: etDay(i), mature: i >= 4 }));
    const { id: featuredId, source: featuredIdSource } = resolveFeatured(yesterday);

    // ---- Per-day set counts for every event type, over the week ----
    const TYPES = ['fd_open', 'start', 'win', 'loss', 'share',
      'lineup_open', 'lineup_start', 'lineup_win', 'lineup_loss', 'lineup_push', 'lineup_share',
      'lineup_challenge', 'lineup_subscribe'];
    const cmds = [];
    for (const d of week) {
      cmds.push(['SCARD', `visitors:${d}`], ['SCARD', `visitors:new:${d}`], ['SCARD', `visitors:returning:${d}`]);
      for (const t of TYPES) cmds.push(['SCARD', `evt:${t}:${d}`]);
      cmds.push(['GET', `evt:wrongsum:${d}`], ['SCARD', `evt:clean:${d}`]);
      cmds.push(['HGETALL', `ls:day:${d}`], ['HGETALL', `share:via:${d}`],
        ['HGETALL', `src:new:${d}`], ['HGETALL', `src:returning:${d}`], ['HGETALL', `src:finish:${d}`]);
    }
    const perDay = 3 + TYPES.length + 2 + 5;
    const out = await pipe(cmds);
    const days = week.map((d, k) => {
      const o = out.slice(k * perDay, (k + 1) * perDay);
      const ev = {};
      TYPES.forEach((t, i) => { ev[t] = Number(o[3 + i]) || 0; });
      const j = 3 + TYPES.length;
      return {
        d, visitors: Number(o[0]) || 0, newV: Number(o[1]) || 0, retV: Number(o[2]) || 0, ev,
        wrongSum: Number(o[j]) || 0, clean: Number(o[j + 1]) || 0,
        ls: hashOf(o[j + 2]), via: hashOf(o[j + 3]),
        srcNew: hashOf(o[j + 4]), srcRet: hashOf(o[j + 5]), srcFin: hashOf(o[j + 6]),
      };
    });
    const y = days[0];

    // Visitors who never opened either game yesterday. Sets are tiny at this
    // traffic level, so pulling members is cheaper than another key scheme.
    const [vMembers, fdMembers, ssMembers, subCount] = await pipe([
      ['SMEMBERS', `visitors:${yesterday}`], ['SMEMBERS', `evt:fd_open:${yesterday}`],
      ['SMEMBERS', `evt:lineup_open:${yesterday}`], ['HLEN', 'subscribers'],
    ]);
    const openers = new Set([...(fdMembers || []), ...(ssMembers || [])]);
    const bounced = (vMembers || []).filter(id => !openers.has(id)).length;

    const sum = (f) => days.reduce((a, x) => a + f(x), 0);
    const wk = {
      visitors: sum(x => x.visitors), newV: sum(x => x.newV), retV: sum(x => x.retV),
      ev: Object.fromEntries(TYPES.map(t => [t, sum(x => x.ev[t])])),
      wrongSum: sum(x => x.wrongSum), clean: sum(x => x.clean),
    };
    const addHash = (pick) => days.reduce((acc, x) => {
      Object.entries(pick(x)).forEach(([k, v]) => { acc[k] = (acc[k] || 0) + v; });
      return acc;
    }, {});
    const ls = addHash(x => x.ls);
    const via = addHash(x => x.via);
    const srcNew = addHash(x => x.srcNew);
    const srcRet = addHash(x => x.srcRet);
    const srcFin = addHash(x => x.srcFin);

    const games = (e) => ({
      fd: { opened: e.fd_open, played: e.start, finished: e.win + e.loss, won: e.win, shared: e.share },
      ss: { opened: e.lineup_open, played: e.lineup_start, finished: e.lineup_win + e.lineup_loss + e.lineup_push,
        won: e.lineup_win, shared: e.lineup_share, challenges: e.lineup_challenge, subs: e.lineup_subscribe },
    });
    const gy = games(y.ev);
    const gw = games(wk.ev);
    const yFinished = gy.fd.finished + gy.ss.finished;
    const yShared = gy.fd.shared + gy.ss.shared;
    const wFinished = gw.fd.finished + gw.ss.finished;
    const wShared = gw.fd.shared + gw.ss.shared;

    // Players who arrived through a shared challenge link (utm_source=share,
    // from 2026-10-30 on) and what they did.
    const fromShareNew = srcNew.share || 0;
    const fromShareFin = (srcFin['startsit|share'] || 0) + (srcFin['fourdowns|share'] || 0);

    // ---- 3-day return by first-touch source ----
    const cohortCmds = [];
    cohortDays.forEach(c => cohortCmds.push(['HGETALL', `src:new:${c.d}`], ['HGETALL', `src:ret3:${c.d}`]));
    const cohortOut = await pipe(cohortCmds);
    const ret = {};
    cohortDays.forEach((c, k) => {
      const nw = hashOf(cohortOut[2 * k]), bk = hashOf(cohortOut[2 * k + 1]);
      const touch = s => (ret[s] = ret[s] || { newAll: 0, backAll: 0, newMature: 0, backMature: 0 });
      Object.entries(nw).forEach(([s, v]) => { const r = touch(s); r.newAll += v; if (c.mature) r.newMature += v; });
      Object.entries(bk).forEach(([s, v]) => { const r = touch(s); r.backAll += v; if (c.mature) r.backMature += v; });
    });
    const retTotal = Object.values(ret).reduce((a, r) => ({ n: a.n + r.newMature, b: a.b + r.backMature }), { n: 0, b: 0 });
    const retRows = Object.entries(ret).sort((a, b) => b[1].newAll - a[1].newAll).slice(0, 8);

    // ---- Featured Puzzle, cumulative for its week ----
    let featured = null;
    if (featuredId) {
      const [fs, fw, fl, fsh] = await pipe([
        ['SCARD', `evt:featured_start:${featuredId}`], ['SCARD', `evt:featured_win:${featuredId}`],
        ['SCARD', `evt:featured_loss:${featuredId}`], ['SCARD', `evt:featured_share:${featuredId}`],
      ]);
      featured = { id: featuredId, idSource: featuredIdSource, started: fs || 0, won: fw || 0, finished: (fw || 0) + (fl || 0), shared: fsh || 0 };
    }

    // ---- Sources, last 7 days ----
    const sources = {};
    const bump = (s, f, n) => { sources[s] = sources[s] || { new: 0, back: 0, fd: 0, ss: 0 }; sources[s][f] += n; };
    Object.entries(srcNew).forEach(([s, v]) => bump(s, 'new', v));
    Object.entries(srcRet).forEach(([s, v]) => bump(s, 'back', v));
    Object.entries(srcFin).forEach(([k, v]) => {
      const [g, ...rest] = k.split('|');
      if (g === 'fourdowns') bump(rest.join('|') || 'unknown', 'fd', v);
      if (g === 'startsit') bump(rest.join('|') || 'unknown', 'ss', v);
    });
    const sourceRows = Object.entries(sources).sort((a, b) => (b[1].new + b[1].back) - (a[1].new + a[1].back)).slice(0, 10);

    // ---------------- HTML ----------------
    const F = 'font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;';
    const td = `padding:6px 8px;${F}font-size:14px;`;
    const num = `${td}text-align:right;font-weight:bold;`;
    const dim = 'color:#999;font-weight:normal;';
    const h3 = (t, sub) => `<h3 style="${F}margin:22px 0 2px;font-size:16px;">${t}</h3>${sub ? `<p style="${F}color:#888;margin:0 0 6px;font-size:12px;">${sub}</p>` : ''}`;
    const table = (rows) => `<table style="width:100%;border-collapse:collapse;border:1px solid #eee;">${rows}</table>`;
    const tr3 = (label, a, b, c = '') => `<tr><td style="${td}color:#555;">${label}</td><td style="${num}">${a}</td><td style="${num}">${b}</td><td style="${num}">${c}</td></tr>`;
    const tr2 = (label, v, sub = '') => `<tr><td style="${td}color:#555;">${label}</td><td style="${num}">${v}${sub ? ` <span style="${dim}">${sub}</span>` : ''}</td></tr>`;
    const head3 = `<tr><td style="${td}"></td><td style="${td}text-align:right;color:#888;">Four Downs</td><td style="${td}text-align:right;color:#888;">Start/Sit</td><td style="${td}text-align:right;color:#888;">Total</td></tr>`;

    const yesterdayHtml = `
      ${h3(`Yesterday · ${yesterday}`)}
      ${table(`
        ${tr2('Visitors', y.visitors, `${y.newV} new · ${y.retV} returning`)}
        ${tr2('Never opened a game', bounced, show(pct(bounced, y.visitors), '% of visitors'))}`)}
      <div style="height:8px"></div>
      ${table(`${head3}
        ${tr3('Opened', gy.fd.opened, gy.ss.opened, gy.fd.opened + gy.ss.opened)}
        ${tr3('Finished', gy.fd.finished, gy.ss.finished, yFinished)}
        ${tr3('Won', `${gy.fd.won} <span style="${dim}">solved</span>`, `${gy.ss.won} <span style="${dim}">beat House</span>`, '')}
        ${tr3('Shared', gy.fd.shared, gy.ss.shared, yShared)}
        ${tr3('Challenge links opened', '', gy.ss.challenges, '')}`)}`;

    const viaTxt = Object.entries(via).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
    const loopHtml = `
      ${h3('The sharing loop · last 7 days', `${week[6]} to ${week[0]}. Each step should feed the next.`)}
      ${table(`
        ${tr2('Finished a game', wFinished)}
        ${tr2('Shared', wShared, `${show(pct(wShared, wFinished), '%')} of finishers`)}
        ${viaTxt ? tr2('Start/Sit share buttons', viaTxt) : ''}
        ${tr2('Challenge links opened', gw.ss.challenges, 'vault posts and friend links')}
        ${tr2('New players from shares', fromShareNew, `${fromShareFin} finished a game`)}`)}`;

    const backHtml = `
      ${h3('Coming back', 'Return rate counts only first visits 4–10 days old, which have had their full 3 days.')}
      ${table(`
        ${tr2('Came back within 3 days', show(pct(retTotal.b, retTotal.n), '%'), `${retTotal.b} of ${retTotal.n} new visitors`)}
        ${tr2('Returning visitors, 7 days', wk.retV)}
        ${tr2('Start/Sit reminder signups, 7 days', gw.ss.subs)}
        ${tr2('Reminder subscribers, total', Number(subCount) || 0)}`)}
      ${retRows.length ? `<div style="height:8px"></div>${table(`
        <tr><td style="${td}color:#888;">First-touch source</td><td style="${td}text-align:right;color:#888;">New</td><td style="${td}text-align:right;color:#888;">Back ≤3d</td><td style="${td}text-align:right;color:#888;">Rate</td></tr>
        ${retRows.map(([s, v]) => `<tr><td style="${td}">${s}</td><td style="${num}">${v.newAll}</td><td style="${num}">${v.backAll}</td><td style="${num}">${v.newMature ? `${pct(v.backMature, v.newMature)}%` : `<span style="${dim}">pending</span>`}</td></tr>`).join('')}`)}` : ''}`;

    const ssCalls = avg(ls.calls || 0, ls.players || 0);
    const detailHtml = `
      ${h3('Games · last 7 days')}
      ${table(`${head3}
        ${tr3('Opened', gw.fd.opened, gw.ss.opened, gw.fd.opened + gw.ss.opened)}
        ${tr3('Started', gw.fd.played, gw.ss.played, gw.fd.played + gw.ss.played)}
        ${tr3('Finished', gw.fd.finished, gw.ss.finished, wFinished)}
        ${tr3('Won', gw.fd.won, gw.ss.won, '')}`)}
      <p style="${F}color:#555;font-size:13px;line-height:1.5;margin:8px 0 0;">
        <b>Start/Sit:</b> ${ls.players || 0} scored games, avg ${show(ssCalls)}/6 right calls.
        Took the underdog ${show(avg(ls.fades || 0, ls.players || 0))} times a game and was right ${show(pct(ls.fadeHits || 0, ls.fades || 0), '%')} of the time.<br>
        <b>Four Downs:</b> solve rate ${show(pct(gw.fd.won, gw.fd.finished), '%')},
        ${show(avg(wk.wrongSum, gw.fd.finished))} wrong guesses per game, ${show(pct(wk.clean, gw.fd.won), '%')} clean.
        ${featured ? `<br><b>Featured ${featured.id}:</b> ${featured.started} started, ${featured.finished} finished, ${featured.won} solved, ${featured.shared} shared${featured.idSource === 'fallback' ? ' <i>(no window for this date, showing the latest)</i>' : ''}.` : ''}
      </p>`;

    const sourcesHtml = `
      ${h3('Where players came from · last 7 days', 'First-touch source: utm_source/utm_content, else referrer, else direct. x/history = vault posts, share = friend challenge links.')}
      ${sourceRows.length ? table(`
        <tr><td style="${td}color:#888;">Source</td><td style="${td}text-align:right;color:#888;">New</td><td style="${td}text-align:right;color:#888;">Back</td><td style="${td}text-align:right;color:#888;">FD fin.</td><td style="${td}text-align:right;color:#888;">S/S fin.</td></tr>
        ${sourceRows.map(([s, v]) => `<tr><td style="${td}">${s}</td><td style="${num}">${v.new}</td><td style="${num}">${v.back}</td><td style="${num}">${v.fd}</td><td style="${num}">${v.ss}</td></tr>`).join('')}`)
        : `<p style="${F}color:#888;font-size:13px;">No source data.</p>`}
      <p style="${F}color:#888;font-size:12px;margin-top:6px;">7-day visitors: ${wk.visitors} (${wk.newV} new).</p>`;

    const html = `
      <div style="max-width:480px;${F}color:#111;">
        <h2 style="${F}margin:0 0 2px;">PlayDraft daily readout</h2>
        ${yesterdayHtml}
        ${loopHtml}
        ${backHtml}
        ${detailHtml}
        ${sourcesHtml}
      </div>`;

    const subject = `PlayDraft ${yesterday}: ${y.visitors} visitors · ${yFinished} game${yFinished === 1 ? '' : 's'} finished · ${yShared} shared`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'PlayDraft Stats <onboarding@resend.dev>', to: ALERT_EMAIL, subject, html }),
    });
    if (!emailRes.ok) {
      return res.status(500).json({ error: 'Resend failed', detail: (await emailRes.text()).slice(0, 300) });
    }

    return res.status(200).json({
      ok: true, date: yesterday, subject,
      yesterday: { visitors: y.visitors, new: y.newV, returning: y.retV, bounced, games: gy },
      week: { visitors: wk.visitors, new: wk.newV, returning: wk.retV, games: gw, finished: wFinished, shared: wShared,
        via, fromShareNew, fromShareFin, startsit: ls },
      returns: { rate: pct(retTotal.b, retTotal.n), back: retTotal.b, of: retTotal.n, bySource: ret },
      subscribers: Number(subCount) || 0, featured, sources,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err).slice(0, 300) });
  }
}
