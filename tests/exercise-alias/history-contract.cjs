// Replaces the name-disambiguation contract after explicit UUID confirmation.
// Archived history-tests.cjs remains unmodified and its result is retained.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const fixture=JSON.parse(fs.readFileSync('work/history-fixture.json','utf8'));
const original=fs.readFileSync('C:/Users/raulc/OneDrive/Escritorio/index.html','utf8');
const fixed=fs.readFileSync('outputs/index.html','utf8');
const results=[];
function build(html){
 const start=html.indexOf('function getPreviousExerciseSession('),end=html.indexOf('\nfunction renderPreviousSession(',start);
 const c={user:{id:fixture.session.user_id},workoutRoutine:{id:fixture.session.data.routine_id},activeWorkout:{day:fixture.days.find(x=>x.name==='LUNES / PUSH'),historyDays:fixture.days,exercises:fixture.exercises},window:{workoutHistory:[structuredClone(fixture.session)]},today:'2026-09-07',simpleLocalDateKey(){return c.today},simpleDateFromKey:s=>s};
 vm.createContext(c);vm.runInContext(html.slice(start,end),c);return c;
}
function test(name,fn){try{fn();results.push({name,pass:true})}catch(e){results.push({name,pass:false,error:e.message})}}
const old=build(original),c=build(fixed),id=fixture.exercises[0].id;
const reset=()=>{c.user.id=fixture.session.user_id;c.workoutRoutine.id=fixture.session.data.routine_id;c.window.workoutHistory=[structuredClone(fixture.session)];c.activeWorkout.historyDays=structuredClone(fixture.days);c.activeWorkout.exercises=structuredClone(fixture.exercises);c.today='2026-09-07'};
test('Baseline reproduces missing previous session with actual IDs',()=>assert.equal(old.getPreviousExerciseSession(id),null));
// These three formerly failing expectations are identical to the archived suite.
test('A: all six actual Aug 31 exercises recovered on Sep 7',()=>{for(const e of fixture.exercises){const p=c.getPreviousExerciseSession(e.id);assert.equal(p.date,'2026-08-31');assert.deepEqual(p.exercise.sets,fixture.session.data.exercises.find(x=>x.name===e.name).sets)}});
test('B: incomplete cycle 4/5 does not affect history',()=>{c.window.cycleProgress={completed_days:4,total_days:5};assert.equal(c.getPreviousExerciseSession(id).date,'2026-08-31')});
test('C: next visit uses saved Sep 7 record',()=>{const s=structuredClone(fixture.session);s.workout_date='2026-09-07';s.data.routine_day_id=c.activeWorkout.day.id;s.data.exercises=fixture.exercises.map(e=>({...fixture.session.data.exercises.find(x=>x.name===e.name),exercise_id:e.id}));c.window.workoutHistory.push(s);c.today='2026-09-14';assert.equal(c.getPreviousExerciseSession(id).date,'2026-09-07')});
test('D: selects newest earlier date independent of array order; excludes today/future',()=>{reset();for(const date of ['2026-09-07','2026-08-24','2026-09-14']){const s=structuredClone(fixture.session);s.workout_date=date;c.window.workoutHistory.unshift(s)}assert.equal(c.getPreviousExerciseSession(id).date,'2026-08-31')});
test('E: another user cannot consume cached records',()=>{reset();c.user.id='other';assert.equal(c.getPreviousExerciseSession(id),null)});
test('F: another routine cannot consume cached records',()=>{reset();c.workoutRoutine.id='other';assert.equal(c.getPreviousExerciseSession(id),null)});
const changes=[
 ['Day label is not identity',()=>c.window.workoutHistory[0].data.day_name='VIERNES / UPPER'],
 ['Homonymous day is not identity',()=>c.activeWorkout.historyDays.push({id:'duplicate',name:'LUNES / PUSH'})],
 ['Homonymous current exercise is not identity',()=>c.activeWorkout.exercises.push({...fixture.exercises[0],id:'duplicate'})],
 ['Homonymous historical exercise is not identity',()=>c.window.workoutHistory[0].data.exercises.push({...fixture.session.data.exercises[0],exercise_id:'duplicate'})],
 ['Day membership does not override exercise identity',()=>c.activeWorkout.historyDays.push({id:fixture.session.data.routine_day_id,name:'renamed'})]
];
for(const [name,change] of changes){
 test(name+': confirmed alias still resolves',()=>{reset();change();assert.equal(c.getPreviousExerciseSession(id)?.exercise.exercise_id,fixture.session.data.exercises[0].exercise_id)});
 test(name+': unconfirmed UUID never resolves',()=>{reset();change();c.window.workoutHistory[0].data.exercises[0].exercise_id='11111111-1111-4111-8111-111111111111';assert.equal(c.getPreviousExerciseSession(id),null)});
}
test('Unchanged day/exercise UUID still works',()=>{reset();c.activeWorkout.day={id:fixture.session.data.routine_day_id,name:'LUNES / PUSH'};c.activeWorkout.exercises=fixture.session.data.exercises.map(e=>({...e,id:e.exercise_id}));assert.equal(c.getPreviousExerciseSession(fixture.session.data.exercises[0].exercise_id).date,'2026-08-31')});
test('Auth callback returns before any async handler runs',()=>{const auth=fs.readFileSync(require('path').join(__dirname,'../../assets/auth.js'),'utf8'),a=auth.indexOf('db.auth.onAuthStateChange('),b=auth.indexOf('\nbootstrapAuthSession();',a);let cb,scheduled=0,handled=0,reloads=0;vm.runInNewContext(auth.slice(a,b),{simpleAuth:{epoch:0},resetAuthSession:()=>{},window:{},db:{auth:{onAuthStateChange:f=>cb=f}},user:null,location:{reload:()=>reloads++},setTimeout:f=>{scheduled++;},handleAuthStateChange:()=>handled++});assert.equal(cb('SIGNED_IN',{user:{id:'x'}}),undefined);assert.equal(scheduled,1);assert.equal(handled,0);for(let i=0;i<10;i++)cb('SIGNED_OUT',null);assert.equal(reloads,0)});
fs.writeFileSync('outputs/pruebas-historial-alias.json',JSON.stringify({passed:results.filter(x=>x.pass).length,results},null,2));
console.log(JSON.stringify({passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass)},null,2));if(results.some(x=>!x.pass))process.exitCode=1;
