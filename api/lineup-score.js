// Start/Sit: records a finished lineup's score and returns how it ranks
// against everyone else who played the same lineup number.
//
//   POST { n, score, calls, fades, fadeHits, id, src, dry }
//   ->   { ok, players, pct }   pct = share of OTHER players you beat (ties count half)
//
// Scores live in a sorted set per lineup number (ls:scores:<n>), one entry per
// player, first finish wins (NX) so replays can't move the field. `dry` (the
// owner's ?me=1 browsers) reads the field without joining it.
//
// Also keeps per-day sums for the stats email: calls right, House fades tried,
// fades that hit. Those are what say whether players are reading the cards or
// just tapping.
const TTL = 3888000; // 45 days, same as every other key

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return res.status(200).json({ ok: false, reason: 'not configured' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};
    const n = Number(body.n);
    const score = Number(body.score);
    const id = String(body.id || '').slice(0, 64);
    const int = v => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(9, Math.round(Number(v)))) : 0);
    if (!Number.isInteger(n) || n < 1 || n > 100000 || !Number.isFinite(score) || score < 0 || score > 1000 || !id) {
      return res.status(200).json({ ok: false, reason: 'bad input' });
    }

    const base = UPSTASH_REDIS_REST_URL.replace(/\/+$/, '');
    // Upstash REST pipeline: one round trip for all commands
    const pipe = async cmds => {
      const r = await fetch(`${base}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cmds),
      });
      if (!r.ok) throw new Error(`upstash ${r.status}`);
      return (await r.json()).map(x => x.result);
    };

    const key = `ls:scores:${n}`;
    const s = String(Math.round(score * 10) / 10);
    let joined = 0;
    if (!body.dry) {
      [joined] = await pipe([['ZADD', key, 'NX', s, id], ['EXPIRE', key, String(TTL)]]);
      if (joined === 1) {
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
        const day = `ls:day:${today}`;
        await pipe([
          ['HINCRBY', day, 'players', '1'],
          ['HINCRBY', day, 'calls', String(int(body.calls))],
          ['HINCRBY', day, 'fades', String(int(body.fades))],
          ['HINCRBY', day, 'fadeHits', String(int(body.fadeHits))],
          ['EXPIRE', day, String(TTL)],
        ]);
      }
    }

    // Rank against everyone else. If this player already finished today, use
    // their recorded score so the answer never changes on a replay.
    const [stored] = await pipe([['ZSCORE', key, id]]);
    const mine = stored != null && !body.dry ? String(stored) : s;
    const [total, below, ties] = await pipe([
      ['ZCARD', key], ['ZCOUNT', key, '-inf', `(${mine}`], ['ZCOUNT', key, mine, mine],
    ]);
    const inField = !body.dry && stored != null;
    const others = total - (inField ? 1 : 0);
    const otherTies = ties - (inField ? 1 : 0);
    const pct = others > 0 ? Math.round(((below + otherTies / 2) / others) * 100) : null;
    return res.status(200).json({ ok: true, players: others, pct, joined: joined === 1 });
  } catch (err) {
    return res.status(200).json({ ok: false, error: String(err).slice(0, 200) });
  }
}
