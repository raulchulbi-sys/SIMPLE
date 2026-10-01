const fs=require('fs'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const rows=[];const check=(name,v)=>{assert(v,name);rows.push(name);};
(async()=>{for(const engine of ['chromium','webkit']){const browser=await(engine==='chromium'?chromium:webkit).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});try{const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 for(const k of 'ABCDEFGH'){await p.goto('http://127.0.0.1:4200/demo?case='+k,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.qualityReady);
  const r=JSON.parse(fs.readFileSync(__dirname+'/results/real-quality-'+k+'.json'));
  if(!r.proposal){check(engine+' '+k+' honestly pending',await p.locator('#coachDialog').textContent().then(s=>s.includes('No generado')));continue;}
  const expected=r.proposal.days.flatMap(d=>d.exercises.flatMap(e=>e.planned_sets));
  check(engine+' '+k+' all real sets rendered',await p.locator('.coach-prescription li').count()===expected.length);
  check(engine+' '+k+' exact per-set targets',await p.locator('.coach-prescription li').allTextContents().then(texts=>texts.every((text,i)=>text.includes(expected[i].reps_min+'–'+expected[i].reps_max+' reps')&&text.includes('RIR '+expected[i].rir)&&text.includes('min'))));
  if(['B','E'].includes(k))for(const theme of ['light','dark']){await p.evaluate(t=>simpleTheme.set(t),theme);await p.waitForTimeout(350);check(engine+' '+k+' '+theme+' mobile',await p.locator('#coachDialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1));if(engine==='chromium')await p.screenshot({path:__dirname+'/results/real-'+k+'-'+theme+'.png'});}
 }
 await p.evaluate(()=>{coachStartQuestionnaire();simpleCoach.wizard.step=8;coachRenderQuestionnaire();});
 check(engine+' abdominal machine/wheel visible Basic',await p.locator('[value=ab_machine]').count()===1&&await p.locator('[value=ab_wheel]').count()===1);
 await p.locator('[value=ab_machine]').check();await p.locator('[value=ab_wheel]').check();check(engine+' material stored only as availability',await p.evaluate(()=>simpleCoach.wizard.data.inventory.equipment.includes('ab_machine')&&simpleCoach.wizard.data.excluded.length===0));
 await p.evaluate(()=>{simpleCoach.wizard.step=6;coachRenderQuestionnaire();});check(engine+' six exact exclusions available',await p.evaluate(()=>['floor_crunch','reverse_crunch','weighted_crunch','cable_crunch','machine_crunch','ab_wheel'].every(id=>!!document.querySelector('[data-field=excluded] [value='+id+']'))));
 await p.locator('[data-field=excluded] [value=machine_crunch]').check();check(engine+' exclusion by exact ID independent from machine',await p.evaluate(()=>simpleCoach.wizard.data.excluded.includes('machine_crunch')&&simpleCoach.wizard.data.inventory.equipment.includes('ab_machine')));
 await p.evaluate(()=>{coachStartQuestionnaire(null,true);simpleCoach.wizard.step=coachWizardSteps().indexOf('inventory');coachRenderQuestionnaire();});check(engine+' Premium catalogue unchanged',await p.locator('[value=ab_machine]').count()===0&&await p.locator('[value=ab_wheel]').count()===0);
 check(engine+' no browser errors',errors.length===0);
 }finally{await browser.close();}}
 fs.writeFileSync(__dirname+'/results/real-ui.json',JSON.stringify({passed:rows.length,total:rows.length,rows},null,2));console.log(rows.length+'/'+rows.length+' archived real outputs UI (no network/provider calls)');
})().catch(e=>{console.error(e);process.exitCode=1;});
