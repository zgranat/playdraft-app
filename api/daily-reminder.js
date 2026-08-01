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

    // Resend batch endpoint takes up to 100 per call
    let sent = 0;
    for (let i = 0; i < subs.length; i += 100) {
      const chunk = subs.slice(i, i + 100).map((s) => ({
        from,
        to: s.email,
        subject: "Today's DRAFT is live 🏈",
        html: body(s.token),
      }));
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (!r.ok) {
        return res.status(500).json({ error: 'Resend failed', detail: (await r.text()).slice(0, 300), sent });
      }
      sent += chunk.length;
    }

    return res.status(200).json({ ok: true, sent });
  } catch (err) {
    return res.status(500).json({ error: String(err).slice(0, 300) });
  }
}
