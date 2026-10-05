// New Phase 3 offline browser checks. No Auth, database, or model requests.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const C=require('../../assets/coach-premium-weekly.js'),out=path.join(__dirname,'results'),base='http://127.0.0.1:4241',rows=[],screenshots=[];
fs.mkdirSync(out,{recursive:true});
function check(name,value){rows.push({name,pass:!!value});assert(value,name);}
async function inspect(p){return p.evaluate(()=>window.PremiumWeeklyUI.inspect());}
async function ready(p){await p.waitForFunction(()=>window.PremiumWeeklyUI?.inspect().view&&!window.PremiumWeeklyUI.inspect().busy);}
async function reset(p,tag){await p.evaluate(async tag=>{document.getElementById('case').value=tag;document.getElementById('actor').value='athlete';for(const k of Object.keys(localStorage))if(k.startsWith('simple-premium-weekly:'))localStorage.removeItem(k);await fetch('/weekly-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reset',tag,actor:'athlete',data:{}})});await window.PremiumWeeklyUI.load();},tag);await ready(p);}
async function start(p){if(await p.locator('#permission').count())await p.locator('#permission').check();await p.getByRole('button',{name:/^(Empezar|Continuar) check-in$/}).click();await p.locator('#checkin-form').waitFor();}
async function next(p,value){await p.locator('input[name=answer][value="'+value+'"]').check();await p.getByRole('button',{name:'Continuar',exact:true}).click();await p.waitForFunction(()=>!window.PremiumWeeklyUI.inspect().busy);}
async function geometry(p,label){
 check(label+' no horizontal overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 check(label+' single body scroll',await p.evaluate(()=>![...document.querySelectorAll('main,article,section,fieldset,form,.answer-options,.facts,.changes,.checkin-summary')].some(e=>/auto|scroll/.test(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+1)));
 check(label+' controls at least 44px',await p.evaluate(()=>[...document.querySelectorAll('button,select,.answer-row,.checkbox-row')].filter(e=>e.getClientRects().length).every(e=>e.getBoundingClientRect().height>=43.5)));
}
async function snap(p,file){const target=path.join(out,file);await p.screenshot({path:target,fullPage:true});screenshots.push(file);}
async function api(p,action,data={}){return p.evaluate(async({action,data})=>{const r=await fetch('/weekly-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,tag:document.getElementById('case').value,actor:document.getElementById('actor').value,data})});return {status:r.status,value:await r.json()};},{action,data});}
async function actor(p,value){await p.locator('details').evaluate(d=>d.open=true);await p.locator('#actor').selectOption(value);await ready(p);}
(async()=>{
 check('schema version fixed',C.SCHEMA==='premium-weekly-checkin-v1');
 check('empty answers remain null',C.emptyAnswers().recovery===null&&C.emptyAnswers().availability.changed===null);
 check('draft scope includes identity and context',C.draftKey({user_id:'u',mesocycle:{id:'m',revision_id:'r'},week:{id:'w'}})==='simple-premium-weekly:u:m:w:r');
 check('unknown exercise cannot validate',!!C.validateStep({...C.emptyAnswers(),review:{topic:'exercise',exercise_id:'wrong'}},6,[]));
 check('partial draft normalized without invented answers',C.normalizeDraft({recovery:'good'}).recovery==='good'&&C.normalizeDraft({recovery:'good'}).sleep===null&&C.normalizeDraft({recovery:'good'}).availability.changed===null);
 for(const engine of ['chromium','webkit']){
  const browser=await(engine==='chromium'?chromium:webkit).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
  try{
   for(const width of [320,360,390,430,1280])for(const theme of ['light','dark']){
    const context=await browser.newContext({viewport:{width,height:900}}),p=await context.newPage(),errors=[],requests=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.url().endsWith('/weekly-api'))requests.push(JSON.parse(r.postData()));});
    const label=engine+' '+width+' '+theme;
    try{
     await p.goto(base+'/review');await ready(p);await p.evaluate(theme=>{document.documentElement.dataset.theme=theme;localStorage.setItem('premium-weekly-theme',theme);},theme);await reset(p,'normal');
     check(label+' offline notice clear',(await p.locator('.preview-label').textContent()).includes('Datos y acciones simulados localmente'));
     check(label+' week 3 of 6',(await p.locator('#week-heading').textContent())==='Semana 3 de 6');
     await p.getByRole('button',{name:'Empezar check-in',exact:true}).click();check(label+' consent explicit',(await p.locator('#message').textContent()).includes('Marca el permiso'));
     await start(p);if(engine==='chromium'&&width===320&&theme==='light')await snap(p,'question-320-light.png');await p.getByRole('button',{name:'Continuar',exact:true}).click();check(label+' required response error',(await p.locator('#message').textContent()).includes('Elige una respuesta'));
     await next(p,'good');await p.getByRole('button',{name:'Atrás',exact:true}).click();check(label+' back preserves recovery',await p.locator('input[value=good]').isChecked());
     await p.getByRole('button',{name:'Continuar',exact:true}).click();await p.waitForFunction(()=>window.PremiumWeeklyUI.inspect().step===1&&!window.PremiumWeeklyUI.inspect().busy);await p.locator('input[value=normal]').check();
     await p.reload();await ready(p);await start(p);check(label+' draft survives reload',(await inspect(p)).step===1&&await p.locator('input[value=normal]').isChecked());
     await next(p,'normal');await next(p,'high');await next(p,'moderate');await next(p,'similar');
     await p.locator('input[value=true]').check();await p.getByRole('button',{name:'Continuar',exact:true}).click();check(label+' availability requires day',(await p.locator('#message').textContent()).includes('al menos un día'));
     await p.locator('input[name=weekday][value=mon]').check();await p.locator('#minutes-mon').selectOption('45');await p.getByRole('button',{name:'Continuar',exact:true}).click();await p.waitForFunction(()=>window.PremiumWeeklyUI.inspect().step===6&&!window.PremiumWeeklyUI.inspect().busy);
     await p.locator('input[value=exercise]').check();await p.getByRole('button',{name:'Revisar check-in',exact:true}).click();check(label+' exercise exact selection required',(await p.locator('#message').textContent()).includes('Selecciona un ejercicio'));
     await p.locator('#exercise').selectOption('10000000-0000-4000-8000-000000000010');await p.getByRole('button',{name:'Revisar check-in',exact:true}).click();await p.getByRole('button',{name:'Enviar check-in',exact:true}).waitFor();
     check(label+' seven answers summarized',(await p.locator('.checkin-summary>div').count())===7);await geometry(p,label+' confirm');
     await p.evaluate(()=>{const b=document.querySelector('[data-action=submit]');b.click();b.click();});await p.getByRole('button',{name:'Analizar semana',exact:true}).waitFor();
     check(label+' double submit single request',requests.filter(r=>r.action==='save'&&r.data.submit).length===1);check(label+' submitted immutable',await p.locator('#checkin-form').count()===0&&(await p.locator('.submitted').textContent()).includes('no se pueden editar'));
     const c=(await inspect(p)).view.checkin;const s=(await inspect(p)).view;
     const again=await api(p,'save',{week:s.week.number,revision:s.mesocycle.revision_id,expected:0,answers:c.answers,submit:true});check(label+' repeat exact submit idempotent',again.status===200&&again.value.id===c.id&&again.value.row_version===c.row_version);
     await p.evaluate(()=>{const b=document.querySelector('[data-action=analyze]');b.click();b.click();});await p.locator('#screen-title').filter({hasText:'Mantener la rutina'}).waitFor();
     check(label+' double analysis single request',requests.filter(r=>r.action==='analyze').length===1);check(label+' facts plus checkin',(await p.locator('.facts').textContent()).includes('S1')&&(await p.locator('.checkin-summary').textContent()).includes('Alta'));
     check(label+' athlete cannot accept before reviewer',await p.getByRole('button',{name:/^Aceptar/}).count()===0);
     await actor(p,'reviewer');await p.getByRole('button',{name:'Validar propuesta',exact:true}).waitFor();await p.getByRole('button',{name:'Validar propuesta',exact:true}).click();await p.locator('.status').filter({hasText:'lista para aceptar'}).waitFor();await actor(p,'athlete');
     const accept=p.getByRole('button',{name:'Aceptar mantener',exact:true});await accept.waitFor();await p.keyboard.press('Tab');await accept.focus();check(label+' visible keyboard focus',await accept.evaluate(b=>document.activeElement===b&&getComputedStyle(b).outlineStyle!=='none'));
     await geometry(p,label+' analyzed');
     if(engine==='chromium'&&width===390&&theme==='light'){await p.locator('details').evaluate(d=>d.open=false);await snap(p,'checkin-analysis-390-light.png');}
     for(const tag of ['decline','schedule','discrepancy','insufficient','longname','blank','missing']){
      await reset(p,tag);const analyze=p.getByRole('button',{name:tag==='blank'||tag==='missing'?'Analizar solo entrenamientos':'Analizar semana',exact:true});await analyze.click();await p.waitForFunction(()=>!!window.PremiumWeeklyUI.inspect().view.recommendation&&!window.PremiumWeeklyUI.inspect().busy);
      await geometry(p,label+' '+tag);
      if(tag==='decline'){check(label+' per-set before after',(await p.locator('#before-after').textContent()).includes('S2 · 10–12 reps · RIR 1 · 3 min')&&(await p.locator('#before-after').textContent()).includes('Se elimina la serie 2 original'));}
      if(tag==='schedule'){check(label+' logical schedule preserved',(await p.locator('.schedule>div').count())===5&&(await p.locator('.schedule').textContent()).includes('Martes → Miércoles'));}
      if(tag==='discrepancy'){check(label+' REVIEW cannot apply',await p.locator('#before-after').count()===0&&await p.getByRole('button',{name:/^Aceptar/}).count()===0);await actor(p,'reviewer');check(label+' REVIEW requires separate resolution',await p.getByRole('button',{name:'Resolver sin cambios',exact:true}).count()===1&&await p.getByRole('button',{name:'Validar propuesta',exact:true}).count()===0);}
      if(tag==='insufficient'||tag==='blank')check(label+' '+tag+' no invented trend',await p.locator('.facts').count()===0);
      if(tag==='missing')check(label+' missing explicit',(await p.locator('.missing').textContent()).includes('No hay check-in enviado')&&(await inspect(p)).view.recommendation.checkin_missing===true);
      if(engine==='chromium'&&width===390&&theme==='dark'&&tag==='decline'){await p.locator('details').evaluate(d=>d.open=false);await snap(p,'adjustment-390-dark.png');}
      if(engine==='chromium'&&width===1280&&theme==='light'&&tag==='schedule'){await p.locator('details').evaluate(d=>d.open=false);await snap(p,'schedule-1280-light.png');}
     }
     check(label+' no browser errors',errors.length===0);
    }finally{await context.close();}
   }
   const context=await browser.newContext({viewport:{width:390,height:844}}),p=await context.newPage();await p.goto(base+'/review');await ready(p);
   try{
    await reset(p,'error');await start(p);await p.locator('input[value=good]').check();await p.getByRole('button',{name:'Continuar',exact:true}).click();await p.waitForFunction(()=>!window.PremiumWeeklyUI.inspect().busy);check(engine+' error keeps answer',await p.locator('input[value=good]').isChecked()&&(await p.locator('#message').textContent()).includes('Tus respuestas siguen'));check(engine+' error retry available',await p.getByRole('button',{name:'Continuar',exact:true}).isEnabled());
    await reset(p,'blank');await reset(p,'slow');await p.getByRole('button',{name:'Analizar solo entrenamientos',exact:true}).click();check(engine+' busy prevents duplicate',await p.getByRole('button',{name:'Analizar solo entrenamientos',exact:true}).isDisabled());await p.locator('details').evaluate(d=>d.open=true);await p.locator('#case').selectOption('blank');await ready(p);await p.waitForTimeout(1300);check(engine+' late callback cannot replace new case',(await inspect(p)).view.tag==='blank'&&(await p.locator('#screen-title').textContent())==='Check-in de la semana');
    await reset(p,'normal');const p2=await context.newPage();await p2.goto(base+'/review');await ready(p2);await start(p);await start(p2);await p.locator('input[value=good]').check();await p2.waitForFunction(()=>window.PremiumWeeklyUI.inspect().conflict);check(engine+' cross-tab edit blocks stale overwrite',await p2.getByRole('button',{name:'Continuar',exact:true}).isDisabled());await p.getByRole('button',{name:'Continuar',exact:true}).click();await p.waitForFunction(()=>!window.PremiumWeeklyUI.inspect().busy);await p2.getByRole('button',{name:'Cargar borrador actualizado',exact:true}).click();await ready(p2);await start(p2);check(engine+' cross-tab reload gets current answer',await p2.locator('input[value=good]').isChecked());await p2.close();
    await reset(p,'stable');const state=(await inspect(p)).view;const bad=await api(p,'save',{week:2,revision:state.mesocycle.revision_id,expected:1,answers:state.checkin.answers,submit:true});check(engine+' old week payload rejected',bad.status===400&&bad.value.error==='premium_weekly_stale_context');
    await reset(p,'closed');check(engine+' closed week cannot edit',await p.getByRole('button',{name:/check-in/}).count()===0);
    await reset(p,'revoked');await p.getByRole('button',{name:'Analizar semana',exact:true}).click();check(engine+' revoked grant requires explicit renewal',(await p.locator('#message').textContent()).includes('Marca el permiso'));
    await reset(p,'stale');check(engine+' stale proposal cannot accept',await p.getByRole('button',{name:/^Aceptar/}).count()===0&&await p.getByRole('button',{name:'Cargar semana actual',exact:true}).count()===1);
    check(engine+' private files not served',(await p.request.get(base+'/tests/premium-weekly/private/sessions.json')).status()===404);
   }finally{await context.close();}
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,'ui.json'),JSON.stringify({suite:'premium-weekly-ui-v1',mode:'offline',rows,total:rows.length,passed:rows.filter(r=>r.pass).length,completed:!process.exitCode,screenshots},null,2));console.log(rows.filter(r=>r.pass).length+'/'+rows.length+' new Premium weekly browser checks');});
