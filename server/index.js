// Small Express backend to use Google Sheets as a datastore for NSE symbols
// ENV required:
// - GOOGLE_SERVICE_ACCOUNT_JSON : JSON string of the service account key
// - SPREADSHEET_ID : Google Sheets spreadsheet ID
// - API_KEY : simple API key for client requests (optional but recommended)

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { google } = require('googleapis');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

const PORT = process.env.PORT || 4000;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const API_KEY = process.env.API_KEY || null;

if(!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  console.error('Missing GOOGLE_SERVICE_ACCOUNT_JSON env var. Exiting.');
  process.exit(1);
}
if(!SPREADSHEET_ID){
  console.error('Missing SPREADSHEET_ID env var. Exiting.');
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

// Simple API key middleware
function requireApiKey(req,res,next){
  if(!API_KEY) return next();
  const key = req.get('x-api-key') || req.query.api_key;
  if(key && key === API_KEY) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// Helper to read all rows from Sheet1
async function readAll(){
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Sheet1!A1:Z10000' });
  const rows = r.data.values || [];
  return rows;
}

// Convert rows -> array of objects (header row expected)
function rowsToObjects(rows){
  if(!rows || rows.length===0) return [];
  const [header, ...data] = rows;
  return data.map(r => Object.fromEntries(header.map((h,i)=>[h, r[i] || ''])));
}

app.get('/api/nse', requireApiKey, async (req,res)=>{
  try{
    const rows = await readAll();
    return res.json(rowsToObjects(rows));
  }catch(e){
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

// Append a single record. Body must be an object whose keys match header names (or header will be derived)
app.post('/api/nse/append', requireApiKey, async (req,res)=>{
  const obj = req.body;
  if(!obj || typeof obj !== 'object') return res.status(400).json({ error: 'Invalid body' });
  try{
    // Ensure we have header row
    const rows = await readAll();
    let header = rows[0];
    if(!header){
      header = Object.keys(obj);
      // write header first
      await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: 'Sheet1!A1:1', valueInputOption: 'RAW', requestBody:{ values: [header] }});
    }
    const row = header.map(h => obj[h] || '');
    await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: 'Sheet1!A1:1', valueInputOption: 'USER_ENTERED', requestBody:{ values:[row]} });
    return res.json({ ok:true });
  }catch(e){ console.error(e); return res.status(500).json({ error: e.message }); }
});

// Update existing row by symbol (assumes header contains 'sym')
app.post('/api/nse/update', requireApiKey, async (req,res)=>{
  const obj = req.body; // must include sym
  if(!obj || !obj.sym) return res.status(400).json({ error: 'Missing sym in body' });
  try{
    const rows = await readAll();
    const header = rows[0] || [];
    const data = rows.slice(1);
    const symIdx = header.findIndex(h=>h.toLowerCase()==='sym');
    if(symIdx<0) return res.status(400).json({ error: 'No sym header in sheet' });
    let rowIndex = -1;
    for(let i=0;i<data.length;i++){
      if((data[i][symIdx]||'').toUpperCase() === (obj.sym||'').toUpperCase()){ rowIndex = i+2; break; } // +2 because sheet rows are 1-based and header at row1
    }
    if(rowIndex===-1) return res.status(404).json({ error: 'Symbol not found' });
    const row = header.map(h=> obj[h] || '');
    const range = `Sheet1!A${rowIndex}:`;
    await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range, valueInputOption: 'USER_ENTERED', requestBody: { values: [row] } });
    return res.json({ ok:true });
  }catch(e){ console.error(e); return res.status(500).json({ error: e.message }); }
});

// --- Trades endpoints (sheet name: Trades) ---
app.get('/api/trades', requireApiKey, async (req,res)=>{
  try{
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Trades!A1:Z10000' });
    const rows = r.data.values || [];
    return res.json(rowsToObjects(rows));
  }catch(e){ console.error(e); return res.status(500).json({ error: e.message }); }
});

app.post('/api/trades/append', requireApiKey, async (req,res)=>{
  const obj = req.body;
  if(!obj || typeof obj !== 'object') return res.status(400).json({ error: 'Invalid body' });
  try{
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Trades!A1:1' });
    let header = r.data.values?.[0];
    if(!header){ header = Object.keys(obj); await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: 'Trades!A1:1', valueInputOption: 'RAW', requestBody:{ values: [header] }}); }
    const row = header.map(h => obj[h] || '');
    await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: 'Trades!A1:1', valueInputOption: 'USER_ENTERED', requestBody:{ values:[row]} });
    return res.json({ ok:true });
  }catch(e){ console.error(e); return res.status(500).json({ error: e.message }); }
});

app.post('/api/trades/update', requireApiKey, async (req,res)=>{
  const obj = req.body; if(!obj || (obj.id===undefined)) return res.status(400).json({ error:'Missing id in body' });
  try{
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Trades!A1:Z10000' });
    const rows = r.data.values || [];
    const header = rows[0] || [];
    const data = rows.slice(1);
    const idIdx = header.findIndex(h=>h.toLowerCase()==='id');
    if(idIdx<0) return res.status(400).json({ error: 'No id header in Trades sheet' });
    let rowIndex = -1;
    for(let i=0;i<data.length;i++){ if((data[i][idIdx]||'')+'' === (obj.id+'') ){ rowIndex = i+2; break; } }
    if(rowIndex===-1) return res.status(404).json({ error:'Trade not found' });
    const row = header.map(h => obj[h] || '');
    const range = `Trades!A${rowIndex}:`;
    await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range, valueInputOption: 'USER_ENTERED', requestBody: { values: [row] } });
    return res.json({ ok:true });
  }catch(e){ console.error(e); return res.status(500).json({ error: e.message }); }
});

app.listen(PORT, ()=> console.log('Server listening on', PORT));

// --- LTP proxy endpoint (optional helper for frontend) ---
// GET /api/ltp?syms=RELIANCE,INFY
// Returns: { prices: { RELIANCE: 1234.5, INFY: 789.0 } }
const LTP_CACHE = new Map(); // key: sym -> { price, ts }
const LTP_API_URL_TEMPLATE = process.env.LTP_API_URL_TEMPLATE?.trim();
const LTP_API_KEY = process.env.LTP_API_KEY?.trim();
const LTP_API_KEY_HEADER = process.env.LTP_API_KEY_HEADER?.trim() || 'Authorization';
const LTP_PRICE_PATH = process.env.LTP_PRICE_PATH?.trim();

let YF_BACKOFF = 0;
const LTP_TTL = 30 * 1000; // 30s cache

function resolveJsonPath(obj, path){
  if(!path || obj == null) return undefined;
  return path.split('.').reduce((value, segment) => {
    if(value == null) return undefined;
    const arrayMatch = segment.match(/^(.+?)\[(\d+)\]$/);
    if(arrayMatch){
      const key = arrayMatch[1];
      const idx = Number(arrayMatch[2]);
      const next = value[key];
      return Array.isArray(next) ? next[idx] : undefined;
    }
    return value[segment];
  }, obj);
}

function buildLtpUrl(sym){
  if(LTP_API_URL_TEMPLATE){
    return LTP_API_URL_TEMPLATE.replace(/\{sym\}/g, encodeURIComponent(sym));
  }
  return `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}.NS?interval=1d&range=1d`;
}

app.get('/api/ltp', async (req, res) => {
  try{
    const symsRaw = req.query.syms || '';
    const syms = symsRaw.split(',').map(s=>s.trim()).filter(Boolean).map(s=>s.toUpperCase());
    if(syms.length===0) return res.status(400).json({ error: 'Missing syms query param' });

    const now = Date.now();
    if(now < YF_BACKOFF) return res.status(429).json({ error: 'backoff' });

    const out = {};
    const toFetch = [];
    syms.forEach(sym => {
      const cached = LTP_CACHE.get(sym);
      if(cached && (now - cached.ts) < LTP_TTL){ out[sym] = cached.price; }
      else toFetch.push(sym);
    });

    for(const sym of toFetch){
      try{
        const url = buildLtpUrl(sym);
        const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };
        if(LTP_API_KEY){ headers[LTP_API_KEY_HEADER] = LTP_API_KEY; }
        const r = await fetch(url, { timeout: 5000, headers });
        if(r.status === 429){ YF_BACKOFF = Date.now() + 60 * 1000; console.warn('Price API rate limit reached. Backing off for 60s.'); return res.status(429).json({ error: 'rate_limited' }); }
        if(!r.ok){ out[sym] = null; continue; }
        const d = await r.json();
        let p = null;
        if(LTP_API_URL_TEMPLATE && LTP_PRICE_PATH){
          p = resolveJsonPath(d, LTP_PRICE_PATH);
        }
        if(p == null && !LTP_API_URL_TEMPLATE){
          p = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
        }
        if(typeof p === 'string') p = Number(p.replace(/,/g, ''));
        if(p != null && !Number.isNaN(p)){
          LTP_CACHE.set(sym, { price: p, ts: Date.now() });
          out[sym] = p;
        } else {
          out[sym] = null;
        }
      }catch(e){ out[sym] = null; }
    }

    return res.json({ prices: out });
  }catch(e){ console.error(e); return res.status(500).json({ error: e.message }); }
});
