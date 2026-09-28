const a=require('./api.cjs'),{fs,path,check,save}=a;
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{await a.login();for(const [engine,who]of [['chromium','rollback'],['webkit','browser2']]){
const b=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});let page;
try{page=await b.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(({s,ref})=>{localStorage.setItem('sb-'+ref+'-auth-token',JSON.stringify(s));localStorage.setItem('simple_theme_v1','light');},{s:a.sessions[who],ref:a.c.ref});
await page.goto('http://127.0.0.1:4191',{waitUntil:'domcontentloaded',timeout:40000});await page.getByRole('button',{name:'Entrenar con SIMPLE Coach',exact:true}).click();await page.locator('#coachBegin,#coachOpen').first().waitFor();const already=await page.locator('#coachOpen').count();if(!already){await page.locator('#coachBegin').click();
await page.locator('#coachGoal').fill('SYNTHETIC goal browser');await page.locator('#coachDays').fill('2');await page.locator('#coachGrantTraining').check();await page.locator('#coachGrantHealth').check();
await page.locator('#coachDraft').click();await page.getByText('Borrador guardado.',{exact:true}).waitFor();check(engine+' draft server save',true);
await page.getByRole('button',{name:'Generar propuesta ficticia',exact:true}).click();await page.locator('#coachAccept').waitFor();check(engine+' real Edge proposal displayed',await page.locator('.coach-day').count()===2);
check(engine+' explicit review before creation',(await a.table(who,'routines','owner_id=eq.'+a.c.users[who].id)).data.length===0);
await page.screenshot({path:path.join(__dirname,'results',engine+'-proposal-light.png'),fullPage:true});
await page.locator('#coachAccept').click();await page.locator('#coachOpen').waitFor();check(engine+' accepted',true);}await page.locator('#coachOpen').click();
await page.locator('#trainBody .interior-session-list button').first().waitFor();
const state=await page.evaluate(async()=>({routine:workoutRoutine.id,days:(await days(workoutRoutine.id)).map(x=>({id:x.id,name:x.name})),user:user.id,role:profile.role}));
check(engine+' owner client opens routine',state.user===a.c.users[who].id&&state.role==='client'&&state.days.length===2);
fs.writeFileSync(path.join(__dirname,'private',who+'-ui.json'),JSON.stringify(state));
await page.screenshot({path:path.join(__dirname,'results',engine+'-routine-light.png'),fullPage:true});
check(engine+' no page errors',errors.length===0,errors.join(';'));save('browser');
}catch(e){if(page){fs.writeFileSync(path.join(__dirname,'results',engine+'-failure.txt'),await page.locator('body').innerText());await page.screenshot({path:path.join(__dirname,'results',engine+'-failure.png'),fullPage:true});}throw e;}finally{await b.close();}
}save('browser');})().catch(e=>{save('browser');console.error(e.message);process.exitCode=1});
