'use strict';
// Offline hostile-request checks; no network, credentials or database fixture is used.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const trainer='11111111-1111-4111-8111-111111111111',client='22222222-2222-4222-8222-222222222222',old='99999999-9999-4999-8999-999999999999';
const rid='33333333-3333-4333-8333-333333333333',day='44444444-4444-4444-8444-444444444444',exercise='55555555-5555-4555-8555-555555555555';
const task='cloudflare_hosting_20261014',prefix='SYNTHETIC Cloudflare hosting ';
function harness({actor='6b47ae02-6574-46db-acdb-f00925efdd74',expired=false,project='dmqjexigdnfzobarhnib'}={}){
 const rows=Object.fromEntries(['profiles','routines','routine_assignments','routine_days','routine_exercises','workouts','routine_user_notes'].map(t=>[t,[]])),users=new Map(),mutations=[];
 let handler;
 function query(table){const filters=[];let op='read',inserted;
  const q={select:()=>q,eq:(field,value)=>{filters.push(r=>r[field]===value);return q;},in:(field,values)=>{filters.push(r=>values.includes(r[field]));return q;},
   or:expression=>{const ids=expression.match(/in\.\(([^)]+)\)/)[1].split(',');filters.push(r=>ids.includes(r.trainer_id)||ids.includes(r.client_id));return q;},
   insert:value=>{op='insert';inserted=Array.isArray(value)?value:[value];return q;},delete:()=>{op='delete';return q;},
   then:resolve=>{let found=rows[table].filter(r=>filters.every(fn=>fn(r)));if(op==='insert'){rows[table].push(...inserted);mutations.push({table,op});found=inserted;}if(op==='delete'){rows[table]=rows[table].filter(r=>!found.includes(r));mutations.push({table,op});}return Promise.resolve({data:found,error:null}).then(resolve);}};return q;
 }
 const db={from:query,auth:{getUser:async()=>({data:{user:{id:actor}},error:null}),admin:{
  createUser:async input=>{const slot=input.app_metadata.synthetic_slot,id=slot==='trainer'?trainer:client;users.set(id,{id,email:input.email,app_metadata:input.app_metadata});mutations.push({table:'auth',op:'create'});return{data:{user:{id}},error:null};},
  getUserById:async id=>({data:{user:users.get(id)},error:users.has(id)?null:{code:'notfound'}}),
  deleteUser:async id=>{users.delete(id);rows.profiles=rows.profiles.filter(p=>p.id!==id);mutations.push({table:'auth',op:'delete',id});return{data:{},error:null};}
 }}};
 let source=fs.readFileSync(require('node:path').join(__dirname,'staging-qa-edge.ts'),'utf8');
 source=source.replace(/^import .+;\r?\n/m,'').replace('__EXPIRES_AT__',new Date(Date.now()+(expired?-60000:60000)).toISOString())
  .replace('(slot:string)','(slot)').replace('(req:Request)','(req)').replace('(body:unknown,status=200)','(body,status=200)').replace('let body:any;','let body;').replace('const users:any[]=[];','const users=[];').replace(/\((\w+):any\)/g,'($1)').replace(/\((\w+):string\)/g,'($1)').replace(' as const','');
 vm.runInNewContext(source,{createClient:()=>db,crypto:crypto.webcrypto,Response,Date,Number,Set,Deno:{serve:fn=>{handler=fn;},env:{get:name=>name==='SUPABASE_URL'?'https://'+project+'.supabase.co':'unit-server-only-key'}}});
 const request=async(body,origin)=>{const response=await handler(new Request('https://fixture.invalid',{method:'POST',headers:{Authorization:'Bearer unit-only-token','Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)}));return{status:response.status,data:await response.json()};};
 const create=async()=>{for(const slot of ['trainer','client'])assert.equal((await request({action:'create',slot})).status,200);mutations.length=0;};
 function linked(){rows.routines=[{id:rid,owner_id:trainer,name:prefix+'routine',source_routine_id:null}];rows.routine_days=[{id:day,routine_id:rid}];rows.routine_exercises=[{id:exercise,day_id:day}];rows.routine_assignments=[{id:'66666666-6666-4666-8666-666666666666',trainer_id:trainer,client_id:client,trainer_routine_id:rid,client_routine_id:null}];rows.workouts=[{id:'77777777-7777-4777-8777-777777777777',user_id:client,data:{routine_id:rid,routine_day_id:day,exercises:[{exercise_id:exercise}]}}];rows.routine_user_notes=[{id:'88888888-8888-4888-8888-888888888888',user_id:client,routine_id:rid,exercise_key:'exercise:'+exercise,statistics_stage_id:null}];}
 return{rows,users,mutations,request,create,linked};
}
test('wrong project, wrong actor and browser Origin cannot create users',async()=>{
 for(const options of [{project:'production-forbidden'}, {actor:old}, {}]){const h=harness(options);const r=await h.request({action:'create',slot:'trainer'},Object.keys(options).length?undefined:'https://public.invalid');assert.equal(r.status,403);assert.equal(h.mutations.length,0);}
});
test('expiry and unrecognized command keys prevent new fixture creation',async()=>{
 const expired=harness({expired:true});assert.equal((await expired.request({action:'create',slot:'trainer'})).status,410);assert.equal(expired.mutations.length,0);
 const h=harness();assert.equal((await h.request({action:'create',slot:'trainer',query:'DROP TABLE ignored'})).status,400);assert.equal(h.mutations.length,0);
});
test('synthetic trainer/client creation uses confirmed email and trusted task metadata',async()=>{
 const h=harness();await h.create();assert.equal(h.users.size,2);assert.equal(h.users.get(trainer).app_metadata.synthetic_task,task);assert.equal(h.rows.profiles.find(p=>p.id===client).role,'client');
});
test('cleanup rejects old UUIDs or changed trusted fixture metadata',async()=>{
 const h=harness();await h.create();h.users.set(old,{id:old,email:'reserved-test@example.com',app_metadata:{synthetic_task:'other_task',synthetic_slot:'client'}});
 assert.equal((await h.request({action:'cleanup',ids:[old]})).status,403);assert.equal(h.mutations.length,0);
 h.users.get(client).app_metadata.synthetic_task='other_task';assert.equal((await h.request({action:'cleanup',ids:[trainer,client]})).status,403);assert.equal(h.mutations.length,0);
});
test('a foreign assignment fails before any delete',async()=>{
 const h=harness();await h.create();h.linked();h.rows.routine_assignments[0].client_id=old;
 assert.equal((await h.request({action:'cleanup',ids:[trainer,client]})).status,409);assert.equal(h.mutations.length,0);
});
test('unexpected routine and history identities fail before any delete',async()=>{
 for(const target of ['routine','history']){const h=harness();await h.create();h.linked();if(target==='routine')h.rows.routines[0].name='Preserve this unexpected data';else h.rows.workouts[0].data.routine_id=old;
  assert.equal((await h.request({action:'cleanup',ids:[trainer,client]})).status,409);assert.equal(h.mutations.length,0);}
});
test('scoped cleanup removes only the two identities and their one fixture, Auth last',async()=>{
 const h=harness();await h.create();h.linked();h.rows.workouts.push({id:old,user_id:old,data:{routine_id:old}});const r=await h.request({action:'cleanup',ids:[trainer,client]});
 assert.equal(r.status,200);assert.equal(r.data.app_rows_removed,6);assert.equal(h.users.size,0);assert.equal(h.rows.workouts.length,1);assert.equal(h.rows.workouts[0].id,old);assert.equal(h.mutations.at(-1).table,'auth');
});
test('expiry still permits removal of only an exact empty fixture',async()=>{
 const h=harness({expired:true});h.users.set(client,{id:client,email:'simple-qa-'+task+'-client@example.com',app_metadata:{synthetic_task:task,synthetic_slot:'client'}});h.rows.profiles=[{id:client,name:prefix+'client',role:'client'}];
 assert.equal((await h.request({action:'cleanup',ids:[client]})).status,200);assert.equal(h.users.size,0);
});
