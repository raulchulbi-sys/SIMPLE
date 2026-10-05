// Focused local rendering of the previously captured availability recommendation.
// weekly_days/snapshot metadata are reconstructed from captured setup SQL + manifest.
// No database/Auth/provider calls and no new remote fixtures. This is not a JWT test.
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{scheduleChange}=require('./weekly-schedule.cjs');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir=__dirname,out=path.join(dir,'results'),get=name=>JSON.parse(fs.readFileSync(path.join(dir,name))),rows=[],screenshots=[],copy=v=>structuredClone(v);
fs.mkdirSync(out,{recursive:true});
const check=(name,v)=>{rows.push({name,pass:!!v});assert(v,name);},deny=(name,f)=>{let denied=false;try{f();}catch(e){denied=e.message==='premium_weekly_schedule_context_invalid';}check(name,denied);};
const manifest=get('private/weekly-fixture.json'),record=get('results/weekly-real.json').find(r=>r.tag==='availability'),context=get('private/weekly-context-availability-1.json'),fixture=manifest.cases.availability;
assert.equal(manifest.ref,'dmqjexigdnfzobarhnib');assert.equal(record.recommendation.kind,'MODIFY');
const patch=record.recommendation.patches.find(p=>p.field==='weekly_schedule');assert(patch);
const sql=fs.readFileSync(path.join(dir,'private/weekly-setup.sql'),'utf8'),dayPattern=/insert into public\.routine_days\(id,routine_id,name,day_order\) values\('([0-9a-f-]+)','([0-9a-f-]+)','((?:''|[^'])*)',([0-9]+)\);/g;
const setup=[...sql.matchAll(dayPattern)].filter(m=>m[2]===fixture.routine).map(m=>({id:m[1],name:m[3].replaceAll("''","'"),day_order:Number(m[4])}));
assert.equal(setup.length,5);assert.equal(new Set(setup.map(d=>d.id)).size,5);assert.equal(new Set(setup.map(d=>d.day_order)).size,5);
assert(fixture.days.every(id=>setup.some(d=>d.id===id)));assert.equal(patch.target_id,fixture.routine);
// The original setup has unique captured day_order values; the provider retains
// each order/ref pair. This reconstruction is test-only, never a runtime fallback.
const weeklyDays=setup.map(day=>{const matching=context.routine.days.filter(d=>d.order===day.day_order);assert.equal(matching.length,1);return {day_id:day.id,day_ref:matching[0].ref};});
const bundle={provider:context,weekly_days:weeklyDays},mapped=scheduleChange(patch,bundle,setup);
// Exercise the actual adapter formatter while substituting only its live transport
// module. Importing private credentials or calling any transport is prohibited.
const formatterModule={exports:{}},noTransport=()=>{throw Error('local_test_transport_prohibited');};
const requireLocal=name=>name==='./live.cjs'?{credentials:{ref:'dmqjexigdnfzobarhnib'},read:noTransport,rpc:noTransport}:name.startsWith('.')?require(path.resolve(dir,name)):require(name);
vm.runInNewContext(fs.readFileSync(path.join(dir,'jwt-preview.cjs'),'utf8'),{module:formatterModule,require:requireLocal,process:{env:{}},__dirname:dir,structuredClone},{filename:'jwt-preview-local-formatter.cjs'});
const publicRec=formatterModule.exports.publicRecommendation({...record.recommendation,analysis_bundle:bundle},[],setup);
const expected=new Map(weeklyDays.map(b=>{const before=patch.from.find(d=>d.day_id===b.day_id),after=patch.to.find(d=>d.day_id===b.day_id),source=setup.find(d=>d.id===b.day_id);assert(before&&after);return [b.day_ref,{name:source.name,from:before.weekday,to:after.weekday,minutes:after.minutes}];}));
const weekday={mon:'Lunes',tue:'Martes',wed:'Miércoles',thu:'Jueves',fri:'Viernes',sat:'Sábado',sun:'Domingo'};
(async()=>{
 check('actual adapter formatter uses exact guarded schedule mapping',JSON.stringify(publicRec.changes.find(c=>c.action==='weekly_schedule'))===JSON.stringify(mapped));
 check('capture supplies five exact day identities',mapped.days.length===5&&new Set(mapped.days.map(d=>d.logical_day_ref)).size===5);
 for(const day of mapped.days){const e=expected.get(day.logical_day_ref);check(day.logical_day_ref+' exact snapshot name',day.logical_day_name===e.name);check(day.logical_day_ref+' before/after/minutes exact',day.from_weekday===e.from&&day.to_weekday===e.to&&day.minutes===e.minutes);}
 const permuted=copy(patch);permuted.from.reverse();permuted.to.reverse();const shuffledBundle=copy(bundle);shuffledBundle.weekly_days.reverse();shuffledBundle.provider.routine.days.reverse();
 check('permuted arrays resolve by ID/ref only',scheduleChange(permuted,shuffledBundle,[...setup].reverse()).days.every(d=>{const e=expected.get(d.logical_day_ref);return e&&d.logical_day_name===e.name&&d.from_weekday===e.from&&d.to_weekday===e.to&&d.minutes===e.minutes;}));
 const reviewer=scheduleChange(permuted,shuffledBundle);check('reviewer without snapshot gets five distinct mapped labels',new Set(reviewer.days.map(d=>d.logical_day_name)).size===5&&reviewer.days.every(d=>d.logical_day_name==='Día '+d.logical_day_ref.slice(4)));
 const named=copy(bundle);named.provider.routine.days.forEach(d=>d.name='Etiqueta '+d.ref);check('provider names are display values after exact ref mapping',scheduleChange(patch,named).days.every(d=>d.logical_day_name==='Etiqueta '+d.logical_day_ref));
 const sameNames=setup.map(d=>({...d,name:'Mismo nombre'}));check('same names do not merge different day identities',scheduleChange(patch,bundle,sameNames).days.length===5);
 const wrong=copy(patch);wrong.to[0].day_id='ffffffff-ffff-4fff-8fff-ffffffffffff';deny('unknown target day UUID denied',()=>scheduleChange(wrong,bundle,setup));
 const wrongBefore=copy(patch);wrongBefore.from[0].day_id='ffffffff-ffff-4fff-8fff-ffffffffffff';deny('unknown original day UUID denied',()=>scheduleChange(wrongBefore,bundle,setup));
 const duplicateAfter=copy(patch);duplicateAfter.to[1].day_id=duplicateAfter.to[0].day_id;deny('duplicate target UUID denied',()=>scheduleChange(duplicateAfter,bundle,setup));
 const duplicateBefore=copy(patch);duplicateBefore.from[1].day_id=duplicateBefore.from[0].day_id;deny('duplicate original UUID denied',()=>scheduleChange(duplicateBefore,bundle,setup));
 const duplicateBinding=copy(bundle);duplicateBinding.weekly_days[1].day_id=duplicateBinding.weekly_days[0].day_id;deny('ambiguous binding UUID denied',()=>scheduleChange(patch,duplicateBinding,setup));
 const duplicateRef=copy(bundle);duplicateRef.weekly_days[1].day_ref=duplicateRef.weekly_days[0].day_ref;deny('ambiguous binding logical ref denied',()=>scheduleChange(patch,duplicateRef,setup));
 const duplicateProvider=copy(bundle);duplicateProvider.provider.routine.days[1].ref=duplicateProvider.provider.routine.days[0].ref;deny('ambiguous provider ref denied',()=>scheduleChange(patch,duplicateProvider,setup));
 const missingRef=copy(bundle);missingRef.provider.routine.days[0].ref='day_99';deny('unmapped provider ref denied',()=>scheduleChange(patch,missingRef,setup));
 deny('missing binding denied rather than generic repeated labels',()=>scheduleChange(patch,{provider:context},setup));
 const partial=copy(patch);partial.to.pop();deny('incomplete schedule denied',()=>scheduleChange(partial,bundle,setup));
 const misleading=copy(patch);misleading.to[0].day_ref='day_99';deny('injected logical ref cannot override UUID binding',()=>scheduleChange(misleading,bundle,setup));
 const duplicateSnapshot=copy(setup);duplicateSnapshot[1].id=duplicateSnapshot[0].id;deny('ambiguous snapshot UUID denied',()=>scheduleChange(patch,bundle,duplicateSnapshot));
 const wrongSnapshot=copy(setup);wrongSnapshot[0].id='ffffffff-ffff-4fff-8fff-ffffffffffff';deny('foreign snapshot identity denied',()=>scheduleChange(patch,bundle,wrongSnapshot));
 const invalidMinutes=copy(patch);invalidMinutes.to[0].minutes=0;deny('invalid minutes denied',()=>scheduleChange(invalidMinutes,bundle,setup));
 const invalidWeekday=copy(patch);invalidWeekday.to[0].weekday='unknown';deny('invalid weekday denied',()=>scheduleChange(invalidWeekday,bundle,setup));
 deny('malformed snapshot container denied',()=>scheduleChange(patch,bundle,{}));
 // Readonly captured-data adapter: no model/DB calls, no credentials loaded.
 const P=require('./preview.cjs'),adapter={mode:'offline',cases:[['normal','Disponibilidad capturada · lectura local']],async handle({action,tag,actor}){if(action!=='state'||tag!=='normal'||!['athlete','reviewer'].includes(actor))throw Error('action_unavailable');return {
  mode:'offline',actor,user_id:manifest.user,permission:true,exercises:[],mesocycle:{id:fixture.mesocycle,number:context.mesocycle.number,planned_weeks:context.mesocycle.planned_weeks,revision_id:fixture.original_revision,revision_no:context.mesocycle.current_revision,state:'active'},week:{id:record.recommendation.id,number:context.mesocycle.week},session_summary:'Captura sintética guardada · metadatos reconstruidos localmente',checkin:{id:fixture.checkin,answers:fixture.answers,row_version:1,submitted_at:'captured'},recommendation:publicRec
 };}};
 const server=P.createServer(adapter,4243);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4243,'127.0.0.1',resolve);});
 let browser;try{
  browser=await chromium.launch({headless:true,channel:'msedge'});
  for(const width of [320,1280])for(const theme of ['light','dark']){
   const page=await browser.newPage({viewport:{width,height:900}});let external=false;page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4243'))external=true;});
   try{await page.goto('http://127.0.0.1:4243/review');await page.locator('.schedule>div').first().waitFor();await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);const label=width+' '+theme;
    check(label+' captured schedule has five logical rows',await page.locator('.schedule>div').count()===5);
    for(const day of mapped.days){const e=expected.get(day.logical_day_ref),row=page.locator('.schedule>div').filter({has:page.locator('strong',{hasText:e.name})});check(label+' '+day.logical_day_ref+' label/weekdays/minutes visible',(await row.count())===1&&(await row.textContent()).includes(weekday[e.from]+' → '+weekday[e.to])&&(await row.textContent()).includes(e.minutes+' min disponibles'));}
    check(label+' no repeated generic label',!(await page.locator('.schedule').textContent()).includes('Día de la rutina'));
    check(label+' no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    check(label+' single body scroll',await page.evaluate(()=>![...document.querySelectorAll('main,article,section,.schedule')].some(e=>/auto|scroll/.test(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+1)));
    check(label+' no external requests',!external);check(label+' capture explicitly local',(await page.locator('#week-facts').textContent()).includes('metadatos reconstruidos localmente'));
    if(theme==='light'){const name='schedule-captured-'+width+'-light.png';await page.screenshot({path:path.join(out,name),fullPage:true});screenshots.push(name);}
   }finally{await page.close();}
  }
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,'schedule-ui.json'),JSON.stringify({scope:'local captured availability schedule; reconstructed metadata; no JWT/DB/Auth/OpenAI',sources:['results/weekly-real.json','private/weekly-context-availability-1.json','private/weekly-setup.sql','private/weekly-fixture.json'],rows,total:rows.length,passed:rows.filter(r=>r.pass).length,completed:!process.exitCode,screenshots},null,2));console.log(rows.filter(r=>r.pass).length+'/'+rows.length+' focused local schedule checks');});
