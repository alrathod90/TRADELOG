// api/cmb.js  — Vercel serverless function
// Proxies CallMeBot WhatsApp API for Capacitor mobile app.
// Usage: fetch('/api/cmb?phone=919876543210&text=hello&apikey=123456')

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { phone, text, apikey } = req.query;
  if (!phone || !text || !apikey) {
    res.status(400).json({ error: 'Missing phone, text, or apikey' });
    return;
  }

  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;

  try {
    const upstream = await fetch(url);
    const body = await upstream.text();
    res.status(upstream.status).send(body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
