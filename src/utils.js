export function parseCSVLine(line){
  const fields=[];
  let cur='';
  let inQ=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==="\""){
      inQ=!inQ;
      continue;
    }
    if(ch===',' && !inQ){
      fields.push(cur);
      cur='';
      continue;
    }
    cur+=ch;
  }
  fields.push(cur);
  return fields.map(f=>f.trim());
}

export const pnl = t => {
  const ep=t.entryPrice||0;
  const xp=t.exitPrice||0;
  const q=t.qty||0;
  const brk=t.brokerage||0;
  const invest = ep*q;
  const gross = t.dir === 'BUY' ? (xp-ep)*q : (ep-xp)*q;
  const net = gross - brk;
  return { invest, gross, net, pct: invest>0 ? (net/invest)*100 : 0 };
};

export const INR = (n,d=0) => (n<0?"−":"") + "₹" + Math.abs(n).toLocaleString("en-IN",{minimumFractionDigits:d,maximumFractionDigits:d});
export const PCT = n => (n>=0?"+":"") + n.toFixed(2) + "%";
export const today = () => new Date().toISOString().slice(0,10);
