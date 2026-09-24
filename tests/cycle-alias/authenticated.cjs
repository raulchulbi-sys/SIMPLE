const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const dir=__dirname,c=JSON.parse(fs.readFileSync(dir+'/private/config.json'));
assert.equal(c.ref,'dmqjexigdnfzobarhnib');const url='https://'+c.ref+'.supabase.co',file=dir+'/results/authenticated.json';
const report=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{project:c.ref,results:[],trace:[]};
async function req(who,path,body,method='POST',token){assert(path.startsWith('/rest/v1/')||path.startsWith('/auth/v1/'));const r=await fetch(url+path,{method,headers:{apikey:c.key,'Content-Type':'application/json',Prefer:'return=representation',...(who?{Authorization:'Bearer '+(token||c.users[who].token)}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await r.text(),data=text?JSON.parse(text):null;report.trace.push({who,path:path.split('?')[0],method,status:r.status,code:data?.code||null});return{status:r.status,data};}
async function ok(who,path,body,method='POST'){const r=await req(who,path,body,method);assert(r.status>=200&&r.status<300,JSON.stringify(r));return r.data;}
function save(){report.passed=report.results.filter(r=>r.pass).length;report.failed=report.results.filter(r=>!r.pass);fs.writeFileSync(file,JSON.stringify(report,null,2));}
async function test(name,fn){try{await fn();report.results.push({name,pass:true});console.log('PASS '+name);}catch(e){report.results.push({name,pass:false,error:e.message});throw e;}finally{save();}}
const day=(n,ago=0,name=c.names[n],id=c.days[n])=>({id,name,ago});
const old=(n,ago=0)=>day(n,ago,c.names[n],c.old[n]);
const date=ago=>{const now=new Date();const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);return new Date(Date.parse(today+'T12:00:00Z')-ago*86400000).toISOString().slice(0,10);};
async function history(list,who='client',routine=c.routine){
 await ok(who,'/rest/v1/workouts?user_id=eq.'+c.users[who].id,undefined,'DELETE');
 if(!list.length)return;
 const q=s=>"'"+String(s).replaceAll("'","''")+"'";
 const rows=list.map((x,i)=>({id:crypto.randomUUID(),user_id:c.users[who].id,workout_date:x.date||date(x.ago||0),created_at:(x.date||date(x.ago||0))+'T'+String(10+Math.floor(i/60)).padStart(2,'0')+':'+String(i%60).padStart(2,'0')+':00Z',day:x.name,variant:'SYNTHETIC cycle alias',data:{routine_id:routine,...(x.id===undefined?{}:{routine_day_id:x.id}),day_name:x.name,exercises:[],notes:'SYNTHETIC immutable snapshot '+i}}));
 const query='INSERT INTO public.workouts(id,user_id,workout_date,created_at,day,variant,data) VALUES '+rows.map(r=>'('+[r.id,r.user_id,r.workout_date,r.created_at,r.day,r.variant,JSON.stringify(r.data)].map(q).join(',')+')').join(',')+';';
 const id=crypto.randomUUID();fs.writeFileSync(dir+'/private/request.json',JSON.stringify({id,query}));
 const end=Date.now()+180000;
 while(Date.now()<end){if(fs.existsSync(dir+'/private/response.json')){const r=JSON.parse(fs.readFileSync(dir+'/private/response.json'));if(r.id===id){if(r.error)throw Error(r.error);return;}}await new Promise(r=>setTimeout(r,150));}
 throw Error('Administrative fixture seed was not acknowledged');
}
const rpc=(who,client=c.users.client.id,routine=c.routine)=>req(who,'/rest/v1/rpc/get_client_routine_cycle_progress',{p_client_id:client,p_routine_id:routine});
async function check(label,total,done,who='client',client=c.users.client.id,routine=c.routine){await test(label+' / '+who,async()=>{const r=await rpc(who,client,routine);assert.equal(r.status,200);assert.deepEqual(r.data,[{total_days:total,completed_days:done}]);});}
async function both(label,total,done){for(const who of ['client','trainer'])await check(label,total,done,who);}
const patchDay=(id,body)=>ok('trainer','/rest/v1/routine_days?id=eq.'+id,body,'PATCH');
const captured=()=>ok('client','/rest/v1/workouts?user_id=eq.'+c.users.client.id+'&order=workout_date,created_at,id',undefined,'GET');
async function scenario(label,list,total,done){await history(list);const before=await captured();await both(label,total,done);assert.deepEqual(await captured(),before,'RPC modified fixture workouts');}
async function login(){for(const [who,u] of Object.entries(c.users))await test('JWT login '+who,async()=>{const r=await req(null,'/auth/v1/token?grant_type=password',{email:u.email,password:u.password});assert.equal(r.status,200);assert.equal(r.data.user.id,u.id);const claims=JSON.parse(Buffer.from(r.data.access_token.split('.')[1],'base64url'));assert.equal(claims.sub,u.id);assert.equal(claims.role,'authenticated');u.token=r.data.access_token;fs.writeFileSync(dir+'/private/config.json',JSON.stringify(c,null,2));});}
const realSequence=()=>[old(0),old(1),old(2),old(3),day(0),day(1),day(2),day(3),day(0),day(1),day(2),day(3)].map((x,i)=>({...x,date:['2026-08-31','2026-09-01','2026-09-02','2026-09-04','2026-09-07','2026-09-08','2026-09-10','2026-09-11','2026-09-15','2026-09-16','2026-09-17','2026-09-18'][i]}));
async function main(){const action=process.argv[2];
 if(action==='login')return login();
 if(action==='compare'){const mode=process.argv[3],expected=mode==='uuid-first'?3:4;const before=await captured();assert.equal(before.length,12);await both('Same immutable real sequence / '+mode,5,expected);assert.deepEqual(await captured(),before);return;}
 if(action==='logout'){for(const who of Object.keys(c.users))await test('Logout '+who,async()=>{const r=await req(who,'/auth/v1/logout?scope=global');assert([200,204].includes(r.status));});return;}
 if(action!=='suite')throw Error('Unknown action');
 await scenario('No workouts',[],5,0);
 for(let n=0;n<4;n++){await scenario('Confirmed alias '+n,[old(n)],5,1);await scenario('Alias then current same day resets '+n,[old(n,1),day(n)],5,1);}
 await scenario('Four confirmed aliases',[0,1,2,3].map(n=>old(n)),5,4);
 await scenario('Current UUID partial',[day(0),day(1)],5,2);
 await scenario('All current UUIDs complete today',[0,1,2,3,4].map(n=>day(n)),5,5);
 await scenario('Aliases and current fifth complete today',[old(0),old(1),old(2),old(3),day(4)],5,5);
 await scenario('Cycle completed yesterday resets to zero',[0,1,2,3,4].map(n=>day(n,1)),5,0);
 await scenario('Next cycle begins after completion',[...[0,1,2,3,4].map(n=>day(n,1)),day(0)],5,1);
 await scenario('Repeat starts incomplete cycle',[old(0,2),old(1,1),day(0)],5,1);
 await scenario('Unknown orphan cannot use matching name',[day(0,0,c.names[0],c.unknown)],5,0);
 await scenario('Malformed UUID cannot fall back by name',[day(0,0,c.names[0],'not-a-uuid')],5,0);
 await scenario('Unknown orphan does not alter sequence',[old(0,2),day(0,1,c.names[0],c.unknown),day(1)],5,2);
 await scenario('Foreign current UUID cannot use matching name',[day(0,0,c.names[0],c.foreignDay)],5,0);
 await scenario('Legacy absent UUID exact unique name',[{name:'  lunes / push  '}],5,1);
 await scenario('Legacy empty UUID exact unique name',[day(0,0,c.names[0],'')],5,1);
 await scenario('Legacy null UUID exact unique name',[day(0,0,c.names[0],null)],5,1);
 await scenario('Legacy unknown name',[{name:'PUSH fragment'}],5,0);
 try{await patchDay(c.days[1],{name:c.names[0]});await scenario('Homonymous current days remain separate UUIDs',[day(0),day(1)],5,2);await scenario('Homonymous days keep exact alias',[old(1),day(0)],5,2);await scenario('Ambiguous legacy does not choose first',[{name:c.names[0]}],5,0);}finally{await patchDay(c.days[1],{name:c.names[1]});}
 try{await patchDay(c.days[0],{name:'Renamed confirmed day'});await scenario('Rename keeps alias',[old(0)],5,1);await scenario('Current UUID beats historical name of another day',[day(0,0,c.names[1])],5,1);}finally{await patchDay(c.days[0],{name:c.names[0]});}
 try{for(let n=0;n<5;n++)await patchDay(c.days[n],{day_order:4-n});await scenario('Reorder preserves four aliases',[0,1,2,3].map(n=>old(n)),5,4);}finally{for(let n=0;n<5;n++)await patchDay(c.days[n],{day_order:n});}
 try{await ok('trainer','/rest/v1/routine_days?id=eq.'+c.days[0],undefined,'DELETE');await scenario('Alias with absent target is unresolved',[old(0)],4,0);}finally{await ok('trainer','/rest/v1/routine_days',{id:c.days[0],routine_id:c.routine,name:c.names[0],day_order:0});}
 try{await ok('trainer','/rest/v1/routine_days',{id:c.old[0],routine_id:c.routine,name:'Current UUID takes precedence',day_order:5});await scenario('Now-valid old UUID beats alias mapping',[old(0),day(0)],6,2);}finally{await ok('trainer','/rest/v1/routine_days?id=eq.'+c.old[0],undefined,'DELETE');}
 await history([old(0)],'otherClient');await check('Alias does not transfer to other user',5,0,'otherClient',c.users.otherClient.id);await check('Trainer sees other user isolated',5,0,'trainer',c.users.otherClient.id);
 await history([day(0)],'otherClient');await check('Other user current UUID unchanged',5,1,'otherClient',c.users.otherClient.id);
 await history([{id:c.old[0],name:'FOREIGN'}],'otherClient',c.foreign);await check('No alias in another routine',1,0,'otherClient',c.users.otherClient.id,c.foreign);
 for(const [label,who,client,routine] of [['Unassigned routine','client',c.users.client.id,c.foreign],['Foreign trainer','otherTrainer',c.users.client.id,c.routine],['Client reads another client','client',c.users.otherClient.id,c.routine],['Foreign trainer routine','trainer',c.users.otherClient.id,c.foreign],['Null client','trainer',null,c.routine],['Null routine','client',c.users.client.id,null]])await test(label,async()=>{const r=await rpc(who,client,routine);assert.equal(r.status,400);assert.equal(r.data.message,'Not authorized');});
 await test('Anonymous blocked',async()=>{const r=await rpc(null);assert.equal(r.status,401);assert.equal(r.data.code,'42501');});
 await test('Tampered JWT blocked',async()=>{const t=c.users.client.token.split('.');t[2]=(t[2][0]==='A'?'B':'A')+t[2].slice(1);const r=await req('client','/rest/v1/rpc/get_client_routine_cycle_progress',{p_client_id:c.users.client.id,p_routine_id:c.routine},'POST',t.join('.'));assert.equal(r.status,401);});
 await check('Owner can read own empty cycle',5,0,'trainer',c.users.trainer.id);
 try{await ok('trainer','/rest/v1/routine_assignments?id=eq.'+c.assignments[0],{client_deleted_at:new Date().toISOString()},'PATCH');for(const who of ['client','trainer'])await test('Revoked assignment / '+who,async()=>{const r=await rpc(who);assert.equal(r.status,400);assert.equal(r.data.message,'Not authorized');});}finally{await ok('trainer','/rest/v1/routine_assignments?id=eq.'+c.assignments[0],{client_deleted_at:null},'PATCH');}
 await history(realSequence());await both('Real sequence / aliases',5,4);
}
main().catch(e=>{console.error(e.message);report.fatal=e.message;save();process.exitCode=1}).finally(()=>fs.writeFileSync(dir+'/private/completed.json',JSON.stringify({action:process.argv[2],exitCode:process.exitCode||0})));
