// Explicit retry after an ambiguous response: local backend and provider counters only.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const checks=[],out=path.join(__dirname,'results'),check=(n,v)=>{assert(v,n);checks.push({name:n,pass:true});};
(async()=>{for(const engine of ['chromium','webkit']){const b=await(engine==='chromium'?chromium:webkit).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});try{
 const p=await b.newPage({viewport:{width:390,height:844}});await p.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());await p.goto('http://127.0.0.1:4266/demo');await p.waitForFunction(()=>window.previewReady);
 await p.evaluate(()=>{
  const root=document.createElement('div');root.id='retry-fixture';root.style.cssText='position:fixed;inset:0;background:white;z-index:99999';document.body.append(root);
  window.chatRetryFixture={calls:[],provider:0,keys:new Map(),view:{permission:true,history_permission:true,available:true,week:1,revision_no:1,revision_id:crypto.randomUUID(),mesocycle_id:crypto.randomUUID(),conversation:{id:crypto.randomUUID()},messages:[]}};
  window.retryController=PremiumChat.mount(root,async(action,data)=>{
   const f=chatRetryFixture;if(action==='state')return structuredClone(f.view);if(action!=='send')throw Error('unexpected_action');f.calls.push(structuredClone(data));
   if(!f.keys.has(data.key)){f.provider++;const m={id:data.message_id,sequence:f.view.messages.length+1,state:'completed',revision_id:f.view.revision_id,user_content:data.message,assistant_answer:'SYNTHETIC answer'};f.keys.set(data.key,m);f.view.messages.push(m);}
   if(f.calls.length===1)throw Error('preview_offline');return structuredClone(f.view);
  });
 });await p.waitForFunction(()=>retryController.snapshot().view);
 const root=p.locator('#retry-fixture');await root.locator('textarea').fill('¿Qué significa RIR?');await root.locator('[data-action=send]').click();await p.waitForFunction(()=>!retryController.snapshot().busy&&chatRetryFixture.calls.length===1);
 check(engine+' error preserves question and makes no automatic retry',await root.locator('textarea').inputValue()==='¿Qué significa RIR?'&&await p.evaluate(()=>chatRetryFixture.calls.length===1));
 await p.waitForFunction(()=>document.querySelector('#retry-fixture [data-action=send]').dataset.robustClick!=='1');
 await root.locator('[data-action=send]').click();await p.waitForFunction(()=>!retryController.snapshot().busy&&chatRetryFixture.calls.length===2,{},{timeout:5000}).catch(async()=>{throw Error(JSON.stringify(await p.evaluate(()=>({calls:chatRetryFixture.calls.length,provider:chatRetryFixture.provider,busy:retryController.snapshot().busy,input:retryController.input.value,status:document.querySelector('#retry-fixture .chat-status').textContent,view:retryController.snapshot().view.messages.length}))));});
 check(engine+' explicit retry reuses original key and message ID',await p.evaluate(()=>chatRetryFixture.calls[0].key===chatRetryFixture.calls[1].key&&chatRetryFixture.calls[0].message_id===chatRetryFixture.calls[1].message_id));
 check(engine+' provider and transcript are not duplicated',await p.evaluate(()=>chatRetryFixture.provider===1&&retryController.snapshot().view.messages.length===1));
 await p.waitForFunction(()=>document.querySelector('#retry-fixture [data-action=send]').dataset.robustClick!=='1');await root.locator('textarea').fill('¿Y el descanso?');await root.locator('[data-action=send]').click();await p.waitForFunction(()=>!retryController.snapshot().busy&&chatRetryFixture.calls.length===3);
 check(engine+' confirmed response releases key for a new turn',await p.evaluate(()=>chatRetryFixture.calls[2].key!==chatRetryFixture.calls[0].key&&chatRetryFixture.provider===2));
 await p.evaluate(()=>retryController.destroy());await b.close();
 }finally{if(b.isConnected())await b.close();}}
 fs.writeFileSync(path.join(out,'premium-retry.json'),JSON.stringify({simulated:true,passed:checks.length,total:checks.length,checks},null,2));console.log(checks.length+'/'+checks.length+' offline Premium retry assertions');
})().catch(e=>{fs.writeFileSync(path.join(out,'premium-retry-failure.json'),JSON.stringify({error:e.message,checks},null,2));console.error(e.message);process.exitCode=1;});
