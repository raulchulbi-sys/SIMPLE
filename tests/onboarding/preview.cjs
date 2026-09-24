// Local visual review of the real frontend. CSP blocks every API connection.
// Does not mock authentication, expose private files, or permit real account writes.
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..');
const port=Number(process.env.AUTH_PREVIEW_PORT||4180);
const sdkPath=path.join(__dirname,'private/supabase-2.115.0.js');
if(!fs.existsSync(sdkPath))throw Error('Cache the official supabase-js 2.115.0 build in tests/onboarding/private first.');
const files={'/assets/auth.css':['assets/auth.css','text/css'],'/assets/auth.js':['assets/auth.js','application/javascript'],'/assets/atlas.webp':['assets/atlas.webp','image/webp']};
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.writeHead(405);return res.end()}
 if(url.pathname==='/'||url.pathname==='/index.html'){
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.end(fs.readFileSync(path.join(root,'index.html'),'utf8').replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0','/sdk.js'));
 }
 if(url.pathname==='/sdk.js'){res.setHeader('Content-Type','application/javascript');return res.end(fs.readFileSync(sdkPath))}
 const item=files[url.pathname];if(!item){res.writeHead(404);return res.end()}
 res.setHeader('Content-Type',item[1]);res.end(fs.readFileSync(path.join(root,item[0])));
}).listen(port,'127.0.0.1',()=>console.log(`Visual preview: http://127.0.0.1:${port} — all Auth/API connections blocked by CSP.`));
