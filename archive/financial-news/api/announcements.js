/**
 * API endpoint for fetching and managing announcements
 * Supports filtering by category, impact level, sentiment, symbol
 */

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    // GET: Fetch announcements with optional filters
    if (req.method === 'GET') {
      const { symbol, category, impactLevel, sentiment, limit = 50, offset = 0 } = req.query;
      
      let query = `SELECT * FROM announcements WHERE 1=1`;
      const params = [];
      
      if (symbol) {
        query += ` AND symbol = $${params.length + 1}`;
        params.push(symbol);
      }
      
      if (category) {
        query += ` AND category = $${params.length + 1}`;
        params.push(category);
      }
      
      if (impactLevel) {
        query += ` AND impact_level = $${params.length + 1}`;
        params.push(impactLevel);
      }
      
      if (sentiment) {
        query += ` AND sentiment = $${params.length + 1}`;
        params.push(sentiment);
      }
      
      query += ` ORDER BY announcement_date DESC, processed_at DESC`;
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
      
      const rows = await sql(query, ...params);
      
      return res.status(200).json({
        announcements: rows || [],
        count: rows?.length || 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });
    }

    // POST: Save a new announcement
    if (req.method === 'POST') {
      const { announcement } = req.body;
      
      if (!announcement || !announcement.symbol || !announcement.announcement_date) {
        return res.status(400).json({ error: 'Missing required announcement fields' });
      }
      
      try {
        const [result] = await sql`
          INSERT INTO announcements (
            symbol, announcement_date, description, pdf_url, extracted_text,
            category, smart_summary, sentiment, sentiment_score,
            impact_level, impact_score, processed_at, raw_announcement, announcement_key
          ) VALUES (
            ${announcement.symbol},
            ${announcement.announcement_date},
            ${announcement.description || null},
            ${announcement.pdf_url || null},
            ${announcement.extracted_text || null},
            ${announcement.category || 'unknown'},
            ${announcement.smart_summary || null},
            ${announcement.sentiment || 'NEUTRAL'},
            ${announcement.sentiment_score || 0},
            ${announcement.impact_level || 'LOW'},
            ${announcement.impact_score || 2},
            ${announcement.processed_at || new Date().toISOString()},
            ${JSON.stringify(announcement)},
            ${announcement.announcement_key || `${announcement.symbol}|${announcement.announcement_date}|${(announcement.description || '').slice(0, 40)}`}
          )
          ON CONFLICT (announcement_key) DO UPDATE SET
            smart_summary = ${announcement.smart_summary || null},
            category = ${announcement.category || 'unknown'},
            sentiment = ${announcement.sentiment || 'NEUTRAL'},
            impact_level = ${announcement.impact_level || 'LOW'},
            processed_at = ${new Date().toISOString()}
          RETURNING *
        `;
        
        return res.status(201).json(result);
      } catch (e) {
        console.error('Error saving announcement:', e.message);
        return res.status(500).json({ error: e.message });
      }
    }

    // DELETE: Remove an announcement
    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'Missing announcement id' });
      }
      
      try {
        await sql`DELETE FROM announcements WHERE id = ${id}`;
        return res.status(200).json({ ok: true });
      } catch (e) {
        console.error('Error deleting announcement:', e.message);
        return res.status(500).json({ error: e.message });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('announcements API error:', e);
    return res.status(500).json({ error: e.message });
  }
}
