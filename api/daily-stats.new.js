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
      featuredIdSource, featured,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err).slice(0, 300) });
  }
}
