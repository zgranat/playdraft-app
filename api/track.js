// Records a unique visitor for "today" (Eastern Time) in a Redis SET,
// and splits them into new vs. returning using a persistent all-time
// "ever seen" set (visitors:all, no expiry).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return res.status(200).json({ ok: false, reason: 'not configured' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const anonId = (body && body.id) || 'unknown';

    // Eastern Time, so the day boundary matches the daily puzzle reset
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    const key = `visitors:${today}`;

    const base = UPSTASH_REDIS_REST_URL.replace(/\/+$/, ''); // tolerate a trailing slash
    const headers = { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` };

    const addRes = await fetch(
      `${base}/sadd/${encodeURIComponent(key)}/${encodeURIComponent(anonId)}`,
      { headers }
    );
    const addBody = await addRes.text();

    // Surface Upstash rejections instead of swallowing them
    if (!addRes.ok) {
      return res.status(200).json({
        ok: false,
        upstashStatus: addRes.status,
        upstashBody: addBody.slice(0, 300),
      });
    }

    // Expire after 45 days so old daily buckets don't accumulate
    await fetch(`${base}/expire/${encodeURIComponent(key)}/3888000`, { headers });

    // New vs. returning: check the persistent all-time set first, then
    // add this id to it (SADD to visitors:all never expires).
    const seenRes = await fetch(
      `${base}/sismember/visitors:all/${encodeURIComponent(anonId)}`,
      { headers }
    );
    const seenBody = await seenRes.text();
    let alreadySeen = false;
    try { alreadySeen = JSON.parse(seenBody).result === 1; } catch {}

    await fetch(`${base}/sadd/visitors:all/${encodeURIComponent(anonId)}`, { headers });

    const bucketKey = alreadySeen ? `visitors:returning:${today}` : `visitors:new:${today}`;
    await fetch(`${base}/sadd/${encodeURIComponent(bucketKey)}/${encodeURIComponent(anonId)}`, { headers });
    await fetch(`${base}/expire/${encodeURIComponent(bucketKey)}/3888000`, { headers });

    return res.status(200).json({ ok: true, key, result: addBody.slice(0, 120), new: !alreadySeen });
  } catch (err) {
    return res.status(200).json({ ok: false, error: String(err).slice(0, 300) });
  }
}
