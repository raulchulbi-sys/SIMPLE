const fs=require('fs'),assert=require('assert/strict'),path=require('path');
(async()=>{
 const C=await import('../../supabase/functions/simple-coach-chat/chat-policy-v1_2.mjs'),Rx=await import('../../supabase/functions/simple-coach-chat/replacement-prescription-v1.mjs'),Old=await import('../../supabase/functions/simple-coach-chat/chat-policy-v1_1.mjs');
 const rows=[],check=(name,condition)=>{assert(condition,name);rows.push({name,pass:true});},samples=JSON.parse(fs.readFileSync(path.join(__dirname,'results/backend-final.json'))).samples;
 for(const s of samples.filter(x=>x.name!=='pipeline')){assert.deepEqual(Rx.plan(s.source,s.destination,s.old_sets,s.scheme,s.intake),s.plan,s.name);check('SQL/Edge parity: '+s.name,true);}
 const s=samples.find(x=>x.name==='pipeline'),ctx=s.intake,o=s.plan.output;check('full current candidate valid',C.semantic(o,ctx).ok);
 check('rest warnings removed for generated replacements',!C.semantic(o,ctx).warnings.some(x=>x.startsWith('rest_below_demand')));
 for(const [name,mutate]of [
 ['foreign UUID/ref',v=>v.recommendation_candidate.changes[0].exercise_ref='exercise_999'],
 ['excluded',v=>v.recommendation_candidate.changes[0].to_catalogue_id='bird_dog'],
 ['equipment unavailable',v=>v.recommendation_candidate.changes[0].to_catalogue_id='machine_crunch'],
 ['wrong from',v=>v.recommendation_candidate.changes[0].from_catalogue_id='db_curl'],
 ['duplicate target',v=>v.recommendation_candidate.changes[1]=structuredClone(v.recommendation_candidate.changes[0])],
 ['unregistered evidence',v=>v.facts_used=['private']],
 ['sensitive data',v=>v.answer='correo@example.com']]){
  const v=structuredClone(o);mutate(v);check(name+' denied',!C.semantic(v,ctx).ok);
 }
 const rq=C.requestBody(ctx);check('strict JSON fixed model and storefalse',rq.store===false&&rq.text.format.strict&&rq.model===C.MODEL&&rq.max_output_tokens===1000);
 const fatigue=structuredClone(o);fatigue.recommendation_candidate.changes=[{action:'replace_exercise',exercise_ref:'exercise_6',from_catalogue_id:'goblet',to_catalogue_id:'bar_squat'}];fatigue.recommendation_candidate.facts=[{exercise_ref:'exercise_6',claim:ctx.training.routine.exercises[5].metrics.trend}];
 check('higher fatigue requires visible warning',C.semantic(fatigue,ctx).warnings.includes('replacement_fatigue_increased:exercise_6'));
 const short=structuredClone(ctx);short.training.replacement_schedule=[];short.training.intake.minutes_by_day={mon:1,tue:1,thu:1,fri:1};
 check('duration independently rejected without stale values',C.semantic(fatigue,short).failures.includes('replacement_duration_exceeded'));
 check('v1.1 historical unchanged',Old.PROMPT_VERSION==='premium-chat-v1.1'&&Old.PROMPT.includes('conserva automáticamente TODAS'));
 check('v1.2 reassesses no fixed exercise alias',C.PROMPT_VERSION==='premium-chat-v1.2'&&!C.PROMPT.includes('Dead bug')&&!C.PROMPT.includes('Bird dog')&&C.PROMPT.includes('NO copia ciegamente'));
 let calls=0;const a=await C.analyze(ctx,'CONTROLLED_NON_SECRET',async()=>{calls++;return new Response(JSON.stringify({status:'completed',usage:{input_tokens:200,output_tokens:150},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(o)}]}]}));});
 check('one request no retry correct receipt',calls===1&&!a.error&&a.receipt.prompt_version===C.PROMPT_VERSION);
 const A=require('../../assets/coach-premium-adapter.js'),view=A.recommendation({kind:'MODIFY',patches:s.plan.patches.map((p,i)=>({...p,exercise_name:i?'Bird dog':'Dead bug'}))});
 check('reviewer shows newly calculated full series',view.changes[0].after.planned_sets[0].rest_seconds===120&&view.changes[0].after.planned_sets[0].reps_max===15);
 fs.writeFileSync(path.join(__dirname,'results/contract.json'),JSON.stringify(rows,null,2));console.log(rows.length+'/'+rows.length+' prescription checks; no provider');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
