// Full dashboard in Chromium. All requests are fulfilled from local files or blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const origin = 'https://simple.invalid';
const uuid = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const ids = { trainer:uuid(1), client:uuid(2), own:uuid(10), original:uuid(11), copy:uuid(12), shared:uuid(13), coach:uuid(14) };

async function dashboard(context, role, page) {
  page ??= await context.newPage();
  await page.goto(origin);
  await page.waitForFunction(() => typeof simpleAuth !== 'undefined' && !simpleAuth.busy);
  await page.evaluate(({role, ids}) => {
    user = {id:ids[role]};
    profile = {role};
    const routine = (id, name) => ({id, name, description:'', owner_id:user.id});
    routines = [role==='trainer' ? routine(ids.own,'Rutina propia') : routine(ids.coach,'Rutina de Coach')];
    mock.tables.routines = [...routines, routine(ids.original,'Rutina con copia'), routine(ids.shared,'Rutina asignada')];
    assignments = role==='client' ? [
      {id:'copia',client_id:user.id,trainer_routine_id:ids.original,client_routine_id:ids.copy},
      {id:'directa',client_id:user.id,trainer_routine_id:ids.shared,client_routine_id:null}
    ] : [];
    mock.tables.routine_assignments = assignments;
    mock.tables.routine_management = role==='client' ? [{routine_id:ids.coach}] : [];
    mock.tables.workouts = [{id:'historial-de-prueba'}];
    localStorage.setItem('simple_workout_draft_v2:'+user.id+':'+ids.own+':day','borrador');
    const original = db.rpc.bind(db);
    mock.resets = [];
    db.rpc = async (name, args) => {
      if(name === 'reset_my_routine_cycle'){
        mock.resets.push(args);
        if(mock.hold) await new Promise(resolve => {mock.release=resolve;});
        const {p_expected_user_id:owner,p_routine_id:rid,p_request_id:request} = args;
        if(!localStorage.getItem('applied:'+request)){
          localStorage.setItem('progress:'+owner+':'+rid, '0');
          localStorage.setItem('applied:'+request, '1');
        }
        if(mock.loseReply){mock.loseReply=false; throw Error('synthetic lost response');}
        return {data:null,error:null};
      }
      if(name === 'get_client_routine_cycle_progress' || name === 'get_client_custom_routine_cycle_progress'){
        const stored = localStorage.getItem('progress:'+args.p_client_id+':'+args.p_routine_id);
        return {data:[{total_days:5,completed_days:stored===null ? 3 : Number(stored)}],error:null};
      }
      return original(name,args);
    };
    $('auth').style.display='none';
    $('app').style.display='block';
    view(role==='trainer' ? 'mine' : 'shared');
  }, {role,ids});
  await page.locator('.cycle-reset-link').first().waitFor();
  return page;
}

async function run() {
  const browser = await chromium.launch({channel:process.env.SIMPLE_BROWSER_CHANNEL || undefined});
  try {
    const context = await browser.newContext({viewport:{width:320,height:720},timezoneId:'America/Los_Angeles',serviceWorkers:'block'});
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if(url.hostname==='cdn.jsdelivr.net' && url.pathname.startsWith('/npm/@supabase/supabase-js@'))
        return route.fulfill({path:path.join(root,'tests/interior/mock-sdk.js'),contentType:'application/javascript'});
      if(url.origin===origin && url.pathname==='/') return route.fulfill({path:path.join(root,'index.html'),contentType:'text/html; charset=utf-8'});
      if(url.origin===origin && /^\/assets\/[\w.-]+$/.test(url.pathname) && fs.existsSync(path.join(root,url.pathname)))
        return route.fulfill({path:path.join(root,url.pathname)});
      return route.abort();
    });
    const first = await dashboard(context,'trainer'), second = await dashboard(context,'trainer');
    const trigger = first.locator('[data-cycle-routine="'+ids.own+'"]');
    await trigger.focus();
    await first.keyboard.press('Enter');
    const dialog = first.getByRole('dialog',{name:'¿Reiniciar tu ciclo?'});
    await dialog.waitFor();
    assert.equal(await first.evaluate(()=>document.activeElement.id), 'cycleResetCancel');
    await first.keyboard.press('Escape');
    assert.equal(await first.evaluate(()=>document.activeElement.dataset.cycleRoutine), ids.own);
    assert.equal(await first.evaluate(()=>mock.resets.length), 0);
    for(const width of [320,390,1280]){
      await first.setViewportSize({width,height:720});
      const el = await trigger.boundingBox(), bar = await first.getByRole('progressbar').boundingBox();
      assert.ok(el.width>=44 && el.height>=44 && el.x>=0 && el.x+el.width<=width && bar.width>=70);
    }
    for(const theme of ['light','dark']){
      const ratio=await trigger.evaluate((button,theme)=>{
        document.documentElement.dataset.theme=theme;
        const luminance=rgb=>rgb.match(/\d+/g).slice(0,3).map(Number).map(n=>{
          const channel=n/255;
          return channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4;
        }).reduce((sum,c,i)=>sum+c*[0.2126,0.7152,0.0722][i],0);
        const text=luminance(getComputedStyle(button).color),card=luminance(getComputedStyle(button.closest('.card')).backgroundColor);
        return (Math.max(text,card)+0.05)/(Math.min(text,card)+0.05);
      },theme);
      assert.ok(ratio>=4.5,theme+' contrast '+ratio);
    }
    await trigger.click();
    await first.evaluate(()=>{mock.hold=true;});
    await first.locator('#cycleResetConfirm').focus();
    await first.keyboard.press('Enter');
    await first.evaluate(()=>$('cycleResetConfirm').click());
    assert.equal(await first.evaluate(()=>mock.resets.length), 1);
    await first.evaluate(()=>{mock.hold=false;mock.release();});
    for(const tab of [first,second])await tab.waitForSelector('#mine [role=progressbar][aria-valuenow="0"]');
    await dialog.waitFor({state:'hidden'});
    assert.equal(await first.evaluate(()=>document.activeElement.dataset.cycleRoutine), ids.own);
    assert.deepEqual(await first.evaluate(()=>mock.tables.workouts), [{id:'historial-de-prueba'}]);
    assert.equal(await first.evaluate(ids=>localStorage.getItem('simple_workout_draft_v2:'+ids.trainer+':'+ids.own+':day'),ids), 'borrador');

    const client = await dashboard(context,'client');
    const button = rid => client.locator('[data-cycle-routine="'+rid+'"]');
    for(const rid of [ids.copy,ids.shared,ids.coach]) await button(rid).waitFor();
    assert.equal(await button(ids.original).count(),0);
    await client.evaluate(()=>{mock.loseReply=true;});
    await button(ids.copy).click();
    await client.locator('#cycleResetConfirm').click();
    await client.getByRole('alert').filter({hasText:'Puedes reintentarlo'}).waitFor();
    const request = await client.evaluate(()=>mock.resets[0]);
    assert.equal(request.p_expected_user_id,ids.client);
    assert.equal(request.p_routine_id,ids.copy);
    assert.match(request.p_request_id,/^[a-f0-9-]{36}$/);
    // A workout arriving after an uncertain reset must survive the retry.
    await client.evaluate(ids=>localStorage.setItem('progress:'+ids.client+':'+ids.copy,'1'),ids);
    await client.keyboard.press('Escape');
    await button(ids.copy).click();
    assert.equal(await client.locator('#cycleResetConfirm').textContent(),'Reintentar reinicio');
    await dashboard(context,'client',client);
    await button(ids.copy).click();
    await client.locator('#cycleResetConfirm').click();
    await client.waitForSelector('#shared .card:has([aria-valuenow="1"]) [data-cycle-routine="'+ids.copy+'"]');
    assert.deepEqual(await client.evaluate(()=>mock.resets[0]),request);
    await client.getByRole('dialog').waitFor({state:'hidden'});

    // An open confirmation and a late response both belong to their original account.
    await button(ids.shared).click();
    await client.evaluate(()=>{user={id:'otro-usuario'};$('cycleResetConfirm').click();});
    assert.equal(await client.evaluate(()=>mock.resets.length),1);
    await client.evaluate(ids=>{user={id:ids.client};mock.hold=true;},ids);
    await button(ids.shared).click();
    await client.locator('#cycleResetConfirm').click();
    await client.evaluate(()=>{resetAuthSession();mock.release();});
    await client.getByRole('dialog').waitFor({state:'hidden'});
    assert.equal(await client.evaluate(()=>$('shared').textContent),'');
    assert.equal(await client.evaluate(()=>mock.resets[1].p_routine_id),ids.shared);

    const results = await first.evaluate(()=>{
      simpleCycleDateKey=()=> '2026-10-26';
      const row=(date,day,routine='r')=>({workout_date:date,data:{routine_id:routine,routine_day_id:day}});
      const cycle=(...rows)=>simpleDailyProgressFromSessions(rows,5,{},['r']);
      const a=row('2026-10-20','a'),b=row('2026-10-21','b');
      return [cycle(row('2026-10-22','a')),cycle(a,b),cycle(a,b,row('2026-10-26','x','otra')),
        cycle(a,b,row('2026-10-26','c')),cycle(row('2026-10-22','a'),row('2026-10-26','b')),
        cycle(...['a','b','c','d','e'].map(key=>row('2026-10-26',key)))];
    });
    assert.deepEqual(results, [1,0,0,1,2,5]);
    console.log('Chromium offline: propias, asignadas, Coach, 320/390/1280 px, teclado, cancelación, doble clic, reintento, aislamiento, dos pestañas y cuatro fechas completas.');
  } finally {await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
