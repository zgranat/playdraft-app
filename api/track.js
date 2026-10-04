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

    // 3-day return, the number an ad is judged on. A first-time visitor gets a
    // first-seen date; when they come back 1-3 days later they are counted once
    // in that day's cohort, credited to their first-touch source. Visitors from
    // before this existed have no first-seen date and are simply left out.
    const firstKey = 'visitors:first';
    const src3 = String((body && body.src) || 'unknown').toLowerCase()
      .replace(/[^a-z0-9._/-]/g, '').slice(0, 60) || 'unknown';
    if (!alreadySeen) {
      await fetch(`${base}/hsetnx/${firstKey}/${encodeURIComponent(anonId)}/${today}`, { headers });
    } else {
      let first = null;
      try {
        first = JSON.parse(await (await fetch(`${base}/hget/${firstKey}/${encodeURIComponent(anonId)}`, { headers })).text()).result;
      } catch {}
      const gap = first ? Math.round((Date.parse(today) - Date.parse(first)) / 86400000) : 0;
      if (gap >= 1 && gap <= 3) {
        const cohort = `ret3:${first}`;
        let added = 0;
        try {
          added = JSON.parse(await (await fetch(`${base}/sadd/${encodeURIComponent(cohort)}/${encodeURIComponent(anonId)}`, { headers })).text()).result;
        } catch {}
        await fetch(`${base}/expire/${encodeURIComponent(cohort)}/3888000`, { headers });
        if (added === 1) {
          const k = `src:ret3:${first}`;
          await fetch(`${base}/hincrby/${encodeURIComponent(k)}/${encodeURIComponent(src3)}/1`, { headers });
          await fetch(`${base}/expire/${encodeURIComponent(k)}/3888000`, { headers });
        }
      }
    }

    const bucketKey = alreadySeen ? `visitors:returning:${today}` : `visitors:new:${today}`;
    await fetch(`${base}/sadd/${encodeURIComponent(bucketKey)}/${encodeURIComponent(anonId)}`, { headers });
    await fetch(`${base}/expire/${encodeURIComponent(bucketKey)}/3888000`, { headers });

    // Where visitors came from, by first-touch source (utm_source[/utm_content],
    // referring site, or "direct"). Counted once per visitor per day, split
    // new vs. returning — returning-by-source is how an ad variant's
    // retention gets read.
    let addedToday = 0;
    try { addedToday = JSON.parse(addBody).result; } catch {}
    if (addedToday === 1) {
      const src = String((body && body.src) || 'unknown').toLowerCase()
        .replace(/[^a-z0-9._/-]/g, '').slice(0, 60) || 'unknown';
      const srcKey = alreadySeen ? `src:returning:${today}` : `src:new:${today}`;
      await fetch(`${base}/hincrby/${encodeURIComponent(srcKey)}/${encodeURIComponent(src)}/1`, { headers });
      await fetch(`${base}/expire/${encodeURIComponent(srcKey)}/3888000`, { headers });
    }

    return res.status(200).json({ ok: true, key, result: addBody.slice(0, 120), new: !alreadySeen });
  } catch (err) {
    return res.status(200).json({ ok: false, error: String(err).slice(0, 300) });
  }
}
