const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');const c=vm.createContext({console,Promise,Set,Object,Number,JSON,Error});vm.runInContext(fs.readFileSync('assets/client-routine.js','utf8'),c);const api=c.simpleClientRoutine;
const good={assignment_id:'assignment',client_id:'client',routine_id:'routine',version:1,name:'Routine',description:null,days:[{id:'day',name:'Day',day_order:0,exercises:[{id:'exercise',day_id:'day',name:'Exercise',sets:3,target:null,rir:'0',rest_seconds:0,exercise_order:0,notes:''}]}]};let checks=0;
const check=(name,ok)=>{assert(ok,name);checks++;};
(async()=>{
 check('complete response preserves null empty and zero',api.validate(good,'client','routine')===good);
 const cases=[x=>x.client_id='other',x=>x.routine_id='other',x=>delete x.assignment_id,x=>x.version=0,x=>delete x.description,x=>x.days=null,x=>x.days.push(structuredClone(x.days[0])),x=>x.days[0].exercises.push(structuredClone(x.days[0].exercises[0])),x=>x.days[0].exercises[0].day_id='other',x=>delete x.days[0].exercises[0].notes,x=>x.days[0].exercises[0].sets=0,x=>x.days[0].exercises[0].rest_seconds=null];
 for(const mutate of cases){const value=structuredClone(good);mutate(value);assert.throws(()=>api.validate(value,'client','routine'),/client_routine_invalid_response/);checks++;}
 await assert.rejects(()=>api.read({rpc:async()=>({error:Error('network')})},'client','routine'),/network/);checks++;
 await assert.rejects(()=>api.read({rpc:async()=>({data:null})},'client','routine'),/client_routine_invalid_response/);checks++;
 let calls=[];const db={rpc:async(name,args)=>{calls.push({name,args});return {data:good,error:null};}},state={clientId:'client',routineId:'routine',clientVersion:1};
 await api.save(db,state,{p_routine_id:'routine',p_days:{mode:'field_patch_v1',changes:[]}});check('save binds exact client routine and version',calls[0].name==='save_client_routine_structure'&&calls[0].args.p_client_id==='client'&&calls[0].args.p_expected_version===1&&calls[0].args.p_routine_id==='routine');
 calls=[];await api.reorder(db,state,{kind:'day',ids:['day']});check('reorder requires independent server read',calls.map(c=>c.name).join()==='reorder_client_routine_structure,get_client_routine_structure');
 await assert.rejects(()=>api.reorder({rpc:async name=>({data:{...good,version:name==='reorder_client_routine_structure'?1:2},error:null})},state,{kind:'day',ids:['day']}),/client_routine_order_not_verified/);checks++;
 console.log(checks+'/'+checks+' client prescription response checks');
})().catch(e=>{console.error(e);process.exitCode=1;});
