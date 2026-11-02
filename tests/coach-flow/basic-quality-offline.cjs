// Preparation only: no SDK, credentials, network, SQL, activation or provider calls.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
globalThis.fetch=()=>{throw Error('Network forbidden');};
const root=path.resolve(__dirname,'../..'),profiles=require('./basic-quality-profiles.json');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),checks=[],rows=[];
const check=(name,fn)=>{fn();checks.push({name,pass:true});};
(async()=>{
 const C=await import('../../supabase/functions/simple-coach-mock/contract.mjs');
 const G=await import('../../supabase/functions/simple-coach-mock/staging-cost-guard.mjs'),I=globalThis.SimpleCoachIntakeV5,Q=globalThis.SimpleCoachProgrammingV5;
 assert.equal(profiles.length,4);assert.deepEqual(profiles.map(x=>x.id),['A','B','C','D']);
 for(const p of profiles){
  const t=p.training,copy=JSON.stringify(t),allowed=I.allowedExercises(t),request=G.prepareBoundedRequest({training:t},C.DEFAULT_MODEL),wire=JSON.parse(request.wire),context=JSON.parse(wire.input[0].content);
  check(p.id+' exact supported Basic V2 questionnaire',()=>{assert.deepEqual(I.basicErrors(t),[]);assert.deepEqual(I.providerTraining(t),t);assert.equal(C.safetyGate({training:t}),null);});
  check(p.id+' catalogue availability, major coverage and exclusions',()=>{assert(allowed.length>0);assert(Q.major.every(g=>allowed.some(e=>Q.byId.get(e.id).primary.includes(g))));assert(allowed.every(e=>e.requires.every(k=>t.inventory.equipment.includes(k))&&!t.excluded.includes(e.id)));assert(allowed.some(e=>Q.byId.get(e.id).primary.includes('core')));});
  check(p.id+' exact final request remains inside byte and fixed configuration limits',()=>{assert(Buffer.byteLength(request.wire)<=16384);assert.equal(wire.model,'gpt-5.4-2026-03-05');assert.equal(wire.max_output_tokens,5120);assert.equal(wire.service_tier,'default');assert.equal(wire.truncation,'disabled');assert.equal(wire.store,false);assert.equal(wire.reasoning.effort,'low');assert(!wire.tools);assert.equal(JSON.stringify(t),copy);});
  check(p.id+' provider context/schema contain exact days/material and permitted exercises only',()=>{assert.deepEqual(context.training,t);assert.deepEqual(context.session_days,I.weekdays.filter(d=>t.weekdays.includes(d.id)).map(d=>d.id));assert.deepEqual(context.catalogue.map(e=>e[0]),allowed.map(e=>e.id));assert.deepEqual(wire.text.format.schema.properties.days.items.properties.exercises.items.properties.id.enum,allowed.map(e=>e.id));});
  const proxy=Math.ceil(Buffer.byteLength(request.wire)/4),output={A:[1300,2300],B:[2000,3300],C:[2700,4500],D:[1300,2600]}[p.id];
  rows.push({id:p.id,requestBytes:Buffer.byteLength(request.wire),requestSHA256:hash(request.wire),allowedExercises:allowed.length,inputTokenProxy:proxy,proxyNotCount:true,outputScenario:output,scenarioCostUSD:output.map(o=>(proxy*2.5+o*15)/1e6),conditionalStandardMaximumUSD:(12000*2.5+5120*15)/1e6,exactTokenCount:null});
 }
 check('A 35 and 40 minutes cannot silently enter this contract',()=>{for(const minutes of [35,40])assert(I.basicErrors({...profiles[0].training,minutes}).includes('minutes'));});
 check('no invented Premium fields or activity load accepted',()=>{assert(I.basicErrors({...profiles[3].training,minutes_by_day:{tue:45,fri:45}}).includes('schema'));assert(I.basicErrors({...profiles[3].training,activity:{type:'football',weekdays:['thu','sat'],intensity:'high'}}).includes('activity'));});
 fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});
 const result={preparationOnly:true,providerCalls:0,tokenCountCalls:0,activation:false,passed:checks.length,total:checks.length,checks,rows};
 fs.writeFileSync(path.join(__dirname,'results/basic-quality-offline.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
