const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..'),captured=path.join(__dirname,'private/originals.json');
// The checked-in rollback contains the exact six original definitions; private captures are optional.
const original=fs.existsSync(captured)?JSON.parse(fs.readFileSync(captured)):Object.fromEntries([...fs.readFileSync(path.join(__dirname,'rollback.sql'),'utf8').matchAll(/CREATE OR REPLACE FUNCTION (?:public|coach_private)\.(\w+)\([\s\S]*?\nAS \$function\$[\s\S]*?\$function\$\n/g)].map(m=>[m[1],m[0]]));
if(Object.keys(original).length!==6)throw Error('Exact original definitions required');
const rename=(name)=>original[name].replace('coach_private.'+name+'(','coach_private.'+name+'_v1(')+';';
const names=['premium_bundle','premium_output_patches','premium_check_patch','premium_snapshot'];
let finish=original.premium_analysis_finish;
finish=finish.replace("when err in ('semantic_invalid','invalid_recommendation','invalid_json') then 'invalid'","when err in ('semantic_invalid','invalid_recommendation','invalid_json') then 'pending_review'");
finish=finish.replace("'quality_warnings',p_warnings", "'quality_warnings',p_warnings,'review_issue',case when err in ('semantic_invalid','invalid_recommendation','invalid_json') then 'La propuesta no es aplicable con seguridad. Requiere resolución humana; no se aplicará el output original.' else null end");
let reserve=original.premium_reserve_analysis.replace("'prompt_version','premium-analysis-v1'","'prompt_version','premium-analysis-v1.1'").replace("'response_schema_version','premium-recommendation-v1'","'response_schema_version','premium-recommendation-v2'").replace("'provider_context_version','premium-provider-v1'","'provider_context_version','premium-provider-v1','prescription_context_version','premium-prescription-v2'");
const sql=fs.readFileSync(path.join(__dirname,'template.sql'),'utf8').replace('__BACKUPS__',()=>names.map(rename).join('\n')).replace('__FINISH__',()=>finish+';').replace('__RESERVE__',()=>reserve+';').replaceAll('\r\n','\n');
const file=fs.readdirSync(path.join(root,'supabase/migrations')).find(x=>x.endsWith('_coach_premium_per_set.sql'));if(!file)throw Error('Create migration via CLI first');
fs.writeFileSync(path.join(root,'supabase/migrations',file),sql);fs.writeFileSync(path.join(__dirname,'private/candidate.sql'),sql);
const rollback=`begin;
do $$ begin
 if exists(select 1 from public.routine_revisions where snapshot->>'prescription_context_version'='premium-prescription-v2') or exists(select 1 from public.coach_recommendations where analysis_trace->>'prescription_context_version'='premium-prescription-v2') then raise exception 'premium_series_rollback_requires_clean_test_fixture_state';end if;
end $$;
`+Object.values(original).map(x=>x+';').join('\n')+`\nalter table coach_private.premium_analysis_budget drop constraint premium_analysis_budget_max_calls_check;
update coach_private.premium_analysis_budget set enabled=false,max_calls=12,max_usd=.5 where id;
alter table coach_private.premium_analysis_budget add constraint premium_analysis_budget_max_calls_check check(max_calls between 0 and 12);
drop function coach_private.premium_bundle_v1(uuid,uuid),coach_private.premium_output_patches_v1(public.coach_recommendations,jsonb),coach_private.premium_check_patch_v1(jsonb,uuid,boolean),coach_private.premium_snapshot_v1(uuid),coach_private.premium_revision_sets(uuid,uuid),coach_private.premium_series_uniform(jsonb),coach_private.premium_sets_valid(jsonb,boolean);
commit;\n`;
fs.writeFileSync(path.join(__dirname,'rollback.sql'),rollback.replaceAll('\r\n','\n'));console.log('Generated additive per-set SQL and exact rollback: '+file);
