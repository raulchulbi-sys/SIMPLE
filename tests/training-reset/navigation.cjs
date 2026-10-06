const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),extract=require('../integration/function-source.cjs');
const source=fs.readFileSync('index.html','utf8');
let checks=0;const check=(name,ok)=>{assert(ok,name);checks++;};
function fixture(){
 const nodes=Object.fromEntries(['trainModal','trainTitle','trainSubtitle','trainModalActions','trainBody'].map(id=>[id,{innerHTML:'',textContent:'',classList:{contains:()=>visible}}]));
 let visible=false;const queries=[],pending=new Map(),editor=[];
 const c=vm.createContext({console,Promise,user:{id:'owner'},profile:{role:'client'},workoutRoutine:{id:'routine'},$:id=>nodes[id],esc:String,
  openM:()=>visible=true,closeM:()=>visible=false,sessionOverviewExercises:day=>'<section>'+day.id+'</section>',
  db:{from:table=>{const filters={};const q={select:()=>q,eq:(k,v)=>{filters[k]=v;return q;},order:()=>q,single:()=>deliver(),then:(a,b)=>deliver().then(a,b)};
   function deliver(){queries.push({table,...filters});return pending.get(filters.id||filters.day_id)?.[table]||Promise.resolve(table==='routine_days'?{data:{id:filters.id,name:filters.id}}:{data:[]});}return q;}},
  openLibraryRoutineEditor:async id=>{editor.push(id);c.__clientRoutineEdit={routineId:id};},editDays:[{id:'second-day'},{id:'first-day'}],
  openClientRoutineDayEditor:i=>editor.push(i),openSharedRoutine:id=>editor.push(['shared',id]),openRoutine:id=>editor.push(['own',id])
 });c.window=c;
 for(const name of ['viewRoutineSession','editViewedRoutineSession','backFromSessionOverview'])vm.runInContext(extract(source,name),c);
 const delay=id=>{let release;const p=new Promise(r=>release=r);pending.set(id,{routine_days:p,routine_exercises:Promise.resolve({data:[]})});return release;};
 return {c,nodes,queries,editor,delay,close:()=>visible=false};
}
(async()=>{
 let f=fixture();await f.c.viewRoutineSession('first-day');
 check('day read is scoped to exact routine UUID',f.queries.some(q=>q.table==='routine_days'&&q.id==='first-day'&&q.routine_id==='routine'));
 check('client overview does not create workout or editor',f.c.activeWorkout===null&&!f.nodes.trainBody.innerHTML.includes('editViewedRoutineSession'));
 f.c.profile.role='trainer';await f.c.viewRoutineSession('first-day');await f.c.editViewedRoutineSession();
 check('trainer editor resolves day by UUID after reordering',JSON.stringify(f.editor)===JSON.stringify(['routine',1]));
 f=fixture();const release=f.delay('old-day'),old=f.c.viewRoutineSession('old-day');await Promise.resolve();f.close();f.nodes.trainBody.innerHTML='closed';release({data:{id:'old-day',name:'Old'}});await old;
 check('closed modal ignores late session response',f.nodes.trainBody.innerHTML==='closed');
 f=fixture();const releaseUser=f.delay('old-day'),oldUser=f.c.viewRoutineSession('old-day');await Promise.resolve();f.c.user={id:'different-user'};f.nodes.trainBody.innerHTML='new user';releaseUser({data:{id:'old-day',name:'Old'}});await oldUser;
 check('another user cannot receive late session response',f.nodes.trainBody.innerHTML==='new user');
 f=fixture();const releaseOld=f.delay('old-day'),oldView=f.c.viewRoutineSession('old-day');await f.c.viewRoutineSession('new-day');const current=f.nodes.trainBody.innerHTML;releaseOld({data:{id:'old-day',name:'Old'}});await oldView;
 check('newer session view wins over older response',f.nodes.trainBody.innerHTML===current&&current.includes('new-day'));
 f=fixture();f.delay('broken-day')({data:null,error:{message:'network'}});await f.c.viewRoutineSession('broken-day');
 check('failed read has persistent error and back action',f.nodes.trainBody.innerHTML.includes('role="alert"')&&f.nodes.trainBody.innerHTML.includes('← Sesiones')&&!f.nodes.trainBody.innerHTML.includes('startWorkoutDay'));
 f=fixture();f.delay('incomplete-day')({data:null});await f.c.viewRoutineSession('incomplete-day');
 check('incomplete response cannot show successful session',f.nodes.trainBody.innerHTML.includes('No se pudo cargar la sesión'));
 f=fixture();f.c.workoutRoutine.trainer_routine_id='assigned-source';await f.c.viewRoutineSession('first-day');f.c.backFromSessionOverview();
 check('athlete back retains assigned routine destination',JSON.stringify(f.editor)===JSON.stringify([['shared','assigned-source']]));
 fs.mkdirSync(__dirname+'/results',{recursive:true});fs.writeFileSync(__dirname+'/results/navigation.json',JSON.stringify({passed:checks,failed:0}));
 console.log(checks+'/'+checks+' session read/navigation checks');
})().catch(e=>{console.error(e);process.exitCode=1;});
