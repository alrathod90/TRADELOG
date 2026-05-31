import { useState, useEffect, useRef, useCallback } from "react";
import { parseCSVLine, pnl, INR, PCT, today } from './utils.js';

/* ─── Google Fonts ─────────────────────────────────────────────────────────── */
const GF = () => <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>;
const STRATEGY_OPTIONS = ["1% Club","3 Node strategy"];

/* ─── NSE Stock Database (now loaded from localStorage or fetched) ───────── */
let NSE_DB = [];

// Persistence key for NSE database (client-side)
const NSE_DB_KEY = 'tradelog_nse_db_v1';

function nseDbSave(db){
  try{ if(typeof window!=='undefined' && window.localStorage){ window.localStorage.setItem(NSE_DB_KEY, JSON.stringify(db)); }}catch(e){}
}

function nseDbLoad(){
  try{
    if(typeof window==='undefined' || !window.localStorage) return null;
    const t=window.localStorage.getItem(NSE_DB_KEY);
    if(!t) return null;
    const parsed=JSON.parse(t);
    if(Array.isArray(parsed)) return parsed;
  }catch(e){}
  return null;
}

// If we have a saved DB in localStorage, use it (overrides bundled stub)
if(typeof window!=='undefined'){
  const saved = nseDbLoad();
  if(saved && saved.length>0){ NSE_DB = saved; window.NSE_DB = NSE_DB; console.info('Loaded NSE_DB from localStorage, entries=',NSE_DB.length); }
}

// Try to fetch the official NSE list (EQUITY_L.csv) and replace/augment local DB.

async function fetchAndReplaceNseDB(url='/nse-csv/EQUITY_L.csv'){
  // Try proxied path first (dev), then remote URL as fallback
  const remote = 'https://archives.nseindia.com/content/equities/EQUITY_L.csv';
  try{
    let res=await fetch(url);
    if(!res.ok) throw new Error('proxy fetch failed');
    let txt=await res.text();
    // If proxied hit returned HTML (Akamai), and we used proxy, fall back to remote
    if(url.startsWith('/nse-csv') && txt.trim().startsWith('<')) throw new Error('proxy returned HTML');
    const lines=txt.split(/\r?\n/).filter(l=>l.trim());
    if(lines.length<2) return;
    const header=parseCSVLine(lines[0]).map(h=>h.replace(/"/g,'').toUpperCase());
    const symIdx = header.findIndex(h=>h.includes('SYMBOL'));
    const nameIdx = header.findIndex(h=>h.includes('NAME'));
    if(symIdx<0) return;
    const parsed=[];
    for(let i=1;i<lines.length;i++){
      const f=parseCSVLine(lines[i]);
      const sym=(f[symIdx]||'').toUpperCase();
      const name=(f[nameIdx]||'').replace(/"/g,'');
      if(!sym) continue;
      parsed.push({sym,name,sector:''});
    }
    // merge while preserving local entries as fallback; dedupe by sym
    const map=new Map();
    parsed.concat(NSE_DB).forEach(e=>{map.set((e.sym||'').toUpperCase(),{sym:(e.sym||'').toUpperCase(),name:e.name||'',sector:e.sector||''})});
    NSE_DB = Array.from(map.values());
    nseDbSave(NSE_DB);
    if(typeof window!=='undefined') window.NSE_DB = NSE_DB;
    console.info('NSE_DB updated from remote CSV, entries=',NSE_DB.length);
  }catch(err){
    console.warn('Could not fetch NSE CSV from',url,err.message);
    // If we tried proxied path, attempt remote direct fetch once (may still be CORS-blocked in browser)
    if(url.startsWith('/nse-csv')){
      try{
        const r2=await fetch(remote);
        if(r2.ok){
          const txt2=await r2.text();
          const lines=txt2.split(/\r?\n/).filter(l=>l.trim());
          if(lines.length>1){
            const header=parseCSVLine(lines[0]).map(h=>h.replace(/"/g,'').toUpperCase());
            const symIdx = header.findIndex(h=>h.includes('SYMBOL'));
            const nameIdx = header.findIndex(h=>h.includes('NAME'));
            const parsed=[];
            for(let i=1;i<lines.length;i++){
              const f=parseCSVLine(lines[i]);
              const sym=(f[symIdx]||'').toUpperCase();
              const name=(f[nameIdx]||'').replace(/"/g,'');
              if(!sym) continue;
              parsed.push({sym,name,sector:''});
            }
            const map=new Map();
            parsed.concat(NSE_DB).forEach(e=>{map.set((e.sym||'').toUpperCase(),{sym:(e.sym||'').toUpperCase(),name:e.name||'',sector:e.sector||''})});
            NSE_DB = Array.from(map.values());
            if(typeof window!=='undefined') window.NSE_DB = NSE_DB;
            console.info('NSE_DB updated from remote CSV, entries=',NSE_DB.length);
            return;
          }
        }
      }catch(e){/* ignore */}
    }
    console.warn('Using local NSE_DB fallback');
  }
}

// Kick off background fetch to update NSE_DB only in development.
if(typeof window!=='undefined' && import.meta.env.DEV){
  fetchAndReplaceNseDB();
}

// Expose utilities for manual retry / inspection from the browser console
if(typeof window!=='undefined'){
  window.fetchAndReplaceNseDB = fetchAndReplaceNseDB;
  window.NSE_DB = NSE_DB;
}

/* ─── Seed trades ──────────────────────────────────────────────────────────── */
const SEED = [
  {id:1,sym:"RELIANCE",name:"Reliance Industries",sector:"Energy",dir:"BUY",status:"closed",entryDate:"2025-03-10",exitDate:"2025-03-18",entryPrice:2720,exitPrice:2890,qty:50,brokerage:120,strategy:"Breakout",timeframe:"Daily",rating:4,emotions:["Planned","Disciplined"],entryReason:"Strong breakout above 2700 resistance with volume.",exitReason:"Reached target zone.",lessons:"Patience paid off.",tags:"momentum",screenshots:[]},
  {id:2,sym:"INFY",name:"Infosys Ltd",sector:"IT",dir:"BUY",status:"closed",entryDate:"2025-03-20",exitDate:"2025-03-28",entryPrice:1540,exitPrice:1480,qty:80,brokerage:90,strategy:"Trend Following",timeframe:"Daily",rating:2,emotions:["FOMO"],entryReason:"Chased after 2% gap up.",exitReason:"Hit stop loss.",lessons:"Do not chase gap ups without pullback.",tags:"",screenshots:[]},
  {id:3,sym:"TCS",name:"Tata Consultancy",sector:"IT",dir:"BUY",status:"closed",entryDate:"2025-04-02",exitDate:"2025-04-14",entryPrice:3300,exitPrice:3520,qty:30,brokerage:200,strategy:"Support/Resistance",timeframe:"Weekly",rating:5,emotions:["Confident","Patient"],entryReason:"Bounce from major support.",exitReason:"Reached resistance.",lessons:"Wait for confirmation at key levels.",tags:"earnings",screenshots:[]},
  {id:4,sym:"SBIN",name:"State Bank of India",sector:"Banking",dir:"SELL",status:"closed",entryDate:"2025-04-10",exitDate:"2025-04-17",entryPrice:840,exitPrice:795,qty:200,brokerage:150,strategy:"Reversal",timeframe:"Daily",rating:4,emotions:["Disciplined"],entryReason:"Double top confirmed.",exitReason:"Hit target zone.",lessons:"Shorting works well at double tops.",tags:"bearish",screenshots:[]},
  {id:5,sym:"HDFCBANK",name:"HDFC Bank Ltd",sector:"Banking",dir:"BUY",status:"open",entryDate:"2025-05-05",exitDate:"",entryPrice:1680,exitPrice:0,qty:60,brokerage:0,strategy:"Moving Average Cross",timeframe:"Daily",rating:3,emotions:["Patient"],entryReason:"Golden cross on daily.",exitReason:"",lessons:"",tags:"banking",screenshots:[]},
  {id:6,sym:"TATAMOTORS",name:"Tata Motors Ltd",sector:"Auto",dir:"BUY",status:"closed",entryDate:"2025-02-15",exitDate:"2025-02-25",entryPrice:880,exitPrice:975,qty:100,brokerage:180,strategy:"Gap Up/Down",timeframe:"Daily",rating:5,emotions:["Confident","Planned"],entryReason:"Gap up after EV sales data.",exitReason:"Trailing stop triggered.",lessons:"Ride momentum on catalysts.",tags:"ev",screenshots:[]},
  {id:7,sym:"TATAPOWER",name:"Tata Power Co Ltd",sector:"Utilities",dir:"BUY",status:"closed",entryDate:"2025-01-15",exitDate:"2025-01-28",entryPrice:385,exitPrice:430,qty:300,brokerage:200,strategy:"Breakout",timeframe:"Daily",rating:4,emotions:["Planned","Confident"],entryReason:"Clean breakout from 6-month consolidation zone.",exitReason:"Target achieved, booked profits.",lessons:"Consolidation breakouts with volume are reliable.",tags:"power,renewables",screenshots:[]},
];

/* ─── Sparkline ────────────────────────────────────────────────────────────── */
function Spark({data,color="#00E5A0"}){
  if(!data||data.length<2)return null;
  const W=80,H=36,min=Math.min(...data),max=Math.max(...data),rng=max-min||1;
  const xy=data.map((v,i)=>[(i/(data.length-1))*W, H-((v-min)/rng)*H]);
  const pts=xy.map(p=>p.join(",")).join(" ");
  const area=pts+` ${W},${H} 0,${H}`;
  return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible"}}>
    <defs><linearGradient id={`g${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".25"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
    <polygon points={area} fill={`url(#g${color.replace("#","")})`}/>
    <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

/* ─── Donut ─────────────────────────────────────────────────────────────────── */
function Donut({win,loss}){
  const total=win+loss;
  if(!total)return <div style={{height:110,display:"flex",alignItems:"center",justifyContent:"center",color:"#333",fontSize:12,fontFamily:"'DM Mono'"}}>No data</div>;
  const r=40,cx=55,cy=55,c=2*Math.PI*r,pct=win/total,dash=pct*c;
  return <svg width={110} height={110} viewBox="0 0 110 110">
    <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a1a22" strokeWidth={14}/>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke="#00E5A0" strokeWidth={14} strokeDasharray={`${dash} ${c}`} strokeDashoffset={c*.25} strokeLinecap="round"/>
    <text x={cx} y={cy-4} textAnchor="middle" fill="#fff" fontSize={14} fontFamily="'DM Mono'" fontWeight="500">{(pct*100).toFixed(0)}%</text>
    <text x={cx} y={cy+14} textAnchor="middle" fill="#555" fontSize={9} fontFamily="'DM Sans'">WIN RATE</text>
  </svg>;
}

/* ─── Bar Chart ─────────────────────────────────────────────────────────────── */
function BarChart({trades}){
  const m=Array(12).fill(0);
  trades.forEach(t=>{if(t.status==="closed"&&t.exitDate){const i=new Date(t.exitDate).getMonth();m[i]+=pnl(t).net;}});
  const max=Math.max(...m.map(Math.abs),1);
  const labels=["J","F","M","A","M","J","J","A","S","O","N","D"];
  const cur=new Date().getMonth();
  return <div style={{display:"flex",alignItems:"flex-end",gap:5,height:80,padding:"0 4px"}}>
    {m.slice(0,cur+1).map((v,i)=>{
      const h=Math.max(Math.abs(v)/max*68,3);
      const c=v>=0?"#00E5A0":"#FF4D4D";
      return <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
        {v>=0?<><div style={{height:68-h}}/><div style={{width:"100%",height:h,borderRadius:"3px 3px 0 0",background:c,opacity:.85}}/></>:<><div style={{width:"100%",height:h,borderRadius:"0 0 3px 3px",background:c,opacity:.85,marginTop:"auto"}}/><div style={{height:68-h}}/></>}
        <span style={{fontSize:9,color:"#444",fontFamily:"'DM Mono'"}}>{labels[i]}</span>
      </div>;
    })}
  </div>;
}

/* ─── Shared styles ─────────────────────────────────────────────────────────── */
const C = {background:"#101013",border:"1px solid #1a1a22",borderRadius:14,padding:"20px 22px"};
const SL = ({ch})=><div style={{fontSize:9,color:"#333",fontFamily:"'DM Mono'",letterSpacing:".08em"}}>{(ch||"").toUpperCase()}</div>;
const FL = ({ch})=><div style={{fontSize:10,color:"#444",fontFamily:"'DM Mono'",letterSpacing:".05em"}}>{(ch||"").toUpperCase()}</div>;
const DirBadge = ({dir,sm})=>{const d=dir==="BUY"?{bg:"#00E5A010",br:"#00E5A033",c:"#00E5A0"}:{bg:"#FF4D4D10",br:"#FF4D4D33",c:"#FF4D4D"};return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:sm?"2px 7px":"3px 9px",borderRadius:20,fontSize:sm?10:11,fontFamily:"'DM Mono'",fontWeight:500,background:d.bg,border:`1px solid ${d.br}`,color:d.c}}>{dir==="BUY"?"▲ LONG":"▼ SHORT"}</span>;};
const StBadge = ({s})=>{const d=s==="open"?{bg:"#0042ff10",br:"#0066ff33",c:"#4da6ff"}:{bg:"#1a1a22",br:"#2a2a35",c:"#444"};return <span style={{display:"inline-flex",padding:"2px 7px",borderRadius:20,fontSize:10,fontFamily:"'DM Mono'",background:d.bg,border:`1px solid ${d.br}`,color:d.c}}>{s}</span>;};
const IBtn = ({onClick,ch,red,title})=><button title={title} onClick={onClick} style={{width:26,height:26,borderRadius:6,border:"1px solid #2a2a35",background:"transparent",color:"#333",cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=red?"#FF4D4D55":"#444";e.currentTarget.style.color=red?"#FF4D4D":"#aaa";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="#2a2a35";e.currentTarget.style.color="#333";}}>{ch}</button>;

/* ─── Search Component ──────────────────────────────────────────────────────── */
/* KEY FIXES:
   1. onMouseDown + e.preventDefault() on each result — fires BEFORE onBlur, prevents dropdown close
   2. stock state set immediately (synchronous) in pick()
   3. Fallback to local DB if API fails / CORS blocks
*/
function StockSearch({value, onChange}){
  const [q,setQ]=useState(value?.sym ? `${value.sym} — ${value.name}` : "");
  const [hits,setHits]=useState([]);
  const [open,setOpen]=useState(false);
  const [ltpMap,setLtpMap]=useState({});
  const boxRef=useRef();

  const search = v => {
    setQ(v);
    if(!v||v.length<1){setHits([]);setOpen(false);onChange(null);return;}
    const up=v.toUpperCase().trim();
    // Prioritise symbol-starts-with, then symbol-contains, then name-contains
    const res=[
      ...NSE_DB.filter(s=>s.sym.startsWith(up)),
      ...NSE_DB.filter(s=>!s.sym.startsWith(up)&&s.sym.includes(up)),
      ...NSE_DB.filter(s=>!s.sym.includes(up)&&s.name.toUpperCase().includes(up)),
    ].slice(0,10);
    setHits(res);
    setOpen(res.length>0);
    // Clear selected stock when user types new query
    onChange(null);
  };

  const pick = s => {
    // This runs on mousedown (before blur), so stock is set before form validates
    setQ(`${s.sym} — ${s.name}`);
    setHits([]);
    setOpen(false);
    onChange(s);
    // Fetch live LTP in background (non-blocking)
    fetchLTP(s.sym).then(price=>{
      if(price) setLtpMap(p=>({...p,[s.sym]:price}));
    });
  };

  const ltp = value?.sym ? ltpMap[value.sym] : null;

  return <div ref={boxRef}>
    <FL ch="Search NSE Symbol or Company Name"/>
    <div style={{position:"relative",marginTop:8}}>
      <input
        value={q}
        onChange={e=>search(e.target.value)}
        onFocus={()=>hits.length>0&&setOpen(true)}
        onBlur={()=>setTimeout(()=>setOpen(false),200)}
        placeholder="Type to search all NSE stocks — e.g. Tata Power, INFY, Reliance…"
        style={{paddingRight:q.length>0?"36px":"13px"}}
      />
      {q.length>0&&<button onMouseDown={e=>{e.preventDefault();setQ("");setHits([]);setOpen(false);onChange(null);}} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>}
      {open&&hits.length>0&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:999,background:"#13131c",border:"1px solid #2a2a40",borderRadius:10,overflow:"hidden",boxShadow:"0 16px 48px rgba(0,0,0,.8)"}}>
          <div style={{padding:"6px 14px",fontSize:10,color:"#333",fontFamily:"'DM Mono'",borderBottom:"1px solid #1e1e2a",letterSpacing:".05em"}}>
            {hits.length} MATCHES · NSE STOCK DATABASE
          </div>
          {hits.map(s=>(
            <div key={s.sym}
              onMouseDown={e=>{e.preventDefault();pick(s);}}
              style={{padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",borderBottom:"1px solid #1a1a22",userSelect:"none"}}
              onMouseEnter={e=>e.currentTarget.style.background="#1e1e2a"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div>
                <span style={{fontFamily:"'Syne'",fontWeight:700,fontSize:13,color:"#F0EFE8"}}>{s.sym}</span>
                <span style={{fontSize:12,color:"#444",marginLeft:10}}>{s.name}</span>
              </div>
              <span style={{fontSize:10,color:"#555",fontFamily:"'DM Mono'",marginLeft:12,whiteSpace:"nowrap"}}>{s.sector}</span>
            </div>
          ))}
        </div>
      )}
    </div>
    {value&&(
      <div style={{display:"flex",alignItems:"center",gap:14,marginTop:10,padding:"10px 14px",background:"#0d1a14",borderRadius:8,border:"1px solid #00E5A033"}}>
        <div style={{width:36,height:36,borderRadius:8,background:"#00E5A015",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne'",fontWeight:800,fontSize:11,color:"#00E5A0",flexShrink:0}}>{value.sym.slice(0,2)}</div>
        <div>
          <div style={{fontFamily:"'Syne'",fontWeight:700,fontSize:14,color:"#F0EFE8"}}>{value.sym}</div>
          <div style={{fontSize:12,color:"#555",marginTop:2}}>{value.name} · {value.sector}</div>
        </div>
        <div style={{marginLeft:"auto",textAlign:"right",flexShrink:0}}>
          {ltp
            ? <><div style={{fontFamily:"'DM Mono'",color:"#00E5A0",fontSize:14}}>₹{ltp.toLocaleString("en-IN",{minimumFractionDigits:2})}</div><div style={{fontSize:10,color:"#2a6b52",marginTop:2}}>Live · Yahoo Finance</div></>
            : <div style={{fontSize:11,color:"#555",fontFamily:"'DM Mono'"}}>Fetching LTP…</div>
          }
        </div>
      </div>
    )}
  </div>;
}

/* ─── Yahoo Finance LTP fetch (via Vite proxy OR direct) ───────────────────── */
async function fetchLTP(sym){
  // Try Vite proxy first (avoids CORS in dev), then direct
  const urls=[`/yf-api/v8/finance/chart/${sym}.NS?interval=1d&range=1d`,`https://query2.finance.yahoo.com/v8/finance/chart/${sym}.NS?interval=1d&range=1d`];
  for(const url of urls){
    try{
      const r=await fetch(url,{signal:AbortSignal.timeout(4000)});
      if(!r.ok)continue;
      const d=await r.json();
      const p=d?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if(p)return p;
    }catch{}
  }
  return null;
}

/* ─── Sidebar ───────────────────────────────────────────────────────────────── */
function Sidebar({page,setPage,tradeCount,onExport,onImport,onReset,user,onLogout}){
  const nav=[{id:"dashboard",icon:"⬡",label:"Dashboard"},{id:"journal",icon:"≡",label:"Trade Journal"},{id:"add",icon:"+",label:"New Trade"}];
  return <div className="app-sidebar">
    <div style={{padding:"0 22px 20px",borderBottom:"1px solid #161618"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:34,height:34,borderRadius:9,background:"#00E5A0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:"#000",fontFamily:"'Syne'"}}>₹</div>
        <div>
          <div style={{fontFamily:"'Syne'",fontWeight:700,fontSize:15,color:"#F0EFE8"}}>TradeLog</div>
          <div style={{fontSize:10,color:"#333",fontFamily:"'DM Mono'",letterSpacing:".05em"}}>NSE JOURNAL</div>
        </div>
      </div>
      {user && <div style={{marginTop:16,padding:12,borderRadius:12,background:"#111217",border:"1px solid #161618"}}>
        <div style={{fontSize:10,color:"#888",fontFamily:"'DM Mono'",letterSpacing:".08em",marginBottom:6}}>Signed in as</div>
        <div style={{fontSize:13,color:"#F0EFE8",fontFamily:"'DM Mono'",fontWeight:600}}>{user}</div>
        <button onClick={onLogout} style={{marginTop:12,width:"100%",padding:"8px 0",borderRadius:10,border:"none",background:"#1b1b1f",color:"#aaa",fontSize:12,cursor:"pointer"}} onMouseEnter={e=>{e.currentTarget.style.background="#24242a";e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="#1b1b1f";e.currentTarget.style.color="#aaa";}}>Logout</button>
      </div>}
    </div>

    <div style={{flex:1,padding:"0 12px",display:"flex",flexDirection:"column",gap:2}}>
      {nav.map(n=>{
        const a=page===n.id;
        return <button key={n.id} onClick={()=>setPage(n.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:9,border:"none",cursor:"pointer",textAlign:"left",background:a?"rgba(0,229,160,0.08)":"transparent",color:a?"#00E5A0":"#555",fontFamily:"'DM Sans'",fontSize:13,fontWeight:a?500:400,transition:"all .15s",borderLeft:a?"2px solid #00E5A0":"2px solid transparent"}}>
          <span style={{fontSize:15,width:18,textAlign:"center"}}>{n.icon}</span>
          {n.label}
          {n.id==="journal"&&tradeCount>0&&<span style={{marginLeft:"auto",fontSize:10,background:"#1a1a22",color:"#444",padding:"1px 7px",borderRadius:20,fontFamily:"'DM Mono'"}}>{tradeCount}</span>}
        </button>;
      })}
    </div>

    {/* Data Management */}
    <div style={{padding:"14px 12px",borderTop:"1px solid #161618"}}>
      <div style={{fontSize:9,color:"#2a2a35",fontFamily:"'DM Mono'",letterSpacing:".07em",marginBottom:8,paddingLeft:4}}>DATA MANAGEMENT</div>
      {[
        {icon:"↓",label:"Backup JSON",fn:onExport,tip:"Download all trades as JSON"},
        {icon:"↑",label:"Restore JSON",fn:onImport,tip:"Import a JSON backup file"},
        {icon:"⟳",label:"Reset Demo",fn:onReset,tip:"Reset to demo data"},
      ].map(({icon,label,fn,tip})=>(
        <button key={label} onClick={fn} title={tip} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"8px 14px",borderRadius:8,border:"none",background:"transparent",color:"#333",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono'",transition:"all .15s",textAlign:"left"}}
          onMouseEnter={e=>{e.currentTarget.style.background="#161618";e.currentTarget.style.color="#888";}}
          onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#333";}}>
          <span style={{width:16,textAlign:"center",fontSize:13}}>{icon}</span>{label}
        </button>
      ))}
    </div>

    <div style={{padding:"10px 22px",borderTop:"1px solid #161618",fontSize:10,color:"#1e1e1e",fontFamily:"'DM Mono'"}}>
      <div style={{color:"#2a2a35"}}>Saved to browser storage</div>
      <div style={{marginTop:3,color:"#1a4a34"}}>v2.2 · localStorage</div>
    </div>
  </div>;
}

/* ─── Dashboard ─────────────────────────────────────────────────────────────── */
function Dashboard({trades,setPage,setView}){
  const [selectedStrategy,setSelectedStrategy]=useState("All");
  const closed=trades.filter(t=>t.status==="closed");
  const wins=closed.filter(t=>pnl(t).net>0);
  const losses=closed.filter(t=>pnl(t).net<=0);
  const totalNet=closed.reduce((a,t)=>a+pnl(t).net,0);
  const totalInvest=closed.reduce((a,t)=>a+pnl(t).invest,0);
  const winRate=closed.length?wins.length/closed.length*100:0;
  const avgWin=wins.length?wins.reduce((a,t)=>a+pnl(t).net,0)/wins.length:0;
  const avgLoss=losses.length?Math.abs(losses.reduce((a,t)=>a+pnl(t).net,0)/losses.length):0;
  const pf=avgLoss>0?avgWin/avgLoss:0;
  const open=trades.filter(t=>t.status==="open");
  let cum=0;
  const strategyGroups = STRATEGY_OPTIONS.map(name=>{
    const group=closed.filter(t=>t.strategy===name);
    const net=group.reduce((a,t)=>a+pnl(t).net,0);
    const invest=group.reduce((a,t)=>a+pnl(t).invest,0);
    const wins=group.filter(t=>pnl(t).net>0).length;
    const losses=group.filter(t=>pnl(t).net<=0).length;
    const winRate=group.length?wins/group.length*100:0;
    return {name,count:group.length,net,invest,wins,losses,winRate};
  });
  const otherTrades=closed.filter(t=>t.strategy && !STRATEGY_OPTIONS.includes(t.strategy));
  const strategySummary = otherTrades.length ? [...strategyGroups, {
    name:'Other',
    count:otherTrades.length,
    net:otherTrades.reduce((a,t)=>a+pnl(t).net,0),
    invest:otherTrades.reduce((a,t)=>a+pnl(t).invest,0),
    wins:otherTrades.filter(t=>pnl(t).net>0).length,
    losses:otherTrades.filter(t=>pnl(t).net<=0).length,
    winRate:otherTrades.length?otherTrades.filter(t=>pnl(t).net>0).length/otherTrades.length*100:0
  }] : strategyGroups;
  const filteredTrades = selectedStrategy === "All" ? trades : trades.filter(t => {
    if(selectedStrategy === "Other") return t.strategy && !STRATEGY_OPTIONS.includes(t.strategy);
    return t.strategy === selectedStrategy;
  });
  const recentTrades = filteredTrades.slice(0,6);
  const spark=closed.map(t=>{cum+=pnl(t).net;return cum;});
  const sectors={};trades.forEach(t=>{sectors[t.sector]=(sectors[t.sector]||0)+1;});
  const topSec=Object.entries(sectors).sort((a,b)=>b[1]-a[1]).slice(0,5);

  return <div>
    <div style={{marginBottom:28}}>
      <div style={{fontFamily:"'Syne'",fontSize:26,fontWeight:700,letterSpacing:"-.02em",color:"#F0EFE8"}}>Good morning 👋</div>
      <div style={{color:"#444",fontSize:13,marginTop:4,fontFamily:"'DM Mono'"}}>{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
    </div>

    {/* KPI Row */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14,marginBottom:16}}>
      {[
        {label:"Net P&L",val:INR(totalNet,2),sub:`on ${INR(totalInvest,0)} deployed`,color:totalNet>=0?"#00E5A0":"#FF4D4D",spark},
        {label:"Total Trades",val:closed.length,sub:`${open.length} position${open.length!==1?"s":""} open`,color:"#F0EFE8"},
        {label:"Win Rate",val:winRate.toFixed(1)+"%",sub:`${wins.length}W · ${losses.length}L`,color:winRate>=55?"#00E5A0":winRate>=40?"#F5A623":"#FF4D4D"},
        {label:"Profit Factor",val:pf.toFixed(2)+"×",sub:pf>=1.5?"Excellent":pf>=1?"Positive":"Needs work",color:pf>=1.5?"#00E5A0":pf>=1?"#F5A623":"#FF4D4D"},
      ].map((k,i)=>(
        <div key={i} style={{...C,position:"relative",overflow:"hidden"}}>
          <div style={{fontSize:9,color:"#333",fontFamily:"'DM Mono'",letterSpacing:".07em",marginBottom:10}}>{k.label.toUpperCase()}</div>
          <div style={{fontFamily:"'Syne'",fontSize:22,fontWeight:700,color:k.color,letterSpacing:"-.01em"}}>{k.val}</div>
          <div style={{fontSize:11,color:"#333",marginTop:6}}>{k.sub}</div>
          {k.spark&&k.spark.length>2&&<div style={{position:"absolute",bottom:12,right:16,opacity:.5}}><Spark data={k.spark} color={k.color}/></div>}
        </div>
      ))}
    </div>

    {/* Strategy P&L Groups */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14,marginBottom:16}}>
      {strategySummary.map(group=>(
        <div key={group.name} onClick={()=>setSelectedStrategy(group.name)} style={{...C,cursor:"pointer",borderColor:selectedStrategy===group.name?"#00E5A0":"#1e1e22",boxShadow:selectedStrategy===group.name?"0 0 0 1px rgba(0,229,160,.25)":"none",transition:"transform .15s ease, box-shadow .15s ease, border-color .15s ease"}} onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.02)"; e.currentTarget.style.boxShadow="0 18px 45px rgba(0,0,0,.14)"}} onMouseLeave={e=>{e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow=selectedStrategy===group.name?"0 0 0 1px rgba(0,229,160,.25)":"none";}}>
          <div style={{fontSize:12,color:"#888",fontFamily:"'DM Mono'",letterSpacing:".08em",marginBottom:8}}>{group.name.toUpperCase()}</div>
          <div style={{fontFamily:"'Syne'",fontSize:24,fontWeight:700,color:group.net>=0?"#00E5A0":"#FF4D4D"}}>{INR(group.net,2)}</div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:12,fontSize:11,color:"#555"}}>
            <span>{group.count} trade{group.count!==1?"s":""}</span>
            <span>{group.winRate.toFixed(0)}% win</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:11,color:"#555"}}>
            <span>Deployed</span>
            <span>{INR(group.invest,0)}</span>
          </div>
        </div>
      ))}
      <div onClick={()=>setSelectedStrategy("All")} style={{...C,cursor:"pointer",borderColor:selectedStrategy==="All"?"#00E5A0":"#1e1e22",boxShadow:selectedStrategy==="All"?"0 0 0 1px rgba(0,229,160,.25)":"none",transition:"transform .15s ease, box-shadow .15s ease, border-color .15s ease"}} onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.02)"; e.currentTarget.style.boxShadow="0 18px 45px rgba(0,0,0,.14)"}} onMouseLeave={e=>{e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow=selectedStrategy==="All"?"0 0 0 1px rgba(0,229,160,.25)":"none";}}>
        <div style={{fontSize:12,color:"#888",fontFamily:"'DM Mono'",letterSpacing:".08em",marginBottom:8}}>ALL STRATEGIES</div>
        <div style={{fontFamily:"'Syne'",fontSize:24,fontWeight:700,color:"#F0EFE8"}}>{INR(filteredTrades.reduce((a,t)=>a+pnl(t).net,0),2)}</div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:12,fontSize:11,color:"#555"}}>
          <span>{filteredTrades.length} trade{filteredTrades.length!==1?"s":""}</span>
          <span>{filteredTrades.length?((filteredTrades.filter(t=>pnl(t).net>0).length/filteredTrades.length)*100).toFixed(0):0}% win</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:11,color:"#555"}}>
          <span>Deployed</span>
          <span>{INR(filteredTrades.reduce((a,t)=>a+pnl(t).invest,0),0)}</span>
        </div>
      </div>
    </div>

    {/* Charts Row */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginBottom:16}}>
      <div style={C}><SL ch="Monthly P&L · 2025"/><div style={{marginTop:12}}><BarChart trades={trades}/></div></div>
      <div style={{...C,display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
        <SL ch="Win / Loss Ratio"/>
        <Donut win={wins.length} loss={losses.length}/>
        <div style={{display:"flex",gap:20}}>
          {[["#00E5A0",`${wins.length} Wins`],["#FF4D4D",`${losses.length} Losses`]].map(([c,l])=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#555"}}><div style={{width:8,height:8,borderRadius:"50%",background:c}}/>{l}</div>
          ))}
        </div>
      </div>
      <div style={C}>
        <SL ch="Sector Exposure"/>
        <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:9}}>
          {topSec.map(([sec,cnt])=>{const p=(cnt/trades.length)*100;return <div key={sec}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#555",marginBottom:3}}><span>{sec}</span><span style={{fontFamily:"'DM Mono'",color:"#00E5A0"}}>{p.toFixed(0)}%</span></div>
            <div style={{height:4,borderRadius:2,background:"#1a1a22"}}><div style={{width:p+"%",height:"100%",borderRadius:2,background:"#00E5A0",opacity:.7}}/></div>
          </div>;})}
        </div>
      </div>
    </div>

    {/* Open + Recent */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14}}>
      <div style={C}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <SL ch="Open Positions"/>
          <span style={{fontSize:11,color:"#00E5A0",fontFamily:"'DM Mono'"}}>{open.length} active</span>
        </div>
        {open.length===0
          ?<div style={{textAlign:"center",padding:"2rem",color:"#2a2a35",fontSize:12,fontFamily:"'DM Mono'"}}>No open positions</div>
          :open.map(t=><div key={t.id} onClick={()=>setView(t)} style={{padding:"10px 12px",borderRadius:8,background:"#161618",border:"1px solid #1e1e22",marginBottom:8,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"border .15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor="#2a2a35"} onMouseLeave={e=>e.currentTarget.style.borderColor="#1e1e22"}>
            <div><div style={{fontFamily:"'Syne'",fontWeight:700,fontSize:13}}>{t.sym}</div><div style={{fontSize:11,color:"#444",marginTop:2}}>Entry ₹{t.entryPrice?.toLocaleString("en-IN")} · {t.qty} qty</div></div>
            <div style={{textAlign:"right"}}><DirBadge dir={t.dir}/><div style={{fontSize:11,color:"#444",marginTop:4,fontFamily:"'DM Mono'"}}>{t.strategy||"—"}</div></div>
          </div>)
        }
      </div>
      <div style={C}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <SL ch="Recent Trades"/>
          <button onClick={()=>setPage("journal")} style={{fontSize:11,color:"#444",background:"none",border:"none",cursor:"pointer",fontFamily:"'DM Mono'"}} onMouseEnter={e=>e.currentTarget.style.color="#00E5A0"} onMouseLeave={e=>e.currentTarget.style.color="#444"}>View all →</button>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr>{["Symbol","Dir","Entry","Exit","Net P&L","Return"].map(h=><th key={h} style={{textAlign:"left",padding:"0 8px 8px 0",color:"#333",fontSize:10,fontFamily:"'DM Mono'",letterSpacing:".05em",fontWeight:400}}>{h}</th>)}</tr></thead>
          <tbody>{recentTrades.map(t=>{const {net,pct}=pnl(t);return <tr key={t.id} onClick={()=>setView(t)} style={{cursor:"pointer",borderTop:"1px solid #161616"}} onMouseEnter={e=>[...e.currentTarget.cells].forEach(c=>c.style.background="#161618")} onMouseLeave={e=>[...e.currentTarget.cells].forEach(c=>c.style.background="transparent")}>
            <td style={{padding:"9px 8px 9px 0"}}><div style={{fontFamily:"'Syne'",fontWeight:700,fontSize:12}}>{t.sym}</div><div style={{fontSize:10,color:"#333"}}>{t.sector}</div></td>
            <td style={{padding:"9px 8px 9px 0"}}><DirBadge dir={t.dir} sm/></td>
            <td style={{fontFamily:"'DM Mono'",fontSize:11,padding:"9px 8px 9px 0",color:"#555"}}>₹{t.entryPrice?.toLocaleString("en-IN")}</td>
            <td style={{fontFamily:"'DM Mono'",fontSize:11,padding:"9px 8px 9px 0",color:"#555"}}>{t.exitPrice?`₹${t.exitPrice?.toLocaleString("en-IN")}`:<span style={{color:"#2a2a35"}}>—</span>}</td>
            <td style={{fontFamily:"'DM Mono'",fontSize:11,padding:"9px 8px 9px 0",color:net>=0?"#00E5A0":"#FF4D4D"}}>{t.status==="open"?<StBadge s="open"/>:(net>=0?"+":`−`)+"₹"+Math.abs(net).toLocaleString("en-IN",{maximumFractionDigits:0})}</td>
            <td style={{fontFamily:"'DM Mono'",fontSize:11,color:pct>=0?"#00E5A0":"#FF4D4D"}}>{t.status==="open"?"—":PCT(pct)}</td>
          </tr>;})}
          </tbody>
        </table>
      </div>
    </div>
  </div>;
}

/* ─── Journal ───────────────────────────────────────────────────────────────── */
function Journal({trades,onEdit,onDelete,setView}){
  const [fS,setFS]=useState(""); const [fD,setFD]=useState(""); const [fQ,setFQ]=useState(""); const [fStr,setFStr]=useState(""); const [sort,setSort]=useState("date-desc");
  let data=trades.filter(t=>{
    if(fS&&t.status!==fS)return false;
    if(fD&&t.dir!==fD)return false;
    if(fStr&&t.strategy!==fStr)return false;
    if(fQ&&!t.sym.toUpperCase().includes(fQ.toUpperCase())&&!t.name.toUpperCase().includes(fQ.toUpperCase()))return false;
    return true;
  });
  data=[...data].sort((a,b)=>sort==="date-desc"?new Date(b.entryDate)-new Date(a.entryDate):sort==="date-asc"?new Date(a.entryDate)-new Date(b.entryDate):sort==="pnl-desc"?pnl(b).net-pnl(a).net:pnl(a).net-pnl(b).net);
  const totalNet=data.filter(t=>t.status==="closed").reduce((a,t)=>a+pnl(t).net,0);
  const strats=[...new Set(trades.map(t=>t.strategy).filter(Boolean))];

  const exportCSV=()=>{
    const h=["Symbol","Name","Dir","Status","Entry Date","Exit Date","Entry ₹","Exit ₹","Qty","Net P&L","Return %","Strategy"];
    const rows=trades.map(t=>{const {net,pct}=pnl(t);return [t.sym,t.name,t.dir,t.status,t.entryDate,t.exitDate||"",t.entryPrice,t.exitPrice||"",t.qty,net.toFixed(2),pct.toFixed(2),t.strategy||""];});
    const csv=[h,...rows].map(r=>r.map(v=>`"${(v||"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);a.download="tradelog.csv";a.click();
  };

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:22}}>
      <div>
        <div style={{fontFamily:"'Syne'",fontSize:24,fontWeight:700,letterSpacing:"-.02em"}}>Trade Journal</div>
        <div style={{color:"#444",fontSize:12,marginTop:3,fontFamily:"'DM Mono'"}}>{data.length} trades · Net {totalNet>=0?"+":""}{INR(totalNet,2)}</div>
      </div>
      <button onClick={exportCSV} style={{padding:"8px 16px",background:"transparent",border:"1px solid #2a2a35",borderRadius:8,color:"#555",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono'"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="#444";e.currentTarget.style.color="#ccc";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="#2a2a35";e.currentTarget.style.color="#555";}}>↓ Export CSV</button>
    </div>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
      <input value={fQ} onChange={e=>setFQ(e.target.value)} placeholder="Search symbol…" style={{width:180}}/>
      <select value={fS} onChange={e=>setFS(e.target.value)} style={{width:130}}><option value="">All Status</option><option value="open">Open</option><option value="closed">Closed</option></select>
      <select value={fD} onChange={e=>setFD(e.target.value)} style={{width:130}}><option value="">All Direction</option><option value="BUY">Long</option><option value="SELL">Short</option></select>
      <select value={fStr} onChange={e=>setFStr(e.target.value)} style={{width:160}}><option value="">All Strategies</option>{strats.map(s=><option key={s}>{s}</option>)}</select>
      <select value={sort} onChange={e=>setSort(e.target.value)} style={{width:160,marginLeft:"auto"}}><option value="date-desc">Date (Newest)</option><option value="date-asc">Date (Oldest)</option><option value="pnl-desc">P&L (Best)</option><option value="pnl-asc">P&L (Worst)</option></select>
    </div>
    <div style={{...C,padding:0,overflow:"hidden"}}>
      {data.length===0
        ?<div style={{padding:"3rem",textAlign:"center",color:"#2a2a35",fontSize:12,fontFamily:"'DM Mono'"}}>No trades found</div>
        :<table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:"1px solid #1a1a22"}}>{["Symbol","Dir","Status","Entry","Entry ₹","Exit ₹","Qty","Investment","Net P&L","Return","Strategy","★",""].map(h=><th key={h} style={{textAlign:"left",padding:"11px 12px",color:"#333",fontSize:10,fontFamily:"'DM Mono'",letterSpacing:".05em",fontWeight:400,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
          <tbody>{data.map(t=>{const {invest,net,pct}=pnl(t);return <tr key={t.id} style={{borderBottom:"1px solid #111113",cursor:"pointer"}} onMouseEnter={e=>[...e.currentTarget.cells].forEach(c=>c.style.background="#141416")} onMouseLeave={e=>[...e.currentTarget.cells].forEach(c=>c.style.background="transparent")} onClick={()=>setView(t)}>
            <td style={{padding:"10px 12px"}}><div style={{fontFamily:"'Syne'",fontWeight:700,fontSize:13}}>{t.sym}</div><div style={{fontSize:10,color:"#333",marginTop:1}}>{t.sector}</div></td>
            <td style={{padding:"10px 12px"}}><DirBadge dir={t.dir} sm/></td>
            <td style={{padding:"10px 12px"}}><StBadge s={t.status}/></td>
            <td style={{padding:"10px 12px",fontFamily:"'DM Mono'",fontSize:11,color:"#444"}}>{t.entryDate||"—"}</td>
            <td style={{padding:"10px 12px",fontFamily:"'DM Mono'",fontSize:11,color:"#888"}}>₹{t.entryPrice?.toLocaleString("en-IN")}</td>
            <td style={{padding:"10px 12px",fontFamily:"'DM Mono'",fontSize:11,color:"#888"}}>{t.exitPrice?`₹${t.exitPrice?.toLocaleString("en-IN")}`:"-"}</td>
            <td style={{padding:"10px 12px",fontFamily:"'DM Mono'",fontSize:11,color:"#555"}}>{t.qty?.toLocaleString("en-IN")}</td>
            <td style={{padding:"10px 12px",fontFamily:"'DM Mono'",fontSize:11,color:"#555"}}>₹{invest.toLocaleString("en-IN",{maximumFractionDigits:0})}</td>
            <td style={{padding:"10px 12px",fontFamily:"'DM Mono'",fontSize:12,color:net>=0?"#00E5A0":"#FF4D4D",fontWeight:500}}>{t.status==="open"?"-":(net>=0?"+":`−`)+"₹"+Math.abs(net).toLocaleString("en-IN",{maximumFractionDigits:0})}</td>
            <td style={{padding:"10px 12px",fontFamily:"'DM Mono'",fontSize:11,color:pct>=0?"#00E5A0":"#FF4D4D"}}>{t.status==="open"?"—":PCT(pct)}</td>
            <td style={{padding:"10px 12px",fontSize:11,color:"#444"}}>{t.strategy||"—"}</td>
            <td style={{padding:"10px 12px"}}><span style={{color:"#F5A623",letterSpacing:1,fontSize:11}}>{"★".repeat(t.rating||0)}<span style={{color:"#1e1e1e"}}>{"★".repeat(5-(t.rating||0))}</span></span></td>
            <td style={{padding:"10px 12px"}} onClick={e=>e.stopPropagation()}><div style={{display:"flex",gap:5}}><IBtn title="Edit" ch="✎" onClick={()=>onEdit(t)}/><IBtn title="Delete" ch="✕" red onClick={()=>{if(confirm("Delete this trade?"))onDelete(t.id);}}/></div></td>
          </tr>;})}
          </tbody>
        </table>
      }
    </div>
  </div>;
}

/* ─── Add / Edit Trade ──────────────────────────────────────────────────────── */
function AddTrade({initial,onSave,onCancel}){
  const [stock,setStock]=useState(initial?{sym:initial.sym,name:initial.name,sector:initial.sector}:null);
  const [dir,setDir]=useState(initial?.dir||"BUY");
  const [status,setStatus]=useState(initial?.status||"closed");
  const [ed,setED]=useState(initial?.entryDate||today());
  const [xd,setXD]=useState(initial?.exitDate||today());
  const [ep,setEP]=useState(initial?.entryPrice||"");
  const [xp,setXP]=useState(initial?.exitPrice||"");
  const [qty,setQty]=useState(initial?.qty||"");
  const [brk,setBrk]=useState(50);
  const [sl,setSL]=useState(initial?.sl||"");
  const [tgt,setTgt]=useState(initial?.target||"");
  const [strat,setStrat]=useState(initial?.strategy||"");
  const [tf,setTF]=useState(initial?.timeframe||"");
  const [rating,setRating]=useState(initial?.rating||0);
  const [emos,setEmos]=useState(initial?.emotions||[]);
  const [er,setER]=useState(initial?.entryReason||"");
  const [xr,setXR]=useState(initial?.exitReason||"");
  const [less,setLess]=useState(initial?.lessons||"");
  const [tags,setTags]=useState(initial?.tags||"");
  const [shots,setShots]=useState(initial?.screenshots||[]);
  const [err,setErr]=useState("");
  const fileRef=useRef();

  const EPf=parseFloat(ep)||0, XPf=parseFloat(xp)||0, Qf=parseFloat(qty)||0, Bf=parseFloat(brk)||0;
  const invest=EPf*Qf, gross=dir==="BUY"?(XPf-EPf)*Qf:(EPf-XPf)*Qf, net=gross-Bf;
  const pct=invest>0?(net/invest)*100:0;
  const risk=Math.abs(EPf-(parseFloat(sl)||0)), reward=Math.abs((parseFloat(tgt)||0)-EPf);
  const rr=risk>0?reward/risk:0;

  const save=()=>{
    if(!stock){setErr("Please search and select an NSE stock first.");return;}
    if(!EPf||!Qf){setErr("Entry price and quantity are required.");return;}
    setErr("");
    onSave({id:initial?.id||Date.now(),sym:stock.sym,name:stock.name,sector:stock.sector,dir,status,entryDate:ed,exitDate:xd,entryPrice:EPf,exitPrice:XPf,qty:Qf,brokerage:Bf,sl:parseFloat(sl)||0,target:parseFloat(tgt)||0,strategy:strat,timeframe:tf,rating,emotions:emos,entryReason:er,exitReason:xr,lessons:less,tags,screenshots:shots});
  };

  const EMOS=["Confident","FOMO","Patient","Impulsive","Disciplined","Revenge Trade","Planned","Overtrading"];

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
      <div>
        <div style={{fontFamily:"'Syne'",fontSize:24,fontWeight:700,letterSpacing:"-.02em"}}>{initial?"Edit Trade":"New Trade"}</div>
        <div style={{color:"#444",fontSize:12,marginTop:3,fontFamily:"'DM Mono'"}}>Log your NSE trade</div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={onCancel} style={{padding:"9px 18px",background:"transparent",border:"1px solid #2a2a35",borderRadius:8,color:"#666",fontSize:13,cursor:"pointer"}}>Cancel</button>
        <button onClick={save} style={{padding:"9px 22px",background:"#00E5A0",border:"none",borderRadius:8,color:"#000",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Syne'"}}>
          {initial?"Update Trade":"Save Trade"}
        </button>
      </div>
    </div>

    {err&&<div style={{marginBottom:14,padding:"10px 14px",background:"#FF4D4D12",border:"1px solid #FF4D4D44",borderRadius:8,color:"#FF4D4D",fontSize:13}}>{err}</div>}

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14}}>
      {/* Stock Search Card */}
      <div style={{...C,gridColumn:"1/-1"}}>
        <SL ch="Stock Search"/>
        <div style={{marginTop:12}}>
          <StockSearch value={stock} onChange={s=>setStock(s)}/>
        </div>
      </div>

      {/* Trade Details */}
      <div style={C}>
        <SL ch="Trade Details"/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginTop:14}}>
          <div>
            <FL ch="Direction"/>
            <div style={{display:"flex",gap:8,marginTop:6}}>
              {["BUY","SELL"].map(d=><button key={d} onClick={()=>setDir(d)} style={{flex:1,padding:"9px",borderRadius:8,border:`1px solid ${dir===d?(d==="BUY"?"#00E5A0":"#FF4D4D"):"#2a2a35"}`,background:dir===d?(d==="BUY"?"#00E5A015":"#FF4D4D15"):"transparent",color:dir===d?(d==="BUY"?"#00E5A0":"#FF4D4D"):"#444",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono'",fontWeight:500,transition:"all .15s"}}>{d==="BUY"?"▲ LONG":"▼ SHORT"}</button>)}
            </div>
          </div>
          <div><FL ch="Status"/><select value={status} onChange={e=>setStatus(e.target.value)} style={{marginTop:6}}><option value="open">Open</option><option value="closed">Closed</option></select></div>
          <div><FL ch="Entry Date"/><input type="date" value={ed} onChange={e=>setED(e.target.value)} style={{marginTop:6}}/></div>
          <div><FL ch="Exit Date"/><input type="date" value={xd} onChange={e=>setXD(e.target.value)} style={{marginTop:6}}/></div>
          <div><FL ch="Entry Price ₹"/><input type="number" placeholder="0.00" value={ep} onChange={e=>setEP(e.target.value)} style={{marginTop:6}}/></div>
          <div><FL ch="Exit Price ₹"/><input type="number" placeholder="0.00" value={xp} onChange={e=>setXP(e.target.value)} style={{marginTop:6}}/></div>
          <div><FL ch="Quantity (Shares)"/><input type="number" placeholder="0" value={qty} onChange={e=>setQty(e.target.value)} style={{marginTop:6}}/></div>
          <div><FL ch="Brokerage / Charges ₹"/><input type="number" value={brk} readOnly style={{marginTop:6,background:"#12121a",cursor:"not-allowed",color:"#ccc"}}/></div>
        </div>
        {EPf>0&&Qf>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8,marginTop:16}}>
            {[{l:"Investment",v:INR(invest,0),c:"#888"},{l:"Gross P&L",v:(gross>=0?"+":"−")+INR(gross,0),c:gross>=0?"#00E5A0":"#FF4D4D"},{l:"Net P&L",v:(net>=0?"+":"−")+INR(net,0),c:net>=0?"#00E5A0":"#FF4D4D"},{l:"Return",v:PCT(pct),c:pct>=0?"#00E5A0":"#FF4D4D"}].map(k=>(
              <div key={k.l} style={{background:"#0e0e14",borderRadius:8,padding:"10px",textAlign:"center"}}>
                <div style={{fontSize:9,color:"#333",fontFamily:"'DM Mono'",letterSpacing:".05em",marginBottom:4}}>{k.l.toUpperCase()}</div>
                <div style={{fontFamily:"'DM Mono'",fontSize:13,color:k.c,fontWeight:600}}>{k.v}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Setup & Risk */}
      <div style={C}>
        <SL ch="Setup & Risk"/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginTop:14}}>
          <div><FL ch="Strategy"/><select value={strat} onChange={e=>setStrat(e.target.value)} style={{marginTop:6}}><option value="">Select…</option>{[...STRATEGY_OPTIONS, ...(strat && !STRATEGY_OPTIONS.includes(strat) ? [strat] : [])].map(s=><option key={s} value={s}>{s}</option>)}</select></div>
          <div><FL ch="Timeframe"/><select value={tf} onChange={e=>setTF(e.target.value)} style={{marginTop:6}}><option value="">Select…</option>{["Daily","Weekly","Monthly"].map(t=><option key={t}>{t}</option>)}</select></div>
          <div><FL ch="Stop Loss ₹"/><input type="number" placeholder="0.00" value={sl} onChange={e=>setSL(e.target.value)} style={{marginTop:6}}/></div>
          <div><FL ch="Target Price ₹"/><input type="number" placeholder="0.00" value={tgt} onChange={e=>setTgt(e.target.value)} style={{marginTop:6}}/></div>
        </div>
        {rr>0&&<div style={{marginTop:14,padding:"10px 14px",background:"#0e0e14",borderRadius:8}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#444",marginBottom:6}}><span style={{fontFamily:"'DM Mono'"}}>Risk : Reward</span><span style={{color:rr>=2?"#00E5A0":rr>=1?"#F5A623":"#FF4D4D",fontWeight:600,fontFamily:"'DM Mono'"}}>1 : {rr.toFixed(2)}</span></div>
          <div style={{height:5,borderRadius:3,background:"#1a1a22"}}><div style={{width:Math.min((rr/4)*100,100)+"%",height:"100%",borderRadius:3,background:rr>=2?"#00E5A0":rr>=1?"#F5A623":"#FF4D4D",transition:"width .3s"}}/></div>
        </div>}
        <div style={{marginTop:14}}>
          <FL ch="Trade Rating"/>
          <div style={{display:"flex",gap:6,marginTop:8}}>{[1,2,3,4,5].map(n=><span key={n} onClick={()=>setRating(n)} style={{fontSize:22,cursor:"pointer",color:n<=rating?"#F5A623":"#222"}}>★</span>)}</div>
        </div>
        <div style={{marginTop:14}}>
          <FL ch="Emotion / Mindset"/>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>{EMOS.map(e=><span key={e} onClick={()=>setEmos(p=>p.includes(e)?p.filter(x=>x!==e):[...p,e])} style={{padding:"4px 10px",borderRadius:20,fontSize:11,cursor:"pointer",border:`1px solid ${emos.includes(e)?"#00E5A0":"#2a2a35"}`,background:emos.includes(e)?"#00E5A012":"transparent",color:emos.includes(e)?"#00E5A0":"#444",fontFamily:"'DM Mono'",transition:"all .15s"}}>{e}</span>)}</div>
        </div>
      </div>

      {/* Notes */}
      <div style={{...C,gridColumn:"1/-1"}}>
        <SL ch="Trade Notes"/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginTop:14}}>
          <div><FL ch="Entry Reason"/><textarea value={er} onChange={e=>setER(e.target.value)} placeholder="Why did you enter? What was your thesis?" style={{marginTop:6,minHeight:80,resize:"vertical"}}/></div>
          <div><FL ch="Exit Reason"/><textarea value={xr} onChange={e=>setXR(e.target.value)} placeholder="Why did you exit?" style={{marginTop:6,minHeight:80,resize:"vertical"}}/></div>
          <div><FL ch="Lessons Learned"/><textarea value={less} onChange={e=>setLess(e.target.value)} placeholder="What did this trade teach you?" style={{marginTop:6,minHeight:80,resize:"vertical"}}/></div>
        </div>
        <div style={{marginTop:12}}><FL ch="Custom Tags"/><input value={tags} onChange={e=>setTags(e.target.value)} placeholder="e.g. momentum, sector-play, event-driven" style={{marginTop:6}}/></div>
      </div>

      {/* Screenshots */}
      <div style={{...C,gridColumn:"1/-1"}}>
        <SL ch="Chart Screenshots"/>
        <div onClick={()=>fileRef.current.click()} style={{marginTop:12,border:"1.5px dashed #2a2a35",borderRadius:10,padding:"1.5rem",textAlign:"center",cursor:"pointer",background:"#0e0e14",transition:"border .15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor="#3a3a50"} onMouseLeave={e=>e.currentTarget.style.borderColor="#2a2a35"}>
          <div style={{fontSize:24,marginBottom:8}}>📸</div>
          <div style={{fontSize:13,color:"#444"}}>Click to attach chart screenshots</div>
          <div style={{fontSize:11,color:"#2a2a35",marginTop:4,fontFamily:"'DM Mono'"}}>PNG · JPG · WEBP — multiple allowed</div>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>Array.from(e.target.files).forEach(f=>{const r=new FileReader();r.onload=ev=>setShots(p=>[...p,ev.target.result]);r.readAsDataURL(f);})}/>
        </div>
        {shots.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginTop:12}}>
          {shots.map((s,i)=><div key={i} style={{position:"relative",aspectRatio:"16/9",borderRadius:8,overflow:"hidden",border:"1px solid #2a2a35"}}>
            <img src={s} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            <button onClick={()=>setShots(p=>p.filter((_,j)=>j!==i))} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,.75)",border:"none",borderRadius:"50%",width:20,height:20,color:"#fff",cursor:"pointer",fontSize:10}}>✕</button>
          </div>)}
        </div>}
      </div>
    </div>
  </div>;
}

/* ─── Trade View Modal ──────────────────────────────────────────────────────── */
function Modal({t,onClose}){
  const {invest,gross,net,pct}=pnl(t);
  return <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
    <div style={{background:"#101013",border:"1px solid #1e1e2a",borderRadius:16,padding:"26px 30px",width:"100%",maxWidth:560,maxHeight:"85vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
        <div><div style={{fontFamily:"'Syne'",fontSize:22,fontWeight:700}}>{t.sym}</div><div style={{fontSize:12,color:"#444",marginTop:2}}>{t.name} · {t.sector}</div></div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}><DirBadge dir={t.dir}/><StBadge s={t.status}/><button onClick={onClose} style={{background:"none",border:"1px solid #2a2a35",borderRadius:8,color:"#555",width:32,height:32,cursor:"pointer",fontSize:16}}>✕</button></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:20}}>
        {[{l:"Investment",v:INR(invest,0),c:"#888"},{l:"Gross P&L",v:(gross>=0?"+":"−")+INR(gross,0),c:gross>=0?"#00E5A0":"#FF4D4D"},{l:"Net P&L",v:(net>=0?"+":"−")+INR(net,0),c:net>=0?"#00E5A0":"#FF4D4D"},{l:"Return %",v:t.status==="open"?"—":PCT(pct),c:pct>=0?"#00E5A0":"#FF4D4D"}].map(k=>(
          <div key={k.l} style={{background:"#161620",borderRadius:10,padding:"12px",textAlign:"center"}}>
            <div style={{fontSize:9,color:"#333",fontFamily:"'DM Mono'",letterSpacing:".05em",marginBottom:5}}>{k.l.toUpperCase()}</div>
            <div style={{fontFamily:"'DM Mono'",fontSize:14,color:k.c,fontWeight:600}}>{k.v}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:4,fontSize:13,marginBottom:18}}>
        {[["Entry",`₹${t.entryPrice?.toLocaleString("en-IN")} · ${t.entryDate}`],["Exit",t.exitPrice?`₹${t.exitPrice?.toLocaleString("en-IN")} · ${t.exitDate}`:"—"],["Quantity",`${t.qty?.toLocaleString("en-IN")} shares`],["Brokerage",INR(t.brokerage||0,2)],["Strategy",t.strategy||"—"],["Timeframe",t.timeframe||"—"]].map(([k,v])=>(
          <div key={k} style={{padding:"8px 0",borderBottom:"1px solid #161620",display:"flex",justifyContent:"space-between"}}>
            <span style={{color:"#333",fontFamily:"'DM Mono'",fontSize:11}}>{k}</span><span style={{color:"#777",fontSize:12}}>{v}</span>
          </div>
        ))}
      </div>
      {t.rating>0&&<div style={{marginBottom:14}}><div style={{fontSize:10,color:"#333",fontFamily:"'DM Mono'",letterSpacing:".05em",marginBottom:6}}>RATING</div><span style={{color:"#F5A623",fontSize:18,letterSpacing:2}}>{"★".repeat(t.rating)}<span style={{color:"#1e1e1e"}}>{"★".repeat(5-t.rating)}</span></span></div>}
      {t.emotions?.length>0&&<div style={{marginBottom:14}}><div style={{fontSize:10,color:"#333",fontFamily:"'DM Mono'",letterSpacing:".05em",marginBottom:7}}>EMOTIONS</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{t.emotions.map(e=><span key={e} style={{padding:"3px 10px",borderRadius:20,fontSize:11,border:"1px solid #00E5A033",color:"#00E5A0",fontFamily:"'DM Mono'"}}>{e}</span>)}</div></div>}
      {[["ENTRY REASON",t.entryReason],["EXIT REASON",t.exitReason],["LESSONS LEARNED",t.lessons]].map(([l,v])=>v&&<div key={l} style={{marginBottom:12}}><div style={{fontSize:10,color:"#333",fontFamily:"'DM Mono'",letterSpacing:".05em",marginBottom:5}}>{l}</div><p style={{fontSize:13,color:"#555",lineHeight:1.65}}>{v}</p></div>)}
      {t.screenshots?.length>0&&<div><div style={{fontSize:10,color:"#333",fontFamily:"'DM Mono'",letterSpacing:".05em",marginBottom:8}}>SCREENSHOTS</div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>{t.screenshots.map((s,i)=><div key={i} style={{aspectRatio:"16/9",borderRadius:8,overflow:"hidden",border:"1px solid #2a2a35"}}><img src={s} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>)}</div></div>}
    </div>
  </div>;
}

/* ─── localStorage helpers ──────────────────────────────────────────────────── */
const DB_KEY = "tradelog_v1";

function dbLoad(){
  try{
    const raw = localStorage.getItem(DB_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  }catch(e){ console.warn("TradeLog: could not read localStorage", e); }
  // First ever launch → seed with demo data
  return SEED;
}

function dbSave(trades){
  try{ localStorage.setItem(DB_KEY, JSON.stringify(trades)); }
  catch(e){ console.warn("TradeLog: could not write localStorage", e); }
}

const AUTH_USERNAME = "tradelog";
const AUTH_PASSWORD = "$duWav92";

function authLoad(){
  try{ return localStorage.getItem('tradelog_user') || null; }
  catch(e){ return null; }
}
function authSave(user){
  try{ localStorage.setItem('tradelog_user', user); }
  catch(e){}
}
function authClear(){
  try{ localStorage.removeItem('tradelog_user'); }
  catch(e){}
}

function Login({onLogin}){
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = e => {
    e.preventDefault();
    const user = username.trim();
    const pass = password.trim();
    if(!user || !pass){
      setError("Enter both username and password.");
      return;
    }
    if(user !== AUTH_USERNAME || pass !== AUTH_PASSWORD){
      setError("Invalid username or password.");
      return;
    }
    setError("");
    onLogin(AUTH_USERNAME);
  };

  return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24,background:"#0d0d0f"}}>
    <div style={{width:"100%",maxWidth:420,background:"#101016",border:"1px solid #1b1b22",borderRadius:24,padding:36,boxShadow:"0 32px 80px rgba(0,0,0,.45)"}}>
      <div style={{fontFamily:"'Syne'",fontSize:28,fontWeight:700,color:"#F0EFE8",marginBottom:10}}>TradeLog Login</div>
      <div style={{marginBottom:24,fontSize:14,color:"#aaa",lineHeight:1.6}}>Sign in with your TradeLog credentials to access the journal.</div>
      <form onSubmit={handleSubmit}>
        <label style={{display:"block",marginBottom:14,fontSize:12,color:"#888",fontFamily:"'DM Mono'"}}>Username</label>
        <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter username" style={{marginBottom:18}} />
        <label style={{display:"block",marginBottom:14,fontSize:12,color:"#888",fontFamily:"'DM Mono'"}}>Password</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password" style={{marginBottom:18}} />
        {error && <div style={{marginBottom:14,color:"#FF4D4D",fontSize:12}}>{error}</div>}
        <button type="submit" style={{width:"100%",padding:"12px 16px",borderRadius:10,border:"none",background:"#00E5A0",color:"#000",fontSize:14,fontWeight:700,cursor:"pointer"}}>Sign in</button>
      </form>
      <div style={{marginTop:18,fontSize:11,color:"#666",fontFamily:"'DM Mono'"}}>Your login is stored locally in browser storage only.</div>
    </div>
  </div>;
}

/* ─── App Root ──────────────────────────────────────────────────────────────── */
export default function App(){
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL?.trim() || '';
  const BACKEND_KEY = import.meta.env.VITE_BACKEND_KEY || '';
  const [page, setPage]     = useState("dashboard");
  const [user, setUser]     = useState(() => authLoad() || null);
  const [trades, setTrades] = useState(dbLoad);   // lazy init from localStorage (cache)
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [toast, setToast]   = useState("");

  const handleLogin = name => {
    setUser(name);
    authSave(name);
    setPage("dashboard");
  };

  const logout = () => { authClear(); setUser(null); setPage("dashboard"); };

  // Fetch trades from backend (primary source). Falls back to local cache if backend not reachable.
  const fetchTradesFromBackend = useCallback(async ()=>{
    if(!BACKEND_URL) return;
    try{
      const r = await fetch(`${BACKEND_URL}/api/trades`, { headers: {...(BACKEND_KEY?{'x-api-key':BACKEND_KEY}:{})} });
      if(!r.ok) throw new Error('bad response');
      const data = await r.json();
      if(Array.isArray(data) && data.length>0){
        setTrades(data);
        dbSave(data); // update local cache
        showToast('✓ Trades loaded from cloud');
      }
    }catch(err){
      console.warn('Could not load trades from backend, using local cache', err.message);
      showToast('Using local cached trades');
    }
  }, [BACKEND_URL, BACKEND_KEY]);

  useEffect(()=>{ if(!user) return; fetchTradesFromBackend(); }, [fetchTradesFromBackend, user]);

  // ── Persist every change automatically ──
  useEffect(()=>{ dbSave(trades); }, [trades]);

  const loginView = !user ? <Login onLogin={handleLogin}/> : null;

  // ── Toast helper ──
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(""), 2800); };

  // ── Trade CRUD ──
  const saveTrade = t => {
    setTrades(p => {
      const exists = p.find(x => x.id === t.id);
      return exists ? p.map(x => x.id === t.id ? t : x) : [t, ...p];
    });
    setEditing(null);
    setPage("journal");
    showToast(t.id && editing ? "✓ Trade updated" : "✓ Trade saved");
    // Sync to backend Trades sheet (non-blocking) only when a backend URL is configured
    if(BACKEND_URL){
      (async()=>{
        try{
          const existsOnClient = trades.find(x=>x.id===t.id);
          const url = existsOnClient ? `${BACKEND_URL}/api/trades/update` : `${BACKEND_URL}/api/trades/append`;
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(BACKEND_KEY?{'x-api-key':BACKEND_KEY}:{}) },
            body: JSON.stringify(t)
          });
        }catch(e){ console.warn('Trade sync failed', e); }
      })();
    }
  };
  const deleteTrade = id => {
    setTrades(p => p.filter(t => t.id !== id));
    showToast("Trade deleted");
  };
  const startEdit = t => { setEditing(t); setPage("add"); };

  // ── Backup: export entire DB as JSON ──
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(trades, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tradelog-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    showToast("✓ Backup downloaded");
  };

  // ── Restore: import JSON backup ──
  const importJSON = e => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try{
        const data = JSON.parse(ev.target.result);
        if(!Array.isArray(data)) throw new Error("Invalid");
        if(!confirm(`Import ${data.length} trades? This will replace your current data.`)) return;
        setTrades(data);
        showToast(`✓ Imported ${data.length} trades`);
      }catch{ showToast("✗ Invalid backup file"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Reset to demo data ──
  const resetDemo = () => {
    if(!confirm("Reset to demo data? Your current trades will be lost.")) return;
    setTrades(SEED);
    showToast("✓ Reset to demo data");
  };

  const importRef = useRef();

  return <>
    <GF/>
    <style>{`
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
      body{background:#0d0d0f;color:#F0EFE8;font-family:'DM Sans',sans-serif;}
      input,select,textarea,button{font-family:'DM Sans',sans-serif;}
      input,select,textarea{background:#131318;color:#F0EFE8;border:1px solid #2a2a35;border-radius:8px;padding:9px 13px;font-size:13px;width:100%;outline:none;transition:border .15s;}
      input:focus,select:focus,textarea:focus{border-color:#00E5A055;}
      select option{background:#131318;}
      textarea{resize:vertical;min-height:70px;}
      .app-shell{display:flex;min-height:100vh;}
      .app-sidebar{position:fixed;top:0;left:0;width:220px;height:100vh;background-color:#0c0c0e;border-right:1px solid #161618;display:flex;flex-direction:column;padding:24px 0;z-index:100;}
      .app-content{flex:1;margin-left:220px;padding:28px 32px;min-height:100vh;overflow-y:auto;}
      .app-sidebar .data-management button{font-size:12px;}
      @media (max-width: 980px){
        .app-sidebar{position:relative;width:100%;height:auto;border-right:none;border-bottom:1px solid #161618;padding:18px 0;}
        .app-content{margin-left:0;padding:20px 16px;}
      }
      @media (max-width: 720px){
        .app-sidebar{padding:18px 12px;}
        .app-sidebar > div{padding:0 12px;}
        .app-content{padding:16px 12px;}
      }
    `}</style>

    {loginView || (
      <>
        <div className="app-shell">
          <Sidebar page={page} setPage={p=>{if(p!="add")setEditing(null);setPage(p);}}
            tradeCount={trades.length}
            onExport={exportJSON}
            onImport={()=>importRef.current.click()}
            onReset={resetDemo}
            user={user}
            onLogout={logout}
          />
          <input ref={importRef} type="file" accept=".json" style={{display:"none"}} onChange={importJSON}/>

          <div className="app-content">
            {page==="dashboard" && <Dashboard trades={trades} setPage={setPage} setView={setViewing}/>}
            {page==="journal"   && <Journal trades={trades} onEdit={startEdit} onDelete={deleteTrade} setView={setViewing}/>}
            {page==="add"       && <AddTrade initial={editing} onSave={saveTrade} onCancel={()=>{setEditing(null);setPage("journal");}}/>}
          </div>
        </div>

        {viewing && <Modal t={viewing} onClose={()=>setViewing(null)}/>}

        {/* Toast notification */}
        {toast && (
          <div style={{position:"fixed",bottom:24,right:24,background:"#1a1a22",border:"1px solid #2a2a35",borderRadius:10,padding:"10px 18px",fontSize:13,color:"#F0EFE8",zIndex:9999,fontFamily:"'DM Mono'",boxShadow:"0 8px 32px rgba(0,0,0,.5)",animation:"slideUp .25s ease"}}>
            {toast}
          </div>
        )}
      </>
    )}
  </>;
}
