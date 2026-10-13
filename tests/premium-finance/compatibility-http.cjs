'use strict';
// Synthetic JWTs stay in memory; credentials and outputs must remain in ignored private/.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),rl=require('node:readline');
const URL='https://dmqjexigdnfzobarhnib.supabase.co';
let fixture,tokens=new Map();
function init(file){fixture=JSON.parse(fs.readFileSync(file,'utf8'));
if(fixture.ref!=='dmqjexigdnfzobarhnib'||fixture.users.mock.id!=='c7bbe50b-d349-4f7e-8fdc-476f17c22674'||fixture.users.real.id!=='c14a2a6d-9853-431d-856c-4d742002187e')throw Error('synthetic_only');}
const report={provider_calls:0,tokens_persisted:false,scenarios:[],security:[]};
async function token(a){if(a==='anon')return fixture.key;if(tokens.has(a))return tokens.get(a);const u=fixture.users[a];const r=await fetch(URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:fixture.key,'Content-Type':'application/json'},body:JSON.stringify({email:u.email,password:u.password})});const b=await r.json();if(r.status!==200)throw Error('synthetic_auth_http_'+r.status+'_'+String(b.error_code||b.code||'failed').replace(/[^a-z_]/gi,''));if(b.user?.id!==u.id)throw Error('synthetic_identity_mismatch');const t=b.access_token;delete b.refresh_token;delete b.access_token;tokens.set(a,t);await new Promise(resolve=>setTimeout(resolve,2100));return t;}
async function req(a,name,body){const t=await token(a),start=performance.now();const r=await fetch(URL+'/rest/v1/'+name,{method:body===null?'GET':'POST',headers:{apikey:fixture.key,Authorization:'Bearer '+t,'Content-Type':'application/json'},...(body===null?{}:{body:JSON.stringify(body)})});const b=await r.json();return{status:r.status,data:b,start,end:performance.now()};}
const qa=(a,id,kind,action)=>req(a,'rpc/premium_finance_compat_qa',{p_id:id,p_kind:kind,p_action:action});
async function run(n){
 await Promise.all(['mock','real'].map(token));const ids=[crypto.randomUUID(),crypto.randomUUID()];if(n===3)ids[1]=ids[0];const actors=n===3?['mock','mock']:['mock','real'],kinds=n===6?['analysis','chat']:['analysis','analysis'];
 const rr=await Promise.all(actors.map((a,i)=>qa(a,ids[i],kinds[i],'claim')));report.last_requests=rr.map((r,i)=>({actor:actors[i],id:ids[i],kind:kinds[i],status:r.status,data:r.data}));save();rr.forEach(r=>assert.equal(r.status,200,'qa_http'));
 assert(Math.max(...rr.map(r=>r.start))<Math.min(...rr.map(r=>r.end)),'overlapping_http');
 assert.notEqual(rr[0].data.txid,rr[1].data.txid,'distinct_transactions');
 assert(Math.max(...rr.map(r=>Date.parse(r.data.start)))<Math.min(...rr.map(r=>Date.parse(r.data.finish))),'overlapping_server');
 const winners=rr.filter(r=>r.data.claimed===true).length;assert.equal(winners,n===1?2:[2,3,6].includes(n)?1:0,'winner_count');
 for(let i=0;i<2;i++)if(rr[i].data.claimed){assert(+rr[i].data.reserved>0,'positive_reserve');const f=await qa(actors[i],ids[i],kinds[i],'finish');assert.equal(f.status,200);assert.equal(+f.data.charged,.00425);}
 if(n===4)rr.forEach(r=>assert.equal(r.data.error,'premium_financial_blocked'));
 if(n===5)rr.forEach(r=>assert.equal(r.data.error,'premium_shared_budget_exhausted'));
 const entry={case:n,passed:true,winners,requests:rr.map(r=>({actor:actors[rr.indexOf(r)],result:r.data})),provider_calls:0};report.scenarios.push(entry);save();return{case:n,passed:true,winners};
}
function save(){fs.writeFileSync(path.join(__dirname,'private/compat-http-results.json'),JSON.stringify(report,null,2));}
async function security(){
 for(const a of ['mock','real','retry','reviewer','trainer','anon']){
  for(const [name,b]of [['premium_finance_incidents',{}],['premium_finance_reconcile',{p_kind:'chat',p_id:crypto.randomUUID(),p_amount:0,p_evidence:{},p_actor:'client',p_authorization:'none',p_reason:'unauthorized',p_key:crypto.randomUUID()}],['premium_finance_resume',{p_kind:'chat',p_id:crypto.randomUUID(),p_actor:'client',p_authorization:'none',p_reason:'unauthorized',p_key:crypto.randomUUID()}]]){
   const r=await req(a,'rpc/'+name,b);assert([401,403,404].includes(r.status),'service_rpc_denied');report.security.push({actor:a,name,passed:true,status:r.status});
  }
  const r=await req(a,'premium_financial_items?select=*',null);assert.equal(r.status,404);report.security.push({actor:a,name:'private_ledger_not_exposed',passed:true,status:r.status});
 }
 save();return{security:report.security.length,passed:true};
}
function close(){tokens.clear();fixture=null;return{closed:true,tokens_persisted:false};}
module.exports={init,run,security,close};
if(require.main===module){init(process.env.SIMPLE_FINANCE_CREDENTIALS_FILE);(async()=>{for await(const line of rl.createInterface({input:process.stdin})){try{const b=JSON.parse(line);if(b.close){tokens.clear();fixture=null;console.log('{"closed":true,"tokens_persisted":false}');break;}console.log(JSON.stringify(b.security?await security():await run(b.case)));}catch(e){save();console.log(JSON.stringify({error:e.code||'compat_check_failed',message:/^[a-z_]+$/.test((e.message||'').split('\n')[0])?e.message.split('\n')[0]:'assertion_failed'}));}}tokens.clear();fixture=null;})().catch(()=>{tokens.clear();fixture=null;console.error('compat_runtime_failed');process.exitCode=1;});}
