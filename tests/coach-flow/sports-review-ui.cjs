// Real reviewer renderer with a local in-memory backend; NOT authenticated staging.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=require('./basic-real-proposal.json'),root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'results'),rows=[];
fs.mkdirSync(out,{recursive:true});
const check=(name,v)=>{assert(v,name);rows.push({name,pass:true});};
(async()=>{
 for(const engine of ['chromium','webkit']){
  const browser=await(engine==='chromium'?chromium:webkit).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
  try{
   const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>{requests.push(r.request().url());return r.abort();});
   await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
   const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
   for(const m of index.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g))await page.addStyleTag({content:m[1]});
   for(const file of ['theme.css','coach.css'])await page.addStyleTag({content:fs.readFileSync(path.join(root,'assets',file),'utf8')});
   await page.evaluate(()=>{
    window.$=id=>document.getElementById(id);window.esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    window.SUPABASE_URL='https://dmqjexigdnfzobarhnib.supabase.co';window.user={id:'synthetic-reviewer'};window.profile={role:'trainer'};
    window.db={auth:{onAuthStateChange(){}},from(){return{select(){return{order:async()=>({data:[],error:null})};}};}};
   });
   for(const file of ['coach-intake.js','coach-programming-v4.js','coach-programming-v5.js','coach-questionnaire.js','coach-prescription.js','coach.js','coach-reviewer.js'])
    await page.addScriptTag({content:fs.readFileSync(path.join(root,'assets',file),'utf8')});
   await page.evaluate(async f=>{
    window.reviewWrites=0;window.coachCall=async name=>{
     if(name==='get_coach_review_queue')return[{athlete:{name:'Synthetic athlete'},training:f.training,operation:{id:'synthetic-operation',user_id:'synthetic-owner',state:'pending_review',prompt_version:'basic-initial-v5',proposal:f.proposal}}];
     if(name==='get_coach_pilot_metrics')return{};
     if(name==='get_coach_reviewer_status')return{authorized:true,expires_at:'2099-01-01'};
     reviewWrites++;throw Error('No mutation authorized in UI test');
    };await openCoachReviewer();
   },fixture);
   const quality=page.locator('.coach-quality');
   check(engine+' actual reviewer renders all five contextual warnings and separate counts',await quality.locator('ul > li').count()===5&&(await quality.innerText()).includes('0 series directas / 0 días; participación secundaria en 6 series / 3 días.')&&(await quality.innerText()).includes('no un mínimo universal')&&(await quality.innerText()).includes('regiones distintas del hombro')&&(await quality.innerText()).includes('recuperación percibida'));
   check(engine+' warnings do not disable human decision or trigger writes',await page.getByRole('button',{name:'Aprobar propuesta',exact:true}).isEnabled()&&await page.getByRole('button',{name:'Rechazar propuesta',exact:true}).isEnabled()&&await page.locator('#coachQueue > section form textarea').getAttribute('required')!==null&&await page.evaluate(()=>reviewWrites===0)&&await page.locator('.coach-prescription ol li').count()===30);
   for(const width of [320,360,390,430,1280])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:844});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    check(engine+' '+width+' '+theme+' warning layout readable without horizontal overflow',await page.locator('#coachDialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1&&[...d.querySelectorAll('.coach-quality li')].every(e=>getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility==='visible')));
   }
   check(engine+' no browser errors or external requests',errors.length===0&&requests.length===0&&await page.evaluate(()=>reviewWrites===0));
  }finally{await browser.close();}
 }
 fs.writeFileSync(path.join(out,'sports-review-ui.json'),JSON.stringify({type:'browser with in-memory backend, no JWT',passed:rows.length,total:rows.length,rows},null,2));
 console.log(rows.length+'/'+rows.length+' offline reviewer browser checks');
})().catch(e=>{console.error(e);process.exitCode=1;});
