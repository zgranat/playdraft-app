// Runs daily via Vercel Cron. Emails yesterday's performance readout:
// visitors, funnel (started -> finished -> solved), abandons, solve
// rate, and share rate.
//
// ACTIVE_FEATURED_ID: update this each time a new Featured Puzzle ships —
// must match the `id` field on the live entry in FEATURED_PUZZLES in
// src/App.js (e.g. "wk-2026-08-18"). Featured events are keyed by puzzle
// id, not by day, so this readout shows the whole week's cumulative
// Featured activity rather than just yesterday's slice of it. Leave this
// empty ('') when no Featured Puzzle is live and the section is skipped.
const ACTIVE_FEATURED_ID = 'wk-2026-08-18';

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
    const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

    const solveRate = pct(won, finished);        // of people who finished, % who solved
    const completionRate = pct(finished, started); // of people who started, % who finished
    const abandonRate = pct(abandoned, started);   // of people who started, % who bailed
    const shareRate = pct(shared, finished);       // of people who finished, % who shared
    const newRate = pct(newVisitors, visitors);     // of visitors, % who are first-timers
    const avgWrong = finished > 0 ? Math.round((wrongSum / finished) * 10) / 10 : 0;
    const cleanRate = pct(clean, won);              // of solvers, % with zero wrong guesses

    // Featured Puzzle totals — cumulative for the whole week, not just
    // yesterday, since these events are keyed by puzzle id rather than day.
    let featured = null;
    if (ACTIVE_FEATURED_ID) {
      const [fStarted, fWon, fLost, fShared, fWrongSum, fClean] = await Promise.all([
        scard(`evt:featured_start:${ACTIVE_FEATURED_ID}`),
        scard(`evt:featured_win:${ACTIVE_FEATURED_ID}`),
        scard(`evt:featured_loss:${ACTIVE_FEATURED_ID}`),
        scard(`evt:featured_share:${ACTIVE_FEATURED_ID}`),
        getInt(`evt:wrongsum:${ACTIVE_FEATURED_ID}`),
        scard(`evt:clean:${ACTIVE_FEATURED_ID}`),
      ]);
      const fFinished = fWon + fLost;
      featured = {
        id: ACTIVE_FEATURED_ID,
        started: fStarted, won: fWon, lost: fLost, shared: fShared,
        finished: fFinished,
        solveRate: pct(fWon, fFinished),
        avgWrong: fFinished > 0 ? Math.round((fWrongSum / fFinished) * 10) / 10 : 0,
        cleanRate: pct(fClean, fWon),
      };
    }

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
          ${row('New', newVisitors, `(${newRate}% of visitors)`)}
          ${row('Returning', returningVisitors)}
          ${row('Started puzzle', started)}
          ${row('Finished puzzle', finished, `(${completionRate}% of starts)`)}
          ${row('Solved', won)}
          ${row('Failed', lost)}
          ${row('Abandoned', abandoned, `(${abandonRate}% of starts)`)}
          ${row('Solve rate', `${solveRate}%`, 'of finishers')}
          ${row('Avg wrong guesses', avgWrong, 'per finisher')}
          ${row('Clean game rate', `${cleanRate}%`, 'of solvers')}
          ${row('Shared', shared, `(${shareRate}% of finishers)`)}
        </table>
        ${featured ? `
        <h3 style="font-family:Georgia,serif;margin:18px 0 2px;">Featured Puzzle — ${featured.id}</h3>
        <p style="color:#888;margin-top:0;font-size:13px;">Cumulative for this week's featured, not just yesterday</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #eee;">
          ${row('Started', featured.started)}
          ${row('Finished', featured.finished)}
          ${row('Solved', featured.won)}
          ${row('Failed', featured.lost)}
          ${row('Solve rate', `${featured.solveRate}%`, 'of finishers')}
          ${row('Avg wrong guesses', featured.avgWrong, 'per finisher')}
          ${row('Clean game rate', `${featured.cleanRate}%`, 'of solvers')}
          ${row('Shared', featured.shared)}
        </table>` : ''}
      </div>`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PlayDraft Stats <onboarding@resend.dev>',
        to: ALERT_EMAIL,
        subject: `PlayDraft — ${visitors} visitors, ${solveRate}% solve rate on ${yesterday}`,
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
      featured,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err).slice(0, 300) });
  }
}
