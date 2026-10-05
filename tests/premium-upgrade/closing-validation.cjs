// Check sanitized receipts of actual staging HTTP/SQL interleavings. Never Auth/provider calls.
// These receipts come from the explicitly authorized memory-only coordinator, not mocks of HTTP.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'results',name),'utf8'));
const evidence=read('closing-remote-proof.json'),rows=[];
function check(name,ok){rows.push({name,pass:!!ok});assert(ok,name);}
const time=value=>Date.parse(value.replace(' ','T').replace(/\+00$/,'Z'));
function window(name,request){
 const w=evidence.windows[name][0],start=time(request.request_started_at),end=time(request.request_finished_at||request.finished_at),locked=time(w.lock_acquired),committed=time(w.committed);
 return locked<start&&start<committed&&(name==='workout'||end>=committed)&&(!w.waiter_detected||locked<time(w.waiter_detected)&&time(w.waiter_detected)<committed);
}
for(const name of ['basic','provision','workout','acceptance']){
 const r=read('crossings-'+name+'.json');assert(r.completed&&r.rows.length===4&&r.provider_dispatches===0);
 for(const row of r.rows)check(row.name,row.pass);
 check(name+' external SQL/HTTP window proven',window(name,r));
}
const reviewer=read('crossings-reviewer.json');
check('Concurrent reviewer resolution has one winner and one safe rejection',reviewer.results.filter(r=>r.status===204&&r.ok).length===1&&reviewer.results.filter(r=>r.status===400&&!r.ok&&r.expected_error).length===1);
check('Reviewer resolution has no applied revision',evidence.supplemental.resolved);
check('Reviewer resolution external window proven',window('reviewer',reviewer));
const late=read('crossings-late.json');
check('Late declared mock response is superseded with no patches or result revision',evidence.supplemental.late_superseded);
check('Late response preserves the single N+1 and exact current revision',evidence.supplemental.current_exact);
check('Owner cannot accept a superseded response',late.result.status===400&&!late.result.ok&&evidence.late_rejection_expected_code_verified);
check('Late finish/acceptance external window proven',window('late',late));
for(const row of evidence.security)check(row.name,row.pass);
assert.equal(rows.length,32);assert.equal(evidence.provider_dispatches,0);assert.equal(evidence.credentials_persisted,false);
fs.writeFileSync(path.join(__dirname,'results','closing-validation.json'),JSON.stringify({rows,total:rows.length,scope:'Actual staging HTTP JWT + SQL interleavings; another client is SQL claims only, no third session refresh',provider_dispatches:0,token_storage:false},null,2));
console.log(rows.length+'/'+rows.length+' closing evidence checks; no new network requests');
