// Runs daily via Vercel Cron. Nudges subscribers that today's puzzles are live.
//
// Timing: fires at 8:30am ET. Vercel crons run on UTC and UTC does not observe
// daylight saving, so vercel.json triggers this at both 12:30 and 13:30 UTC and
// the guard below drops whichever one is not 8am in New York today. Without it
// the send drifts an hour every November.
//
// Morning matters more than it looks. Play state lives in localStorage, so this
// job cannot know who has already played and cannot suppress them. At 5pm a
// large share of the list has already played and gets told to do something they
// have done, which is how people learn to ignore you. At 8:30 almost nobody has,
// so the problem mostly disappears on its own.
export default async function handler(req, res) {
  const {
    UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN,
    RESEND_API_KEY,
    REMINDER_FROM, // e.g. "DRAFT <daily@playdraft.app>" — needs a verified domain
  } = process.env;

  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN || !RESEND_API_KEY) {
    return res.status(500).json({ error: 'Missing required environment variables' });
  }

  // Same America/New_York formatting used everywhere else, so the reminder can
  // never drift away from the daily reset boundary.
  const etHour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', hour12: false,
  }).format(new Date()));
  const force = req.query?.force === '1';
  if (etHour !== 8 && !force) {
    return res.status(200).json({ ok: true, skipped: 'not 8am ET', etHour });
  }

  try {
    const base = UPSTASH_REDIS_REST_URL.replace(/\/+$/, '');
    const headers = { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` };

    const listRes = await fetch(`${base}/hgetall/subscribers`, { headers });
    const raw = await listRes.text();
    if (!listRes.ok) {
      return res.status(500).json({ error: 'redis rejected', upstashStatus: listRes.status, upstashBody: raw.slice(0, 300) });
    }

    // HGETALL returns a flat [field, value, field, value, ...] array
    const flat = (JSON.parse(raw).result) || [];
    const subs = [];
    for (let i = 0; i < flat.length; i += 2) subs.push({ email: flat[i], token: flat[i + 1] });

    if (!subs.length) return res.status(200).json({ ok: true, sent: 0, note: 'no subscribers' });

    const from = REMINDER_FROM || 'DRAFT <onboarding@resend.dev>';

    // One email, two games, one link each. Two sends to the same small list
    // would burn goodwill fast, and separate links show which game the email
    // actually drives.
    const body = (token) => `
      <div style="font-family:system-ui,sans-serif;max-width:460px;color:#1a1a2e">
        <div style="font-size:13px;letter-spacing:4px;color:#C8A96E">DRAFT</div>
        <h1 style="font-size:22px;margin:10px 0 6px">Today's puzzles are live.</h1>

        <div style="border-left:3px solid #C8A96E;padding:2px 0 2px 14px;margin:22px 0 18px">
          <div style="font-size:17px;font-weight:600;margin-bottom:3px">Four Downs</div>
          <p style="font-size:14px;line-height:1.5;color:#555;margin:0 0 12px">
            16 players, 4 hidden groups, 4 chances.
          </p>
          <a href="https://playdraft.app/#/four-downs" style="display:inline-block;background:#C8A96E;color:#0f1923;text-decoration:none;font-weight:600;padding:11px 22px;border-radius:8px;font-size:14px">Play Four Downs</a>
        </div>

        <div style="border-left:3px solid #3FA7D6;padding:2px 0 2px 14px;margin:0 0 22px">
          <div style="font-size:17px;font-weight:600;margin-bottom:3px">Start/Sit</div>
          <p style="font-size:14px;line-height:1.5;color:#555;margin:0 0 12px">
            Ten real players from real weeks going back to 1999. Start five, beat the House.
          </p>
          <a href="https://playdraft.app/#/start-sit" style="display:inline-block;background:#3FA7D6;color:#fff;text-decoration:none;font-weight:600;padding:11px 22px;border-radius:8px;font-size:14px">Set today's lineup</a>
        </div>

        <p style="font-size:13px;line-height:1.5;color:#888;margin:0">
          Already played? You're all set, your streak is safe.
        </p>
        <p style="font-size:12px;color:#999;margin-top:26px">
          <a href="https://playdraft.app/api/unsubscribe?t=${encodeURIComponent(token)}" style="color:#999">Unsubscribe</a>
        </p>
      </div>`;

    const subject = "Today's puzzles are live 🏈";
    const msg = (s) => ({ from, to: s.email, subject, html: body(s.token) });

    // Resend batch endpoint takes up to 100 per call. A rejected batch used to
    // return 500 and abort, so one bad address blocked every subscriber behind
    // it in the list, every day, silently. Now a failed batch retries one at a
    // time and only the addresses that actually fail are dropped.
    let sent = 0;
    const failures = [];
    for (let i = 0; i < subs.length; i += 100) {
      const chunk = subs.slice(i, i + 100);
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk.map(msg)),
      });
      if (r.ok) { sent += chunk.length; continue; }

      const batchDetail = (await r.text()).slice(0, 200);
      for (const s of chunk) {
        const one = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(msg(s)),
        });
        if (one.ok) { sent += 1; continue; }
        failures.push({ email: s.email, detail: (await one.text()).slice(0, 140) || batchDetail });
      }
    }

    // onboarding@resend.dev is Resend's shared sandbox sender and will only
    // deliver to the account owner's own address. If REMINDER_FROM is unset,
    // every other subscriber silently fails. Surface that rather than hide it.
    const sandboxSender = from.includes('resend.dev');

    return res.status(200).json({
      ok: true,
      sent,
      failed: failures.length,
      failures: failures.slice(0, 10),
      from,
      etHour,
      ...(sandboxSender ? { warning: 'REMINDER_FROM is unset, using the Resend sandbox sender. It can only deliver to your own account email. Set REMINDER_FROM to a verified playdraft.app address.' } : {}),
    });
  } catch (err) {
    return res.status(500).json({ error: String(err).slice(0, 300) });
  }
}
