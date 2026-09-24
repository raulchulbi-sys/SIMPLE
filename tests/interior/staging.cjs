// Authenticated UI + direct PostgREST readback. Only freshly manifested staging identities.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),config=JSON.parse(fs.readFileSync(path.join(__dirname,'private/fixture.json')));
assert.equal(config.ref,'dmqjexigdnfzobarhnib');
const api='https://'+config.ref+'.supabase.co',out=path.join(__dirname,'results'),tokens={},results=[],requests=[];
if(process.argv.includes('--resume')&&fs.existsSync(path.join(out,'staging.json'))){const prior=JSON.parse(fs.readFileSync(path.join(out,'staging.json')));results.push(...prior.results.filter(r=>r.pass));requests.push(...prior.requests);}
const sdk=fs.readFileSync(path.join(root,'tests/onboarding/private/supabase-2.115.0.js'));
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const write=()=>fs.writeFileSync(path.join(out,'staging.json'),JSON.stringify({results,requests,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass)},null,2));
function manifest(table,rows){config.created[table]||=[];for(const row of rows)if(!config.created[table].includes(row.id))config.created[table].push(row.id);fs.writeFileSync(path.join(__dirname,'private/fixture.json'),JSON.stringify(config,null,2));fs.writeFileSync(path.join(out,'staging-manifest.json'),JSON.stringify({ref:config.ref,users:Object.values(config.users).map(({id,role})=>({id,role})),created:config.created},null,2));}
async function req(role,route,method='GET',body){const response=await fetch(api+route,{method,headers:{apikey:config.key,...(tokens[role]?{Authorization:'Bearer '+tokens[role]}:{}),'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.text();if(!response.ok)throw Error(response.status+' '+data);return data?JSON.parse(data):null;}
const table=(role,name,filter='',method='GET',body)=>req(role,'/rest/v1/'+name+'?'+filter,method,body);
async function test(name,fn){if(results.some(r=>r.name===name&&r.pass)){console.log('RETAIN '+name);return;}try{await fn();results.push({name,pass:true});console.log('PASS '+name)}catch(e){results.push({name,pass:false,error:e.message});console.log('FAIL '+name+' '+e.message.slice(0,300));write();throw e;}write();}
const clean=row=>Object.fromEntries(Object.entries(row).filter(([key])=>key!=='updated_at'));
(async()=>{
 for(const role of ['trainer','client']){const r=await req(role,'/auth/v1/token?grant_type=password','POST',{email:config.users[role].email,password:config.users[role].password});tokens[role]=r.access_token;}
 if(process.argv.includes('--trash-matrix')){for(const id of config.created.routines)await table('trainer','routines','id=eq.'+id+'&owner_id=eq.'+config.users.trainer.id,'PATCH',{deleted_at:null});for(const id of config.created.assignments)await table('client','routine_assignments','id=eq.'+id+'&client_id=eq.'+config.users.client.id,'PATCH',{client_deleted_at:null});}
 for(const engine of ['chromium','webkit']){
  if(process.argv.includes('--trash-matrix')&&engine==='webkit')continue;
  if(!process.argv.includes('--trash-matrix')&&results.filter(r=>r.pass&&r.name.startsWith(engine+' ')).length>=6){console.log('RETAIN '+engine+' completed staging flow');continue;}
  const b=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
  try{
   const pages=[];let failures=false;
   async function page(role,width){const p=await b.newPage({viewport:{width,height:900},hasTouch:width<700});pages.push(p);p.setDefaultTimeout(15000);p.on('dialog',d=>d.accept());
    await p.route('**/*',async r=>{const u=new URL(r.request().url());
     if(u.origin==='https://simple.test'){
      const target=path.join(root,u.pathname==='/'?'index.html':u.pathname.slice(1));
      if(!target.startsWith(root+path.sep)||!fs.existsSync(target))return r.fulfill({status:404});
      let body=fs.readFileSync(target);if(u.pathname==='/')body=body.toString().replaceAll('yvguatdqncadkwewlepe',config.ref).replace('sb_publishable_VYoUECN0MaGIOC2LtGi0iw_C0wqUY-W',config.key);
      return r.fulfill({body,contentType:target.endsWith('.css')?'text/css':target.endsWith('.js')?'application/javascript':target.endsWith('.webp')?'image/webp':'text/html'});
     }
     if(u.hostname==='cdn.jsdelivr.net')return r.fulfill({body:sdk,contentType:'application/javascript'});
     if(!r.request().url().startsWith(api+'/'))return r.abort();
     if(failures&&r.request().method()!=='GET'&&u.pathname.startsWith('/rest/'))return r.fulfill({status:503,body:'{"message":"Synthetic outage"}',contentType:'application/json'});
     const response=await r.fetch();
     if(u.pathname.startsWith('/rest/')){const text=await response.text();requests.push({engine,role,path:u.pathname,method:r.request().method(),payload:r.request().postDataJSON(),status:response.status(),response:text?JSON.parse(text):null});}
     return r.fulfill({response});
    });
    await p.goto('https://simple.test/');await p.waitForFunction(()=>!simpleAuth.busy);await p.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await p.locator('#email').fill(config.users[role].email);await p.locator('#password').fill(config.users[role].password);await p.locator('#authBtn').click();await p.waitForFunction(()=>window.__simpleStarted&&!simpleAuth.busy);return p;
   }
   const p=await page('trainer',390);let rid,days,ex;
   if(process.argv.includes('--resume')){const existing=await table('trainer','routines','owner_id=eq.'+config.users.trainer.id+'&name=eq.'+encodeURIComponent('SIMPLE interior '+engine));if(existing.length){rid=existing[0].id;days=await table('trainer','routine_days','routine_id=eq.'+rid+'&order=day_order');ex=await table('trainer','routine_exercises','day_id=eq.'+days[0].id+'&order=exercise_order');await p.locator('#tMine').click();await p.locator('[data-open-routine="'+rid+'"]').click();await p.locator('#clientSessionList').getByText('Editar sesión',{exact:true}).click();}}
   await test(engine+' create routine: entered values = payload = persisted rows = reopened fields',async()=>{
    await p.locator('#tNew').click();await p.locator('#rn').fill('SIMPLE interior '+engine);await p.locator('#rd').fill('Synthetic only · descripción 731');
    await p.getByRole('button',{name:'Añadir día',exact:true}).click();await p.locator('#newDays .dayhead input').fill('Día sintético 731');await p.locator('#rn').focus();
    for(let n=0;n<12;n++){
     await p.getByRole('button',{name:'Añadir ejercicio',exact:true}).click();const inputs=p.locator('#newDays .exercise').nth(n).locator('input');
     for(const [k,v] of ['Ejercicio '+n,3,n===0?0:2.5,'objetivo '+n+' · 9–13',n===0?'0':'2','Nota '+n].entries())await inputs.nth(k).fill(String(v));
     await p.locator('#rn').focus();
    }
    await p.getByRole('button',{name:'Guardar rutina',exact:true}).click();await p.waitForFunction(()=>!window.__routineSaving);
    const rows=await table('trainer','routines','owner_id=eq.'+config.users.trainer.id+'&name=eq.'+encodeURIComponent('SIMPLE interior '+engine));assert.equal(rows.length,1);rid=rows[0].id;manifest('routines',rows);
    days=await table('trainer','routine_days','routine_id=eq.'+rid+'&order=day_order');manifest('days',days);assert.equal(days.length,1);
    ex=await table('trainer','routine_exercises','day_id=eq.'+days[0].id+'&order=exercise_order');manifest('exercises',ex);assert.equal(ex.length,12);
    const save=requests.findLast(r=>r.path.endsWith('/create_routine_atomic'));assert.equal(save.status,200);assert.equal(save.payload.p_days[0].exercises[0].target,'objetivo 0 · 9–13');
    for(let n=0;n<12;n++){assert.equal(ex[n].name,'Ejercicio '+n);assert.equal(ex[n].target,'objetivo '+n+' · 9–13');assert.equal(ex[n].sets,3);assert.equal(ex[n].notes,'Nota '+n);assert.equal(ex[n].rest_seconds,n===0?0:150);}
    await p.locator('#tMine').click();await p.locator('[data-open-routine="'+rid+'"]').click();await p.locator('#clientSessionList').getByText('Editar sesión',{exact:true}).click();assert.equal(await p.locator('#daysEditor input[onchange*="target"]').first().inputValue(),'objetivo 0 · 9–13');
   });
   const open=async()=>{await p.reload();await p.waitForFunction(()=>window.__simpleStarted);await p.locator('#tMine').click();await p.locator('[data-open-routine="'+rid+'"]').click();await p.locator('#clientSessionList').getByText('Editar sesión',{exact:true}).click();};
   const fields=f=>p.locator('#daysEditor input[onchange*="\''+f+'\'"]');
   const save=async()=>{await p.locator('#clientRoutineEditor').getByRole('button',{name:'Guardar cambios',exact:true}).click();await p.waitForFunction(()=>!window.__routineSaving);};
   await test(engine+' edit one field; zero rest/RIR, UUID and all other exercises preserved after reload',async()=>{
    const before=structuredClone(ex);await fields('target').first().fill('6x17 · exacto 943');await save();ex=await table('trainer','routine_exercises','day_id=eq.'+days[0].id+'&order=exercise_order');const expected=structuredClone(before);expected[0].target='6x17 · exacto 943';assert.deepEqual(ex.map(clean),expected.map(clean));await open();assert.equal(await fields('target').first().inputValue(),expected[0].target);assert.equal(await fields('rest_seconds').first().inputValue(),'0');
   });
   await test(engine+' long exercise list reorder: same UUID/fields, exact database order and reopen',async()=>{
    const before=structuredClone(ex);await p.getByRole('button',{name:/Reordenar ejercicios/}).click();
    // Exercise the real pointer controller across a long scrolling list.
    const handles=p.locator('#exerciseReorderList .editor-drag-handle');await handles.first().scrollIntoViewIfNeeded();const from=await handles.first().boundingBox(),to=await handles.nth(2).boundingBox();assert(from&&to);await p.mouse.move(from.x+from.width/2,from.y+from.height/2);await p.mouse.down();await p.mouse.move(to.x+to.width/2,to.y+to.height-2,{steps:18});await p.mouse.up();
    const order=await p.evaluate(()=>editDays[0].exercises.map(e=>e.id));assert.notDeepEqual(order,before.map(e=>e.id),'Drag must change order');
    await p.waitForFunction(()=>!__editorOrderSaving);await p.getByRole('button',{name:/Listo/}).click();await save();ex=await table('trainer','routine_exercises','day_id=eq.'+days[0].id+'&order=exercise_order');assert.deepEqual(ex.map(e=>e.id),order);for(const e of ex){const old=before.find(x=>x.id===e.id);assert.deepEqual(clean({...e,exercise_order:old.exercise_order}),clean(old));}await open();assert.deepEqual(await p.evaluate(()=>editDays[0].exercises.map(e=>e.id)),order);
   });
   let assignment=await table('trainer','routine_assignments','client_id=eq.'+config.users.client.id+'&trainer_routine_id=eq.'+rid);
   if(!assignment.length){const shared=await req('trainer','/rest/v1/rpc/create_routine_share_code','POST',{p_routine_id:rid,p_max_uses:1,p_expires_at:null});const share=Array.isArray(shared)?shared[0]:shared;await req('client','/rest/v1/rpc/redeem_routine_share_code','POST',{p_code:share.code||share});assignment=await table('trainer','routine_assignments','client_id=eq.'+config.users.client.id+'&trainer_routine_id=eq.'+rid);manifest('share_codes',await table('trainer','routine_share_codes','routine_id=eq.'+rid));}
   manifest('assignments',assignment);
   const c=await page('client',1280);
   await test(engine+' workout: notes, first check starts duration, stable timer close and one static save; persisted history',async()=>{
    await c.locator('#shared .routine').filter({hasText:'SIMPLE interior '+engine}).getByRole('button',{name:'Abrir',exact:true}).click();await c.locator('.interior-session-list button').first().click();await c.locator('.setrow').first().waitFor();assert.equal(await c.evaluate(()=>activeWorkout.startedAt||null),null);
    const card=c.locator('.workout-exercise').first();const inputs=card.locator('.setrow:has(input)').first().locator('input');for(const [n,value] of ['37.5','11','0'].entries())await inputs.nth(n).fill(value);await card.locator('textarea').fill('Nota sintética persistida 492');await card.locator('textarea').blur();assert.equal(await c.evaluate(()=>activeWorkout.startedAt||null),null);
    await card.locator('.tick').first().click();assert(await c.evaluate(()=>Boolean(activeWorkout.startedAt)));await card.locator('.rest-buttons button').first().click();await c.evaluate(()=>window.testCloseNode=document.querySelector('[data-action="rest-close"]'));await c.waitForTimeout(1200);assert(await c.evaluate(()=>window.testCloseNode===document.querySelector('[data-action="rest-close"]')));await c.getByRole('button',{name:'Cerrar temporizador'}).click();
    assert.equal(await c.locator('#saveWorkoutBtn').count(),1);assert.equal(await c.locator('#saveWorkoutBtn').evaluate(e=>getComputedStyle(e).position),'static');await c.locator('#saveWorkoutBtn').click();await c.waitForFunction(()=>!window.__savingWorkout&&activeWorkout===null);
    const rows=await table('client','workouts','user_id=eq.'+config.users.client.id);manifest('workouts',rows);const w=rows.find(w=>w.data.routine_id===rid);assert(w);assert.equal(Number(w.data.exercises[0].sets[0].kg),37.5);assert.equal(Number(w.data.exercises[0].sets[0].reps),11);assert.equal(w.data.exercises[0].notes,'Nota sintética persistida 492');assert(w.data.started_at);
    await c.reload();await c.waitForFunction(()=>window.__simpleStarted);await c.locator('#shared .routine').filter({hasText:'SIMPLE interior '+engine}).getByRole('button',{name:'Abrir',exact:true}).click();await c.locator('.interior-session-list button').first().click();await c.locator('#trainModalActions').getByRole('button',{name:'Historial',exact:true}).click();await c.locator('.history-session').first().waitFor();await c.locator('.history-summary').first().click();assert.match(await c.locator('.history-content').first().innerText(),/37[.,]5/);
    const notes=await table('client','routine_user_notes','user_id=eq.'+config.users.client.id);manifest('notes',notes);
   });
   async function trash(role,page){const tab=role==='client'?'#tTrashClient':'#tTrash';if(role==='client')await table('client','routine_assignments','id=eq.'+assignment[0].id,'PATCH',{client_deleted_at:null});await page.reload();await page.waitForFunction(()=>window.__simpleStarted);await page.locator(role==='client'?'#tShared':'#tMine').click();const cards=page.locator(role==='client'?'#shared .routine':'#mine .routine').filter({hasText:'SIMPLE interior '+engine});await cards.getByRole('button',{name:'Eliminar',exact:true}).click();await page.waitForFunction(tab=>document.querySelector(tab).classList.contains('trash-full'),tab);await page.locator(tab).click();await page.locator('#trash .routine').waitFor();assert(await page.locator(tab).evaluate(e=>e.classList.contains('trash-full')));
    failures=true;await page.locator('#trash').getByRole('button',{name:/Restaurar/}).click();await page.waitForTimeout(350);assert(await page.locator(tab).evaluate(e=>e.classList.contains('trash-full')));assert(await page.locator('#trash .routine').count()>0);failures=false;
    await page.locator('#trash').getByRole('button',{name:/Restaurar/}).click();await page.waitForFunction(tab=>document.querySelector(tab).classList.contains('trash-empty'),tab);
    if(role==='trainer')assert.equal((await table(role,'routines','id=eq.'+rid))[0].deleted_at,null);else assert.equal((await table(role,'routine_assignments','id=eq.'+assignment[0].id))[0].client_deleted_at,null);
   }
   await test(engine+' client trash remove → failed restore stays full → restore empty; database confirmed',()=>trash('client',c));
   await test(engine+' trainer trash remove → failed restore stays full → restore empty; database confirmed',()=>trash('trainer',p));
   if(process.argv.includes('--trash-matrix')){
    for(const [role,pg] of [['client',c],['trainer',p]])await test(role+' two trash items: restoring one stays full, restoring last becomes empty',async()=>{
     await pg.reload();await pg.waitForFunction(()=>window.__simpleStarted);const tab=role==='client'?'#tTrashClient':'#tTrash',home=role==='client'?'#tShared':'#tMine',cards=role==='client'?'#shared .routine':'#mine .routine';await pg.locator(home).click();
     for(let n=0;n<2;n++){await pg.locator(cards).getByRole('button',{name:'Eliminar',exact:true}).first().click();await pg.waitForFunction(({cards,count})=>document.querySelectorAll(cards).length===count,{cards,count:1-n});}
     await pg.locator(tab).click();await pg.waitForFunction(()=>document.querySelectorAll('#trash .routine').length===2);assert(await pg.locator(tab).evaluate(e=>e.classList.contains('trash-full')));
     await pg.locator('#trash').getByRole('button',{name:/Restaurar/}).first().click();await pg.waitForFunction(()=>document.querySelectorAll('#trash .routine').length===1);assert(await pg.locator(tab).evaluate(e=>e.classList.contains('trash-full')));
     await pg.locator('#trash').getByRole('button',{name:/Restaurar/}).first().click();await pg.waitForFunction(tab=>document.querySelector(tab).classList.contains('trash-empty'),tab);
    });
    await test('trainer permanent delete removes only own synthetic structure, history unchanged',async()=>{
     const before=await table('client','workouts','user_id=eq.'+config.users.client.id);await p.reload();await p.waitForFunction(()=>window.__simpleStarted);await p.locator('#tMine').click();await p.locator('#mine .routine').filter({hasText:'SIMPLE interior chromium'}).getByRole('button',{name:'Eliminar',exact:true}).click();await p.waitForFunction(()=>document.querySelectorAll('#mine .routine').length===1);await p.locator('#tTrash').click();await p.locator('#trash .routine').waitFor();failures=true;await p.locator('#trash').getByRole('button',{name:'Eliminar',exact:true}).click();await p.waitForFunction(()=>!window.__routineTrashBusy);assert.equal(await p.locator('#trash .routine').count(),1);failures=false;await p.locator('#trash').getByRole('button',{name:'Eliminar',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#tTrash').classList.contains('trash-empty'));assert.equal((await table('trainer','routines','id=eq.'+rid)).length,0);assert.deepEqual(await table('client','workouts','user_id=eq.'+config.users.client.id),before);
    });
   }
   for(const pg of pages){await pg.unrouteAll({behavior:'wait'});await pg.close();}
  }finally{await b.close();}
 }
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(async()=>{for(const role of Object.keys(tokens)){try{await req(role,'/auth/v1/logout','POST')}catch(_){}}write();});
