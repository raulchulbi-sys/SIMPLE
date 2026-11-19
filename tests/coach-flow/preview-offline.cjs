'use strict';
// Test-only runtime for the actual unified page. No Auth route, real SDK or network.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),port=Number(process.env.COACH_PORT||4266);
if(![4266,4273].includes(port))throw Error('Unapproved test port');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const types={'.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const runtime={target:'mock',environment:'staging',appUrl:'http://127.0.0.1:'+port+'/demo',appOrigin:'http://127.0.0.1:'+port,basePath:'/demo',supabaseUrl:'https://dmqjexigdnfzobarhnib.supabase.co',supabasePublicKey:'SYNTHETIC_NOT_A_KEY',billingTest:false};
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 if(url.pathname==='/demo'){
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'");
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.end(read('index.html').replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0','/demo-sdk.js').replace('</body>','<script src="/demo-seed.js"></script></body>'));
 }
 if(url.pathname==='/demo-sdk.js'){res.setHeader('Content-Type','application/javascript');return res.end(['tests/interior/mock-sdk.js','tests/coach/demo-sdk.js','tests/coach-pilot/preview-sdk.js'].map(read).join('\n'));}
 if(url.pathname==='/demo-seed.js'){res.setHeader('Content-Type','application/javascript');return res.end(read('tests/coach/demo-seed.js'));}
 if(url.pathname==='/assets/runtime-config.js'){res.setHeader('Content-Type','application/javascript');return res.end('Object.defineProperty(window,"SimpleAppRuntime",{value:Object.freeze('+JSON.stringify(runtime)+'),writable:false,configurable:false});');}
 if(!/^\/assets\/[a-zA-Z0-9._/-]+$/.test(url.pathname)||url.pathname.includes('..')){res.writeHead(404);return res.end();}
 const file=path.resolve(root,'.'+url.pathname),assets=path.join(root,'assets')+path.sep;
 if(!file.startsWith(assets)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
}).listen(port,'127.0.0.1',()=>console.log('Offline Coach mock runtime ready on loopback '+port));
