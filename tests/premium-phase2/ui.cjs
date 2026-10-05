const fs=require('fs'),path=require('path'),assert=require('assert/strict');process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';const{chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.join(__dirname,'results'),rows=[],base='http://127.0.0.1:4233';fs.mkdirSync(out,{recursive:true});const check=(name,v)=>{rows.push({name,pass:!!v});assert(v,name);};
(async()=>{for(const engine of ['chromium','webkit']){const browser=await(engine==='chromium'?chromium:webkit).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 for(const width of [320,360,390,430,1280])for(const theme of ['light','dark']){
  await p.setViewportSize({width,height:900});await p.goto(base+'/review');await p.locator('#case').selectOption('F');await p.locator('#title').filter({hasText:'Propuesta de cambio'}).waitFor();
  if((await p.locator('html').getAttribute('data-theme'))!==theme)await p.locator('#theme').click();
  check(engine+width+theme+' no horizontal overflow',await p.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check(engine+width+theme+' official mapped before after',await p.locator('#changes').textContent().then(t=>t.includes('Curl con mancuernas')&&t.includes('Curl con banda')&&t.includes('→')));
  check(engine+width+theme+' pending cannot accept',await p.getByRole('button',{name:'Aceptar cambios',exact:true}).count()===0);
  check(engine+width+theme+' actual theme contrast',await p.locator('body').evaluate((e,t)=>{const rgb=getComputedStyle(e).backgroundColor.match(/\d+/g).map(Number);return t==='dark'?rgb[0]<40:rgb[0]>220;},theme));
  await p.locator('#actor').selectOption('reviewer');await p.getByRole('button',{name:'Validar propuesta',exact:true}).waitFor();check(engine+width+theme+' reviewer tap target',await p.getByRole('button',{name:'Validar propuesta',exact:true}).evaluate(b=>b.getBoundingClientRect().height>=44));
  if(engine==='chromium'&&[390,1280].includes(width))await p.screenshot({path:path.join(out,'MODIFY-'+width+'-'+theme+'.png'),fullPage:true});
 }
 await p.locator('#case').selectOption('D');await p.locator('#title').filter({hasText:'Mantener'}).waitFor();check(engine+' incomplete history explained',await p.locator('#facts').textContent().then(t=>t.includes('suficientes')));
 await p.locator('#case').selectOption('E');await p.locator('#title').filter({hasText:'Mantener'}).waitFor();await p.locator('#facts').filter({hasText:'Cambió el contexto'}).waitFor();check(engine+' uncertain history explained',await p.locator('#facts').textContent().then(t=>t.includes('faltan datos')));
 check(engine+' no browser errors',errors.length===0);
 }finally{await browser.close();}}
 if(process.env.PREMIUM_UI_ACCEPT==='1'){
  const browser=await chromium.launch({headless:true,channel:'msedge'}),p=await browser.newPage({viewport:{width:390,height:900}});try{
   await p.goto(base+'/review');await p.locator('#case').selectOption('F');await p.locator('#title').filter({hasText:'Propuesta'}).waitFor();await p.locator('#actor').selectOption('reviewer');await p.getByRole('button',{name:'Validar propuesta',exact:true}).click();await p.locator('#status').filter({hasText:'Validada'}).waitFor();check('real UI reviewer validated',true);
   await p.locator('#actor').selectOption('athlete');const b=p.getByRole('button',{name:'Aceptar cambios',exact:true});await b.waitFor();await p.screenshot({path:path.join(out,'MODIFY-ready-390.png'),fullPage:true});
   let accepts=0;p.on('request',r=>{if(r.url().endsWith('/analysis-api')&&r.postDataJSON()?.action==='accept')accepts++;});await b.evaluate(b=>{b.click();b.click();});await p.locator('#status').filter({hasText:'Aceptada'}).waitFor();check('real UI double tap one request',accepts===1);check('real UI new revision active',await p.locator('#breadcrumb').textContent().then(t=>t.includes('Revisión 2')&&t.includes('Semana 2')));await p.screenshot({path:path.join(out,'MODIFY-accepted-390.png'),fullPage:true});
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,'ui.json'),JSON.stringify({total:rows.length,passed:rows.filter(x=>x.pass).length,completed:!process.exitCode,rows},null,2));console.log(rows.filter(x=>x.pass).length+'/'+rows.length+' UI checks');});
