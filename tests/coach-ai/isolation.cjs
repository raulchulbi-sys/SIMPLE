const a=require('./api.cjs');
(async()=>{await a.login();const owner='browser2',id=a.c.users[owner].id;
for(const table of ['training_intakes','intake_health','context_grants','coach_operations','routine_management','routine_revisions']){
 const rows=await a.table(owner,table,'user_id=eq.'+id);a.check(table+' populated owner reads',rows.ok&&rows.data.length>0);
 for(const who of ['other','trainer']){const r=await a.table(who,table,'user_id=eq.'+id);a.check(table+' populated other isolated '+who,r.ok&&r.data.length===0);}
}
const i=(await a.table('other','training_intakes')).data[0];
a.check('Edge no pilot denied',!(await a.edge('other',i)).ok);
a.check('Edge anon denied',!(await a.edge(null,i)).ok);
a.check('Edge rejects model parameter',!(await a.request('other','/functions/v1/simple-coach-mock',{intake_id:i.id,key:a.crypto.randomUUID(),model:'gpt-5.4-2026-03-05'})).ok);
a.check('Edge forged intake denied',!(await a.edge('owner',i)).ok);
a.save('isolation');})().catch(e=>{a.save('isolation');console.error(e.message);process.exitCode=1});
