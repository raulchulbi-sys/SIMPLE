// Synthetic fixtures only. Mock outputs are never counted as real AI calls.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const dir=path.join(__dirname,'private'),out=path.join(__dirname,'results'),f=JSON.parse(fs.readFileSync(path.join(dir,'fixture.json'))),mode=process.argv[2],q=x=>"'"+String(x).replaceAll("'","''")+"'",j=x=>q(JSON.stringify(x))+'::jsonb';
assert.equal(f.ref,'dmqjexigdnfzobarhnib');
const s=JSON.parse(fs.readFileSync(path.join(dir,'sessions.json'))),rows=[];
const write=(n,v)=>fs.writeFileSync(path.join(dir,n),typeof v==='string'?v:JSON.stringify(v,null,2));
function check(name,v){rows.push({name,pass:!!v});assert(v,name);}
async function req(w,route,data,method){const r=await fetch('https://'+f.ref+'.supabase.co'+route,{method:method||(data===undefined?'GET':'POST'),headers:{apikey:f.key,...(s[w]?{Authorization:'Bearer '+s[w].access_token}:{}),'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(20000)});const text=await r.text();return{ok:r.ok,data:text?JSON.parse(text):null};}
const rpc=(w,n,d)=>req(w,'/rest/v1/rpc/'+n,d),read=(w,t,where)=>req(w,'/rest/v1/'+t+'?select=*&'+where);
async function main(){
 if(mode==='prepare'){
  const A=f.cases.A,B=f.cases.B,C=f.cases.C,D=f.cases.D;
  const specs={volume:{m:A.mesocycle,kind:'MODIFY',p:[{target_id:A.exercises[0],field:'sets',from:3,to:2}]},review:{m:D.mesocycle,kind:'REVIEW',p:[]},race1:{m:B.mesocycle,kind:'MODIFY',p:[{target_id:B.exercises[0],field:'sets',from:3,to:2}]},race2:{m:B.mesocycle,kind:'MODIFY',p:[{target_id:B.exercises[1],field:'sets',from:3,to:2}]},atomic:{m:C.mesocycle,kind:'MODIFY',p:[{target_id:C.exercises[0],field:'replace_exercise',from:C.exercises[0],to:{id:crypto.randomUUID(),catalogue_id:'band_row',sets:3,target:'8-12',rir:'2',rest_seconds:180}},{target_id:C.exercises[0],field:'sets',from:3,to:2}]}};
  write('functional-setup.sql','begin;set local role service_role;\nselect jsonb_build_object('+Object.entries(specs).map(([k,v])=>q(k)+`,public.premium_mock_recommendation('${v.m}','${v.kind}',${j(v.p)},'[]'::jsonb,'Controlled Phase2 ${k}; no real AI.')`).join(',')+') recs;commit;');
 }
 if(mode==='run'||mode==='resume-after-void'){
  const ids=JSON.parse(fs.readFileSync(path.join(dir,'functional-ids.json')));
  if(mode==='run'){
  check('REVIEW cannot self accept',!(await rpc('mock','premium_accept_recommendation',{p_id:ids.review})).ok);
  check('normal review cannot approve unresolved REVIEW',!(await rpc('reviewer','premium_review_recommendation',{p_id:ids.review,p_approve:true,p_reason:'Must first resolve.'})).ok);
  for(const w of ['mock','real','trainer',null])check((w||'anon')+' cannot resolve REVIEW',!(await rpc(w,'premium_resolve_review',{p_id:ids.review,p_kind:'KEEP',p_patches:[],p_reason:'Forbidden'})).ok);
  check('scoped reviewer resolves REVIEW',(await rpc('reviewer','premium_resolve_review',{p_id:ids.review,p_kind:'KEEP',p_patches:[],p_reason:'One exposure; keep without a speculative change.'})).ok);
  }else{
   const previous=JSON.parse(fs.readFileSync(path.join(out,'functional-run.json')));assert.equal(previous.rows.length,6);assert(previous.rows.every(r=>r.pass));rows.push(...previous.rows);
   const resolved=(await read('reviewer','coach_recommendations','id=eq.'+ids.review)).data[0];check('scoped reviewer resolves REVIEW',resolved.state==='ready'&&resolved.kind==='KEEP'&&resolved.review_reason==='One exposure; keep without a speculative change.');
  }
  check('owner accepts human resolution',(await rpc('mock','premium_accept_recommendation',{p_id:ids.review})).ok);
  const dr=(await read('mock','routine_revisions','routine_id=eq.'+f.cases.D.routine)).data;
  check('resolved KEEP creates no revision',dr.length===1);
  for(const k of ['volume','race1','race2','atomic'])check('review '+k,(await rpc('reviewer','premium_review_recommendation',{p_id:ids[k],p_approve:true,p_reason:'Synthetic structural check; original evidence inspected.'})).ok);
  const old=(await read('mock','routine_revisions','routine_id=eq.'+f.cases.A.routine)).data;
  const a=await Promise.all([1,2].map(()=>rpc('mock','premium_accept_recommendation',{p_id:ids.volume})));
  check('volume acceptance double request same revision',a.every(r=>r.ok)&&a[0].data===a[1].data);
  const ar=(await read('mock','routine_revisions','routine_id=eq.'+f.cases.A.routine)).data;
  check('volume exactly one new revision',ar.length===2&&ar.some(r=>r.id===old[0].id&&r.snapshot_hash===old[0].snapshot_hash));
  check('stale real A cannot apply',!(await rpc('mock','premium_accept_recommendation',{p_id:f.cases.A.real_rec})).ok);
  check('stale real A superseded',(await read('mock','coach_recommendations','id=eq.'+f.cases.A.real_rec)).data[0].state==='superseded');
  const rr=await Promise.all([ids.race1,ids.race2].map(p_id=>rpc('mock','premium_accept_recommendation',{p_id})));
  check('different concurrent recommendations one winner',rr.filter(r=>r.ok).length===1);
  const before=(await read('mock','routine_revisions','routine_id=eq.'+f.cases.C.routine)).data;
  const ebefore=(await read('mock','routine_exercises','id=eq.'+f.cases.C.exercises[0])).data;
  check('mid-apply failure rejects whole transaction',!(await rpc('mock','premium_accept_recommendation',{p_id:ids.atomic})).ok);
  const after=(await read('mock','routine_revisions','routine_id=eq.'+f.cases.C.routine)).data;
  check('atomic failure no partial revision',JSON.stringify(before)===JSON.stringify(after));
  check('atomic failure preserves exercise',(await read('mock','routine_exercises','id=eq.'+f.cases.C.exercises[0])).data[0]?.id===ebefore[0].id);
  check('atomic failure recommendation remains ready',(await read('mock','coach_recommendations','id=eq.'+ids.atomic)).data[0].state==='ready');
  check('reviewer has no direct workout access',(await read('reviewer','workouts','user_id=eq.'+f.users.mock.id)).data.length===0);
  await req('reviewer','/rest/v1/routine_exercises?id=eq.'+f.cases.A.exercises[0],{sets:8},'PATCH');check('reviewer cannot edit structure',(await read('mock','routine_exercises','id=eq.'+f.cases.A.exercises[0])).data[0].sets===2);
  check('owner cannot bypass managed structure',!(await req('mock','/rest/v1/routine_exercises?id=eq.'+f.cases.A.exercises[0],{sets:8},'PATCH')).ok);
  check('owner cannot mutate immutable revision',!(await req('mock','/rest/v1/routine_revisions?id=eq.'+old[0].id,{reason:'overwrite'},'PATCH')).ok);
 }
 if(mode==='resume-security'){
  const previous=JSON.parse(fs.readFileSync(path.join(out,'functional-resume-after-void.json')));assert.equal(previous.rows.length,24);rows.push(...previous.rows.slice(0,23));assert(rows.every(r=>r.pass));
  await req('reviewer','/rest/v1/routine_exercises?id=eq.'+f.cases.A.exercises[0],{sets:8},'PATCH');check('reviewer cannot edit structure',(await read('mock','routine_exercises','id=eq.'+f.cases.A.exercises[0])).data[0].sets===2);
  check('owner cannot bypass managed structure',!(await req('mock','/rest/v1/routine_exercises?id=eq.'+f.cases.A.exercises[0],{sets:8},'PATCH')).ok);
  const old=(await read('mock','routine_revisions','routine_id=eq.'+f.cases.A.routine)).data.find(r=>r.revision_no===1);
  check('owner cannot mutate immutable revision',!(await req('mock','/rest/v1/routine_revisions?id=eq.'+old.id,{reason:'overwrite'},'PATCH')).ok);
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{if(rows.length)fs.writeFileSync(path.join(out,'functional-'+mode+'.json'),JSON.stringify({rows,total:rows.length,completed:!process.exitCode},null,2));console.log(rows.filter(r=>r.pass).length+'/'+rows.length+' functional '+mode);});
