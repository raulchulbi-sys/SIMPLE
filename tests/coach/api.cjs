const fs=require('fs'),path=require('path'),crypto=require('crypto');
const dir=__dirname,c=JSON.parse(fs.readFileSync(path.join(dir,'private/fixture.json'))),base=`https://${c.ref}.supabase.co`;
if(c.ref!=='dmqjexigdnfzobarhnib')throw Error('Synthetic tests are staging-only');
const file=path.join(dir,'private/sessions.json');let sessions=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{};
const results=[];
function check(name,ok,detail=''){results.push({name,pass:!!ok,detail});console.log(`${ok?'PASS':'FAIL'} ${name}${detail?' '+detail:''}`);if(!ok)throw Error(name);}
async function request(who,route,body,method){const r=await fetch(base+route,{method:method||(body===undefined?'GET':'POST'),headers:{apikey:c.key,...(who&&sessions[who]?{Authorization:'Bearer '+sessions[who].access_token}:{}),'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});let data;const t=await r.text();try{data=JSON.parse(t)}catch{data=t}return {status:r.status,ok:r.ok,data};}
async function login(){for(const [who,u]of Object.entries(c.users)){if(sessions[who]?.expires_at>Date.now()/1000+120)continue;const r=await request(null,'/auth/v1/token?grant_type=password',{email:u.email,password:u.password});if(!r.ok)throw Error('Synthetic login '+who+' '+r.status);sessions[who]=r.data;check('JWT '+who,r.data.user.id===u.id);}
fs.writeFileSync(file,JSON.stringify(sessions));}
const rpc=(w,n,b={})=>request(w,'/rest/v1/rpc/'+n,b);
const table=(w,n,q='',b,m)=>request(w,'/rest/v1/'+n+'?'+q,b,m);
const training={goal:'SYNTHETIC strength',experience:'beginner',days:2,minutes:45,equipment:['SYNTHETIC equipment'],preferred:'',avoided:'',preferences:''},health={discomfort:'',limitations:''};
async function setup(w){const r=await rpc(w,'save_my_training_intake',{p_id:null,p_expected:null,p_training:training,p_health:health,p_submit:true});check(w+' submitted intake',r.ok,r.ok?'':JSON.stringify(r.data));for(const scope of ['training_intake','declared_health']){const g=await rpc(w,'set_my_coach_context_permission',{p_scope:scope,p_allow:true});check(w+' grant '+scope,g.ok)}return r.data;}
const edge=(w,i,key=crypto.randomUUID())=>request(w,'/functions/v1/simple-coach-mock',{intake_id:i.id,key});
function save(name){fs.writeFileSync(path.join(dir,'results',name+'.json'),JSON.stringify([...new Map(results.map(r=>[r.name,r])).values()],null,2))}
module.exports={fs,path,crypto,c,base,sessions,results,check,request,login,rpc,table,training,health,setup,edge,save};
