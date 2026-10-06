const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const sandbox={Map,Date,Error,globalThis:null};sandbox.globalThis=sandbox;vm.runInNewContext(fs.readFileSync('assets/statistics-stage.js','utf8'),sandbox);const api=sandbox.simpleStatisticsStage;
let checks=0;const check=(name,ok)=>{assert(ok,name);checks++;};
(async()=>{
 const empty={id:null,started_at:null},stage={id:'00000000-0000-4000-8000-000000000001',started_at:'2026-10-06T12:00:00Z'};
 const rows=[{id:'old',created_at:'2026-10-06T11:59:59.999Z'},{id:'new',created_at:stage.started_at},{id:'missing'},{id:'bad',created_at:'invalid'}],snapshot=JSON.stringify(rows);
 check('no reset keeps all',api.filter(rows,empty).length===4);check('cutoff includes boundary only',api.filter(rows,stage).map(r=>r.id).join()==='new');check('input untouched',JSON.stringify(rows)===snapshot);
 check('Postgres microsecond boundary preserved',api.filter([{id:'before',created_at:'2026-10-06T12:00:00.123455Z'},{id:'exact',created_at:'2026-10-06T12:00:00.123456Z'}],{...stage,started_at:'2026-10-06T12:00:00.123456Z'}).map(r=>r.id).join()==='exact');
 check('timezone offsets compare same instant',api.filter([{created_at:'2026-10-06T14:00:00.123456+02:00'}],{...stage,started_at:'2026-10-06T12:00:00.123456Z'}).length===1);
 check('unknown previous withheld',api.previous(rows,'a','r').length===0);
 let state=stage,calls=[];const db={rpc:async(name,args)=>{calls.push({name,args});return {data:state,error:null};}};
 await api.read(db,'a','r');check('previous excludes old',api.previous(rows,'a','r').length===1);check('another client isolated',api.previous(rows,'b','r').length===0);check('another routine isolated',api.previous(rows,'a','other').length===0);
 await api.cycle(db,'a','r');check('reset uses assignment-aware cycle RPC',calls.at(-1).name==='get_client_custom_routine_cycle_progress');state=empty;await api.cycle(db,'a','r');check('no reset uses same assignment-aware cycle RPC',calls.at(-1).name==='get_client_custom_routine_cycle_progress');
 await api.read(db,'a','r',()=>false);check('stale read returns null',await api.read(db,'a','r',()=>false)===null);
 for(const value of [null,[],{}, {id:stage.id,started_at:null},{id:stage.id,started_at:'invalid'}]){try{api.filter(rows,value);throw Error('expected invalid');}catch(e){check('invalid stage fails closed',e.message==='statistics_invalid_stage');}}
 try{await api.read({rpc:async()=>({error:Error('network')})},'a','r');throw Error('expected network');}catch(e){check('network errors propagate',e.message==='network');}
 const cleared={...stage,training_reset_id:stage.id};let release;const slow={rpc:name=>name==='reset_client_routine_training_history'?new Promise(r=>release=r):Promise.resolve({data:cleared,error:null})};const first=api.reset(slow,'a','r',empty,stage.id);try{await api.reset(slow,'a','r',empty,stage.id);throw Error('expected busy');}catch(e){check('double submit prevented',e.message==='statistics_reset_busy');}release({data:cleared,error:null});check('reset verified by server read',(await first).id===stage.id);

 const cache=new Map([['simple_routine_notes_v3:a:r:day','old note'],['simple_workout_draft_v2:a:r:day','old draft'],['simple_workout_completed_v1:a:r:day','old completion'],['simple_routine_notes_v3:a:r:day:reset:'+stage.id,'new note'],['simple_workout_draft_v2:a:other:day','other routine'],['simple_workout_draft_v2:b:r:day','other client']]);
 const storage={get length(){return cache.size},key:i=>[...cache.keys()][i],removeItem:k=>cache.delete(k)};
 api.clearLocal(storage,'a','r',cleared);
 check('old cache and drafts removed',!cache.has('simple_routine_notes_v3:a:r:day')&&!cache.has('simple_workout_draft_v2:a:r:day')&&!cache.has('simple_workout_completed_v1:a:r:day'));
 check('current-stage note retained',cache.has('simple_routine_notes_v3:a:r:day:reset:'+stage.id));
 check('other routine cache retained',cache.has('simple_workout_draft_v2:a:other:day'));
 check('other client cache retained',cache.has('simple_workout_draft_v2:b:r:day'));
 api.clearLocal(storage,'a','other',empty);check('metadata-only stage does not clear cache',cache.has('simple_workout_draft_v2:a:other:day'));
 try{await api.reset({rpc:async()=>({data:stage,error:null})},'a','r',empty,stage.id);throw Error('expected unverified');}catch(e){check('accepted RPC without reset token is not success',e.message==='statistics_reset_not_verified');}
 console.log(checks+'/'+checks+' module checks');
})().catch(e=>{console.error(e);process.exitCode=1;});
