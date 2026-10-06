const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:4259/',out=path.join(__dirname,'results'),results=[],id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');fs.mkdirSync(out,{recursive:true});
(async()=>{for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});try{
 for(const width of [320,390,1280])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const check=(name,ok)=>{assert(ok,engine+' '+width+' '+theme+' '+name);results.push({engine,width,theme,name,pass:true});};
  const go=async role=>{await page.goto(base+'?role='+role);await page.waitForFunction(()=>window.previewReady);await page.evaluate(t=>simpleTheme.set(t),theme);};
  await go('trainer');await page.evaluate(r=>openLibraryRoutineEditor(r),id(10));
  await page.getByRole('button',{name:'Ver sesión',exact:true}).first().click();
  check('trainer overview has no editable exercise fields',await page.locator('.session-overview input,.session-overview textarea').count()===0&&await page.getByRole('button',{name:'Editar',exact:true}).count()===1);
  const structure=await page.evaluate(()=>JSON.stringify(mock.tables.routine_exercises));
  check('overview shows exact series target RIR rest',await page.locator('.session-overview').innerText().then(t=>t.includes('Series')&&t.includes('Objetivo')&&t.includes('RIR')&&t.includes('Descanso')&&t.includes('min')));
  await page.screenshot({path:path.join(out,'overview-'+engine+'-'+width+'-'+theme+'.png')});
  await page.getByRole('button',{name:'Editar',exact:true}).click();
  check('edit enters existing session editor',await page.locator('#daysEditor input').count()>0&&await page.getByRole('button',{name:'Guardar cambios',exact:true}).count()===1);
  await page.getByRole('button',{name:'← Sesiones',exact:true}).click();
  check('back retains sessions and exact structure',await page.getByRole('button',{name:'Ver sesión',exact:true}).count()===5&&await page.evaluate(()=>JSON.stringify(mock.tables.routine_exercises))===structure);
  await page.evaluate(()=>closeM('editModal'));
  await page.evaluate(([c,r])=>openClientRoutineProgress(c,r,'PPL · Upper / Lower'),[id(2),id(10)]);
  await page.getByRole('button',{name:'Reiniciar estadísticas',exact:true}).waitFor();
  await page.evaluate(([c,r])=>{mock.tables.routine_user_notes=[{user_id:c,routine_id:r,exercise_key:'exercise:test',note:'Old personal note'}];localStorage.setItem('simple_routine_notes_v3:'+c+':'+r+':'+mock.tables.routine_days[0].id,JSON.stringify({old:'Old local note'}));localStorage.setItem('simple_workout_draft_v2:'+c+':'+r+':'+mock.tables.routine_days[0].id,JSON.stringify({sets:{old:'old draft'}}));},[id(2),id(10)]);
  let warning='';page.once('dialog',d=>{warning=d.message();d.dismiss()});await page.getByRole('button',{name:'Reiniciar estadísticas',exact:true}).click();
  check('irreversible scoped confirmation and cancel',warning.includes('definitivamente')&&warning.includes('notas personales')&&warning.includes('no se puede deshacer')&&await page.evaluate(()=>mock.tables.workouts.length===1));
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Reiniciar estadísticas',exact:true}).click();await page.locator('#statisticsStageControls button').evaluate(e=>e.click());
  await page.waitForFunction(()=>document.getElementById('statisticsStageControls')?.innerText.includes('Estadísticas desde'));
  check('one destructive submit',await page.evaluate(()=>mock.calls.filter(c=>c.rpc==='reset_client_routine_training_history').length===1));
  check('history and personal notes removed',await page.evaluate(()=>mock.tables.workouts.length===0&&mock.tables.routine_user_notes.length===0)&&await page.locator('#clientProgressBody .history-session').count()===0);
  check('all exercise prescriptions retained',await page.evaluate(()=>JSON.stringify(mock.tables.routine_exercises))===structure);
  check('reset target tactile and no horizontal overflow',await page.locator('#statisticsStageControls button').evaluate(e=>e.getBoundingClientRect().height>=44&&document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(out,'reset-'+engine+'-'+width+'-'+theme+'.png')});
  await go('client');await page.evaluate(r=>openSharedRoutine(r),id(10));await page.getByRole('button',{name:'Ver sesión',exact:true}).first().click();
  check('athlete can view but cannot edit',await page.locator('.session-overview-exercise').count()>0&&await page.getByRole('button',{name:'Editar',exact:true}).count()===0);
  await page.getByRole('button',{name:'Entrenar',exact:true}).click();await page.locator('.previous-empty').first().waitFor();
  check('last session and personal notes empty',await page.evaluate(()=>Object.values(activeWorkout.sets).every(rows=>!rows.note))&&await page.locator('.previous-empty').first().innerText().then(t=>t.includes('Sin registro anterior')));
  check('old local cache and draft removed',await page.evaluate(([c,r])=>!localStorage.getItem('simple_routine_notes_v3:'+c+':'+r+':'+activeWorkout.day.id)&&!localStorage.getItem('simple_workout_draft_v2:'+c+':'+r+':'+activeWorkout.day.id),[id(2),id(10)]));
  check('single static final save and reset identity captured',await page.locator('#saveWorkoutBtn').count()===1&&await page.locator('#saveWorkoutBtn').evaluate(e=>getComputedStyle(e).position)==='static'&&await page.evaluate(()=>!!activeWorkout.statisticsStage.training_reset_id));
  await page.evaluate(e=>updateSet(e,0,'kg','31'),id(160));
  const draft=await page.evaluate(()=>({key:workoutDraftKey(),value:localStorage.getItem(workoutDraftKey())}));
  await page.evaluate(d=>startWorkoutDay(d),id(30));
  check('new stage draft survives reopening',draft.key.includes(':reset:')&&await page.evaluate(e=>activeWorkout.sets[e][0].kg==='31',id(160)));
  const cycle=await page.evaluate(r=>getWeeklyRoutineProgressForUser(user.id,[r]).then(x=>x.get(r)),id(10));check('persisted reset cycle zero',cycle.done===0&&cycle.total===5);
  await page.evaluate(()=>showHistory());check('athlete history is empty',await page.locator('#trainBody .history-session').count()===0);
  check('no browser errors',errors.length===0);await context.close();
 }
 }finally{await browser.close();}
}fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(results,null,2));console.log(results.length+'/'+results.length+' offline actual UI checks');})().catch(e=>{console.error(e.stack);process.exitCode=1});
