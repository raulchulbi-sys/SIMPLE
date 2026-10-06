const fs=require('fs'),path=require('path'),http=require('http'),root=path.resolve(__dirname,'../..');
const sdk=fs.readFileSync(path.join(root,'tests/interior/mock-sdk.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'preview-sdk.js'),'utf8');
http.createServer((req,res)=>{const u=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');
 if(u.pathname==='/sdk.js'){res.setHeader('Content-Type','application/javascript');return res.end(sdk);}
 if(u.pathname==='/seed.js'){res.setHeader('Content-Type','application/javascript');return res.end(fs.readFileSync(path.join(root,'tests/interior/preview-seed.js'),'utf8'));}
 if(u.pathname==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'self';script-src 'self' 'unsafe-inline';style-src 'self' 'unsafe-inline';img-src 'self' data:;connect-src 'none';form-action 'none';object-src 'none'");return res.end(fs.readFileSync(path.join(root,'index.html'),'utf8').replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0','/sdk.js').replace('</body>','<script src="/seed.js"></script></body>'));}
 if(!/^\/assets\/[a-zA-Z0-9._/-]+$/.test(u.pathname)||u.pathname.includes('..')){res.writeHead(404);return res.end();}
 const file=path.join(root,u.pathname);if(!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
}).listen(4260,'127.0.0.1',()=>console.log('Offline assignment preview http://127.0.0.1:4260/?role=trainer'));
