// Negative actions use only Root's exact synthetic fixture and existing controlled JWTs.
// No Auth, provider, role, entitlement or user-data administration from this harness.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),{isDeepStrictEqual:equal}=require('util');
const L=require('./live.cjs'),{fixture:f,rpc,table,must,rows,check}=L,mode=process.argv[2],actors=['mock','real','trainer','reviewer',null],tag=a=>a||'anon';
async function privateTable(actor,name,method='GET',body){
 assert(['premium_entitlements','premium_admissions'].includes(name));
 const r=await fetch('https://'+L.creds.ref+'.supabase.co/rest/v1/'+name,{method,headers:{apikey:L.creds.key,...(L.sessions[actor]?{Authorization:'Bearer '+L.sessions[actor].access_token}:{}),'Content-Type':'application/json','Accept-Profile':'coach_private','Content-Profile':'coach_private',Prefer:'return=representation'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
 // Never retain arbitrary server error text or row values in test evidence.
 return {ok:r.ok,status:r.status};
}
const readMeso=a=>table(a,'coach_mesocycles','id=eq.'+f.mesocycle,'id,user_id,routine_id,current_revision_id,tracking_week');
async function main(){
 assert(f?.ref==='dmqjexigdnfzobarhnib'&&f.mesocycle,'Wait for authorized staging fixture');
 if(mode==='unassigned-reviewer'){
  const r=await readMeso('reviewer');check('Authorized but unassigned reviewer cannot read owner mesocycle',!r.ok||r.data.length===0);
  if(f.analysis){const v=await rpc('reviewer','premium_recommendation_view',{p_id:f.analysis});check('Unassigned reviewer cannot view owner recommendation',!v.ok);}
  return;
 }
 if(mode==='assigned-reviewer'){
  const r=await readMeso('reviewer');check('Explicitly assigned reviewer reads exactly owner mesocycle',r.ok&&r.data.length===1&&r.data[0].id===f.mesocycle&&r.data[0].user_id===f.user);
  const privateJournal=await table('reviewer','coach_messages','mesocycle_id=eq.'+f.mesocycle,'context_bundle,receipt');check('Assigned reviewer cannot access private Chat context/receipt',!privateJournal.ok);
  if(f.analysis){const v=await rpc('reviewer','premium_recommendation_view',{p_id:f.analysis});check('Assigned reviewer gets safe recommendation view only',v.ok&&v.data?.id===f.analysis&&!/"analysis_bundle"|"context_snapshot"|"user_message"|"last_messages"|"receipt"/.test(JSON.stringify(v.data)));}
  return;
 }
 assert(mode==='negative','Only explicit negative mode');
 const before=await L.baseline(),accessBefore=await must(rpc('mock','premium_my_access')),args={p_routine:f.routine,p_revision:f.revision,p_key:crypto.randomUUID(),p_start:new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Madrid'}),p_weeks:6};
 for(const a of actors){
  const set=await rpc(a,'premium_set_entitlement',{p_user:f.user,p_enabled:true,p_until:'2026-10-08T00:00:00Z',p_capabilities:['upgrade','tracking','weekly','analysis','chat'],p_generation_limit:0,p_analysis_limit:10,p_chat_limit:10});check(tag(a)+' cannot self-grant server entitlement',!set.ok);
  check(tag(a)+' cannot read private entitlement table',!(await privateTable(a,'premium_entitlements')).ok);
  check(tag(a)+' cannot insert private entitlement',!(await privateTable(a,'premium_entitlements','POST',{user_id:f.user,enabled:true,expires_at:'2026-10-08T00:00:00Z',capabilities:['tracking']})).ok);
  check(tag(a)+' cannot insert private admission',!(await privateTable(a,'premium_admissions','POST',{routine_id:f.routine,user_id:f.user,mesocycle_id:f.mesocycle,baseline_revision_id:f.revision,source_kind:'basic'})).ok);
  const provision=await rpc(a,'premium_provision',{p_user:f.user,p_routine:f.routine,p_start:args.p_start,p_weeks:6,p_until:'2026-10-08T00:00:00Z'});check(tag(a)+' cannot call service-only provision',!provision.ok);
  const claim=await rpc(a,'premium_analysis_claim',{p_user:f.user,p_id:f.analysis||crypto.randomUUID(),p_input_bound:1,p_mode:'mock'});check(tag(a)+' cannot call service-only analysis claim',!claim.ok);
  const chatClaim=await rpc(a,'premium_chat_claim',{p_user:f.user,p_id:f.turn||crypto.randomUUID(),p_input_bound:1,p_mode:'mock'});check(tag(a)+' cannot call service-only Chat claim',!chatClaim.ok);
  if(a!=='mock'){
   check(tag(a)+' cannot upgrade another athlete Basic routine',!(await rpc(a,'upgrade_basic_routine_to_premium',args)).ok);
   check(tag(a)+' cannot grant Premium admission without entitlement',!(await rpc(a,'premium_admission_permission',{p_allow:true,p_notice:'premium-followup-v1'})).ok);
   const j=await rpc(a,'premium_chat_load',{p_mesocycle:f.mesocycle});check(tag(a)+' cannot load owner complete Chat journal',!j.ok);
  }
 }
 for(const a of ['real','trainer',null]){const m=await readMeso(a);check(tag(a)+' cannot read owner mesocycle',!m.ok||m.data.length===0);}
 for(const a of ['mock','real','trainer','reviewer']){
  const p=(await must(table(a,'profiles','id=eq.'+L.creds.users[a].id,'id,role')))[0];check(a+' role preserved without plan stored as role',p?.id===L.creds.users[a].id&&p.role===(['mock','real'].includes(a)?'client':'trainer'));
 }
 const invalid=await rpc('mock','upgrade_basic_routine_to_premium',{...args,p_revision:crypto.randomUUID()});check('Owner stale baseline revision cannot silently upgrade',!invalid.ok);
 const accessAfter=await must(rpc('mock','premium_my_access'));check('Denied actions leave owner server access/consumption identical',equal(accessBefore,accessAfter));
 const after=await L.baseline();for(const k of Object.keys(before))check('Denied actions leave '+k+' identical',equal(before[k],after[k]));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{if(rows.length)fs.writeFileSync(path.join(__dirname,'results/security-'+mode+'.json'),JSON.stringify({rows,total:rows.length,completed:!process.exitCode,provider_dispatches:0,no_auth_administration:true},null,2));console.log(rows.filter(r=>r.pass).length+'/'+rows.length+' '+mode+' checks');});
