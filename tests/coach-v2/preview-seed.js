(async()=>{
 while(typeof simpleAuth==='undefined'||simpleAuth.busy)await new Promise(r=>setTimeout(r,20));
 for(const n of ['training_intakes','intake_health','context_grants','coach_operations','routine_management','routine_revisions','routines','routine_days','routine_exercises','routine_assignments','workouts','routine_user_notes','coach_pilot_feedback'])mock.tables[n]=[];
 const stored=sessionStorage.getItem('coach-v2-synthetic');if(stored)Object.assign(mock.tables,JSON.parse(stored));
 mock.tables.profiles=[{id:demoUser,name:'Atleta ficticio de la demostración',role:'client'}];
 user={id:demoUser,email:'preview@example.invalid'};await start();window.previewReady=true;
})();
