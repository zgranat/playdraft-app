// Tracks a unique visitor for "today" using an anonymous client-generated id.
// Stores ids in a Redis SET keyed by date so we can count uniques per day.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    // Fail silently so a missing config never breaks the app for real users
    return res.status(200).json({ ok: false, reason: 'not configured' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const anonId = (body && body.id) || 'unknown';

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD (UTC)
    const key = `visitors:${today}`;

    const headers = { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` };

    // Add this visitor's id to today's set
    await fetch(
      `${UPSTASH_REDIS_REST_URL}/SADD/${encodeURIComponent(key)}/${encodeURIComponent(anonId)}`,
      { headers }
    );
    // Auto-expire the key after 45 days so old data doesn't pile up
    await fetch(
      `${UPSTASH_REDIS_REST_URL}/EXPIRE/${encodeURIComponent(key)}/3888000`,
      { headers }
    );

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(200).json({ ok: false, error: String(err) });
  }
}
