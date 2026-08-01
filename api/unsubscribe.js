// One-click unsubscribe. Linked from every reminder email.
export default async function handler(req, res) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  const token = String((req.query && req.query.t) || '');

  const page = (msg) => `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<div style="font-family:system-ui,sans-serif;max-width:420px;margin:18vh auto;padding:0 24px;text-align:center;color:#1a1a2e">
<div style="font-size:13px;letter-spacing:4px;color:#C8A96E">DRAFT</div>
<p style="font-size:17px;line-height:1.5;margin-top:14px">${msg}</p>
<a href="https://playdraft.app" style="color:#C8A96E">Back to the puzzle</a></div>`;

  if (!token || !UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(page('That unsubscribe link looks invalid.'));
  }

  try {
    const base = UPSTASH_REDIS_REST_URL.replace(/\/+$/, '');
    const headers = { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` };

    const lookup = await fetch(`${base}/get/unsub:${encodeURIComponent(token)}`, { headers });
    const email = (await lookup.json()).result;

    res.setHeader('Content-Type', 'text/html');
    if (!email) return res.status(404).send(page('That link has already been used, or has expired.'));

    await fetch(`${base}/hdel/subscribers/${encodeURIComponent(email)}`, { headers });
    await fetch(`${base}/del/unsub:${encodeURIComponent(token)}`, { headers });

    return res.status(200).send(page("You're unsubscribed. No more reminders."));
  } catch {
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(page('Something went wrong. Try the link again shortly.'));
  }
}
