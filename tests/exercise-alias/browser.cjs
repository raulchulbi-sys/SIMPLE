const fs=require('fs'),vm=require('vm'),crypto=require('crypto'),path=require('path');
const legacy='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a';
process.env.PLAYWRIGHT_BROWSERS_PATH=legacy+'/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const html=fs.readFileSync('index.html','utf8'),old=fs.readFileSync(legacy+'/work/test-ux-browser.cjs','utf8');
let stub=vm.runInNewContext(old.slice(old.indexOf('const stub='),old.indexOf('const results=[]'))+'stub');
stub=stub.replace('String(x[k])===String(v)',"String(k.includes('->>')?x[k.split('->>')[0]]?.[k.split('->>')[1]]:x[k])===String(v)");
const fixture=JSON.parse(fs.readFileSync(legacy+'/work/history-fixture.json','utf8'));
const results=[];
(async()=>{for(const engine of ['chromium','webkit'])for(const width of [390,1280]){
 const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 try{
  const p=await browser.newPage({viewport:{width,height:844}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/*',r=>r.request().url()==='http://simple.test/'?r.fulfill({body:html,contentType:'text/html'}):r.request().url().includes('cdn.jsdelivr')?r.fulfill({body:stub,contentType:'application/javascript'}):r.abort());
  await p.goto('http://simple.test/');
  const rows=await p.evaluate(async f=>{
   const results=[],test=(name,actual,expected)=>results.push({name,pass:JSON.stringify(actual)===JSON.stringify(expected),actual,expected});
   const pairs=[
    ['9740243b-0928-4c5a-b9dc-8ebd09e4d256','8f5b1173-dbb8-4f0f-9eab-a3058dcca969'],
    ['ce87cfe5-4424-4645-92b6-091802f0153d','78bc6c44-1c7a-4f49-8983-4c731894534e'],
    ['6bc9d317-1511-48f0-b126-1c307de41622','21dd0c95-6ae8-403f-91b7-08c51cd4b237'],
    ['056f44c2-0914-479c-814b-75046654cb45','1207ebbd-6878-41d9-a955-10cd5b59cb9e'],
    ['302dea2d-25ef-416a-a85d-8bc1b8a920db','fb36a1d3-a8bc-4cbc-97d1-45decc47bb67'],
    ['bd31394a-5ee9-4f21-b90e-0c759781585f','37eedaee-ac32-4308-9194-5aae01c69ca3']
   ];
   const U=f.session.user_id,R=f.session.data.routine_id,D=f.days.find(d=>d.name==='LUNES / PUSH'),NEW='11111111-1111-4111-8111-111111111111';
   const before=JSON.stringify(f.session),reset=()=>{
    user={id:U};profile={role:'client'};workoutRoutine={id:R,name:'Alias test'};
    activeWorkout={day:structuredClone(D),historyDays:structuredClone(f.days),exercises:structuredClone(f.exercises),sets:{}};
    window.workoutHistory=[structuredClone(f.session)];simpleLocalDateKey=()=> '2026-09-07';
   };
   reset();
   for(const [oldId,id] of pairs){
    const expected=f.session.data.exercises.find(e=>e.exercise_id===oldId),prev=getPreviousExerciseSession(id);
    test(id+': only confirmed historical UUID',prev?.exercise.exercise_id,oldId);
    test(id+': all historical fields are exact',prev?.exercise,expected);
    test(id+': date Aug 31',prev?.date.getTime(),simpleDateFromKey('2026-08-31').getTime());
   }
   $('trainBody').innerHTML=f.exercises.map(e=>renderPreviousSession(e.id)).join('');
   test('Rendered six prior sessions',$('trainBody').querySelectorAll('.previous-session-date').length,6);
   test('Rendered all sixteen original sets',$('trainBody').querySelectorAll('.previous-set').length,16);
   test('Render does not mutate stored snapshot',JSON.stringify(window.workoutHistory[0]),before);
   for(const [oldId,id] of pairs){
    reset();const e=activeWorkout.exercises.find(e=>e.id===id);e.name='Entirely different name';
    window.workoutHistory[0].data.exercises.forEach(x=>x.name='Identical historical names');
    activeWorkout.exercises.reverse();activeWorkout.day={id:NEW,name:'Other day'};
    test(id+': rename/reorder/move still exact alias',getPreviousExerciseSession(id)?.exercise.exercise_id,oldId);
    reset();activeWorkout.exercises=[{...e,id:NEW,name:f.exercises.find(x=>x.id===id).name}];
    test(id+': new namesake cannot inherit',getPreviousExerciseSession(NEW),null);
   }
   reset();const [OLD,ID]=pairs[0];
   const exact=structuredClone(f.session);exact.workout_date='2026-08-24';exact.data.exercises=[{...exact.data.exercises[0],exercise_id:ID,sets:[{kg:0,reps:'',rir:null}]}];
   window.workoutHistory.push(exact);
   test('Exact UUID precedes newer alias',getPreviousExerciseSession(ID)?.exercise.sets,[{kg:0,reps:'',rir:null}]);
   test('Reading exact and aliases leaves snapshot unchanged',JSON.stringify(window.workoutHistory[0]),before);
   reset();const duplicate=structuredClone(f.session.data.exercises[0]);window.workoutHistory[0].data.exercises.push(duplicate);
   test('Duplicate historical UUID fails closed',getPreviousExerciseSession(ID),null);
   reset();activeWorkout.exercises.push({...activeWorkout.exercises[0]});
   test('Duplicate current UUID fails closed',getPreviousExerciseSession(ID),null);
   reset();window.workoutHistory[0].data.exercises[0].exercise_id=NEW;
   test('Unconfirmed orphan with exact name is rejected',getPreviousExerciseSession(ID),null);
   reset();delete window.workoutHistory[0].data.exercises[0].exercise_id;
   test('No UUID is not proof of an alias',getPreviousExerciseSession(ID),null);
   reset();user.id=NEW;window.workoutHistory[0].user_id=NEW;
   test('Alias registry is owner scoped even with owned history',getPreviousExerciseSession(ID),null);
   reset();workoutRoutine.id=NEW;window.workoutHistory[0].data.routine_id=NEW;
   test('Alias registry is routine scoped even with matching history',getPreviousExerciseSession(ID),null);
   reset();window.workoutHistory[0].workout_date='2026-09-07';test('Today is excluded from prior sessions',getPreviousExerciseSession(ID),null);
   window.workoutHistory[0].workout_date='2026-09-08';test('Future is excluded',getPreviousExerciseSession(ID),null);
   reset();
   const current=activeWorkout.exercises,names=Object.fromEntries(current.map(e=>[e.id,e.name])),ids=new Set(current.map(e=>e.id));
   for(const [oldId,id] of pairs){
    const options=getProgressExercises(window.workoutHistory,names,ids);
    test(id+': chart retains original and current separate keys',[options.some(e=>e.key==='id:'+oldId),options.some(e=>e.key==='id:'+id)],[true,true]);
    test(id+': current chart never absorbs old UUID',getExercisePoints(window.workoutHistory,'id:'+id,'weight',names,ids).length,0);
    test(id+': historical chart remains consultable',getExercisePoints(window.workoutHistory,'id:'+oldId,'weight',names,ids).length,1);
    const e=current.find(e=>e.id===id),h=window.workoutHistory;
    test(id+': modern UUID note wins',resolveExerciseNote(e,new Map([['exercise:'+id,'Current note'],['exercise:'+oldId,'Old note']]),{},current,h),'Current note');
    test(id+': alias never copies historical note',resolveExerciseNote({...e,notes:''},new Map([['exercise:'+oldId,'Old note']]),{},current,h),'');
    test(id+': ambiguous legacy note not reassigned',safeLegacyExerciseNote(e,new Map([[simpleNormalizeNoteKey(e.name),'Legacy']]),current,h),undefined);
   }
   reset();localStorage.clear();
   activeWorkout.exercises=[{id:ID,name:'Current',sets:1}];activeWorkout.sets={[ID]:[{kg:'',reps:'',rir:''}]};
   localStorage.setItem(workoutDraftKey(),JSON.stringify({routineId:R,dayId:D.id,savedAt:Date.now(),sets:{[OLD]:{rows:[{kg:999,reps:99,rir:9}],note:'Old'}}}));
   loadWorkoutDraft();test('Old draft UUID never flows through alias',activeWorkout.sets[ID][0].kg,'');
   activeWorkout.sets[ID]=[{kg:123,reps:12,rir:0}];saveWorkoutDraft();activeWorkout.sets[ID]=[{kg:''}];loadWorkoutDraft();
   test('Current draft UUID still restores',[activeWorkout.sets[ID][0].kg,activeWorkout.sets[ID][0].rir],[123,0]);
   test('Draft uses original day ID',JSON.parse(localStorage.getItem(workoutDraftKey())).dayId,D.id);
   localStorage.clear();reset();window.__simpleStarted=true;$('auth').style.display='none';$('app').style.display='block';
   mock.tables.routines=[{id:R,owner_id:U,name:'Alias test'}];routines=mock.tables.routines;
   mock.tables.routine_days=[{...D,routine_id:R,day_order:0}];
   mock.tables.routine_exercises=f.exercises.map((e,i)=>({...e,day_id:D.id,exercise_order:i}));
   mock.tables.routine_user_notes=[];
   const today=structuredClone(f.session);today.workout_date='2026-09-07';today.data.routine_day_id=D.id;mock.tables.workouts=[today];
   openM('trainModal');await startWorkoutDay(D.id);
   test('Reopening today never imports old UUID sets via alias',pairs.map(([,id])=>activeWorkout.sets[id][0].kg),pairs.map(()=>''));
   closeM('trainModal');today.data.exercises[0].exercise_id=ID;mock.tables.workouts=[today];
   openM('trainModal');await startWorkoutDay(D.id);
   test('Reopening today still uses exact UUID',activeWorkout.sets[ID][0].kg,f.session.data.exercises[0].sets[0].kg);
   test('Reopening keeps other UUIDs empty',activeWorkout.sets[pairs[1][1]][0].kg,'');
   closeM('trainModal');test('Fixture original remains unchanged',JSON.stringify(f.session),before);
   localStorage.clear();return results;
  },fixture);
  results.push(...rows.map(r=>({engine,width,...r})),{engine,width,name:'No JavaScript errors',pass:errors.length===0,actual:errors});
  console.log(engine,width,rows.length+1,'checks; failures:',rows.filter(r=>!r.pass).map(r=>r.name));
 }finally{await browser.close()}
 }
 const report={sha256:crypto.createHash('sha256').update(html).digest('hex'),passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass),results};
 fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});fs.writeFileSync(path.join(__dirname,'results/browser.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
