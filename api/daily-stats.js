// Runs daily via Vercel Cron. Reads yesterday's unique visitor count from
// Redis and emails it using Resend.
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
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const key = `visitors:${yesterday}`;

    const countRes = await fetch(
      `${UPSTASH_REDIS_REST_URL}/SCARD/${encodeURIComponent(key)}`,
      { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } }
    );
    const countData = await countRes.json();
    const visitors = countData.result ?? 0;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PlayDraft Stats <onboarding@resend.dev>',
        to: ALERT_EMAIL,
        subject: `📊 PlayDraft — ${visitors} visitors on ${yesterday}`,
        html: `<p><strong>${visitors}</strong> unique visitors played or visited on <strong>${yesterday}</strong>.</p>`,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      return res.status(500).json({ error: 'Resend failed', detail: errText });
    }

    res.status(200).json({ ok: true, visitors, date: yesterday });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
