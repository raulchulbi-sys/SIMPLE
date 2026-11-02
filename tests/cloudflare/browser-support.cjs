// Real built product files; local synthetic SDK only. Never sends an Auth/API request.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'../..');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.txt':'text/plain'};
function serverFor(directory,options={}){
 const absolute=path.resolve(directory);
 return http.createServer((req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  let route=decodeURIComponent(u.pathname).replace(/^\/SIMPLE(?=\/|$)/,'');
  if(!route||route==='/')route='/index.html';
  const file=path.resolve(absolute,'.'+route);
  if(route==='/assets/runtime-config.js'&&options.runtime){res.setHeader('Content-Type','application/javascript; charset=utf-8');res.setHeader('Cache-Control','no-store');return res.end(options.runtime(u));}
  if(!file.startsWith(absolute+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end('Not found');}
  res.setHeader('Content-Type',(types[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  // Reflect the candidate's explicit policy in lab cold/warm resource tests.
  res.setHeader('Cache-Control',options.policy==='github'?'public, max-age=600':route.includes('runtime-config')?'no-store':'public, max-age=0, must-revalidate');
  const body=fs.readFileSync(file),etag='"'+crypto.createHash('sha256').update(body).digest('hex')+'"';res.setHeader('ETag',etag);
  if(req.headers['if-none-match']===etag){res.writeHead(304);return res.end();}
  if(options.gzip&&/gzip/.test(req.headers['accept-encoding']||'')&&['.html','.js','.css'].includes(path.extname(file))){res.setHeader('Content-Encoding','gzip');return res.end(req.method==='HEAD'?undefined:zlib.gzipSync(body));}
  res.end(req.method==='HEAD'?undefined:body);
 });
}
const sdk=fs.readFileSync(path.join(root,'tests/interior/mock-sdk.js'),'utf8').replace('createClient:()=>({','createClient:(url,key,options)=>{window.cfSdkConfig={url,key,options};return ({').replace(/\n\}\)\};\s*\n\}\)\(\);\s*$/,'\n})}};\n})();');
const seed=fs.readFileSync(path.join(root,'tests/interior/preview-seed.js'),'utf8');
async function isolate(page,origin,theme){
 const errors=[],external=[],badResponses=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)badResponses.push({url:r.url(),status:r.status()});});
 page.on('dialog',d=>d.dismiss());
 await page.addInitScript(theme=>{localStorage.setItem('simple_theme_v1',theme);},theme);
 await page.route('**/*',r=>{
  const req=r.request(),url=new URL(req.url());
  if(url.pathname==='/auth/v1/settings'&&url.hostname.endsWith('.supabase.co'))return r.fulfill({json:{external:{google:true,apple:false,facebook:false}}});
  if((url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('supabase-js'))||(url.origin===origin&&/\/assets\/.*supabase.*\.js$/.test(url.pathname)))return r.fulfill({body:sdk,contentType:'application/javascript'});
  if(url.origin===origin&&req.method()==='GET')return r.continue();
  if(url.protocol==='data:')return r.continue();
  external.push({url:req.url(),method:req.method()});return r.abort();
 });
 return {errors,external,badResponses};
}
async function go(page,base,role='client',state='history'){
 await page.goto(base+'?role='+role+'&state='+state);
 await page.addScriptTag({content:seed});
 await page.waitForFunction(()=>window.previewReady);
 if(role==='trainer')await page.locator('.client-overview-card').first().waitFor();
}
async function geometry(page,selector){
 return page.locator(selector).evaluateAll(nodes=>({viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,boxes:nodes.filter(n=>n.getClientRects().length).map(n=>{const b=n.getBoundingClientRect();return{x:b.left,right:b.right};})}));
}
module.exports={root,serverFor,isolate,go,geometry};
