// Requires the actual staging samples from backend.sql, saved in ignored results/backend.json.
 // All provider transport is intercepted: these are contract tests, not live AI answers.
 const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
 const root=path.resolve(__dirname,'../..'),rows=[];
 const check=(name,ok)=>{assert.ok(ok,name);rows.push({name,pass:true});};
 async function main(){
  const C=await import(pathToFileURL(path.join(root,'supabase/functions/simple-coach-chat/chat-contract.mjs')));
  const samples=JSON.parse(fs.readFileSync(path.join(__dirname,'results/backend.json'),'utf8')).samples;
  for(const [name,ctx] of Object.entries(samples)){
   check(name+' actual SQL projection accepted by unchanged Edge contract',C.contextQuality(ctx).ok);
   const projected=JSON.parse(C.requestBody(ctx).input[0].content);
   check(name+' provider body keeps exact status/explanation without private fields',JSON.stringify(projected.recent_decisions)===JSON.stringify(ctx.recent_decisions)&&!/PRIVATE CANARY|review_reason|analysis_trace|reviewer_id|user_id/.test(JSON.stringify(projected)));
  }
  const pending=samples['REVIEW pending'],decision=pending.recent_decisions[0];
  const questions=[
   ['¿Por qué está mi semana en revisión?','La explicación registrada indica que faltan datos suficientes y hay ejercicios excluidos en la programación heredada. Sigue pendiente de revisión humana; la revisión activa continúa siendo la 1.'],
   ['¿Por qué no has cambiado mi rutina?','La decisión es REVIEW, pendiente de revisión humana y sin cambios. Tu revisión activa sigue siendo la 1.'],
   ['¿Qué observaste esta semana?','La interpretación registrada indica evidencia insuficiente y una contradicción con los ejercicios excluidos; no prueba otros motivos.'],
   ['¿Qué decidió SIMPLE Coach?','Dejó la propuesta en REVIEW, pendiente de revisión humana y sin cambios aplicados.']
  ];
  for(const [message,answer] of questions){
   let calls=0;const ctx={...pending,message};
   const result=await C.analyze(ctx,'SYNTHETIC_CONTRACT_ONLY',async(_,opts)=>{
    calls++;const sent=JSON.parse(JSON.parse(opts.body).input[0].content);
    assert.equal(sent.recent_decisions[0].reason,decision.reason);
    assert.equal(sent.recent_decisions[0].interpretation,decision.interpretation);
    return new Response(JSON.stringify({status:'completed',usage:{input_tokens:100,output_tokens:60},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({schema_version:C.SCHEMA_VERSION,answer,facts_used:['decision_1'],suggested_action:'none',recommendation_candidate:null})}]}]}));
   });
   check(message+' mocked bounded answer uses decision evidence and has no candidate',!result.error&&calls===1&&result.output.answer===answer&&result.output.recommendation_candidate===null);
  }
  check('superseded is never serialized as pending or accepted',samples.superseded.recent_decisions[0].state==='superseded');
  check('resolved retains original REVIEW and real KEEP ready',samples['REVIEW resolved'].recent_decisions[0].original_kind==='REVIEW'&&samples['REVIEW resolved'].recent_decisions[0].kind==='KEEP'&&samples['REVIEW resolved'].recent_decisions[0].state==='ready');
  check('legacy absence stays null through provider body',JSON.parse(C.requestBody(samples['legacy missing interpretation']).input[0].content).recent_decisions[0].interpretation===null);
  fs.writeFileSync(path.join(__dirname,'results/contract.json'),JSON.stringify({rows,count:rows.length,failed:0,real_provider_calls:0},null,2));
  console.log(rows.length+'/'+rows.length+' actual-projection contract checks; transport intercepted');
 }
 main().catch(e=>{console.error(e.message);process.exitCode=1;});
