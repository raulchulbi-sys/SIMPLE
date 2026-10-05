// Generate the reviewable SQL candidate from the approved, unchanged vocabulary.
const fs=require('fs'),path=require('path');
const I=require('../../assets/coach-intake.js');
const enumOf=(v,nullable=false)=>({enum:[...v,...(nullable?[null]:[])]});
const ids=x=>x.map(v=>v.id),arr=(v,n)=>({type:'array',maxItems:n,items:enumOf(v)});
function shape(full){const e=(v)=>enumOf(v,!full);return {type:'object',properties:{
 schema_version:enumOf(['premium-intake-v1']),experience:e(ids(I.experience)),goal:e(ids(I.premiumGoals)),
 days:e([2,3,4,5,6]),weekdays:arr(ids(I.weekdays),7),minutes:enumOf([null]),effort:e(ids(I.effort)),
 excluded:arr(ids(I.exercises),20),pause:e([true,false]),weak_points:arr(ids(I.weakPoints),2),
 confidence:enumOf(ids(I.levels),true),recovery:e(ids(I.recovery)),sleep:e(ids(I.sleep)),
 sleep_stability:enumOf(ids(I.stability),true),stress:e(ids(I.levels)),distribution:e(ids(I.distribution)),
 // Variable-key availability is validated separately, never ignored.
 minutes_by_day:{type:'object'},activity:{type:'object',properties:{type:e(ids(I.activities)),weekdays:arr(ids(I.weekdays),7),minutes:enumOf(I.minutes,true),intensity:enumOf(ids(I.levels),true)}},
 inventory:{type:'object',properties:{equipment:arr(ids(I.equipment),37),custom:{type:'array',maxItems:10,items:{type:'string',minLength:2,maxLength:40}}}}
}};}
let sql=fs.readFileSync(path.join(__dirname,'template.sql'),'utf8');
sql=sql.replaceAll('__CATALOGUE__',JSON.stringify(I.exercises).replaceAll("'","''"));
for(const full of [true,false])sql=sql.replaceAll(full?'__FULL_SCHEMA__':'__DRAFT_SCHEMA__',JSON.stringify(shape(full)).replaceAll("'","''"));
const guard=fs.readFileSync(path.join(__dirname,'guard-before.sql'),'utf8').trim().replace(/;$/,'');
const gate=` if exists(select 1 from public.routine_management m join public.coach_recommendations c on c.routine_id=m.routine_id
   where m.plan_kind='premium' and c.user_id=auth.uid() and c.state='ready' and c.apply_txid=txid_current()
   and c.base_revision_id=m.current_revision_id and (old_r is null or old_r=m.routine_id) and (new_r is null or new_r=m.routine_id)) then
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
`;
sql=sql.replace('__GUARD__',guard.replace(' if exists(select 1 from public.routine_management where routine_id in (old_r,new_r))',gate+' if exists(select 1 from public.routine_management where routine_id in (old_r,new_r))')+';');
fs.mkdirSync(path.join(__dirname,'private'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'private/candidate.sql'),sql);
console.log('Generated private/candidate.sql from unchanged vocabulary and original guard.');
