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

// GET /api/profile?userId=xxx           -> { telegram_chat_id }
// PUT /api/profile { userId, telegram_chat_id } -> upsert
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const userId = String(req.query.userId || 'guest').toLowerCase();
      const rows = await sql`
        SELECT telegram_chat_id FROM profiles WHERE user_id = ${userId}
      `;
      return res.status(200).json({ telegram_chat_id: rows[0]?.telegram_chat_id || null });
    }

    if (req.method === 'PUT') {
      const { userId, telegram_chat_id } = req.body || {};
      if (!userId) return res.status(400).json({ error: 'userId is required' });
      const uid = String(userId).toLowerCase();
      await sql`
        INSERT INTO profiles (user_id, telegram_chat_id)
        VALUES (${uid}, ${telegram_chat_id || null})
        ON CONFLICT (user_id) DO UPDATE SET telegram_chat_id = ${telegram_chat_id || null}
      `;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('api/profile error:', e);
    return res.status(500).json({ error: e.message });
  }
}