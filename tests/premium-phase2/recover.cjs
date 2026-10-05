// Read-only receipts recovery; no provider dispatch or network.
const fs=require('fs'),path=require('path');const dir=path.join(__dirname,'private'),out=path.join(__dirname,'results');
const f=JSON.parse(fs.readFileSync(path.join(dir,'fixture.json'))),rows=JSON.parse(fs.readFileSync(path.join(dir,'recover.json'))),ledger=[];
for(const r of rows){const entry=Object.entries(f.cases).find(([,c])=>c.routine===r.routine_id);if(!entry)throw Error('Unknown receipt owner');const[tag,c]=entry;c.real_rec=r.id;c.keys=[...new Set([...c.keys,r.analysis_key])];ledger.push({tag,key:r.analysis_key,state:'returned',http_status:r.analysis_trace.receipt.status,recommendation:r});}
fs.writeFileSync(path.join(dir,'fixture.json'),JSON.stringify(f,null,2));fs.writeFileSync(path.join(out,'real.json'),JSON.stringify(ledger,null,2));console.log(ledger.length+' persisted real receipts recovered; no call repeated.');
