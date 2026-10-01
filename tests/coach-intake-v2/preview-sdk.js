// Offline preview ONLY. The production bundle never exposes a Premium entry point.
addEventListener('message',event=>{if(event.origin!==location.origin||event.data!=='demo-premium')return;simpleCoach.intake=null;simpleCoach.accepted=false;let draft;try{draft=JSON.parse(sessionStorage.getItem('coach-premium-preview'));}catch{}coachStartQuestionnaire(draft||null,true);});
