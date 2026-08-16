// Records a daily gameplay event (start / win / loss / share) for the
// daily puzzle only. Each event is a Redis SET keyed by day, so counts
// are unique-per-visitor (one start/win/loss/share counted once per
// person per day, no matter how many times they fire).
const ALLOWED = new Set(['start', 'win', 'loss', 'share']);

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
    const type = body && body.type;
    const anonId = (body && body.id) || 'unknown';
    const wrong = Number.isFinite(body && body.wrong) ? body.wrong : null;

    if (!ALLOWED.has(type)) {
      return res.status(200).json({ ok: false, reason: 'bad type' });
    }

    // Eastern Time, matching api/track.js so the day boundary lines up
    // with the daily puzzle reset.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    const key = `evt:${type}:${today}`;

    const base = UPSTASH_REDIS_REST_URL.replace(/\/+$/, '');
    const headers = { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` };

    const addRes = await fetch(
      `${base}/sadd/${encodeURIComponent(key)}/${encodeURIComponent(anonId)}`,
      { headers }
    );
    if (!addRes.ok) {
      const addBody = await addRes.text();
      return res.status(200).json({ ok: false, upstashStatus: addRes.status, upstashBody: addBody.slice(0, 300) });
    }

    // Expire after 45 days, matching the visitor keys.
    await fetch(`${base}/expire/${encodeURIComponent(key)}/3888000`, { headers });

    // For finishers (win/loss), also roll up wrong-guess count and
    // clean-game rate. wrongsum is a plain counter (not a set) so it
    // can be divided by the finisher count to get an average.
    if ((type === 'win' || type === 'loss') && wrong !== null) {
      const sumKey = `evt:wrongsum:${today}`;
      await fetch(`${base}/incrby/${encodeURIComponent(sumKey)}/${wrong}`, { headers });
      await fetch(`${base}/expire/${encodeURIComponent(sumKey)}/3888000`, { headers });

      if (type === 'win' && wrong === 0) {
        const cleanKey = `evt:clean:${today}`;
        await fetch(`${base}/sadd/${encodeURIComponent(cleanKey)}/${encodeURIComponent(anonId)}`, { headers });
        await fetch(`${base}/expire/${encodeURIComponent(cleanKey)}/3888000`, { headers });
      }
    }

    return res.status(200).json({ ok: true, key });
  } catch (err) {
    return res.status(200).json({ ok: false, error: String(err).slice(0, 300) });
  }
}
