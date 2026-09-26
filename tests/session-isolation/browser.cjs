// Real frontend in Chromium/WebKit; all records and requests are isolated mock data.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.SIMPLE_PREVIEW_URL||'http://127.0.0.1:4188/',results=[];
const out=path.resolve('tests/session-edit/results/isolation-browser.json');
(async()=>{
for(const engine of ['chromium','webkit']){
 const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 try{for(const width of [390,1280]){
  const p=await browser.newPage({viewport:{width,height:900}});p.setDefaultTimeout(5000);
  const test=async(name,fn)=>{try{await setup();await fn();results.push({engine,width,name,pass:true})}catch(e){results.push({engine,width,name,pass:false,error:e.message});console.error(name,e.message)}};
  async function setup(){
   await p.goto(base+'?role=trainer&state=history');await p.waitForFunction(()=>window.previewReady);
   await p.evaluate(()=>{
    window.a=mock.tables.routines[0].id;window.b=mock.tables.routines[1].id;window.client=mock.tables.profiles[2].id;
    for(const r of mock.tables.routines){r.deleted_at=null;r.description=null;}
    window.da=mock.tables.routine_days.find(d=>d.routine_id===a).id;window.dbid=mock.tables.routine_days.find(d=>d.routine_id===b).id;
    window.ea=mock.tables.routine_exercises.find(e=>e.day_id===da).id;window.eb=mock.tables.routine_exercises.find(e=>e.day_id===dbid).id;
    mock.tables.routine_exercises.find(e=>e.id===ea).name='Same name';mock.tables.routine_exercises.find(e=>e.id===eb).name='Same name';
    window.baseline=structuredClone(mock.tables);window.writes=[];window.messages=[];toast=m=>messages.push(m);
    window.readRpc=db.rpc;
    db.rpc=async(name,args)=>{
     if(name!=='save_routine_atomic')return readRpc(name,args);
     writes.push(structuredClone(args));
     for(const c of args.p_days.changes){const row=mock.tables.routine_exercises.find(e=>e.id===c.id);Object.assign(row,c.values);}
     return {data:args.p_routine_id,error:null};
    };
   });
  }
  const nameInput=()=>p.locator('#daysEditor input[onchange*="\'name\'"]').first();
  await test('Editing owned A changes only its exact exercise; assigned B stays byte-identical',async()=>{
   await p.evaluate(async()=>{await openLibraryRoutineEditor(a);openClientRoutineDayEditor(0)});
   await nameInput().fill('Only A');await p.evaluate(()=>saveClientRoutineEditor());
   assert.deepEqual(await p.evaluate(()=>writes.map(x=>({routine:x.p_routine_id,changes:x.p_days.changes}))),await p.evaluate(()=>[{routine:a,changes:[{entity:'exercise',id:ea,day_id:da,expected:{name:'Same name'},values:{name:'Only A'}}]}]));
   assert(await p.evaluate(()=>mock.tables.routine_exercises.every(e=>e.id===ea?e.name==='Only A':JSON.stringify(e)===JSON.stringify(baseline.routine_exercises.find(x=>x.id===e.id)))));
   await p.evaluate(async()=>{await openLibraryRoutineEditor(b);openClientRoutineDayEditor(0)});assert.equal(await nameInput().inputValue(),'Same name');
  });
  await test('Editing assigned B sends B IDs and preserves owned A and all histories/notes/assignments',async()=>{
   await p.evaluate(async()=>{await openRoutineEditor(b,{clientId:client,clientName:'Synthetic client'});openClientRoutineDayEditor(0)});
   await nameInput().fill('Only B');await p.evaluate(()=>saveClientRoutineEditor());
   assert(await p.evaluate(()=>writes.length===1&&writes[0].p_routine_id===b&&writes[0].p_days.changes[0].id===eb&&mock.tables.routine_exercises.find(e=>e.id===ea).name==='Same name'));
   for(const key of ['workouts','routine_user_notes','routine_assignments'])assert(await p.evaluate(k=>JSON.stringify(mock.tables[k])===JSON.stringify(baseline[k]),key));
  });
  await test('Event from the old editor cannot modify a different routine',async()=>{
   await p.evaluate(async()=>{await openLibraryRoutineEditor(a);openClientRoutineDayEditor(0);window.oldChange=document.querySelector('#daysEditor input').getAttribute('onchange');await openLibraryRoutineEditor(b);openClientRoutineDayEditor(0);window.beforeEdit=JSON.stringify(editDays);new Function(oldChange).call({value:'Wrong routine'});});
   assert(await p.evaluate(()=>JSON.stringify(editDays)===beforeEdit));await p.evaluate(()=>saveClientRoutineEditor());assert.equal(await p.evaluate(()=>writes.length),0);
  });
  await test('Late routine A load cannot replace editor B',async()=>{
   await p.evaluate(()=>{window.originalDays=days;days=rid=>rid===a?new Promise(resolve=>{window.releaseA=()=>originalDays(rid).then(resolve)}):originalDays(rid);window.pendingA=openLibraryRoutineEditor(a)});
   await p.waitForFunction(()=>!!window.releaseA);await p.evaluate(()=>openLibraryRoutineEditor(b));
   const before=await p.locator('#editor').innerHTML();await p.evaluate(async()=>{await releaseA();await pendingA;days=originalDays});
   assert.equal(await p.locator('#editor').innerHTML(),before);assert(await p.evaluate(()=>__clientRoutineEdit.routineId===b&&editDays.every(d=>baseline.routine_days.find(x=>x.id===d.id).routine_id===b)));
  });
  await test('Late save A cannot close or overwrite newly opened B',async()=>{
   await p.evaluate(async()=>{await openLibraryRoutineEditor(a);openClientRoutineDayEditor(0)});await nameInput().fill('Delayed A');
   await p.evaluate(()=>{const rpc=db.rpc;db.rpc=(name,args)=>name==='save_routine_atomic'?new Promise(resolve=>{window.releaseSave=()=>rpc(name,args).then(resolve)}):rpc(name,args);window.pendingSave=saveClientRoutineEditor()});
   await p.waitForFunction(()=>!!window.releaseSave);await p.evaluate(async()=>{await openLibraryRoutineEditor(b);openClientRoutineDayEditor(0)});
   await p.evaluate(async()=>{await releaseSave();await pendingSave});assert.equal(await nameInput().inputValue(),'Same name');assert(await p.locator('#editModal').isVisible());
   assert(await p.evaluate(()=>__clientRoutineEdit.routineId===b&&writes.length===1&&writes[0].p_routine_id===a&&mock.tables.routine_exercises.find(e=>e.id===eb).name==='Same name'));
  });
  await test('Wrong client/routine assignment does not open or save an editor',async()=>{
   await p.evaluate(()=>openRoutineEditor(a,{clientId:client}));assert.equal(await p.locator('#editModal').isVisible(),false);assert.equal(await p.evaluate(()=>writes.length),0);assert.match(await p.evaluate(()=>messages.join(' ')),/ya no está asignada/);
  });
  await p.close();
 }}finally{await browser.close()}
}
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({results},null,2));console.log(JSON.stringify({passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass)}));if(results.some(x=>!x.pass))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
