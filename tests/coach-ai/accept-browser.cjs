// Authenticated staging acceptance of explicit STATIC fixtures; not an OpenAI quality test.
const a=require('./api.cjs'),{fs,path,check,save}=a;
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{await a.login();for(const [engine,who]of [['chromium','rollback'],['webkit','browser2']]){
 const b=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 try{const p=await b.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(20000);
 await p.addInitScript(({s,ref})=>localStorage.setItem('sb-'+ref+'-auth-token',JSON.stringify(s)),{s:a.sessions[who],ref:a.c.ref});
 await p.goto('http://127.0.0.1:4193');await p.getByRole('button',{name:'Entrenar con SIMPLE Coach',exact:true}).click();await p.locator('#coachBegin').click();
 await p.locator('#coachAccept').waitFor();check(engine+' server proposal visible',await p.locator('.coach-day').count()===3);
 check(engine+' no routine before acceptance',(await a.table(who,'routines','owner_id=eq.'+a.c.users[who].id)).data.length===0);
 await p.locator('#coachAccept').click();await p.locator('#coachOpen').waitFor();await p.locator('#coachOpen').click();await p.locator('#trainBody .interior-session-list button').first().waitFor();
 const state=await p.evaluate(async()=>({routine:workoutRoutine.id,days:(await days(workoutRoutine.id)).map(x=>({id:x.id,name:x.name})),user:user.id,role:profile.role}));
 check(engine+' own three-day routine opened',state.user===a.c.users[who].id&&state.role==='client'&&state.days.length===3);
 const op=(await a.table(who,'coach_operations','state=eq.accepted')).data[0];
 const twice=await Promise.all([a.rpc(who,'accept_basic_plan',{p_operation:op.id}),a.rpc(who,'accept_basic_plan',{p_operation:op.id})]);
 check(engine+' real concurrent accept returns same UUID',twice.every(x=>x.ok&&x.data===state.routine));
 fs.writeFileSync(path.join(__dirname,'private',who+'-ui.json'),JSON.stringify(state));
 }finally{await b.close();}
}save('accept-browser');})().catch(e=>{save('accept-browser');console.error(e.message);process.exitCode=1});
