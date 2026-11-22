'use strict';
// Actual reviewer entry consumer, invented UUIDs and a tiny DOM. No SDK/network/Auth.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function fixture(sourceRoot,reply){
 const calls=[],opened=[];
 class Element{constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.parent=null;}append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}setAttribute(k,v){this[k]=v;}}
 const app=new Element('main');app.id='app';
 const find=(node,key)=>node.id===key?node:node.children.map(n=>find(n,key)).find(Boolean);
 const context={module:{exports:{}},console:{log(){},error(){}},user:{id:id(1)},profile:{role:'trainer'},SUPABASE_URL:'https://dmqjexigdnfzobarhnib.supabase.co',globalThis:null,
  document:{createElement:tag=>new Element(tag)},$:key=>find(app,key),coachEnabled:()=>true,openPremiumCoach:o=>opened.push(o),
  db:{rpc:async(name,args)=>{calls.push({name,args});return typeof reply==='function'?reply():reply;},from(){calls.push({table:true});throw Error('private_table_fallback');}},fetch(){throw Error('network_forbidden');}};
 context.globalThis=context;vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(sourceRoot,'assets/coach-reviewer.js'),'utf8')+'\nmodule.exports={renderPremiumCoachReviewerEntry};',context,{filename:'actual-coach-reviewer.js'});
 return{context,app,calls,opened,entry:()=>find(app,'premiumCoachReviewerEntry'),run:()=>context.module.exports.renderPremiumCoachReviewerEntry(id(1))};
}
async function run(sourceRoot){
 const checks=[],scope={id:id(3),number:1,state:'active'},positive={data:{actor:'reviewer',scopes:[scope]},error:null};
 for(const reply of [{data:null,error:{code:'PGRST202'}},{data:null,error:{code:'42501'}},{data:{actor:'athlete',scopes:[scope]},error:null},{data:{actor:'reviewer',scopes:[]},error:null}]){
  const f=fixture(sourceRoot,reply);await f.run();assert.equal(f.entry(),undefined);assert.equal(f.calls.length,1);assert.equal(f.calls[0].name,'premium_reviewer_state');assert.equal(f.calls[0].args.p_mesocycle,null);
 }
 const yes=fixture(sourceRoot,positive);await yes.run();assert(yes.entry());const button=yes.entry().children[1].children[1];button.onclick();assert.equal(yes.opened.length,1);assert.equal(yes.opened[0].mesocycleId,scope.id);assert(yes.calls.every(c=>!c.table));
 checks.push('actual reviewer list requires successful server capability even with trainer role and has no private REST fallback');
 for(const nextUser of [null,{id:id(9)}]){
  let release;const wait=new Promise(resolve=>{release=resolve;});const f=fixture(sourceRoot,()=>wait),pending=f.run();assert.equal(f.calls.length,1);f.context.user=nextUser;release(positive);await pending;assert.equal(f.entry(),undefined);assert(f.calls.every(c=>!c.table));
 }
 checks.push('actual reviewer list discards a delayed capability response after local logout or user switch');
 return{kind:'new offline entry-consumer regression only',passed:checks.length,total:checks.length,checks,networkRequests:0,sessionsCreated:0,databaseWrites:0};
}
module.exports={run};
if(require.main===module){const args=process.argv.slice(2);assert(args[0]==='--source-root'&&args.length===2,'Explicit source root required');run(path.resolve(args[1])).then(r=>console.log(JSON.stringify(r))).catch(()=>{console.error('reviewer_entry_contract_failed');process.exitCode=1;});}
