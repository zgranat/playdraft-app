// Runs daily via Vercel Cron. Nudges subscribers that today's DRAFT is live.
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
    const body = (token) => `
      <div style="font-family:system-ui,sans-serif;max-width:460px;color:#1a1a2e">
        <div style="font-size:13px;letter-spacing:4px;color:#C8A96E">DRAFT</div>
        <h1 style="font-size:22px;margin:10px 0 6px">Today's puzzle is live.</h1>
        <p style="font-size:15px;line-height:1.55;color:#555;margin:0 0 18px">
          16 players, 4 hidden groups, 4 chances. If you've already played today, you're all set — your streak is safe.
        </p>
        <a href="https://playdraft.app" style="display:inline-block;background:#C8A96E;color:#0f1923;text-decoration:none;font-weight:600;padding:13px 26px;border-radius:8px">Play today's DRAFT</a>
        <p style="font-size:12px;color:#999;margin-top:26px">
          <a href="https://playdraft.app/api/unsubscribe?t=${encodeURIComponent(token)}" style="color:#999">Unsubscribe</a>
        </p>
      </div>`;

    const subject = "Today's DRAFT is live 🏈";
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
      ...(sandboxSender ? { warning: 'REMINDER_FROM is unset, using the Resend sandbox sender. It can only deliver to your own account email. Set REMINDER_FROM to a verified playdraft.app address.' } : {}),
    });
  } catch (err) {
    return res.status(500).json({ error: String(err).slice(0, 300) });
  }
}
