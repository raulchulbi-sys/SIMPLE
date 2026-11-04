'use strict';
// Actual application UI with local doubles only. No connected authentication or billing.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(require('node:os').homedir(), 'Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers');
const {chromium, webkit} = require(process.env.SIMPLE_PLAYWRIGHT_MODULE || path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const {start} = require('./browser-server.cjs');
const origin = 'http://127.0.0.1:4276', checks = [], out = path.join(__dirname, 'results');
fs.mkdirSync(out, {recursive:true});
const check = (name, value) => {assert(value, name); checks.push({name, pass:true});};
(async () => {
  const {server, state} = await start(); let browser;
  try {
    for (const [engine, launcher] of [['chromium', chromium], ['webkit', webkit]]) {
      browser = await launcher.launch({headless:true, ...(engine === 'chromium' ? {channel:'msedge'} : {})});
      const context = await browser.newContext({viewport:{width:390,height:844}}), errors = [], blocked = [];
      let flag = false;
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) {blocked.push(url.origin); return route.abort();}
        if (url.pathname === '/assets/commercial-config.js') return route.fulfill({contentType:'application/javascript',body:'window.SimpleAppRuntime={billingTest:'+JSON.stringify(flag)+',supabaseUrl:"https://dmqjexigdnfzobarhnib.supabase.co",supabasePublicKey:"SYNTHETIC_LOCAL_ONLY"};'});
        return route.continue();
      });
      const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', e => errors.push(e.message));
      const demo = async () => {await page.goto(origin+'/demo'); await page.waitForFunction(() => window.previewReady);};
      const settings = async () => {await page.locator('#app header .settings-trigger').click();};
      const changeRole = role => page.evaluate(async role => {mock.tables.profiles[0].role=role; await start();}, role);
      const label = name => engine+' '+name;
      Object.assign(state,{owner:'00000000-0000-4000-8000-000000001a01',status:'active',plan:'basic',paid:true,generation:false,calls:[],error:null,delay:0});
      await demo(); await settings();
      check(label('explicit false flag hides subscription'), await page.locator('[data-subscription-open]').count()===0);
      // The existing Coach double reads status/capabilities during app bootstrap.
      check(label('disabled UI cannot dispatch a billing mutation'),state.calls.every(c=>['status','capabilities'].includes(c.action)));
      flag='true'; await demo(); await settings();
      check(label('string flag cannot activate commercial UI'),await page.locator('[data-subscription-open]').count()===0);
      flag=true; await demo(); await changeRole('trainer'); await settings(); const calls=state.calls.length;
      await page.locator('[data-subscription-open]').click();
      check(label('trainer cannot open client subscription dialog'),!await page.locator('.subscription-dialog').isVisible());
      check(label('trainer click makes no billing request'),state.calls.length===calls);
      await page.locator('#settingsDialog').evaluate(d=>d.close()); await changeRole('client'); await settings();
      await page.locator('[data-subscription-open]').click(); await page.getByRole('heading',{name:'Tu plan está activo'}).waitFor();
      check(label('client navigation retains paid period and price'),await page.locator('.subscription-details').innerText().then(t=>t.includes('4,99 €')&&t.includes('2070')));
      check(label('generation and Premium remain closed'),await page.locator('.subscription-dialog').innerText().then(t=>t.includes('todavía no está habilitada'))&&await page.getByRole('button',{name:'Abrir SIMPLE Coach',exact:true}).count()===0&&await page.getByRole('button',{name:'Probar Premium en TEST'}).count()===0);
      await page.getByRole('button',{name:'Cerrar',exact:true}).click();
      check(label('closing returns focus to settings'),await page.locator('#app .settings-trigger').evaluate(e=>document.activeElement===e));
      await settings(); await page.locator('input[name=simpleTheme][value=dark]').check();
      check(label('real settings persist dark choice'),await page.evaluate(()=>simpleTheme.choice==='dark'&&localStorage.getItem('simple_theme_v1')==='dark'));
      await demo();
      check(label('full reload retains theme'),await page.evaluate(()=>document.documentElement.dataset.theme==='dark'));
      await page.evaluate(()=>{window.integrationStorageEvents=0;addEventListener('storage',()=>window.integrationStorageEvents++);const f=document.createElement('iframe');f.id='storageFrame';document.body.append(f);});
      const frame=page.frames().find(f=>f!==page.mainFrame());
      await frame.evaluate(()=>sessionStorage.setItem('simple_theme_v1','light'));
      await page.waitForFunction(()=>integrationStorageEvents>=1);
      check(label('real sessionStorage event preserves local theme'),await page.evaluate(()=>simpleTheme.choice==='dark'));
      await frame.evaluate(()=>sessionStorage.clear()); await page.waitForFunction(()=>integrationStorageEvents>=2);
      check(label('sessionStorage clear cannot reset theme'),await page.evaluate(()=>simpleTheme.choice==='dark'));
      const sibling=await context.newPage(); sibling.on('pageerror',e=>errors.push(e.message)); await sibling.goto(origin+'/demo'); await sibling.waitForFunction(()=>window.previewReady);
      await sibling.evaluate(()=>simpleTheme.set('light')); await page.waitForFunction(()=>simpleTheme.choice==='light');
      check(label('real cross-tab localStorage update synchronizes theme'),await page.evaluate(()=>document.documentElement.dataset.theme==='light'));
      await sibling.evaluate(()=>localStorage.removeItem('simple_theme_v1')); await page.waitForFunction(()=>integrationStorageEvents>=4);
      check(label('localStorage removal retains safe light default'),await page.evaluate(()=>simpleTheme.choice==='light'));
      await sibling.close();
      for(const width of [320,1280]) {await page.setViewportSize({width,height:844});await settings();await page.locator('[data-subscription-open]').click();await page.getByRole('heading',{name:'Tu plan está activo'}).waitFor();
        check(label('integrated dialog fits '+width),await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector('.subscription-dialog').getBoundingClientRect().width<=innerWidth));
        await page.getByRole('button',{name:'Cerrar',exact:true}).click();}
      check(label('navigation creates no checkout portal or generation'),state.calls.every(c=>['status','capabilities'].includes(c.action)));
      check(label('zero outbound requests'),blocked.length===0);check(label('zero runtime errors'),errors.length===0);
      await context.close();await browser.close();browser=null;
    }
    fs.writeFileSync(path.join(out,'integration-browser.json'),JSON.stringify({simulated:true,realJWT:false,connectedServices:false,passed:checks.length,total:checks.length,checks},null,2));
    console.log(checks.length+'/'+checks.length+' new integration browser assertions; connected services: 0');
  } catch(error) {fs.writeFileSync(path.join(out,'integration-browser-failure.json'),JSON.stringify({error:error.message,checks},null,2));throw error;}
  finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
