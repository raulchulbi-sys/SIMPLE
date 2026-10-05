// One explicitly requested dispatch per mode. Staging only; no retries or secrets in output.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const L=require('./live.cjs'),{fixture:f,creds,sessions,rpc,must,write,save,table}=L;
const mode=process.argv[2];
async function main(){
 assert.equal(creds.ref,'dmqjexigdnfzobarhnib');assert(f.original_revision&&f.revision!==f.original_revision&&f.new_workout,'Full mocked E2E must be complete first');
 assert(['weekly','chat'].includes(mode));
 assert(!f['real_'+mode+'_requested'],'No automatic repeat of a dispatched test');
 if(mode==='weekly'){
  const m=(await must(table('mock','coach_mesocycles','id=eq.'+f.mesocycle)))[0];
  assert(m.current_revision_id===f.revision);
  const existing=await must(table('mock','coach_weekly_checkins','mesocycle_id=eq.'+f.mesocycle+'&week_number=eq.'+m.tracking_week));
  assert(existing.length===0,'Do not silently overwrite a submitted check-in');
  const ci=await must(rpc('mock','premium_save_weekly_checkin',{p_mesocycle:f.mesocycle,p_week:m.tracking_week,p_revision:f.revision,p_expected:0,p_answers:L.weekly,p_submit:true}));
  f.real_checkin=ci.id;save();
 }
 const body=mode==='weekly'?{mesocycle_id:f.mesocycle,key:crypto.randomUUID(),mode:'weekly'}:{mesocycle_id:f.mesocycle,revision_id:f.revision,key:crypto.randomUUID(),message:'Explica la programación actual de sentadilla goblet del lunes. Distingue la base heredada de Basic de la decisión Premium aceptada y de la sesión registrada después; no inventes el motivo original.'};
 f['real_'+mode+'_requested']=new Date().toISOString();f['real_'+mode+'_key']=body.key;save();
 const url='https://'+creds.ref+'.supabase.co/functions/v1/'+(mode==='weekly'?'simple-coach-premium':'simple-coach-chat');
 const r=await fetch(url,{method:'POST',headers:{apikey:creds.key,Authorization:'Bearer '+sessions.mock.access_token,'Content-Type':'application/json',Origin:'http://127.0.0.1:4251'},body:JSON.stringify(body),signal:AbortSignal.timeout(110000)});
 const value=await r.json();write('real-'+mode+'-response.json',value);
 const item=mode==='weekly'?value.recommendation:value.message;
 if(item?.id){f['real_'+mode+'_id']=item.id;if(mode==='weekly')f.recommendations.push(item.id);else f.turns.push(item.id);save();}
 const safe={mode,http_status:r.status,error:value.error||item?.error||null,state:item?.state||null,kind:item?.kind||null};
 fs.writeFileSync(path.join(__dirname,'results','real-'+mode+'.json'),JSON.stringify(safe,null,2));console.log(JSON.stringify(safe));
 assert(r.ok&&item&&(mode==='weekly'?item.state==='pending_review':item.state==='completed'),'Real provider outcome did not pass; do not retry automatically');
}
main().catch(e=>{console.error(e.name==='AssertionError'?e.message:'Controlled real test failed: '+e.name);process.exitCode=1;});
