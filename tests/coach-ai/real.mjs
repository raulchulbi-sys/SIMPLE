// Only the staging Edge calls OpenAI. This runner sends authorized synthetic intake IDs with real JWTs.
import fs from 'node:fs';import {createRequire} from 'node:module';
import {cases} from './cases.mjs';import {reviewProposal} from '../../supabase/functions/simple-coach-mock/contract.mjs';
const require=createRequire(import.meta.url),a=require('./api.cjs');
const label=process.argv[2];if(!['mini','capable'].includes(label))throw Error('Expected mini/capable batch label (not a frontend model selector)');
const file=new URL('./results/real-'+label+'.json',import.meta.url);if(fs.existsSync(file))throw Error('Keep previous real outputs; do not overwrite evidence');
await a.login();const users=['owner','retry','stale','revoked','browser1','browser2','rollback'];const results=[];
for(let n=0;n<cases.length;n++){
 const who=users[n%users.length],item=cases[n];
 const before=await a.table(who,'training_intakes','order=revision.desc&limit=1');const old=before.data[0];
 const r=await a.rpc(who,'save_my_training_intake',{p_id:old?.id||null,p_expected:old?.row_version||null,p_training:item.context.training,p_health:item.context.health,p_submit:true});if(!r.ok)throw Error('intake rejected '+r.status);
 for(const scope of ['training_intake','declared_health']){const x=await a.rpc(who,'set_my_coach_context_permission',{p_scope:scope,p_allow:true});if(!x.ok)throw Error('context rejected');}
 const start=Date.now(),response=await a.edge(who,r.data);
 const rows=await a.table(who,'coach_operations','intake_id=eq.'+r.data.id+'&order=created_at.desc&limit=1');const op=rows.data[0];
 results.push({case:item.id,context:item.context,http_status:response.status,roundtrip_ms:Date.now()-start,operation:op,review:op?.proposal?reviewProposal(op.proposal,item.context):null});
 fs.writeFileSync(file,JSON.stringify(results,null,2));
 console.log(JSON.stringify({case:item.id,state:op?.state,error:op?.error_code,model:op?.model_name,latency:op?.latency_ms,valid:results.at(-1).review?.ok}));
 if(['configuration_error','provider_rejected','provider_rate_limit'].includes(op?.error_code))break;
}
