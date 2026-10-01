// Read-only real staging JWT verification, except intentionally rejected accept calls.
const fs=require('fs'),assert=require('assert/strict'),util=require('util'),a=require('./live.cjs');
const sessions=JSON.parse(fs.readFileSync(a.dir+'/sessions.json')),rows=[];
const check=(name,pass)=>{assert(pass,name);rows.push(name);};
async function req(w,route,data){const r=await fetch('https://'+a.c.ref+'.supabase.co'+route,{method:data===undefined?'GET':'POST',headers:{apikey:a.c.key,...(w?{Authorization:'Bearer '+sessions[w].access_token}:{}),'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(20000)});let body;try{body=await r.json();}catch{}return {ok:r.ok,status:r.status,body};}
(async()=>{
for(const k of ['G','H']){
 const r=await req(k,'/rest/v1/coach_operations?select=*'),expected=JSON.parse(fs.readFileSync(a.out+'/real-quality-'+k+'.json'));
 check(k+' owns only expected operations',r.ok&&r.body.length===(k==='G'?2:1)&&r.body.every(o=>o.user_id===a.c.users[k].id));
 const op=r.body.find(o=>o.state==='pending_review');check(k+' exactly one complete proposal pending review',r.body.filter(o=>o.state==='pending_review').length===1);
 check(k+' actual Supabase prescription equals archived output',util.isDeepStrictEqual(op.proposal,expected.proposal)&&op.output_schema_version===2);
 check(k+' no approval or accepted routine',op.reviewed_at===null&&op.routine_id===null);
 const denied=await req(k,'/rest/v1/rpc/accept_basic_plan',{p_operation:op.id});check(k+' athlete cannot accept before approval',!denied.ok&&denied.body.message==='coach_proposal_not_ready');
 const foreign=await req(k,'/rest/v1/coach_operations?user_id=neq.'+a.c.users[k].id);check(k+' cannot read other athlete',foreign.ok&&foreign.body.length===0);
 const managed=await req(k,'/rest/v1/routine_management');check(k+' no routine created',managed.ok&&managed.body.length===0);
 if(k==='G'){const failed=r.body.find(o=>o.state==='failed');check('G preserves failed receipt and explicit retry lineage',failed.error_code==='provider_incomplete'&&failed.retry_authorized_at&&op.retry_source===failed.id);}
}
const q=await req('reviewer','/rest/v1/rpc/get_coach_review_queue',{});check('reviewer sees both pending proposals',q.ok&&['G','H'].every(k=>q.body.some(r=>r.operation.user_id===a.c.users[k].id&&r.operation.state==='pending_review')));
check('review queue does not expose health',q.body.every(r=>!Object.hasOwn(r,'health')&&!Object.hasOwn(r.training||{},'health')));
const anon=await req(null,'/rest/v1/coach_operations');check('anon cannot read operations',!anon.ok||anon.body.length===0);
fs.writeFileSync(a.out+'/live-rest.json',JSON.stringify({passed:rows.length,total:rows.length,rows},null,2));console.log(rows.length+'/'+rows.length+' real staging JWT rest checks');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
