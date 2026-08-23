// Records a gameplay event (start / win / loss / share) for the daily
// puzzle, PLUS the featured_* equivalents for the weekly Featured Puzzle.
// Daily events are Redis SETs keyed by day (one count per person per day).
// Featured events are keyed by the featured puzzle's own id instead of by
// day, since a Featured Puzzle runs for a whole week — keying by day would
// scatter one puzzle's activity across seven separate buckets.
const DAILY_TYPES = new Set(['start', 'win', 'loss', 'share']);
const FEATURED_TYPES = new Set(['featured_start', 'featured_win', 'featured_loss', 'featured_share']);
const ALLOWED = new Set([...DAILY_TYPES, ...FEATURED_TYPES]);

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
    const featuredId = body && body.featured;

    if (!ALLOWED.has(type)) {
      return res.status(200).json({ ok: false, reason: 'bad type' });
    }
    if (FEATURED_TYPES.has(type) && !featuredId) {
      return res.status(200).json({ ok: false, reason: 'missing featured id' });
    }

    // Eastern Time, matching api/track.js so the day boundary lines up
    // with the daily puzzle reset.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    // Daily events bucket by day; featured events bucket by the puzzle's
    // own id so a week's activity accumulates in one place.
    const bucket = FEATURED_TYPES.has(type) ? featuredId : today;
    const key = `evt:${type}:${bucket}`;

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

    // Expire after 45 days, matching the visitor keys. Featured keys get
    // the same expiry — the Locker Room trophy case reads from the
    // client-side pd_featured_v1 store, not from these server counters,
    // so a 45-day expiry here doesn't affect anyone's saved results.
    await fetch(`${base}/expire/${encodeURIComponent(key)}/3888000`, { headers });

    // For finishers (win/loss, daily or featured), also roll up wrong-guess
    // count and clean-game rate. wrongsum is a plain counter (not a set) so
    // it can be divided by the finisher count to get an average.
    if ((type === 'win' || type === 'loss' || type === 'featured_win' || type === 'featured_loss') && wrong !== null) {
      const sumKey = `evt:wrongsum:${bucket}`;
      await fetch(`${base}/incrby/${encodeURIComponent(sumKey)}/${wrong}`, { headers });
      await fetch(`${base}/expire/${encodeURIComponent(sumKey)}/3888000`, { headers });

      if ((type === 'win' || type === 'featured_win') && wrong === 0) {
        const cleanKey = `evt:clean:${bucket}`;
        await fetch(`${base}/sadd/${encodeURIComponent(cleanKey)}/${encodeURIComponent(anonId)}`, { headers });
        await fetch(`${base}/expire/${encodeURIComponent(cleanKey)}/3888000`, { headers });
      }
    }

    return res.status(200).json({ ok: true, key });
  } catch (err) {
    return res.status(200).json({ ok: false, error: String(err).slice(0, 300) });
  }
}
