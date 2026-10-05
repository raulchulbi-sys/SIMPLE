/* Local questionnaire UX only. No Supabase or OpenAI requests. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.PREMIUM_PREVIEW_URL||'http://127.0.0.1:4234',out=path.join(__dirname,'results'),rows=[];
fs.mkdirSync(out,{recursive:true});
const check=(name,value)=>{rows.push({name,pass:!!value});assert(value,name);};
async function ready(p,url){await p.goto(url+'/review');const f=p.frameLocator('iframe');await f.locator('body').evaluate(()=>new Promise(resolve=>{const timer=setInterval(()=>{if(window.previewReady){clearInterval(timer);resolve();}},50);}));await p.locator('#open').click();await f.locator('.premium-nav').first().waitFor();return f;}
async function inventory(f){await f.locator('body').evaluate(()=>{const w=simpleCoach.wizard,I=coachIntake;w.data={...I.emptyPremium(),experience:'y2_4',pause:false,goal:'balanced',days:2,weekdays:['mon','thu'],minutes_by_day:{mon:60,thu:45},weak_points:['upper_back'],effort:'confident',confidence:'medium',activity:{type:'none',weekdays:[],minutes:null,intensity:null},recovery:'mostly',sleep:'h7_8',stress:'low',distribution:'coach',excluded:['db_curl'],inventory:{equipment:['dumbbells','bench'],custom:['Equipo adicional']}};w.step=coachWizardSteps().indexOf('inventory');coachRenderQuestionnaire();});}
(async()=>{
 for(const engine of ['chromium','webkit']){
  const browser=await(engine==='chromium'?chromium:webkit).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
  const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[],external=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/*',r=>{const url=new URL(r.request().url());if(url.hostname!=='127.0.0.1'){external.push(url.hostname);return r.abort();}return r.continue();});
  try{
   if(engine==='chromium'&&process.env.BEFORE_URL){const before=await ready(p,process.env.BEFORE_URL);await inventory(before);for(const theme of ['light','dark']){await before.locator('body').evaluate((_,t)=>simpleTheme.set(t),theme);await before.locator('#coachDialog').evaluate(d=>d.scrollTop=0);await p.screenshot({path:path.join(out,'before-390-'+theme+'.png')});}}
   const f=await ready(p,base);await inventory(f);
   check(engine+' partial selection is announced as mixed',await f.locator('#coachAllEquipment').evaluate(e=>e.indeterminate&&!e.checked));
   await f.locator('#coachAllEquipment').focus();await p.keyboard.press('Space');
   check(engine+' keyboard selects every catalogue item once',await f.locator('body').evaluate(()=>{const a=simpleCoach.wizard.data.inventory.equipment;return a.length===globalThis.SimpleCoachIntake.equipment.length&&new Set(a).size===a.length&&globalThis.SimpleCoachIntake.equipment.every(e=>a.includes(e.id));}));
   check(engine+' custom equipment and exclusions preserved',await f.locator('body').evaluate(()=>JSON.stringify(simpleCoach.wizard.data.inventory.custom)==='["Equipo adicional"]'&&JSON.stringify(simpleCoach.wizard.data.excluded)==='["db_curl"]'));
   await f.locator('#coachSearch').fill('Mancuernas');await f.locator('input[name="equipment"][value="dumbbells"]').uncheck();
   check(engine+' filtered individual exception updates bulk state',await f.locator('body').evaluate(()=>!simpleCoach.wizard.data.inventory.equipment.includes('dumbbells')&&simpleCoach.wizard.data.inventory.equipment.length===globalThis.SimpleCoachIntake.equipment.length-1&&$('coachAllEquipment').indeterminate));
   await f.locator('#coachAllEquipment').check();
   check(engine+' bulk selection also includes hidden search matches',await f.locator('body').evaluate(()=>simpleCoach.wizard.data.inventory.equipment.length===globalThis.SimpleCoachIntake.equipment.length));
   await f.locator('#coachAllEquipment').uncheck();
   check(engine+' uncheck clears catalogue without altering other answers',await f.locator('body').evaluate(()=>simpleCoach.wizard.data.inventory.equipment.length===0&&simpleCoach.wizard.data.inventory.custom.length===1&&simpleCoach.wizard.data.excluded[0]==='db_curl'&&!$('coachAllEquipment').indeterminate));
   await f.locator('#coachSearch').fill('');await f.locator('#coachAllEquipment').check();await f.locator('#coachBack').click();await f.locator('#coachNext').click();
   check(engine+' back and forward preserve all equipment',await f.locator('#coachAllEquipment').isChecked());
   await f.locator('#coachNext').click();
   check(engine+' review retains exactly the catalogue and valid contract',await f.locator('body').evaluate(()=>coachIntake.premiumErrors(simpleCoach.wizard.data).length===0&&Object.keys(simpleCoach.wizard.data.inventory).sort().join(',')==='custom,equipment'&&globalThis.SimpleCoachIntake.equipment.every(e=>$('coachProposal').textContent.includes(e.label))));
   await f.locator('#coachReviewBack').click();
   for(const width of [320,360,390,430,1280])for(const theme of ['light','dark']){
    await p.setViewportSize({width,height:width===1280?900:844});await f.locator('body').evaluate((_,t)=>simpleTheme.set(t),theme);
    await f.locator('#coachDialog').evaluate(async d=>{d.getAnimations({subtree:true}).forEach(a=>{if(a.effect.getTiming().iterations!==Infinity)a.finish();});d.scrollTop=0;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
    const fit=await f.locator('#coachDialog').evaluate(d=>{const list=$('coachSearchResults'),label=$('coachAllEquipment').closest('label'),css=getComputedStyle(d);return {fit:d.scrollWidth<=d.clientWidth+1&&document.documentElement.scrollWidth<=innerWidth+1,single:getComputedStyle(list).overflowY==='visible'&&getComputedStyle(list).maxHeight==='none',touch:label.getBoundingClientRect().height>=44,scroll:css.touchAction.includes('pan-y')&&css.touchAction.includes('pinch-zoom')&&css.scrollbarWidth!=='thin',theme:document.documentElement.dataset.theme};});
    check(engine+' '+width+' '+theme+' fit, touch target and one native scroll area',fit.fit&&fit.single&&fit.touch&&fit.scroll&&fit.theme===theme);
    if(engine==='chromium'&&(width===390||width===1280))await p.screenshot({path:path.join(out,'after-'+width+'-'+theme+'.png')});
    const box=await f.locator('#coachDialog').boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.wheel(0,10000);
    await f.locator('#coachDialog').evaluate(()=>new Promise(r=>setTimeout(r,150)));
    check(engine+' '+width+' '+theme+' wheel reaches navigation without nested scroll trap',await f.locator('#coachDialog').evaluate(d=>{const b=$('coachNext').getBoundingClientRect(),r=d.getBoundingClientRect();return d.scrollTop>0&&b.top>=r.top&&b.bottom<=r.bottom;}));
   }
   await f.locator('#coachDialog').evaluate(d=>d.scrollTop=0);await f.locator('#coachAllEquipment').focus();await p.keyboard.press('Tab');await p.keyboard.press('Shift+Tab');
   check(engine+' visible keyboard focus',await f.locator('#coachAllEquipment').evaluate(e=>e.matches(':focus-visible')&&getComputedStyle(e).outlineStyle!=='none'));
   await f.locator('body').evaluate(()=>{coachStartQuestionnaire(null,false);simpleCoach.wizard.step=coachWizardSteps().indexOf('inventory');coachRenderQuestionnaire();});
   check(engine+' Basic does not acquire Premium controls or scrolling',await f.locator('body').evaluate(()=>!$('coachAllEquipment')&&!document.querySelector('.coach-premium-questionnaire')&&getComputedStyle($('coachSearchResults')).maxHeight!=='none'));
   check(engine+' no browser errors or remote requests',errors.length===0&&external.length===0);
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,'ui.json'),JSON.stringify({completed:!process.exitCode,total:rows.length,rows},null,2));console.log(rows.filter(x=>x.pass).length+'/'+rows.length+' focused UI checks');});
