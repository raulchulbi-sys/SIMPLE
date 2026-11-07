'use strict';
// Call-entry spies, not a network filter. No SDK, credentials or external service.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const baseline=process.env.BASIC_READONLY_BASELINE==='1';
const read=p=>baseline?require('node:child_process').execFileSync('git',['show','8086008c9017a59e21d5464b27b1a9186ff0aa92:'+p],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,p),'utf8');
function fixture(flag=true){
 const calls=[],events={},host={append(){},insertAdjacentHTML(){}};
 const c={console,setTimeout,structuredClone,SUPABASE_URL:'https://dmqjexigdnfzobarhnib.supabase.co',user:{id:'owner-a'},profile:{role:'client'},assignments:[],routines:[],PremiumInitial:{},SimpleAppRuntime:Object.freeze({billingValidationReadOnly:flag}),
  addEventListener:(n,f)=>(events[n]??=[]).push(f),$:()=>host,document:{createElement:()=>({append(){},setAttribute(){},dataset:{}})},
  db:{auth:{onAuthStateChange(){}},from:()=>({select:async()=>({data:[],error:null})}),rpc:async name=>{calls.push(name);return{data:name==='premium_my_access'?{enabled:false}:{authorized:false,enabled:false},error:null};}}};
 c.window=c;c.globalThis=c;vm.createContext(c);vm.runInContext(read('assets/coach.js'),c);
 return{c,calls,events,run:(s)=>vm.runInContext(s,c)};
}
const forbidden=calls=>calls.filter(n=>n==='premium_initial_my_state');
test('home reproduces old defect / corrected profile never calls initial RPC',async()=>{const f=fixture();await f.c.renderCoachHome();assert.equal(forbidden(f.calls).length,baseline?1:0);assert.deepEqual(f.calls.filter(n=>n!=='premium_initial_my_state'),['get_my_coach_access','premium_my_access']);});
if(baseline){
 test('old initial entry also reaches a state load with readonly profile',async()=>{const f=fixture();let created=0,sessionReads=0;f.c.PremiumInitialAdapter={STAGING:f.c.SUPABASE_URL,create(){created++;throw Error('observed_entry');}};vm.runInContext(read('assets/coach-premium-initial.js'),f.c);await assert.rejects(f.c.PremiumInitial.open(),/observed_entry/);assert.equal(created,1);assert.equal(sessionReads,0);});
}else{
 for(const flag of[undefined,false,'true'])test('normal Premium initial remains independent of followup admission: '+String(flag),async()=>{const f=fixture(flag);if(flag===undefined)delete f.c.SimpleAppRuntime;await f.c.renderCoachHome();assert.equal(forbidden(f.calls).length,1);});
 for(const boundary of['routine_management','get_my_coach_access','premium_my_access'])test('late '+boundary+' response cannot start Premium in readonly profile',async()=>{
  const f=fixture();let release;const pending=new Promise(r=>release=r),original=f.c.db.rpc;
  if(boundary==='routine_management')f.c.db.from=()=>({select:()=>pending});else f.c.db.rpc=n=>n===boundary?(f.calls.push(n),pending):original(n);
  const running=f.c.renderCoachHome();await new Promise(setImmediate);release({data:boundary==='routine_management'?[]:{enabled:true,authorized:true},error:null});await running;assert.equal(forbidden(f.calls).length,0);
 });
 test('identity replacement during followup read cannot trigger initial state',async()=>{const f=fixture();let release;f.c.db.rpc=async n=>{f.calls.push(n);if(n==='premium_my_access')return new Promise(r=>release=r);return{data:{authorized:false}};};const running=f.c.renderCoachHome();await new Promise(setImmediate);f.c.user={id:'owner-b'};release({data:{enabled:true}});await running;assert.equal(forbidden(f.calls).length,0);});
 test('BFCache page lifecycle and repeated navigation preserve the restriction',async()=>{const f=fixture();await f.c.renderCoachHome();f.events.pagehide.forEach(x=>x({persisted:true}));await f.c.renderCoachHome();f.events.pageshow.forEach(x=>x({persisted:true}));await f.c.renderCoachHome();assert.equal(forbidden(f.calls).length,0);assert.equal(f.calls.filter(n=>n==='get_my_coach_access').length,2);});
 test('unmount during delayed read does not resume hidden page',async()=>{const f=fixture();let release;f.c.db.from=()=>({select:()=>new Promise(r=>release=r)});const p=f.c.renderCoachHome();f.events.pagehide.forEach(x=>x({persisted:true}));release({data:[]});await p;assert.equal(f.calls.length,0);});
 test('expired rights and denied capabilities never initiate Premium',async()=>{const f=fixture();f.c.db.rpc=async n=>{f.calls.push(n);return{error:{code:'PGRST301'}};};await f.c.renderCoachHome();assert.equal(forbidden(f.calls).length,0);});
 test('readonly initial open and mount stop before adapter creation or invocation',async()=>{const f=fixture();let constructed=0,invoked=0;f.c.PremiumInitialAdapter={STAGING:f.c.SUPABASE_URL,create(){constructed++;throw Error('unexpected');}};vm.runInContext(read('assets/coach-premium-initial.js'),f.c);await f.c.PremiumInitial.open();await f.c.PremiumInitial.open({reviewer:true});f.c.PremiumInitial.mount({owner:'owner-a',adapter(){invoked++;}});assert.equal(constructed,0);assert.equal(invoked,0);assert.equal(f.calls.length,0);});
 test('initial adapter refuses readonly load before any Auth or RPC call',async()=>{const f=fixture();let auth=0;f.c.db.auth={getSession:async()=>{auth++;return{data:{session:{user:{id:'owner-a'}}}};}};vm.runInContext(read('assets/coach-premium-initial-adapter.js'),f.c);const a=f.c.PremiumInitialAdapter.create(f.c.db,{projectUrl:f.c.SUPABASE_URL});await assert.rejects(a.load(),/premium_initial_not_authorized/);assert.equal(auth,0);assert.equal(f.calls.length,0);});
 test('adapter rechecks profile after delayed Auth before constructing RPC',async()=>{const f=fixture(false);let release;f.c.db.auth={getSession:()=>new Promise(r=>release=r)};vm.runInContext(read('assets/coach-premium-initial-adapter.js'),f.c);const a=f.c.PremiumInitialAdapter.create(f.c.db,{projectUrl:f.c.SUPABASE_URL}),p=a.load();f.c.SimpleAppRuntime=Object.freeze({billingValidationReadOnly:true});release({data:{session:{user:{id:'owner-a'}}}});await assert.rejects(p,/premium_initial_not_authorized/);assert.equal(f.calls.length,0);});
 test('normal initial adapter still requests actual state',async()=>{const f=fixture(false);f.c.db.auth={getSession:async()=>({data:{session:{user:{id:'owner-a'}}}})};vm.runInContext(read('assets/coach-premium-initial-adapter.js'),f.c);const a=f.c.PremiumInitialAdapter.create(f.c.db,{projectUrl:f.c.SUPABASE_URL});await a.load();assert.deepEqual(f.calls,['premium_initial_my_state']);});
 test('readonly followup entry never attaches Premium or its mutating chat loader',async()=>{const f=fixture();let attach=0;f.c.PremiumApp={attach(){attach++;}};await f.c.openPremiumCoach();assert.equal(attach,0);assert.equal(f.calls.length,0);});
 test('Basic entry remains a server-authorized read even when denied',async()=>{const f=fixture();f.run("coachShell=()=>{};coachCurrent=()=>true;");await f.c.openSimpleCoach();assert.deepEqual(f.calls,['get_my_coach_access']);});
}
