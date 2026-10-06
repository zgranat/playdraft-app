// Runs daily via Vercel Cron. Emails yesterday's performance readout:
// visitors, funnel (started -> finished -> solved), abandons, solve
// rate, and share rate.
//
// FEATURED_WINDOWS mirrors the `id` / `activeFrom` / `activeUntil` fields of
// FEATURED_PUZZLES in src/App.js. Featured events are keyed by puzzle id
// rather than by day, so this readout shows the whole week's cumulative
// Featured activity rather than just yesterday's slice of it.
//
// Add a row here whenever a new Featured Puzzle ships in src/App.js. If you
// forget, this falls back to the most recent known window — the same thing
// FEATURED_FALLBACK does on the site — instead of querying an id that no
// longer exists and silently reporting zeroes. The `featuredIdSource` field
// in the JSON response says which of the two happened.
const FEATURED_WINDOWS = [
  { id: 'wk-2026-08-23', activeFrom: '2026-08-23', activeUntil: '2026-09-01' },
  { id: 'wk-2026-09-01', activeFrom: '2026-09-01', activeUntil: '2026-09-08' },
  { id: 'wk-2026-09-08', activeFrom: '2026-09-08', activeUntil: '2026-09-15' },
  { id: 'wk-2026-09-15', activeFrom: '2026-09-15', activeUntil: '2026-09-22' },
  { id: 'wk-2026-09-22', activeFrom: '2026-09-22', activeUntil: '2026-09-29' },
  { id: 'wk-2026-09-29', activeFrom: '2026-09-29', activeUntil: '2026-10-06' },
  { id: 'wk-2026-10-06', activeFrom: '2026-10-06', activeUntil: '2026-10-13' },
];

// Same comparison the site uses: key >= activeFrom && key < activeUntil.
function resolveFeatured(dateKey) {
  if (!FEATURED_WINDOWS.length) return { id: '', source: 'none' };
  const hit = FEATURED_WINDOWS.find(f => dateKey >= f.activeFrom && dateKey < f.activeUntil);
  if (hit) return { id: hit.id, source: 'active' };
  return { id: FEATURED_WINDOWS[FEATURED_WINDOWS.length - 1].id, source: 'fallback' };
}

export default async function handler(req, res) {
  const {
    UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN,
    RESEND_API_KEY,
    ALERT_EMAIL,
  } = process.env;

  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN || !RESEND_API_KEY || !ALERT_EMAIL) {
    return res.status(500).json({ error: 'Missing required environment variables' });
  }

  try {
    // Eastern Time, matching api/track.js and api/event.js
    const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
      .format(new Date(Date.now() - 86400000));

    const { id: activeFeaturedId, source: featuredIdSource } = resolveFeatured(yesterday);

    const base = UPSTASH_REDIS_REST_URL.replace(/\/+$/, '');
    const headers = { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` };

    const scard = async (key) => {
      const r = await fetch(`${base}/scard/${encodeURIComponent(key)}`, { headers });
      const raw = await r.text();
      if (!r.ok) throw new Error(`scard ${key} failed: ${r.status} ${raw.slice(0, 200)}`);
      try { return JSON.parse(raw).result ?? 0; } catch { return 0; }
    };
    const getInt = async (key) => {
      const r = await fetch(`${base}/get/${encodeURIComponent(key)}`, { headers });
      const raw = await r.text();
      if (!r.ok) return 0;
      try { return Number(JSON.parse(raw).result) || 0; } catch { return 0; }
    };

    const [visitors, newVisitors, returningVisitors, started, won, lost, shared, wrongSum, clean] = await Promise.all([
      scard(`visitors:${yesterday}`),
      scard(`visitors:new:${yesterday}`),
      scard(`visitors:returning:${yesterday}`),
      scard(`evt:start:${yesterday}`),
      scard(`evt:win:${yesterday}`),
      scard(`evt:loss:${yesterday}`),
      scard(`evt:share:${yesterday}`),
      getInt(`evt:wrongsum:${yesterday}`),
      scard(`evt:clean:${yesterday}`),
    ]);

    const finished = won + lost;
    const abandoned = Math.max(0, started - finished);

    // A rate with no denominator is not zero, it is unmeasured. These return
    // null so the email can say n/a instead of reporting a 0% that nobody
    // earned. Reading "0% solve rate" off a day with no finishers was what
    // made the 2026-08-30 email look like a product failure.
    const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : null);
    const avg = (n, d) => (d > 0 ? Math.round((n / d) * 10) / 10 : null);
    const show = (v, suffix = '') => (v === null ? 'n/a' : `${v}${suffix}`);

    const solveRate = pct(won, finished);          // of people who finished, % who solved
    const completionRate = pct(finished, started); // of people who started, % who finished
    const abandonRate = pct(abandoned, started);   // of people who started, % who bailed
    const shareRate = pct(shared, finished);       // of people who finished, % who shared
    const newRate = pct(newVisitors, visitors);    // of visitors, % who are first-timers
    const avgWrong = avg(wrongSum, finished);
    const cleanRate = pct(clean, won);             // of solvers, % with zero wrong guesses

    // Featured Puzzle totals — cumulative for the whole week, not just
    // yesterday, since these events are keyed by puzzle id rather than day.
    let featured = null;
    if (activeFeaturedId) {
      const [fStarted, fWon, fLost, fShared, fWrongSum, fClean] = await Promise.all([
        scard(`evt:featured_start:${activeFeaturedId}`),
        scard(`evt:featured_win:${activeFeaturedId}`),
        scard(`evt:featured_loss:${activeFeaturedId}`),
        scard(`evt:featured_share:${activeFeaturedId}`),
        getInt(`evt:wrongsum:${activeFeaturedId}`),
        scard(`evt:clean:${activeFeaturedId}`),
      ]);
      const fFinished = fWon + fLost;
      featured = {
        id: activeFeaturedId,
        idSource: featuredIdSource,
        started: fStarted, won: fWon, lost: fLost, shared: fShared,
        finished: fFinished,
        solveRate: pct(fWon, fFinished),
        avgWrong: avg(fWrongSum, fFinished),
        cleanRate: pct(fClean, fWon),
      };
    }

    // ---- Game head-to-head and traffic sources, over the last 7 days ----
    // Single days at this traffic level are noise, so both tables sum a week
    // ending yesterday. Start/Sit events (lineup_*) and fd_open exist from
    // 2026-09-29 on; earlier days read as zero.
    const hgetall = async (key) => {
      const r = await fetch(`${base}/hgetall/${encodeURIComponent(key)}`, { headers });
      if (!r.ok) return {};
      let arr = [];
      try { arr = JSON.parse(await r.text()).result || []; } catch {}
      const out = {};
      for (let i = 0; i + 1 < arr.length; i += 2) out[arr[i]] = Number(arr[i + 1]) || 0;
      return out;
    };
    const week = [];
    for (let i = 1; i <= 7; i++) {
      week.push(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
        .format(new Date(Date.now() - i * 86400000)));
    }
    const sumWeek = async (type) =>
      (await Promise.all(week.map(d => scard(`evt:${type}:${d}`)))).reduce((a, b) => a + b, 0);
    const [fdOpen, fdStart, fdWin, fdLoss, fdShare, ssOpen, ssStart, ssWin, ssLoss, ssPush, ssShare] =
      await Promise.all(['fd_open', 'start', 'win', 'loss', 'share',
        'lineup_open', 'lineup_start', 'lineup_win', 'lineup_loss', 'lineup_push', 'lineup_share'].map(sumWeek));
    const games = {
      fourdowns: { opened: fdOpen, played: fdStart, finished: fdWin + fdLoss, won: fdWin, shared: fdShare },
      startsit: { opened: ssOpen, played: ssStart, finished: ssWin + ssLoss + ssPush, won: ssWin, shared: ssShare },
    };

    // Start/Sit play quality, last 7 days (from /api/lineup-score). If fades
    // per player sits near zero, people are following the House and never
    // reading the cards; if fade hit rate sits near 50%, they are guessing.
    const lsDays = await Promise.all(week.map(d => hgetall(`ls:day:${d}`)));
    const ls = lsDays.reduce((a, x) => ({ players: a.players + (x.players || 0), calls: a.calls + (x.calls || 0),
      fades: a.fades + (x.fades || 0), fadeHits: a.fadeHits + (x.fadeHits || 0) }),
      { players: 0, calls: 0, fades: 0, fadeHits: 0 });
    const ssQuality = {
      players: ls.players,
      avgCalls: avg(ls.calls, ls.players),
      fadesPerPlayer: avg(ls.fades, ls.players),
      fadeHitRate: pct(ls.fadeHits, ls.fades),
    };

    // 3-day return by first-touch source. A day's new visitors form a cohort;
    // it is counted as returned if they came back 1-3 days later. Cohorts
    // 4-10 days old have had their full window, so only those feed the rate.
    const cohortDays = [];
    for (let i = 1; i <= 10; i++) {
      cohortDays.push({ d: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
        .format(new Date(Date.now() - i * 86400000)), mature: i >= 4 });
    }
    const ret = {};   // source -> { newAll, backAll, newMature, backMature }
    const cohortData = await Promise.all(cohortDays.map(c =>
      Promise.all([hgetall(`src:new:${c.d}`), hgetall(`src:ret3:${c.d}`)])));
    cohortData.forEach(([nw, bk], k) => {
      const mature = cohortDays[k].mature;
      const touch = src => (ret[src] = ret[src] || { newAll: 0, backAll: 0, newMature: 0, backMature: 0 });
      Object.entries(nw).forEach(([src, v]) => { const r = touch(src); r.newAll += v; if (mature) r.newMature += v; });
      Object.entries(bk).forEach(([src, v]) => { const r = touch(src); r.backAll += v; if (mature) r.backMature += v; });
    });
    const retRows = Object.entries(ret).sort((a, b) => b[1].newAll - a[1].newAll).slice(0, 12);

    const sources = {};   // source -> { new, returning, fourdowns, startsit }
    const bump = (src, field, n) => {
      sources[src] = sources[src] || { new: 0, returning: 0, fourdowns: 0, startsit: 0 };
      sources[src][field] += n;
    };
    const srcDays = await Promise.all(week.map(d => Promise.all([
      hgetall(`src:new:${d}`), hgetall(`src:returning:${d}`), hgetall(`src:finish:${d}`),
    ])));
    for (const [n, r, f] of srcDays) {
      Object.entries(n).forEach(([s, v]) => bump(s, 'new', v));
      Object.entries(r).forEach(([s, v]) => bump(s, 'returning', v));
      Object.entries(f).forEach(([k, v]) => {
        const [game, ...rest] = k.split('|');
        if (game === 'fourdowns' || game === 'startsit') bump(rest.join('|') || 'unknown', game, v);
      });
    }
    const sourceRows = Object.entries(sources)
      .sort((a, b) => (b[1].new + b[1].returning) - (a[1].new + a[1].returning))
      .slice(0, 12);

    const cell = 'padding:6px 10px;font-family:Georgia,serif;';
    const vsRow = (label, a, b) => `
      <tr><td style="${cell}color:#555;">${label}</td>
      <td style="${cell}font-weight:bold;text-align:right;">${a}</td>
      <td style="${cell}font-weight:bold;text-align:right;">${b}</td></tr>`;
    const gamesHtml = `
        <h3 style="font-family:Georgia,serif;margin:18px 0 2px;">Four Downs vs Start/Sit</h3>
        <p style="color:#888;margin-top:0;font-size:13px;">Last 7 days (${week[6]} to ${week[0]}), unique players per day, summed</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #eee;">
          <tr><td style="${cell}"></td><td style="${cell}text-align:right;color:#888;">Four Downs</td><td style="${cell}text-align:right;color:#888;">Start/Sit</td></tr>
          ${vsRow('Opened', games.fourdowns.opened, games.startsit.opened)}
          ${vsRow('Played', `${games.fourdowns.played}`, `${games.startsit.played}`)}
          ${vsRow('Finished', games.fourdowns.finished, games.startsit.finished)}
          ${vsRow('Won', `${games.fourdowns.won} <span style="color:#999;font-weight:normal;">solved</span>`, `${games.startsit.won} <span style="color:#999;font-weight:normal;">beat House</span>`)}
          ${vsRow('Shared', games.fourdowns.shared, games.startsit.shared)}
        </table>
        <p style="color:#555;font-size:13px;margin:8px 0 0;line-height:1.5;">
          Start/Sit play quality: ${ssQuality.players} ranked lineups,
          ${show(ssQuality.avgCalls)}/9 calls right on average,
          ${show(ssQuality.fadesPerPlayer)} House fades per player,
          ${show(ssQuality.fadeHitRate, '%')} of fades hit.
          <span style="color:#999;">Random tapping hits about 50% of fades.</span>
        </p>`;
    const sourcesHtml = `
        <h3 style="font-family:Georgia,serif;margin:18px 0 2px;">Where players came from</h3>
        <p style="color:#888;margin-top:0;font-size:13px;">Last 7 days, by first-touch source (utm_source/utm_content, referrer, or direct)</p>
        ${sourceRows.length ? `
        <table style="width:100%;border-collapse:collapse;border:1px solid #eee;font-size:13px;">
          <tr><td style="${cell}color:#888;">Source</td><td style="${cell}text-align:right;color:#888;">New</td><td style="${cell}text-align:right;color:#888;">Back</td><td style="${cell}text-align:right;color:#888;">FD fin.</td><td style="${cell}text-align:right;color:#888;">S/S fin.</td></tr>
          ${sourceRows.map(([s, v]) => `
          <tr><td style="${cell}">${s}</td><td style="${cell}text-align:right;">${v.new}</td><td style="${cell}text-align:right;">${v.returning}</td><td style="${cell}text-align:right;">${v.fourdowns}</td><td style="${cell}text-align:right;">${v.startsit}</td></tr>`).join('')}
        </table>` : '<p style="color:#888;font-size:13px;">No source data yet (tracking started 2026-09-29).</p>'}`;

    const retHtml = `
        <h3 style="font-family:Georgia,serif;margin:18px 0 2px;">Came back within 3 days</h3>
        <p style="color:#888;margin-top:0;font-size:13px;">By first-touch source. New = first visits in the last 10 days. Rate uses only cohorts 4+ days old, which have had their full 3 days.</p>
        ${retRows.length ? `
        <table style="width:100%;border-collapse:collapse;border:1px solid #eee;font-size:13px;">
          <tr><td style="${cell}color:#888;">Source</td><td style="${cell}text-align:right;color:#888;">New</td><td style="${cell}text-align:right;color:#888;">Back ≤3d</td><td style="${cell}text-align:right;color:#888;">Rate</td></tr>
          ${retRows.map(([src, v]) => `
          <tr><td style="${cell}">${src}</td><td style="${cell}text-align:right;">${v.newAll}</td><td style="${cell}text-align:right;">${v.backAll}</td><td style="${cell}text-align:right;">${v.newMature ? `${pct(v.backMature, v.newMature)}% <span style="color:#999;">of ${v.newMature}</span>` : '<span style="color:#999;">pending</span>'}</td></tr>`).join('')}
        </table>` : '<p style="color:#888;font-size:13px;">No return data yet (tracking started 2026-10-04).</p>'}`;

    const row = (label, value, sub) => `
      <tr>
        <td style="padding:8px 14px;font-family:Georgia,serif;color:#555;">${label}</td>
        <td style="padding:8px 14px;font-family:Georgia,serif;font-weight:bold;text-align:right;">${value}${sub ? ` <span style="color:#999;font-weight:normal;">${sub}</span>` : ''}</td>
      </tr>`;

    const html = `
      <div style="max-width:420px;font-family:Georgia,serif;">
        <h2 style="font-family:Georgia,serif;margin-bottom:2px;">PlayDraft — ${yesterday}</h2>
        <p style="color:#888;margin-top:0;font-size:13px;">Daily performance readout</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #eee;">
          ${row('Visitors', visitors)}
          ${row('New', newVisitors, `(${show(newRate, '%')} of visitors)`)}
          ${row('Returning', returningVisitors)}
          ${row('Started puzzle', started)}
          ${row('Finished puzzle', finished, `(${show(completionRate, '%')} of starts)`)}
          ${row('Solved', won)}
          ${row('Failed', lost)}
          ${row('Abandoned', abandoned, `(${show(abandonRate, '%')} of starts)`)}
          ${row('Solve rate', show(solveRate, '%'), 'of finishers')}
          ${row('Avg wrong guesses', show(avgWrong), 'per finisher')}
          ${row('Clean game rate', show(cleanRate, '%'), 'of solvers')}
          ${row('Shared', shared, `(${show(shareRate, '%')} of finishers)`)}
        </table>
        ${featured ? `
        <h3 style="font-family:Georgia,serif;margin:18px 0 2px;">Featured Puzzle — ${featured.id}</h3>
        <p style="color:#888;margin-top:0;font-size:13px;">Cumulative for this week's featured, not just yesterday${featured.idSource === 'fallback' ? ' &middot; <strong>no window matched this date, showing the most recent known featured</strong>' : ''}</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #eee;">
          ${row('Started', featured.started)}
          ${row('Finished', featured.finished)}
          ${row('Solved', featured.won)}
          ${row('Failed', featured.lost)}
          ${row('Solve rate', show(featured.solveRate, '%'), 'of finishers')}
          ${row('Avg wrong guesses', show(featured.avgWrong), 'per finisher')}
          ${row('Clean game rate', show(featured.cleanRate, '%'), 'of solvers')}
          ${row('Shared', featured.shared)}
        </table>` : ''}
        ${gamesHtml}
        ${sourcesHtml}
        ${retHtml}
      </div>`;

    // No finishers means no solve rate to report. Say what actually happened
    // rather than putting a fake 0% in the subject line.
    const subject = finished > 0
      ? `PlayDraft — ${visitors} visitors, ${solveRate}% solve rate on ${yesterday}`
      : `PlayDraft — ${visitors} visitors, no finishers on ${yesterday}`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PlayDraft Stats <onboarding@resend.dev>',
        to: ALERT_EMAIL,
        subject,
        html,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      return res.status(500).json({ error: 'Resend failed', detail: errText.slice(0, 300) });
    }

    return res.status(200).json({
      ok: true, date: yesterday, visitors, newVisitors, returningVisitors, started, finished, won, lost,
      abandoned, shared, solveRate, completionRate, abandonRate, shareRate, newRate, avgWrong, cleanRate,
      featuredIdSource, featured, games, sources, ssQuality, returns: ret,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err).slice(0, 300) });
  }
}
