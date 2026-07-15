import { neon } from '@neondatabase/serverless';

let _sql = null;
function sql(strings, ...values) {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set in Vercel environment variables');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql(strings, ...values);
}

// GET    /api/trades?userId=xxx                      -> list all trades for user
// POST   /api/trades   { userId, trade }              -> upsert one trade
// PUT    /api/trades   { userId, trades: [...] }      -> replace all trades for user
// DELETE /api/trades?userId=xxx&tradeId=yyy           -> delete one trade
export default async function handler(req, res) {
  try {
    const { method } = req;

    if (method === 'GET') {
      const userId = String(req.query.userId || 'guest').toLowerCase();
      const rows = await sql`
        SELECT data FROM trades WHERE user_id = ${userId} ORDER BY updated_at DESC
      `;
      return res.status(200).json(rows.map(r => r.data));
    }

    if (method === 'POST') {
      const { userId, trade } = req.body || {};
      if (!userId || !trade || !trade.id) {
        return res.status(400).json({ error: 'userId and trade.id are required' });
      }
      const uid = String(userId).toLowerCase();
      const json = JSON.stringify(trade);
      await sql`
        INSERT INTO trades (id, user_id, data, updated_at)
        VALUES (${trade.id}, ${uid}, ${json}::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET data = ${json}::jsonb, updated_at = now()
      `;
      return res.status(200).json({ ok: true });
    }

    if (method === 'PUT') {
      const { userId, trades } = req.body || {};
      if (!userId || !Array.isArray(trades)) {
        return res.status(400).json({ error: 'userId and trades[] are required' });
      }
      const uid = String(userId).toLowerCase();
      await sql`DELETE FROM trades WHERE user_id = ${uid}`;
      for (const t of trades) {
        if (!t || !t.id) continue;
        await sql`
          INSERT INTO trades (id, user_id, data, updated_at)
          VALUES (${t.id}, ${uid}, ${JSON.stringify(t)}::jsonb, now())
        `;
      }
      return res.status(200).json({ ok: true });
    }

    if (method === 'DELETE') {
      const userId = String(req.query.userId || 'guest').toLowerCase();
      const tradeId = req.query.tradeId;
      if (!tradeId) return res.status(400).json({ error: 'tradeId is required' });
      await sql`DELETE FROM trades WHERE user_id = ${userId} AND id = ${tradeId}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('api/trades error:', e);
    return res.status(500).json({ error: e.message });
  }
}