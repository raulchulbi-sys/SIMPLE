'use strict';
// Loopback-only inspection of the reviewed staging package; no proxy or API.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function serverFor(directory){
 const root=fs.realpathSync(directory),manifest=require('../config/static-public-manifest.json');
 const allowed=new Set([...manifest.files,'assets/runtime-config.js','404.html','robots.txt']);
 const runtime=fs.readFileSync(path.join(root,'assets/runtime-config.js'),'utf8');
 const routes=JSON.parse(runtime.match(/var routes=(\[.*\]);\n/)[1]);
 if(routes.length!==1||routes[0].target!=='local'||routes[0].environment!=='staging'||routes[0].supabaseUrl!=='https://dmqjexigdnfzobarhnib.supabase.co')throw Error('Preview requires the single local staging artifact');
 const policy=fs.readFileSync(path.join(root,'_headers'),'utf8').split(/\r?\n/);
 const rules=[];let current=null;
 for(const line of policy){if(!line.trim()||line.startsWith('#'))continue;if(!/^\s/.test(line)){current={pattern:line.trim(),headers:{}};rules.push(current);}else{const at=line.indexOf(':');if(at>0&&current)current.headers[line.slice(0,at).trim()]=line.slice(at+1).trim();}}
 const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
 return http.createServer((req,res)=>{
  for(const rule of rules)if(rule.pattern==='/*')for(const [k,v]of Object.entries(rule.headers))res.setHeader(k,v);
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD','Cache-Control':'no-store'});return res.end();}
  let route;try{route=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400,{'Cache-Control':'no-store'});return res.end();}
  const name=route==='/'||route==='/index'?'index.html':route.slice(1);
  const exists=allowed.has(name)&&fs.existsSync(path.join(root,...name.split('/')));
  const relative=exists?name:'404.html',absolute=path.join(root,...relative.split('/'));
  if(fs.lstatSync(absolute).isSymbolicLink()||!fs.realpathSync(absolute).startsWith(root+path.sep)){res.writeHead(500,{'Cache-Control':'no-store'});return res.end();}
  const body=fs.readFileSync(absolute),etag='"'+crypto.createHash('sha256').update(body).digest('hex')+'"';
  for(const rule of rules){if(rule.pattern===route||rule.pattern==='/assets/*'&&route.startsWith('/assets/'))for(const[k,v]of Object.entries(rule.headers))res.setHeader(k,v);}
  res.setHeader('Content-Type',types[path.extname(relative)]||'application/octet-stream');res.setHeader('ETag',etag);
  if(!exists){res.setHeader('Cache-Control','no-store');res.writeHead(404);return res.end(req.method==='HEAD'?undefined:body);}
  if(req.headers['if-none-match']===etag){res.writeHead(304);return res.end();}
  res.writeHead(200);res.end(req.method==='HEAD'?undefined:body);
 });
}
module.exports={serverFor};
if(require.main===module){const s=serverFor(path.join(__dirname,'../dist'));s.listen(4280,'127.0.0.1',()=>console.log('Staging frontend preview: http://127.0.0.1:4280/ (no production backend)'));}
