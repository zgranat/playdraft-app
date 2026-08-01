// Opt-in for the daily reminder email. Stores email -> unsubscribe token.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({ ok: false, reason: 'not configured' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const email = String((body && body.email) || '').trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) {
      return res.status(400).json({ ok: false, error: 'invalid email' });
    }

    const base = UPSTASH_REDIS_REST_URL.replace(/\/+$/, '');
    const headers = { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` };
    const token = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '');

    // subscribers: hash of email -> unsubscribe token
    const r1 = await fetch(`${base}/hset/subscribers/${encodeURIComponent(email)}/${encodeURIComponent(token)}`, { headers });
    if (!r1.ok) {
      return res.status(500).json({ ok: false, upstashStatus: r1.status, upstashBody: (await r1.text()).slice(0, 200) });
    }
    // reverse lookup so an unsubscribe link needs no email in the URL
    await fetch(`${base}/set/unsub:${encodeURIComponent(token)}/${encodeURIComponent(email)}`, { headers });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err).slice(0, 200) });
  }
}
