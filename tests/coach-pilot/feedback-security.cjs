const a=require('./api.cjs'),{fs,path,check,rpc,table}=a;
(async()=>{await a.login();const rid=JSON.parse(fs.readFileSync(path.join(__dirname,'private/browser1-ui.json'))).routine;
 if(process.argv.includes('--before')){const r=await rpc('browser1','save_my_coach_feedback',{p_routine:rid,p_rating:4,p_comment:'SYNTHETIC'});check('feedback before first workout rejected',!r.ok&&r.data.message==='coach_feedback_workout_required');a.save('feedback-before');return;}
 let r=await rpc('browser1','save_my_coach_feedback',{p_routine:rid,p_rating:4,p_comment:'SYNTHETIC useful'});check('feedback after own workout allowed',r.ok&&r.data.rating===4);const id=r.data?.id;
 for(const n of [0,6,null]){r=await rpc('browser1','save_my_coach_feedback',{p_routine:rid,p_rating:n,p_comment:null});check('invalid rating rejected '+n,!r.ok&&r.data.message==='coach_invalid_feedback');}
 r=await rpc('browser1','save_my_coach_feedback',{p_routine:rid,p_rating:5,p_comment:'x'.repeat(1001)});check('long feedback rejected',!r.ok&&r.data.message==='coach_invalid_feedback');
 for(const w of ['other','trainer','reviewer','browser2',null]){r=await rpc(w,'save_my_coach_feedback',{p_routine:rid,p_rating:5,p_comment:'not mine'});check((w||'anon')+' cannot write another feedback',!r.ok);}
 const rr=await Promise.all([1,2].map(()=>rpc('browser1','save_my_coach_feedback',{p_routine:rid,p_rating:5,p_comment:'SYNTHETIC updated'})));check('second concurrent feedback updates same row',rr.every(x=>x.ok&&x.data.id===id));
 const rows=await table('browser1','coach_pilot_feedback','routine_id=eq.'+rid);check('one feedback no duplicates',rows.ok&&rows.data.length===1&&rows.data[0].rating===5&&rows.data[0].comment==='SYNTHETIC updated');
 for(const w of ['other','trainer','reviewer','browser2',null]){r=await table(w,'coach_pilot_feedback','routine_id=eq.'+rid);check((w||'anon')+' feedback read permission',w==='reviewer'?r.ok&&r.data.length===1:w===null?!r.ok:r.ok&&r.data.length===0);}
 for(const w of ['browser1','reviewer','other','trainer',null]){r=await table(w,'coach_pilot_feedback','id=eq.'+id,{rating:1},'PATCH');check((w||'anon')+' cannot bypass write RPC',!r.ok);}
 r=await rpc('browser1','save_my_coach_feedback',{p_routine:a.c.normal.routine,p_rating:4,p_comment:null});check('foreign routine feedback rejected',!r.ok&&r.data.message==='coach_feedback_workout_required');
 a.save('feedback-security');
})().catch(e=>{a.save('feedback-security');console.error(e.message);process.exitCode=1});
