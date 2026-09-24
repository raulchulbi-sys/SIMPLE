// Preview bootstrap. All IDs and names below are fictitious; no network APIs.
(async()=>{
while(typeof simpleAuth==='undefined'||simpleAuth.busy)await new Promise(r=>setTimeout(r,20));
const params=new URLSearchParams(location.search),role=params.get('role')==='trainer'?'trainer':'client',scenario=params.get('state')||'normal';
if(params.get('role')==='auth'){
 if(scenario==='social'){authNavigate('login');const render=renderOAuthButtons;renderOAuthButtons=()=>render(true);renderOAuthButtons();}
 window.previewReady=true;return;
}
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),T=id(1),C=id(2),R=id(10),R2=id(11);
const long=scenario==='long';
mock.tables.profiles=[{id:T,name:'Entrenador de ejemplo',role:'trainer'},{id:C,name:long?'Alejandra Fernández de la Vega — nombre largo de prueba':'Alejandra Fernández',role:'client'},{id:id(3),name:'Daniel Martín',role:'client'},{id:id(4),name:'Lucía Torres',role:'client'}];
mock.tables.routines=[{id:R,owner_id:T,name:long?'Programa de fuerza y movilidad con un nombre muy largo para comprobar la lectura en pantallas pequeñas':'PPL · Upper / Lower',description:'Cinco sesiones. Mantén el orden de los días y registra cada entrenamiento.',created_at:'2026-09-01',routine_order:0},{id:R2,owner_id:T,name:'Fuerza · 3 días',description:'Trabajo de cuerpo completo.',created_at:'2026-09-02',routine_order:1}];
mock.tables.routine_assignments=[{id:id(20),trainer_id:T,client_id:C,trainer_routine_id:R,created_at:'2026-09-20',client_deleted_at:null},{id:id(21),trainer_id:T,client_id:id(3),trainer_routine_id:R2,created_at:'2026-09-20',client_deleted_at:null},{id:id(22),trainer_id:T,client_id:id(4),trainer_routine_id:R,created_at:'2026-09-20',client_deleted_at:null}];
mock.tables.routine_days=[];mock.tables.routine_exercises=[];
for(const [rid,names,start]of [[R,['Lunes / Push','Martes / Pull','Miércoles / Pierna','Viernes / Upper','Sábado / Lower'],30],[R2,['Sesión A','Sesión B','Sesión C'],40]]){
 names.forEach((name,i)=>{const day=id(start+i);mock.tables.routine_days.push({id:day,routine_id:rid,day_order:i,name:long&&i===0?'Sesión de empuje con trabajo de hombro, pecho y tríceps — nombre completo':name});['Press con mancuernas','Aperturas en polea'].forEach((name,j)=>mock.tables.routine_exercises.push({id:id(100+(start+i)*2+j),day_id:day,name,sets:3,target:'8–12',rir:'2',rest_seconds:120,exercise_order:j,notes:''}))});
}
mock.tables.workouts=[{id:id(200),user_id:C,workout_date:'2026-09-23',created_at:'2026-09-23T15:00:00Z',data:{routine_id:R,routine_day_id:id(30),day_name:'Lunes / Push',duration_seconds:2700,exercises:[{exercise_id:id(160),name:'Press con mancuernas',sets:[{kg:20,reps:10,rir:2}],notes:''}]} }];
mock.tables.routine_user_notes=[];mock.tables.routine_share_codes=[];
if(scenario==='trash'){
 if(role==='trainer')mock.tables.routines[0].deleted_at='2026-09-20T10:00:00Z';
 mock.tables.routine_assignments[0].client_deleted_at='2026-09-20T10:00:00Z';
}
if(scenario==='history'){
 mock.tables.workouts=Array.from({length:14},(_,n)=>({id:id(200+n),user_id:C,day:'Lunes / Push',workout_date:'2026-09-'+String(10+n).padStart(2,'0'),created_at:'2026-09-'+String(10+n).padStart(2,'0')+'T15:00:00Z',data:{routine_id:R,day_id:id(30),routine_day_id:id(30),day_name:'Lunes / Push',duration_seconds:2700,exercises:[{exercise_id:id(160),name:'Press con mancuernas',sets:[{kg:20+n,reps:10,rir:2,done:true}],notes:'Nota de ejemplo'},{exercise_id:id(161),name:'Press con mancuernas',sets:[{kg:8+n,reps:12,rir:1,done:true}],notes:'Ejercicio distinto con el mismo nombre'}]}}));
 mock.tables.routine_exercises.find(e=>e.id===id(161)).name='Press con mancuernas';
}
if(scenario==='empty'){mock.tables.routines=[];mock.tables.routine_assignments=[];mock.tables.routine_days=[];mock.tables.routine_exercises=[]}
user={id:role==='trainer'?T:C,email:role+'@ejemplo.invalid'};await start();
if(scenario==='trash')view('trash');
if(['loading','error'].includes(scenario)){mock.scenario=scenario;view(role==='trainer'?'clients':'shared')}
window.previewReady=true;
})();
