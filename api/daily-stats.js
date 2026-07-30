// Runs daily via Vercel Cron. Emails yesterday's unique visitor count.
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
    // Eastern Time, matching api/track.js
    const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
      .format(new Date(Date.now() - 86400000));
    const key = `visitors:${yesterday}`;

    const base = UPSTASH_REDIS_REST_URL.replace(/\/+$/, '');
    const headers = { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` };

    const countRes = await fetch(`${base}/scard/${encodeURIComponent(key)}`, { headers });
    const raw = await countRes.text();

    if (!countRes.ok) {
      return res.status(500).json({
        error: 'redis rejected the request',
        upstashStatus: countRes.status,
        upstashBody: raw.slice(0, 300),
      });
    }

    let visitors = 0;
    try { visitors = JSON.parse(raw).result ?? 0; } catch {}

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PlayDraft Stats <onboarding@resend.dev>',
        to: ALERT_EMAIL,
        subject: `PlayDraft — ${visitors} visitors on ${yesterday}`,
        html: `<p><strong>${visitors}</strong> unique visitors on <strong>${yesterday}</strong>.</p>`,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      return res.status(500).json({ error: 'Resend failed', detail: errText.slice(0, 300), visitors });
    }

    return res.status(200).json({ ok: true, visitors, date: yesterday });
  } catch (err) {
    return res.status(500).json({ error: String(err).slice(0, 300) });
  }
}
