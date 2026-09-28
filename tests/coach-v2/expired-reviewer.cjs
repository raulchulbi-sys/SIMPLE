// Focused synthetic browser regression for interrupted/expired reservations.
// No JWT, Supabase or provider calls. Backend authorization has separate SQL/JWT tests.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.join(__dirname,'results'),rows=[];fs.mkdirSync(out,{recursive:true});
function check(name,pass){rows.push({name,pass:!!pass});assert(pass,name);}
(async()=>{for(const engine of ['chromium','webkit']){
 const b=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})}),p=await b.newPage({viewport:{width:390,height:844}});const errors=[],remote=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4196/'))remote.push(r.url());});
 try{
 await p.goto('http://127.0.0.1:4196/demo');await p.waitForFunction(()=>window.previewReady);
 await p.evaluate(()=>{const intake={id:crypto.randomUUID(),user_id:demoUser,revision:1,row_version:1,state:'submitted',training:{goal:'Fuerza general',experience:'beginner',days:3,minutes:60,equipment:['Gimnasio'],preferred:'',avoided:'',preferences:''}};mock.tables.training_intakes=[intake];mock.tables.coach_operations=[{id:crypto.randomUUID(),user_id:demoUser,intake_id:intake.id,state:'reserved',expires_at:new Date(Date.now()+300000).toISOString(),proposal:null}];pilotDemoReviewer=true;return openCoachReviewer();});
 await p.getByRole('heading',{name:'Preparándose',exact:true}).waitFor();
 check(engine+' unexpired reservation cannot request retry',await p.getByRole('button',{name:'Autorizar un nuevo intento',exact:true}).count()===0);
 await p.evaluate(()=>{mock.tables.coach_operations[0].expires_at=new Date(Date.now()-1000).toISOString();return openCoachReviewer();});
 await p.getByRole('heading',{name:'Generación interrumpida',exact:true}).waitFor();
 check(engine+' expired reservation offers explicit retry without changing state',await p.getByRole('button',{name:'Autorizar un nuevo intento',exact:true}).isVisible()&&await p.evaluate(()=>mock.tables.coach_operations[0].state==='reserved'&&coachDemo.invokeCalls.length===0));
 await p.getByRole('button',{name:'Autorizar un nuevo intento',exact:true}).click();
 check(engine+' empty reason makes no request',await p.evaluate(()=>coachDemo.rpcCalls.filter(x=>x.name==='authorize_coach_retry').length===0));
 await p.locator('#coachQueue textarea').fill('Intento interrumpido y caducado: autorizo un único nuevo intento.');await p.evaluate(()=>coachDemo.delays.authorize_coach_retry=400);
 await p.getByRole('button',{name:'Autorizar un nuevo intento',exact:true}).evaluate(x=>{x.click();x.click();});
 await p.getByRole('heading',{name:'Generación bloqueada o fallida',exact:true}).waitFor();
 check(engine+' double press sends exactly one retry authorization with reason',await p.evaluate(()=>{const calls=coachDemo.rpcCalls.filter(x=>x.name==='authorize_coach_retry');return calls.length===1&&calls[0].args.p_reason==='Intento interrumpido y caducado: autorizo un único nuevo intento.';}));
 check(engine+' server state reflected without dispatch or duplicate operation',await p.evaluate(()=>mock.tables.coach_operations.length===1&&mock.tables.coach_operations[0].state==='failed'&&!!mock.tables.coach_operations[0].retry_authorized_at&&coachDemo.invokeCalls.length===0)&&await p.getByRole('button',{name:'Autorizar un nuevo intento',exact:true}).count()===0);
 await p.evaluate(()=>openCoachReviewer());check(engine+' reviewer reload does not reauthorize or generate',await p.evaluate(()=>coachDemo.rpcCalls.filter(x=>x.name==='authorize_coach_retry').length===1&&coachDemo.invokeCalls.length===0));
 check(engine+' no runtime errors or remote traffic',errors.length===0&&remote.length===0);
 }finally{await b.close();fs.writeFileSync(path.join(out,'expired-reviewer.json'),JSON.stringify({kind:'synthetic-browser-delta',checks:rows.length,passed:rows.filter(x=>x.pass).length,rows},null,2));}
 }console.log('Expired reviewer UI delta: '+rows.length+'/'+rows.length+' passed.');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
