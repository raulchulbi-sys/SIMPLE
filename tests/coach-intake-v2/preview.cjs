// Fictitious local preview only. No Supabase/AI traffic; never serves private files.
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..'),port=Number(process.env.COACH_PORT||4197);
const type={'.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 if(u.pathname==='/review'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SIMPLE Coach · cuestionarios v2</title><style>body{margin:0;font:14px system-ui;background:#f7f5f1;color:#252929}header{padding:12px 18px}iframe{display:block;border:0;width:100%;height:calc(100dvh - 125px)}button{min-height:44px}a{color:inherit}</style><header><b>SIMPLE Coach · cuestionarios v2</b><p>Demostración ficticia local. Sin conexión a Supabase ni IA.</p><button data-mode="demo-athlete">Ver atleta</button> <button data-mode="demo-premium">Preview Premium</button> <button data-mode="demo-reset">Reiniciar demo</button></header><script>document.querySelector("header").onclick=e=>{if(e.target.dataset.mode)document.querySelector("iframe").contentWindow.postMessage(e.target.dataset.mode,location.origin)};</script><iframe title="SIMPLE Coach: demostración sintética" src="/demo"></iframe></html>');}
 if(u.pathname==='/demo-sdk.js'){res.setHeader('Content-Type','application/javascript');return res.end(['tests/interior/mock-sdk.js','tests/coach/demo-sdk.js','tests/coach-v2/preview-sdk.js','tests/coach-intake-v2/preview-sdk.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n'));}
 if(u.pathname==='/demo-seed.js'){res.setHeader('Content-Type','application/javascript');return res.end(fs.readFileSync(path.join(__dirname,'../coach-v2/preview-seed.js')));}
 if(u.pathname==='/demo'){
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'");res.setHeader('Content-Type','text/html; charset=utf-8');
  let html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0','/demo-sdk.js').replace('https://yvguatdqncadkwewlepe.supabase.co','https://dmqjexigdnfzobarhnib.supabase.co').replace('</body>','<script src="/demo-seed.js"></script></body>');
  return res.end(html);
 }
 if(!/^\/assets\/[a-zA-Z0-9._/-]+$/.test(u.pathname)||u.pathname.includes('..')){res.writeHead(404);return res.end();}
 const file=path.join(root,u.pathname);if(!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',type[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
}).listen(port,'127.0.0.1',()=>console.log('Synthetic offline preview http://127.0.0.1:'+port+'/review'));
