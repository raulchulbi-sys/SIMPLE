// Candidate assets + existing synthetic interior fixture, with all API traffic prohibited.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),port=Number(process.env.COACH_GENERAL_PORT||4261);
http.createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'");
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 if(u.pathname==='/'){
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.end(fs.readFileSync(path.join(root,'index.html'),'utf8').replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0','/mock-sdk.js').replace('</body>','<script src="/preview-seed.js"></script></body>'));
 }
 let file;
 if(u.pathname==='/mock-sdk.js')file='tests/interior/mock-sdk.js';
 if(u.pathname==='/preview-seed.js')file='tests/interior/preview-seed.js';
 if(/^\/assets\/[a-zA-Z0-9_.-]+$/.test(u.pathname))file=u.pathname.slice(1);
 if(!file||!fs.existsSync(path.join(root,file))){res.writeHead(404);return res.end();}
 const types={'.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
 res.setHeader('Content-Type',(types[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');
 res.end(fs.readFileSync(path.join(root,file)));
}).listen(port,'127.0.0.1',()=>console.log('Ready '+port+' (synthetic only; no API)'));
