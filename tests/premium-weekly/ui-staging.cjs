// Run only after the root agent explicitly authorizes the matching fixture phase.
// `checkin`: W2 structured check-in. `review`: pre-created W2 KEEP review/accept.
const mode=process.argv[2];if(!['checkin','verify-checkin','review'].includes(mode)){console.error('Explicit checkin, verify-checkin, or review phase required; no actions performed.');process.exit(2);}
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const H=require('./live.cjs'),J=require('./jwt-preview.cjs'),C=require('../../assets/coach-premium-weekly.js');
assert.equal(H.credentials.ref,'dmqjexigdnfzobarhnib');
const out=path.join(__dirname,'results'),rows=[],base='http://127.0.0.1:4242',check=(name,v)=>{rows.push({name,pass:!!v});assert(v,name);};fs.mkdirSync(out,{recursive:true});
const ready=p=>p.waitForFunction(()=>window.PremiumWeeklyUI?.inspect().view&&!window.PremiumWeeklyUI.inspect().busy);
(async()=>{
 const initial=await J.state('athlete');assert.equal(initial.week.number,2,'Only explicitly reserved W2 fixture');assert(initial.permission,'Root-provisioned consent must exist');
 if(mode==='checkin')assert(!initial.checkin,'Do not overwrite a pre-existing W2 check-in');
 else if(mode==='verify-checkin')assert(initial.checkin?.submitted_at&&H.equal(initial.checkin.answers,H.normal()),'Read-only verification requires the already submitted exact W2 row');
 else assert(initial.recommendation?.kind==='KEEP'&&initial.recommendation?.state==='pending_review','Root must finish mock KEEP before review');
 const server=J.createJwtServer(mode==='verify-checkin'?'read-only':mode);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4242,'127.0.0.1',resolve);});
 const browser=await chromium.launch({headless:true,channel:'msedge'}),context=await browser.newContext({viewport:{width:390,height:844}}),p=await context.newPage(),payloads=[],outside=[];
 await p.route('**/weekly-api',async route=>{const response=await route.fetch(),body=await response.text();payloads.push(body);await route.fulfill({response,body});});
 p.on('request',r=>{if(!r.url().startsWith(base))outside.push(r.url());});
 try{
  await p.goto(base+'/review');await ready(p);if(mode!=='verify-checkin'){check(mode+' real JWT staging notice',(await p.locator('.preview-label').textContent()).includes('JWT real contra fixtures sintéticas de staging'));
  check(mode+' only mapped synthetic case',await p.locator('#case option').count()===1);check(mode+' staging reset hidden',await p.locator('#reset').isHidden());}
  if(mode==='checkin'){
   await p.getByRole('button',{name:'Empezar check-in',exact:true}).click();await p.locator('#checkin-form').waitFor();
   for(const [index,value] of ['normal','normal','normal','moderate','similar','false'].entries()){await p.locator('input[name=answer][value="'+value+'"]').check();await p.getByRole('button',{name:'Continuar',exact:true}).click();await p.waitForFunction(step=>window.PremiumWeeklyUI.inspect().step===step&&!window.PremiumWeeklyUI.inspect().busy,index+1);}
   await p.locator('input[name=answer][value=none]').check();await p.getByRole('button',{name:'Revisar check-in',exact:true}).click();await p.getByRole('button',{name:'Enviar check-in',exact:true}).waitFor();
   check('real draft reaches exact seven answers',(await p.locator('.checkin-summary>div').count())===7);
   await p.getByRole('button',{name:'Enviar check-in',exact:true}).click();await p.getByRole('button',{name:'Analizar semana',exact:true}).waitFor();
   const ui=await p.evaluate(()=>window.PremiumWeeklyUI.inspect().view),f=JSON.parse(fs.readFileSync(path.join(__dirname,'private/weekly-fixture.json'))),c=f.cases.longitudinal;
   const persisted=await H.must(H.read('mock','coach_weekly_checkins','mesocycle_id=eq.'+c.mesocycle+'&week_number=eq.2'));
   check('real JWT exact single W2 row',persisted.length===1&&persisted[0].id===ui.checkin.id&&persisted[0].routine_revision_id===initial.mesocycle.revision_id);
   check('real JWT exact submitted structured answers',!!persisted[0].submitted_at&&H.equal(persisted[0].answers,H.normal()));
   check('frontend and backend row_version match',persisted[0].row_version===ui.checkin.row_version);
   await p.reload();await ready(p);check('real submitted row survives reload immutable',await p.locator('#checkin-form').count()===0&&(await p.locator('.submitted').textContent()).includes('no se pueden editar'));
   await p.getByRole('button',{name:'Analizar semana',exact:true}).click();await ready(p);check('browser cannot dispatch provider',(await p.locator('#message').textContent()).includes('No se ha podido completar'));
   await p.screenshot({path:path.join(out,'jwt-checkin-390-light.png'),fullPage:true});
  }else if(mode==='review'){
   check('real KEEP athlete blocked pending reviewer',await p.getByRole('button',{name:/^Aceptar/}).count()===0);
   await p.locator('details').evaluate(d=>d.open=true);await p.locator('#actor').selectOption('reviewer');await ready(p);await p.getByRole('button',{name:'Validar propuesta',exact:true}).waitFor();
   await p.getByRole('button',{name:'Validar propuesta',exact:true}).click();await p.locator('.status').filter({hasText:'lista para aceptar'}).waitFor();
   check('real assigned reviewer approves W2',await p.getByRole('button',{name:'Validar propuesta',exact:true}).count()===0);
   await p.locator('#actor').selectOption('athlete');await ready(p);await p.getByRole('button',{name:'Aceptar mantener',exact:true}).waitFor();
   await p.getByRole('button',{name:'Aceptar mantener',exact:true}).click();await p.waitForFunction(()=>window.PremiumWeeklyUI.inspect().view.week.number===3&&!window.PremiumWeeklyUI.inspect().busy);
   const final=await J.state('athlete');check('real KEEP advances exactly to W3',final.week.number===3);check('real KEEP keeps exact revision',final.mesocycle.revision_id===initial.mesocycle.revision_id);check('old accepted recommendation excluded',final.recommendation===null&&final.checkin===null);
   check('next week check-in accessible',await p.getByRole('button',{name:'Empezar check-in',exact:true}).count()===1);
   await p.locator('details').evaluate(d=>d.open=false);await p.screenshot({path:path.join(out,'jwt-next-week-390-light.png'),fullPage:true});
  }
  const exposed=payloads.join('\n')+'\n'+await p.content(),label=mode==='verify-checkin'?'checkin':mode;
  check(label+' browser receives no credentials or JWT',![H.credentials.key,H.sessions.mock.access_token,H.sessions.reviewer.access_token].some(secret=>secret&&exposed.includes(secret))&&!/access_token|refresh_token|service_role|password/.test(exposed));
  check(label+' browser only loopback requests',outside.length===0);check(label+' no horizontal overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{
 const report={mode,ref:'dmqjexigdnfzobarhnib',rows,total:rows.length,passed:rows.filter(r=>r.pass).length,completed:!process.exitCode};fs.writeFileSync(path.join(out,'ui-staging-'+mode+'.json'),JSON.stringify(report,null,2));
 if(mode==='verify-checkin'&&!process.exitCode){const target=path.join(out,'ui-staging-checkin.json'),prior=JSON.parse(fs.readFileSync(target));assert.equal(prior.passed,9);assert.equal(prior.total,9);fs.copyFileSync(target,path.join(out,'ui-staging-checkin-diagnostic.json'));const unique=[...new Map([...prior.rows,...rows].map(r=>[r.name,r])).values()];fs.writeFileSync(target,JSON.stringify({mode:'checkin',ref:report.ref,rows:unique,total:unique.length,passed:unique.filter(r=>r.pass).length,completed:true,diagnostic:'Nine original successful checks plus three read-only checks; no check-in resubmission.'},null,2));}
 console.log(rows.filter(r=>r.pass).length+'/'+rows.length+' real JWT browser '+mode+' checks');});
