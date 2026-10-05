// Focused adapter regression. JWT mode is read-only: no Auth, mutations or providers.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const A=require('../../assets/coach-premium-adapter.js'),mode=process.argv[2]||'local',rows=[];
function check(name,ok){rows.push({name,pass:!!ok});assert(ok,name);}
function fake({owner=false,revision=false,assigned=true,detailError=null}={}){
 const ids={user:crypto.randomUUID(),owner:crypto.randomUUID(),meso:crypto.randomUUID(),revision:crypto.randomUUID(),rec:crypto.randomUUID(),exercise:crypto.randomUUID()};if(owner)ids.owner=ids.user;
 const calls=[],safe={id:ids.rec,base_revision_id:ids.revision,kind:'MODIFY',state:'pending_review',facts:[{exercise_name:'Sentadilla goblet',claim:'mixed_comparable'}],patches:[{field:'planned_sets',target_id:ids.exercise,exercise_name:'Sentadilla goblet',from:[{set_number:1,reps_min:8,reps_max:10,rir:2,rest_seconds:180}],to:[{set_number:1,reps_min:8,reps_max:10,rir:1,rest_seconds:180}]}],quality_warnings:['Comparabilidad limitada']};
 const tables={coach_mesocycles:assigned?[{id:ids.meso,user_id:ids.owner,current_revision_id:ids.revision,tracking_week:1,intake:{private:'PRIVATE_INTAKE_SENTINEL'}}]:[],coach_mesocycle_weeks:[{id:crypto.randomUUID(),week_number:1}],routine_revisions:revision?[{id:ids.revision,revision_no:2,snapshot:{days:[{id:crypto.randomUUID(),exercises:[{id:ids.exercise,name:'Sentadilla goblet'}]}]}}]:[],coach_recommendations:[{id:ids.rec,base_revision_id:ids.revision,kind:'MODIFY',state:'pending_review',patches:[],facts:[]}],context_grants:[],coach_weekly_checkins:[]};
 const db={auth:{getSession:async()=>({data:{session:{user:{id:ids.user}}},error:null})},async rpc(name,args){calls.push({rpc:name,args});if(name==='premium_my_access')return{data:{enabled:owner,consent:owner,capabilities:[]},error:null};assert.equal(name,'premium_recommendation_view');return{data:detailError?null:safe,error:detailError};},from(table){const c={table,filters:{}};calls.push(c);return{select(columns){c.columns=columns;return this;},eq(k,v){c.filters[k]=v;return this;},is(k,v){c.filters[k]=v;return this;},order(){return this;},then(resolve,reject){return Promise.resolve({data:tables[table]||[],error:null}).then(resolve,reject);}};}};
 return{ids,calls,safe,db};
}
async function local(){
 const f=fake(),s=await A.create(f.db,{mesocycleId:f.ids.meso}).load();
 check('Assigned reviewer loads with owner revision SELECT unavailable',s.actor==='reviewer'&&s.mesocycle.id===f.ids.meso);
 check('Reviewer needs no athlete entitlement',s.access.enabled===false);
 check('Reviewer never queries private revisions',!f.calls.some(c=>c.table==='routine_revisions'));
 check('Reviewer never calls athlete-only access RPC',!f.calls.some(c=>c.rpc==='premium_my_access'));
 check('Reviewer never requests private intake columns',!f.calls.some(c=>c.table==='coach_mesocycles'&&c.columns.split(',').includes('intake')));
 check('Reviewer never queries owner grants/checkins/chat/notes',!f.calls.some(c=>['context_grants','coach_weekly_checkins','coach_messages','coach_conversations','routine_user_notes'].includes(c.table)));
 check('Reviewer retains exact current revision UUID',s.mesocycle.revision_id===f.ids.revision);
 check('Reviewer has no invented ordinal or full programming',s.mesocycle.revision_no==='actual'&&s.days.length===0);
 check('Reviewer uses the scoped safe recommendation RPC',f.calls.some(c=>c.rpc==='premium_recommendation_view'&&c.args.p_id===f.ids.rec));
 check('Reviewer gets named facts and warnings from safe projection',s.recommendations[0].facts[0].exercise_name==='Sentadilla goblet'&&s.recommendations[0].quality_warnings[0]==='Comparabilidad limitada');
 check('Reviewer before/after series equal safe projection',JSON.stringify(s.recommendations[0].changes[0].before)===JSON.stringify(f.safe.patches[0].from)&&JSON.stringify(s.recommendations[0].changes[0].after)===JSON.stringify(f.safe.patches[0].to));
 check('Reviewer state excludes private intake and owner identity',!Object.hasOwn(s.mesocycle,'intake')&&!Object.hasOwn(s.mesocycle,'user_id')&&!JSON.stringify(s).includes('PRIVATE_INTAKE_SENTINEL'));
 const o=fake({owner:true,revision:true}),os=await A.create(o.db,{mesocycleId:o.ids.meso}).load();
 check('Owner still loads exact delivered revision and full programming',os.actor==='athlete'&&os.mesocycle.revision_no===2&&os.days.length===1&&o.calls.some(c=>c.table==='routine_revisions'&&c.filters.id===o.ids.revision));
 const missing=fake({owner:true});let denied=false;try{await A.create(missing.db,{mesocycleId:missing.ids.meso}).load();}catch(e){denied=e.code==='premium_current_prescription_unresolved';}
 check('Owner missing current prescription still fails closed',denied);
 const no=fake({assigned:false}),ns=await A.create(no.db,{mesocycleId:no.ids.meso}).load();
 check('Unassigned reviewer cannot mount an owner mesocycle',ns.mesocycle===null&&ns.actor!=='reviewer'&&!no.calls.some(c=>c.rpc==='premium_recommendation_view'));
 const broken=fake({detailError:{code:'network_error'}});let network=false;try{await A.create(broken.db,{mesocycleId:broken.ids.meso}).load();}catch(e){network=e.code==='network_error';}
 check('Unknown safe-detail errors propagate without private fallback',network);
}
async function jwt(){
 const L=require('./live.cjs'),f=L.fixture;assert.equal(f?.ref,'dmqjexigdnfzobarhnib');assert(f.mesocycle&&L.sessions.reviewer?.access_token,'Existing controlled reviewer JWT required; no login in this harness');
 const privateRevision=await L.table('reviewer','routine_revisions','id=eq.'+f.revision,'id');
 check('Actual reviewer JWT cannot SELECT owner private revision',privateRevision.ok&&Array.isArray(privateRevision.data)&&privateRevision.data.length===0);
 const db=L.sdk('reviewer'),calls=[],oldRpc=db.rpc,oldFrom=db.from;
 db.rpc=(name,args)=>{assert(['premium_my_access','premium_recommendation_view'].includes(name),'Read-only RPC allowlist');calls.push({rpc:name});return oldRpc(name,args);};
 db.from=table=>{assert(['coach_mesocycles','coach_mesocycle_weeks','coach_recommendations'].includes(table),'No private owner tables through reviewer adapter');calls.push({table});return oldFrom(table);};
 const s=await A.create(db,{mesocycleId:f.mesocycle}).load();
 check('Actual SDK reviewer loads assigned mesocycle despite hidden revision',s.actor==='reviewer'&&s.user_id===f.reviewer&&s.mesocycle?.id===f.mesocycle);
 const m=await L.table('reviewer','coach_mesocycles','id=eq.'+f.mesocycle,'id,current_revision_id');
 check('Actual SDK reviewer preserves current revision identity',m.ok&&m.data.length===1&&s.mesocycle.revision_id===m.data[0].current_revision_id);
 check('Actual reviewer uses safe recommendation projection',s.recommendations.length>0&&calls.some(c=>c.rpc==='premium_recommendation_view'));
 check('Actual reviewer has no full prescription or invented ordinal',s.days.length===0&&s.mesocycle.revision_no==='actual');
 check('Actual reviewer result excludes private intake/context/transcript/receipt',!Object.hasOwn(s.mesocycle,'intake')&&!Object.hasOwn(s.mesocycle,'user_id')&&!/"analysis_bundle"|"context_snapshot"|"user_message"|"last_messages"|"receipt"/.test(JSON.stringify(s)));
 check('Actual reviewer adapter never reads private owner tables or athlete-only access',calls.every(c=>!c.table||['coach_mesocycles','coach_mesocycle_weeks','coach_recommendations'].includes(c.table))&&!calls.some(c=>c.rpc==='premium_my_access'));
}
assert(['local','jwt'].includes(mode));
(mode==='jwt'?jwt():local()).catch(()=>{process.exitCode=1;console.error('Focused reviewer adapter regression failed; no raw credentials or response printed.');}).finally(()=>{fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});fs.writeFileSync(path.join(__dirname,'results/reviewer-adapter-'+mode+'.json'),JSON.stringify({rows,total:rows.length,completed:!process.exitCode,scope:mode==='jwt'?'Existing reviewer JWT, actual SDK proxy; SELECT and safe read RPCs only':'Offline SDK adapter regression; owner-only revisions unavailable',provider_dispatches:0,auth_calls:0,data_mutations:0},null,2));console.log(rows.filter(r=>r.pass).length+'/'+rows.length+' reviewer adapter '+mode+' checks');});
