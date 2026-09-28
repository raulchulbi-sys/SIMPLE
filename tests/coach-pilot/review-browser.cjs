const a=require('./api.cjs'),{fs,path,check}=a;
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{await a.login();const ops=JSON.parse(fs.readFileSync(path.join(__dirname,'private/operations.json')));
 for(const [engine,who]of [['chromium','browser1'],['webkit','browser2']]){
 const b=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 const errors=[],make=async w=>{const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.addInitScript(({s,ref})=>localStorage.setItem('sb-'+ref+'-auth-token',JSON.stringify(s)),{s:a.sessions[w],ref:a.c.ref});const p=await ctx.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:4194/');return p;};
 try{const p=await make(who);await p.getByRole('button',{name:'Entrenar con SIMPLE Coach',exact:true}).click();await p.locator('#coachBegin').click();await p.getByRole('heading',{name:'Pendiente de revisión',exact:true}).waitFor();check(engine+' no accept while pending',await p.locator('#coachAccept').count()===0);
 await p.reload();await p.getByRole('button',{name:'Entrenar con SIMPLE Coach',exact:true}).click();await p.locator('#coachBegin').click();await p.getByRole('heading',{name:'Pendiente de revisión',exact:true}).waitFor();check(engine+' pending survives reload',true);
 check(engine+' normal client no reviewer entry',await p.locator('#coachReviewerEntry').count()===0);
 const reviewer=await make('reviewer');await reviewer.locator('#coachReviewerEntry button').click();await reviewer.locator('#coachQueue').waitFor();
 const section=reviewer.locator('#coachQueue > section').filter({hasText:ops[who].operation.id});check(engine+' reviewer sees full prescription',await section.locator('h4').count()===3);
 for(const theme of ['light','dark']){await reviewer.evaluate(t=>simpleTheme.set(t),theme);check(engine+' reviewer '+theme+' no overflow',await reviewer.locator('#coachDialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1));await reviewer.screenshot({path:path.join(__dirname,'results',engine+'-reviewer-'+theme+'.png'),fullPage:true});}
 await section.locator('textarea').fill('SYNTHETIC: intake, duration, volume and exercise selection reviewed.');await section.getByRole('button',{name:'Aprobar propuesta',exact:true}).click();await reviewer.waitForFunction(()=>!simpleCoach.busy);await section.getByRole('heading',{name:'Aprobada',exact:true}).waitFor();
 await p.locator('#coachRefresh').click();await p.locator('#coachAccept').waitFor();check(engine+' approval unlocks athlete acceptance',await p.locator('#coachAccept').isVisible());
 for(const width of [320,360,390,430,1280])for(const theme of ['light','dark']){await p.setViewportSize({width,height:900});await p.evaluate(t=>simpleTheme.set(t),theme);check(engine+' proposal '+width+' '+theme+' no overflow',await p.locator('#coachDialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1));if(width===390)await p.screenshot({path:path.join(__dirname,'results',engine+'-approved-'+theme+'.png'),fullPage:true});}
 await p.locator('#coachAccept').click();await p.getByRole('heading',{name:'Rutina creada',exact:true}).waitFor();
 const accepted=(await a.table(who,'coach_operations','id=eq.'+ops[who].operation.id)).data[0],rid=accepted.routine_id;check(engine+' accepted real persisted routine',accepted.state==='accepted'&&!!rid&&accepted.review_decision==='approved');
 const twice=await Promise.all([1,2].map(()=>a.rpc(who,'accept_basic_plan',{p_operation:accepted.id})));check(engine+' double accept same UUID',twice.every(r=>r.ok&&r.data===rid));
 const days=(await a.table(who,'routine_days','routine_id=eq.'+rid+'&order=day_order')).data;
 const data=[];for(const d of days)data.push((await a.table(who,'routine_exercises','day_id=eq.'+d.id+'&order=exercise_order')).data);
 check(engine+' every prescribed field persists exactly',days.length===accepted.proposal.days.length&&days.every((d,i)=>d.name===accepted.proposal.days[i].name&&data[i].length===accepted.proposal.days[i].exercises.length&&data[i].every((e,j)=>{const x=accepted.proposal.days[i].exercises[j];return e.name===x.name&&e.sets===x.sets&&e.target===x.reps_min+'-'+x.reps_max&&e.rir===String(x.rir)&&e.rest_seconds===x.rest_seconds;})));
 check(engine+' single revision and management', (await a.table(who,'routine_revisions','routine_id=eq.'+rid)).data.length===1&&(await a.table(who,'routine_management','routine_id=eq.'+rid)).data.length===1);
 check(engine+' no fictitious trainer assignment',(await a.table(who,'routine_assignments')).data.length===0);
 fs.writeFileSync(path.join(__dirname,'private',who+'-ui.json'),JSON.stringify({routine:rid,days}));
 check(engine+' no runtime errors',errors.length===0,errors.join(';'));
 }finally{await b.close();a.save('review-browser');}
 }
})().catch(e=>{a.save('review-browser');console.error(e.message);process.exitCode=1});
