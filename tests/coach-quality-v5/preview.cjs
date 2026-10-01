// Read-only offline viewer of the eight sanitized real synthetic outputs.
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..'),port=4200;
http.createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 if(u.pathname==='/review'){
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SIMPLE · programación v5</title><style>body{margin:0;font:14px system-ui;background:#f7f5f1}header{padding:12px}button,select{min-height:44px}iframe{border:0;width:100%;height:calc(100dvh - 110px)}</style><header><b>Basic v5 · 8 propuestas reales sintéticas · G/H con descansos afinados</b><p><select aria-label="Caso">'+[...'ABCDEFGH'].map(k=>'<option>'+k+'</option>').join('')+'</select> <button id="theme">Claro / Oscuro</button> Sin conexión a Supabase ni OpenAI.</p></header><iframe title="Propuesta sintética y evaluación" src="/demo?case=A"></iframe><script>document.querySelector("select").onchange=e=>document.querySelector("iframe").src="/demo?case="+e.target.value;document.querySelector("#theme").onclick=()=>document.querySelector("iframe").contentWindow.postMessage("quality-theme",location.origin);</script></html>');
 }
 if(u.pathname==='/sdk.js'){res.setHeader('Content-Type','application/javascript');return res.end(['tests/interior/mock-sdk.js','tests/coach/demo-sdk.js','tests/coach-v2/preview-sdk.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n'));}
 if(u.pathname==='/seed.js'){
  const k=/^[A-H]$/.test(u.searchParams.get('case')||'')?u.searchParams.get('case'):'A';
  const file=path.join(__dirname,'results','real-quality-'+k+'.json');const r=JSON.parse(fs.readFileSync(fs.existsSync(file)?file:path.join(__dirname,'results','mock-proposal.json')));
  const safe=JSON.stringify({proposal:r.proposal||r.diagnostic?.proposal,training:r.training}).replaceAll('<','\\u003c');
  res.setHeader('Content-Type','application/javascript');return res.end(fs.readFileSync(path.join(root,'tests/coach-v2/preview-seed.js'),'utf8')+'\n(async()=>{while(!window.previewReady)await new Promise(r=>setTimeout(r,20));const x='+safe+';if(x.proposal)coachShell(coachProposalMarkup(x.proposal,"basic-initial-v5")+reviewerProgramming({proposal:x.proposal,prompt_version:"basic-initial-v5"},x.training));else coachShell("<h3>No generado</h3><p>Este caso quedó pendiente por el límite autorizado de coste. No se ha sustituido por una simulación.</p>");window.qualityReady=true;})();addEventListener("message",e=>{if(e.origin===location.origin&&e.data==="quality-theme")simpleTheme.set(document.documentElement.dataset.theme==="dark"?"light":"dark")});');
 }
 if(u.pathname==='/demo'){
  const k=/^[A-H]$/.test(u.searchParams.get('case')||'')?u.searchParams.get('case'):'A';
  res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'self';script-src 'self' 'unsafe-inline';style-src 'self' 'unsafe-inline';img-src 'self' data:;connect-src 'none';form-action 'none';object-src 'none';base-uri 'none'");
  return res.end(fs.readFileSync(path.join(root,'index.html'),'utf8').replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0','/sdk.js').replace('</body>','<script src="/seed.js?case='+k+'"></script></body>'));
 }
 if(!/^\/assets\/[a-zA-Z0-9._/-]+$/.test(u.pathname)||u.pathname.includes('..')){res.writeHead(404);return res.end();}
 const file=path.join(root,u.pathname);if(!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
}).listen(port,'127.0.0.1',()=>console.log('Offline real synthetic viewer http://127.0.0.1:'+port+'/review'));
