const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:4258/',out=path.join(__dirname,'results'),rows=[];fs.mkdirSync(out,{recursive:true});
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
(async()=>{for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});try{
 for(const width of [320,390,1280])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const check=(name,ok)=>{assert(ok,engine+' '+width+' '+theme+' '+name);rows.push({engine,width,theme,name,pass:true});};
  const go=async role=>{await page.goto(base+'?role='+role);await page.waitForFunction(()=>window.previewReady);await page.evaluate(t=>simpleTheme.set(t),theme);};
  await go('trainer');await page.evaluate(([c,r])=>openClientRoutineProgress(c,r,'PPL · Upper / Lower'),[id(2),id(10)]);
  await page.getByRole('button',{name:'Reiniciar estadísticas',exact:true}).waitFor();await page.locator('#clientProgressExercise').selectOption('id:'+id(160));await page.waitForFunction(()=>clientProgressChartState.points.length===1);check('before reset one chart observation',await page.evaluate(()=>clientProgressChartState.points.length===1));
  const before=await page.evaluate(()=>JSON.stringify(mock.tables));
  page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Reiniciar estadísticas',exact:true}).click();check('cancel no write',await page.evaluate(()=>!mock.calls.some(c=>c.rpc==='reset_client_routine_statistics')));
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Reiniciar estadísticas',exact:true}).click();await page.locator('#statisticsStageControls button').evaluate(e=>e.click());
  await page.waitForFunction(()=>document.getElementById('statisticsStageControls')?.innerText.includes('Estadísticas desde'));
  check('one submit',await page.evaluate(()=>mock.calls.filter(c=>c.rpc==='reset_client_routine_statistics').length===1));
  check('zero statistics retains history',await page.locator('.progress-point').count()===0&&await page.locator('#clientProgressBody .history-session').count()===1);
  check('all data exact',await page.evaluate(()=>JSON.stringify(mock.tables))===before);
  check('touch target and viewport fit',await page.locator('#statisticsStageControls button').evaluate(e=>e.getBoundingClientRect().height>=44&&document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(out,'trainer-'+engine+'-'+width+'-'+theme+'.png')});
  await page.evaluate(([c,r])=>openClientProfile(c),[id(2),id(10)]);await page.waitForFunction(()=>document.getElementById('clientModalBody').innerText.includes('0/5 del ciclo actual'));
  check('trainer cycle zero',await page.locator('#clientModalBody').innerText().then(t=>t.includes('0/5 del ciclo actual')&&t.includes('Sin sesiones')));
  await go('client');await page.evaluate(r=>openSharedRoutine(r),id(10));await page.locator('.interior-session-list button').first().click();await page.locator('.previous-empty').first().waitFor();
  check('last session starts empty',await page.locator('.previous-empty').first().innerText().then(t=>t.includes('Sin registro anterior')));
  check('single final save preserved',await page.locator('#saveWorkoutBtn').count()===1&&await page.locator('#saveWorkoutBtn').evaluate(e=>getComputedStyle(e).position)==='static');
  const cycle=await page.evaluate(r=>getWeeklyRoutineProgressForUser(user.id,[r]).then(x=>x.get(r)),id(10));
  check('reload persistence and no client reset action',cycle.done===0&&cycle.total===5&&await page.getByRole('button',{name:'Reiniciar estadísticas',exact:true}).count()===0);
  await page.evaluate(()=>showHistory());check('client historical data still accessible',await page.locator('#trainBody .history-session').count()===1);
  await page.evaluate(()=>{const next=structuredClone(mock.tables.workouts[0]);next.id=crypto.randomUUID();next.created_at=new Date().toISOString();const d=new Date();d.setDate(d.getDate()-1);next.workout_date=simpleLocalDateKey(d);next.data.exercises[0].sets[0].kg=23;mock.tables.workouts.push(next);});
  await page.evaluate(d=>startWorkoutDay(d),id(30));check('new stage last session uses only new record',await page.evaluate(e=>getPreviousExerciseSession(e)?.exercise.sets[0].kg===23,id(160)));
  const nextCycle=await page.evaluate(r=>getWeeklyRoutineProgressForUser(user.id,[r]).then(x=>x.get(r)),id(10));check('new athlete record resumes cycle',nextCycle.done===1&&nextCycle.total===5);
  check('historical record and new record coexist',await page.evaluate(()=>window.workoutHistory.length===2&&mock.tables.workouts[0].data.exercises[0].sets[0].kg===20));
  await page.screenshot({path:path.join(out,engine+'-'+width+'-'+theme+'.png')});
  check('no browser errors',errors.length===0);await context.close();
 }
 }finally{await browser.close();}
}fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(rows,null,2));console.log(rows.length+'/'+rows.length+' actual UI checks, offline Chromium/WebKit');})().catch(e=>{console.error(e.stack);process.exitCode=1;});
