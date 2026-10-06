const fs=require('fs'),path=require('path'),http=require('http'),root=path.resolve(__dirname,'../..');
const sdk=fs.readFileSync(path.join(root,'tests/interior/mock-sdk.js'),'utf8')+`
const originalCreate=supabase.createClient;
supabase.createClient=(...args)=>{const db=originalCreate(...args),old=db.rpc;db.rpc=(name,a)=>{
const key='synthetic-statistics:'+a.p_client_id+':'+a.p_routine_id,stage=JSON.parse(localStorage.getItem(key)||'{"id":null,"started_at":null}');
if(name==='get_client_routine_statistics_stage')return Promise.resolve({data:stage,error:null});
if(name==='reset_client_routine_statistics'){mock.calls.push({rpc:name,args:a});return new Promise(resolve=>setTimeout(()=>{if(a.p_expected_stage!==stage.id)return resolve({error:{message:'statistics_stage_conflict'}});const next={id:crypto.randomUUID(),started_at:new Date().toISOString()};localStorage.setItem(key,JSON.stringify(next));resolve({data:next,error:null});},100));}
if(name==='get_client_routine_stage_cycle_progress'){const rows=mock.tables.workouts.filter(w=>w.user_id===a.p_client_id&&w.data.routine_id===a.p_routine_id&&Date.parse(w.created_at)>=Date.parse(stage.started_at));return Promise.resolve({data:[{total_days:5,completed_days:rows.length}],error:null});}
return old(name,a);};return db;};`;
http.createServer((req,res)=>{const u=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');
if(u.pathname==='/sdk.js'){res.setHeader('Content-Type','application/javascript');return res.end(sdk);}
if(u.pathname==='/seed.js'){res.setHeader('Content-Type','application/javascript');return res.end(fs.readFileSync(path.join(root,'tests/interior/preview-seed.js')));}
if(u.pathname==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'self';script-src 'self' 'unsafe-inline';style-src 'self' 'unsafe-inline';img-src 'self' data:;connect-src 'none';form-action 'none';object-src 'none'");return res.end(fs.readFileSync(path.join(root,'index.html'),'utf8').replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0','/sdk.js').replace('</body>','<script src="/seed.js"></script></body>'));}
if(!/^\/assets\/[a-zA-Z0-9._/-]+$/.test(u.pathname)||u.pathname.includes('..')){res.writeHead(404);return res.end();}const file=path.join(root,u.pathname);if(!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
}).listen(4258,'127.0.0.1',()=>console.log('Offline preview http://127.0.0.1:4258/'));
