(async()=>{
while(typeof simpleAuth==='undefined'||simpleAuth.busy)await new Promise(r=>setTimeout(r,20));
for(const n of ['training_intakes','intake_health','context_grants','coach_operations','routine_management','routine_revisions','routines','routine_days','routine_exercises','routine_assignments','workouts','routine_user_notes'])mock.tables[n]=[];
mock.tables.profiles=[{id:demoUser,name:'Atleta de prueba local',role:'client'}];
user={id:demoUser,email:'preview@example.invalid'};await start();window.previewReady=true;
})();
