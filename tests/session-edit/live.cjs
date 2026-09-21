const fs=require('fs'),assert=require('assert/strict'),path=require('path');
const dir=__dirname,c=JSON.parse(fs.readFileSync(path.join(dir,'private/rest.json'))),i=c.ids;
assert.equal(c.ref,'dmqjexigdnfzobarhnib');
const url='https://'+c.ref+'.supabase.co',tokens={},results=[],evidence=[],network=[];
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
async function req(who,route,method='GET',body){const r=await fetch(url+route,{method,headers:{apikey:c.key,...(tokens[who]?{Authorization:'Bearer '+tokens[who]}:{}),'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await r.text();const data=text?JSON.parse(text):null;if(!r.ok)throw Error(JSON.stringify({status:r.status,data}));return data;}
const table=(who,name,filter='',method='GET',body)=>req(who,'/rest/v1/'+name+'?'+filter,method,body);
const rpc=(who,name,args)=>req(who,'/rest/v1/rpc/'+name,'POST',args);
async function test(name,fn){try{await fn();results.push({name,pass:true});console.log('PASS '+name)}catch(e){results.push({name,pass:false,error:e.message});console.log('FAIL '+name+' '+e.message.slice(0,800));}}
const exercises=()=>table('trainer','routine_exercises','day_id=eq.'+i.day+'&order=exercise_order');
const workout=(who='client')=>table(who,'workouts','id=eq.'+i.workout).then(rows=>rows[0]);
const sessionDisplay=process.argv.includes('--session-display');
const focused=process.argv.includes('--trainer-focused')||sessionDisplay;
async function trainerFocused(html,sdk){
 for(const engine of ['chromium','webkit'])for(const device of ['mobile','desktop']){
  const label=engine+' '+device,b=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
  const errors=[];let gate=null;
  try{
   async function page(){
    const p=await b.newPage({viewport:device==='mobile'?{width:390,height:844}:{width:1440,height:1000},hasTouch:device==='mobile'});
    p.setDefaultTimeout(15000);p.on('dialog',d=>d.accept());p.on('pageerror',e=>errors.push(e.message));
    await p.route('**/*',async route=>{
     const r=route.request(),u=r.url();
     if(u==='https://simple.test/')return route.fulfill({body:html,contentType:'text/html'});
     if(u.includes('cdn.jsdelivr'))return route.fulfill({body:sdk,contentType:'application/javascript'});
     if(!u.startsWith(url+'/'))return route.abort();
     const held=gate?.page===p&&gate.match(r)?gate:null;if(held)gate=null;
     const response=await route.fetch();
     if(u.includes('/rest/v1/')){const body=await response.text();network.push({label,method:r.method(),path:u.slice(url.length),...(r.method()==='POST'?{payload:r.postDataJSON()}:{}),status:response.status(),response:body?JSON.parse(body):null});}
     if(held){held.captured=true;held.response=await response.json();await held.wait;}
     return route.fulfill({response});
    });
    await p.goto('https://simple.test/');await p.getByRole('textbox',{name:'Correo electrónico',exact:true}).fill(c.users.trainer.email);await p.locator('input[type=password]').first().fill(c.users.trainer.password);await p.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await p.waitForFunction(()=>window.__simpleStarted&&!window.__simpleStartBusy);return p;
   }
   function hold(p,match){const g={page:p,match,captured:false};g.wait=new Promise(resolve=>g.release=resolve);gate=g;return g;}
   async function captured(g){const end=Date.now()+15000;while(!g.captured&&Date.now()<end)await new Promise(r=>setTimeout(r,30));assert(g.captured,'Expected real response was not captured');}
   async function open(p){
    const trainingClose=p.locator('#trainModalActions button').filter({hasText:'Cerrar'});if(await trainingClose.isVisible())await trainingClose.click();
    const close=p.locator('#editModal [data-routine-editor-context] button').filter({hasText:'Mis rutinas'});if(await close.isVisible())await close.click();
    // Use the same visible navigation as the trainer, including a different section on every re-entry.
    await p.locator('#tClients').click();await p.locator('#tMine').click();await p.evaluate(()=>renderMine());
    await p.locator('[data-open-routine="'+i.routine+'"]').click();await p.locator('#clientSessionList button').filter({hasText:'Editar sesión'}).first().click();
   }
   const input=(p,f)=>p.locator('#daysEditor input[onchange*="\''+f+'\'"]').first();
   const button=p=>p.locator('#clientRoutineEditor button').filter({hasText:'Guardar cambios'});
   async function save(p){await button(p).click();await p.waitForFunction(()=>!window.__routineSaving);}
   async function shown(p,row){for(const f of ['name','sets','target','rir','rest_seconds','notes'])assert.equal(await input(p,f).inputValue(),f==='rest_seconds'?String(row[f]/60):String(row[f]??''),label+' visible '+f);}
   async function reentry(p,row){await open(p);await shown(p,row);await p.reload();await p.waitForFunction(()=>window.__simpleStarted&&!window.__simpleStartBusy);await open(p);await shown(p,row);}
   const p=await page(),q=await page();
   if(sessionDisplay){
    async function session(p){
     const trainingClose=p.locator('#trainModalActions button').filter({hasText:'Cerrar'});if(await trainingClose.isVisible())await trainingClose.click();
     const editorClose=p.locator('#editModal [data-routine-editor-context] button').filter({hasText:'Mis rutinas'});if(await editorClose.isVisible())await editorClose.click();
     await p.locator('#tMine').click();await p.evaluate(()=>renderMine());await p.locator('[data-open-routine="'+i.routine+'"]').click();await p.locator('#clientSessionList .routine-day-train').first().click();await p.locator('#trainBody .workout-exercise').first().waitFor();
    }
    for(const [seconds,display]of [[210,'3:30'],[60,"1'"],[0,'-']])await test(label+' actual session displays saved rest '+seconds+' with preset exercise name, draft, reload and another navigation',async()=>{
     await open(p);const before=await exercises();const values={name:'Aperturas',sets:4,target:'4x17',rir:'3',rest_seconds:seconds};
     for(const [f,v]of Object.entries(values))await input(p,f).fill(String(f==='rest_seconds'?v/60:v));await save(p);
     const expected=structuredClone(before);Object.assign(expected[0],values);const after=await exercises();assert.deepEqual(after,expected);
     const check=async page=>{
      const card=page.locator('#trainBody .workout-exercise').first();assert.equal(await card.locator('.history-objective').innerText(),`Objetivo: 4x17 · 4 series · ${display} · RIR 3`);
      assert.equal(await card.locator('button.tick').count(),4);assert.equal(await page.evaluate(()=>activeWorkout.exercises[0].rest_seconds),seconds);
     };
     await session(p);await check(p);await p.screenshot({path:path.join(dir,'results/'+label.replaceAll(' ','-')+'-session-rest-'+seconds+'.png'),fullPage:true});
     await p.reload();await p.waitForFunction(()=>window.__simpleStarted&&!window.__simpleStartBusy);await session(p);await check(p);await session(q);await check(q);assert.deepEqual(await exercises(),expected);
     evidence.push({label,flow:'saved-rest-visible-in-session',before,after,expectedVisible:`Objetivo: 4x17 · 4 series · ${display} · RIR 3`});
    });
    await test(label+' session display no JavaScript errors',async()=>assert.deepEqual(errors,[]));
    continue;
   }
   await test(label+' trainer single existing sets: payload/result/database/reopen/reload',async()=>{
    await open(p);const before=await exercises(),n=before[0].sets===7?8:7,start=network.length;await input(p,'sets').fill(String(n));await save(p);
    const expected=structuredClone(before);expected[0].sets=n;const after=await exercises();assert.deepEqual(after,expected);
    const request=network.slice(start).find(x=>x.path==='/rest/v1/rpc/save_routine_atomic');assert(request);assert.equal(request.response,i.routine);assert.equal(request.status,200);assert.deepEqual(request.payload.p_days,{mode:'field_patch_v1',changes:[{entity:'exercise',id:before[0].id,day_id:i.day,expected:{sets:before[0].sets},values:{sets:n}}]});
    await reentry(p,after[0]);evidence.push({label,flow:'trainer-single-sets',before,after,request});
   });
   await test(label+' trainer multiple fields: exact values across independent navigation',async()=>{
    await open(p);const before=await exercises(),values={name:'Press '+label,sets:6,target:'6x13-17 '+label,rir:'3-4',rest_seconds:210,notes:'Nota inequívoca '+label};
    for(const [f,v]of Object.entries(values))await input(p,f).fill(String(f==='rest_seconds'?v/60:v));await save(p);
    const expected=structuredClone(before);Object.assign(expected[0],values);const after=await exercises();assert.deepEqual(after,expected);await reentry(p,after[0]);await open(q);await shown(q,after[0]);evidence.push({label,flow:'trainer-multiple-fields',before,after});
   });
   await test(label+' slow RPC plus double click writes exactly once; no early success',async()=>{
    await open(p);const before=await exercises(),value='Doble clic '+label,start=network.length;await input(p,'notes').fill(value);
    const g=hold(p,r=>r.url().endsWith('/rpc/save_routine_atomic'));try{
     await button(p).dblclick({force:true});await captured(g);assert(await p.evaluate(()=>window.__routineSaving));assert(await p.locator('#editModal').isVisible());assert(await button(p).isDisabled());
     const expected=structuredClone(before);expected[0].notes=value;assert.deepEqual(await exercises(),expected);await new Promise(r=>setTimeout(r,800));
     assert.equal(network.slice(start).filter(x=>x.path==='/rest/v1/rpc/save_routine_atomic').length,1);g.release();await p.waitForFunction(()=>!window.__routineSaving);assert.deepEqual(await exercises(),expected);await reentry(p,expected[0]);evidence.push({label,flow:'trainer-slow-double-click',before,after:expected});
    }finally{g.release()}
   });
   await test(label+' delayed verification cannot replace a newer server value or reopened view',async()=>{
    await open(p);await input(p,'notes').fill('Antigua '+label);const g=hold(p,r=>r.method()==='GET'&&r.url().includes('/rest/v1/routine_exercises?'));
    try{
     await button(p).click();await captured(g);const written=await exercises();assert.equal(written[0].notes,'Antigua '+label);assert(await p.locator('#editModal').isVisible());
     await open(q);await input(q,'notes').fill('Nueva '+label);await save(q);const newest=await exercises();assert.equal(newest[0].notes,'Nueva '+label);
     await p.evaluate(()=>closeM('editModal'));await open(p);await shown(p,newest[0]);g.release();await p.waitForFunction(()=>!window.__routineSaving);await shown(p,newest[0]);assert.deepEqual(await exercises(),newest);assert(await p.locator('#editModal').isVisible());await reentry(p,newest[0]);evidence.push({label,flow:'trainer-late-verification',oldRead:g.response,written,newest});
    }finally{g.release()}
   });
   await test(label+' concurrent stale same field rejected; all other columns preserved',async()=>{
    await open(p);await open(q);const before=await exercises();await input(p,'target').fill('6x19 '+label);await save(p);await input(q,'target').fill('6x21 stale');await save(q);
    const expected=structuredClone(before);expected[0].target='6x19 '+label;assert.deepEqual(await exercises(),expected);assert.match(await q.locator('#toast').innerText(),/cambió/);await reentry(q,expected[0]);
   });
   await test(label+' no-op leaves complete records unchanged and issues no write',async()=>{
    await open(p);const before=await exercises(),start=network.length;await save(p);assert.deepEqual(await exercises(),before);assert.equal(network.slice(start).filter(x=>x.method!=='GET').length,0);
   });
   await test(label+' no JavaScript errors',async()=>assert.deepEqual(errors,[]));
  }finally{if(gate)gate.release();await b.close()}
 }
}
async function main(){
for(const [who,u] of Object.entries(c.users)){const data=await req(null,'/auth/v1/token?grant_type=password','POST',{email:u.email,password:u.password});tokens[who]=data.access_token;assert.equal(data.user.id,u.id);}
let sdk=await(await fetch('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/dist/umd/supabase.js')).text();
const source=process.argv.slice(2).find(a=>!a.startsWith('--'))||'index.html',html=fs.readFileSync(source,'utf8').replace('https://yvguatdqncadkwewlepe.supabase.co',url).replace('sb_publishable_VYoUECN0MaGIOC2LtGi0iw_C0wqUY-W',c.key);
if(focused)return trainerFocused(html,sdk);
await test('Frontend antiguo: payload completo sin versión se rechaza sin cambios',async()=>{
 const before=await exercises(),days=await table('trainer','routine_days','routine_id=eq.'+i.routine);
 const payload=days.map(d=>({...d,exercises:before.map(e=>({...e,rir:'9'}))}));
 await assert.rejects(rpc('trainer','save_routine_atomic',{p_routine_id:i.routine,p_name:'stale',p_description:'stale',p_days:payload}),/Actualiza SIMPLE/);
 assert.deepEqual(await exercises(),before);
});
for(const engine of ['chromium','webkit']){
 const b=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 try{
 async function page(who){const p=await b.newPage({viewport:{width:390,height:844},hasTouch:true});p.setDefaultTimeout(15000);p.on('dialog',d=>d.accept());
  p.on('pageerror',e=>results.push({name:engine+' JavaScript error',pass:false,error:e.message}));
  p.on('request',r=>{if(r.url().startsWith(url+'/rest/v1/')&&r.method()!=='GET')network.push({engine,who,method:r.method(),path:r.url().slice(url.length),payload:r.postDataJSON()})});
  await p.route('**/*',async r=>{const u=r.request().url();if(u==='https://simple.test/')return r.fulfill({body:html,contentType:'text/html'});if(u.includes('cdn.jsdelivr'))return r.fulfill({body:sdk,contentType:'application/javascript'});if(u.startsWith(url+'/'))return r.fetch().then(response=>r.fulfill({response}));return r.abort()});
  await p.goto('https://simple.test/');await p.getByRole('textbox',{name:'Correo electrónico',exact:true}).fill(c.users[who].email);await p.locator('input[type=password]').first().fill(c.users[who].password);await p.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await p.waitForFunction(()=>window.__simpleStarted&&!window.__simpleStartBusy);return p;
 }
 const p=await page('trainer');
 const open=async(q=p)=>{await q.evaluate(async()=>{closeM('trainModal');closeM('editModal');view('mine');await renderMine()});await q.locator('[data-open-routine="'+i.routine+'"]').click();await q.locator('#clientSessionList button').filter({hasText:'Editar sesión'}).first().click();};
 const input=(field,q=p)=>q.locator('#daysEditor input[onchange*="\''+field+'\'"]').first();
 const save=async(q=p)=>{await q.locator('#clientRoutineEditor button').filter({hasText:'Guardar cambios'}).tap();await q.waitForFunction(()=>!window.__routineSaving);};
 await table('trainer','routine_exercises','id=eq.'+i.second,'PATCH',{target:null,notes:'',rir:'0',rest_seconds:0});
 for(const [field,value,ui]of [['rir','3','3'],['rest_seconds',180,'3'],['target','2x11','2x11'],['notes','Nota A','Nota A']]){
  await test(engine+' planificación solo '+field+' / lectura completa / reapertura / recarga',async()=>{
   await open();const before=await exercises();const prior=before[0];const next=value===prior[field]?(field==='rest_seconds'?240:String(value)+'x'):value;
   const display=field==='rest_seconds'?String(next/60):String(next);await input(field).fill(display);await save();
   const after=await exercises(),expected=structuredClone(before);expected[0][field]=next;assert.deepEqual(after,expected);evidence.push({engine,flow:'routine',field,before,after});
   await open();assert.equal(await input(field).inputValue(),display);await p.reload();await p.waitForFunction(()=>window.__simpleStarted&&!window.__simpleStartBusy);await open();assert.equal(await input(field).inputValue(),display);
  });
 }
 await test(engine+' planificación guardar sin cambios conserva todas las columnas',async()=>{await open();const before=await exercises();await save();assert.deepEqual(await exercises(),before)});
 await test(engine+' reordenar y editar conserva null/vacío/timestamps/otro ejercicio',async()=>{
  await open();await p.locator('#clientRoutineEditor button').filter({hasText:'Reordenar ejercicios'}).click();
  await p.evaluate(()=>moveEditorExercise(0,0,0,2));await p.waitForFunction(()=>!__editorOrderSaving);
  await p.locator('#clientRoutineEditor button').filter({hasText:'Listo'}).click();const before=await exercises();await input('rir').fill('4');await save();const expected=structuredClone(before);expected[0].rir='4';const after=await exercises();assert.deepEqual(after,expected);evidence.push({engine,flow:'reorder_then_edit',before,after});
 });
 const p2=await page('trainer');
 await test(engine+' dos pestañas: mismo campo obsoleto se rechaza',async()=>{
  await open();await open(p2);const before=await exercises();await input('rir').fill('5');await save();await input('rir',p2).fill('6');await save(p2);const expected=structuredClone(before);expected[0].rir='5';assert.deepEqual(await exercises(),expected);assert.match(await p2.locator('#toast').innerText(),/cambió/);
 });
 await test(engine+' dos pestañas: campos distintos se combinan sin perder ninguno',async()=>{
  await open();await open(p2);const before=await exercises();await input('rir').fill('7');await save();await input('notes',p2).fill('nota concurrente');await save(p2);const expected=structuredClone(before);expected[0].rir='7';expected[0].notes='nota concurrente';assert.deepEqual(await exercises(),expected);
 });
 await test(engine+' estructura obsoleta se rechaza sin crear ni sobrescribir',async()=>{
  await open();await open(p2);const before=await exercises();await input('rir').fill('8');await save();await p2.locator('#daysEditor button').filter({hasText:'Añadir ejercicio'}).click();await save(p2);const expected=structuredClone(before);expected[0].rir='8';assert.deepEqual(await exercises(),expected);assert.match(await p2.locator('#toast').innerText(),/cambió/);
 });
 await test(engine+' añadir/eliminar conserva íntegros los ejercicios existentes',async()=>{
  await open();const before=await exercises();assert.equal(before.length,2);await p.locator('#daysEditor button').filter({hasText:'Añadir ejercicio'}).click();
  for(const [field,value]of [['name','Press'],['sets','4'],['target',''],['rir','0'],['rest_seconds','0'],['notes','']])await p.locator('#daysEditor input[onchange*="\''+field+'\'"]').last().fill(value);
  await save();let after=await exercises();assert.equal(after.length,3);assert.deepEqual(after.slice(0,2),before);
  const added=after[2];assert(added.id&&!before.some(e=>e.id===added.id));assert.equal(added.sets,4);assert.equal(added.rir,'0');assert.equal(added.rest_seconds,0);assert.equal(added.target,'');assert.equal(added.notes,'');
  evidence.push({engine,flow:'add',before,after});
  await open();assert.equal(await p.locator('#daysEditor input[onchange*="\'sets\'"]').last().inputValue(),'4');
  await p.reload();await p.waitForFunction(()=>window.__simpleStarted&&!window.__simpleStartBusy);await open();assert.deepEqual(await exercises(),after);assert.equal(await p.locator('#daysEditor input[onchange*="\'rir\'"]').last().inputValue(),'0');
  await p.locator('#daysEditor button').filter({hasText:'Eliminar ejercicio'}).last().click();await save();assert.deepEqual(await exercises(),before);evidence.push({engine,flow:'remove',before:after,after:before});
  await open();assert.equal(await p.locator('#daysEditor .routine-editor-exercise').count(),2);await p.reload();await p.waitForFunction(()=>window.__simpleStarted&&!window.__simpleStartBusy);await open();assert.equal(await p.locator('#daysEditor .routine-editor-exercise').count(),2);assert.deepEqual(await exercises(),before);
 });
 await p2.close();
 const data={routine_id:i.routine,routine_day_id:i.day,workout_date:'2026-01-01',started_at:'2026-01-01T10:00:00Z',completed_at:'2026-01-01T10:42:00Z',duration_seconds:2520,custom:{keep:true},exercises:[{exercise_id:i.exercise,id:i.exercise,name:'Press',target:null,planned_rir:'1-2',rest_minutes:2,notes:null,sets:[{set:1,kg:20,reps:8,rir:null,done:true,custom:'keep'},{set:2,kg:null,reps:'',rir:0,done:false}]},{exercise_id:i.second,name:'Press',target:'3x15',planned_rir:0,rest_minutes:0,notes:'',sets:[{set:1,kg:90,reps:15,rir:'4',done:false}]}]};
 const existing=await workout();if(existing)await table('client','workouts','id=eq.'+i.workout,'PATCH',{data});else await table('client','workouts','','POST',{id:i.workout,user_id:c.users.client.id,variant:'SIMPLE',day:'test27',workout_date:'2026-01-01',data});
 const client=await page('client');
 async function history(q,who){await q.evaluate(async({id,rid,clientId,who})=>{closeM('editModal');closeM('trainModal');workoutRoutine={id:rid};const r=who==='trainer'?await db.rpc('get_client_routine_history',{p_client_id:clientId,p_routine_id:rid}):await db.from('workouts').select('id,user_id,variant,day,workout_date,data').eq('id',id);if(r.error)throw r.error;window.workoutHistory=r.data;openM('trainModal');showHistory();await editWorkout(id);},{id:i.workout,rid:i.routine,clientId:c.users.client.id,who});}
 const hinput=(q,field)=>q.locator('[data-edit-ex-id="'+i.exercise+'"][data-edit-field="'+field+'"]').first();
 const hsave=async q=>{await q.locator('#trainBody button').filter({hasText:'Guardar cambios'}).tap();await q.waitForFunction(()=>!window.__savingEditedWorkout)};
 for(const [who,q]of [['client',client],['trainer',p]]){
 for(const [field,value]of [['rir','2'],['rest_minutes','3'],['kg','27.5'],['reps','11'],['notes','Notas históricas'],['two','two']])await test(engine+' histórico '+who+' solo '+field+' / SQL vía REST / reapertura / recarga',async()=>{
  await history(q,who);const before=await workout(),expected=structuredClone(before);const ex=expected.data.exercises[0];
  if(field==='notes'){const v=String(ex.notes||'')+' edit';await q.locator('.history-edit-note').first().fill(v);ex.notes=v;}
  else if(field==='two'){await hinput(q,'kg').fill('31');await hinput(q,'reps').fill('9');ex.sets[0].kg='31';ex.sets[0].reps='9';}
  else{const old=field==='rest_minutes'?ex[field]:ex.sets[0][field],v=String(old)===value?String(Number(value)+1):value;await hinput(q,field).fill(v);if(field==='rest_minutes')ex[field]=Number(v);else ex.sets[0][field]=v;}
  await hsave(q);const after=await workout();assert.deepEqual(after,expected);evidence.push({engine,flow:'history',who,field,before,after});
  assert.deepEqual(await q.evaluate(id=>workoutHistory.find(w=>w.id===id).data,i.workout),after.data);
  await history(q,who);assert.deepEqual(await q.evaluate(()=>__workoutEditSnapshot.data),after.data);
  await q.reload();await q.waitForFunction(()=>window.__simpleStarted&&!window.__simpleStartBusy);await history(q,who);assert.deepEqual(await q.evaluate(()=>__workoutEditSnapshot.data),after.data);
 });
 await test(engine+' histórico '+who+' sin cambios no escribe',async()=>{await history(q,who);const before=await workout();await hsave(q);assert.deepEqual(await workout(),before)});
 }
 await test(engine+' histórico dos pestañas obsoletas no sobrescriben',async()=>{await history(client,'client');await history(p,'trainer');const before=await workout();await hinput(client,'rir').fill('8');await hsave(client);await hinput(p,'rir').fill('9');await hsave(p);const expected=structuredClone(before);expected.data.exercises[0].sets[0].rir='8';assert.deepEqual(await workout(),expected);assert.match(await p.locator('#toast').innerText(),/cambió/);});
 await test(engine+' duración y cronómetro se conservan al editar',async()=>{const row=await workout();assert.equal(row.data.duration_seconds,2520);assert.equal(row.data.started_at,data.started_at);assert.equal(row.data.completed_at,data.completed_at);});
 await test(engine+' entrenamiento: mirar/escribir/descanso no inician; tick y recarga conservan inicio',async()=>{
  await client.evaluate(async({rid,did})=>{closeM('trainModal');await openSharedRoutine(rid);await startWorkoutDay(did)}, {rid:i.routine,did:i.day});
  await client.locator('.setrow input').first().fill('20');await client.evaluate(()=>startRestTimer(120));assert.equal(await client.evaluate(()=>!!activeWorkout.startedAt),false);
  await client.locator('button.tick').first().click();const started=await client.evaluate(()=>activeWorkout.startedAt);assert(started);await client.reload();await client.waitForFunction(()=>window.__simpleStarted&&!window.__simpleStartBusy);await client.evaluate(async({rid,did})=>{await openSharedRoutine(rid);await startWorkoutDay(did)},{rid:i.routine,did:i.day});assert.equal(await client.evaluate(()=>activeWorkout.startedAt),started);
  await client.locator('#saveWorkoutBtn').click();await client.waitForFunction(()=>!window.__savingWorkout&&activeWorkout===null);const rows=await table('client','workouts','user_id=eq.'+c.users.client.id+'&data->>routine_id=eq.'+i.routine);const saved=rows.find(w=>w.id!==i.workout);assert(saved);assert.equal(saved.data.started_at,started);assert.equal(saved.data.duration_seconds,Math.floor((Date.parse(saved.data.completed_at)-Date.parse(started))/1000));await rpc('client','delete_my_workout',{p_workout_id:saved.id});
 });
 await p.close();await client.close();
 }finally{await b.close()}
}
}
main().catch(e=>{results.push({name:'runner',pass:false,error:e.message});console.error(e.message)}).finally(async()=>{
for(const who of Object.keys(tokens))await req(who,'/auth/v1/logout?scope=global','POST').catch(()=>{});
const prefix=sessionDisplay?'session-display-':focused?'trainer-focused-':'';
fs.writeFileSync(path.join(dir,'results/'+prefix+'live.json'),JSON.stringify({project:c.ref,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass),results},null,2));fs.writeFileSync(path.join(dir,'results/'+prefix+'before-after.json'),JSON.stringify(evidence,null,2));fs.writeFileSync(path.join(dir,'results/'+prefix+'requests.json'),JSON.stringify(network,null,2));if(results.some(x=>!x.pass))process.exitCode=1;
});
