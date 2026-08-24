// Receives guest puzzle submissions from public/submit.html.
// Stores the raw submission in Redis (a list, oldest-first) so nothing is
// ever lost even if the notification email fails, and emails a formatted
// copy to ALERT_EMAIL — the same address that already gets the daily
// stats email, so submissions show up somewhere you're already looking.
//
// This does NOT touch the live puzzle bank. Turning a submission into a
// real puzzle stays a manual step: read the email, verify the facts,
// run it through the same patch-script + validate.js workflow as any
// other puzzle, then ship it.

const MAX_LEN = { short: 100, medium: 300, category: 500, notes: 1500 };

function clean(v, max) {
  return String(v ?? '').trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, RESEND_API_KEY, ALERT_EMAIL } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({ ok: false, reason: 'not configured' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const name = clean(body.name, MAX_LEN.short);
    const tag = clean(body.tag, MAX_LEN.short);
    const email = clean(body.email, MAX_LEN.short).toLowerCase();
    const theme = clean(body.theme, MAX_LEN.short);
    const blurb = clean(body.blurb, MAX_LEN.medium);
    const categories = [
      clean(body.category1, MAX_LEN.category),
      clean(body.category2, MAX_LEN.category),
      clean(body.category3, MAX_LEN.category),
      clean(body.category4, MAX_LEN.category),
    ];
    const notes = clean(body.notes, MAX_LEN.notes);

    // Required: name, a valid-looking email, a theme, and all 4 category boxes filled in.
    if (!name) return res.status(400).json({ ok: false, error: 'name is required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'valid email is required' });
    }
    if (!theme) return res.status(400).json({ ok: false, error: 'theme is required' });
    if (categories.some(c => !c)) {
      return res.status(400).json({ ok: false, error: 'all 4 categories are required' });
    }

    const submission = {
      name, tag, email, theme, blurb, categories, notes,
      submittedAt: new Date().toISOString(),
    };

    const base = UPSTASH_REDIS_REST_URL.replace(/\/+$/, '');
    const headers = { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` };

    // Durable log first — this succeeding is what matters. Email is a
    // convenience notification on top, not the source of truth.
    // Value goes in the POST body (not the URL path) since a full
    // submission — 4 categories plus notes — can be a few KB, well past
    // safe URL-length limits if it were path-encoded instead.
    const pushRes = await fetch(`${base}/rpush/submissions:puzzles`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'text/plain' },
      body: JSON.stringify(submission),
    });
    if (!pushRes.ok) {
      const t = await pushRes.text();
      return res.status(500).json({ ok: false, upstashStatus: pushRes.status, upstashBody: t.slice(0, 300) });
    }

    // Best-effort email notification — failure here shouldn't fail the
    // submission, since it's already safely logged in Redis above.
    if (RESEND_API_KEY && ALERT_EMAIL) {
      const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const html = `
        <div style="font-family:Georgia,serif;max-width:560px;">
          <h2 style="font-family:Georgia,serif;">New puzzle submission</h2>
          <p><strong>From:</strong> ${esc(name)}${tag ? ` (${esc(tag)})` : ''} — ${esc(email)}</p>
          <p><strong>Theme:</strong> ${esc(theme)}</p>
          ${blurb ? `<p><strong>Blurb:</strong> ${esc(blurb)}</p>` : ''}
          <table style="width:100%;border-collapse:collapse;margin-top:10px;">
            ${categories.map((c, i) => `
              <tr><td style="padding:8px;border:1px solid #eee;vertical-align:top;"><strong>Category ${i + 1}</strong><br>${esc(c).replace(/\n/g, '<br>')}</td></tr>
            `).join('')}
          </table>
          ${notes ? `<p style="margin-top:10px;"><strong>Notes / sources:</strong><br>${esc(notes).replace(/\n/g, '<br>')}</p>` : ''}
          <p style="color:#888;font-size:12px;margin-top:16px;">Submitted ${submission.submittedAt}</p>
        </div>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'PlayDraft Submissions <onboarding@resend.dev>',
          to: ALERT_EMAIL,
          subject: `New puzzle submission: ${theme} (${name})`,
          html,
        }),
      }).catch(() => {}); // swallow — Redis log already has it
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err).slice(0, 300) });
  }
}
