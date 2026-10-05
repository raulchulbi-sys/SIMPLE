// Two-session test; SQL holder must be confirmed externally before this JWT process starts.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),L=require('./live.cjs');
const mode=process.argv[2],manifest=L.readJSON(L.file('race-fixture.json')),c=manifest.cases[mode];let elapsed=null,inconclusive=false,request_started_at=null,request_finished_at=null;
async function main(){
 assert(['a','b'].includes(mode)&&manifest.ref===L.creds.ref&&manifest.owner===L.fixture.user&&c.name.startsWith('SYNTHETIC Upgrade locking '));
 const delay=Number(process.argv[3]||0);assert(Number.isInteger(delay)&&delay>=0&&delay<=30000,'Explicit launch delay must be 0–30000 ms');if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
 const started=Date.now();request_started_at=new Date(started).toISOString();let r;
 if(mode==='a')r=await L.rpc('mock','premium_start_followup',{p_routine:c.routine,p_key:c.key,p_start:new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Madrid'}),p_weeks:4});
 else r=await L.req('mock','/rest/v1/routine_exercises?id=eq.'+c.exercise,{target:c.attempt_target},'PATCH');
 elapsed=Date.now()-started;request_finished_at=new Date().toISOString();
 // Delay alone is not proof: coordinator must also record the actual held parent/blocked session.
 if(elapsed<1000)inconclusive=true;
 if(mode==='a')L.check('Edit-first admission succeeds with real owner JWT',r.ok&&typeof r.data==='string');
 else L.check('Admission-first concurrent owner edit denied after commit',!r.ok&&r.status===403&&r.data?.code==='42501'&&r.data?.message==='coach_structure_locked');
 const m=(await L.must(L.table('mock','coach_mesocycles','routine_id=eq.'+c.routine)))[0];L.check(mode+' exactly one existing-owned admission',!!m&&m.user_id===manifest.owner&&m.routine_id===c.routine&&m.initial_revision_id===m.current_revision_id);
 const rev=(await L.must(L.table('mock','routine_revisions','id=eq.'+m.current_revision_id)))[0],es=await L.must(L.table('mock','routine_exercises','id=eq.'+c.exercise)),target=mode==='a'?c.attempt_target:c.initial_target;
 L.check(mode+' baseline preserves exact day and exercise UUIDs',rev.snapshot.days.length===1&&rev.snapshot.days[0].id===c.day&&rev.snapshot.days[0].exercises.length===1&&rev.snapshot.days[0].exercises[0].id===c.exercise&&es.length===1&&es[0].day_id===c.day);
 const e=rev.snapshot.days[0].exercises[0],reps=target.split('-').map(Number),faithful=Array.isArray(e.planned_sets)?e.planned_sets.length===3&&e.planned_sets.every((s,i)=>s.set_number===i+1&&s.reps_min===reps[0]&&s.reps_max===reps[1]&&s.rir===2&&s.rest_seconds===120):e.target===target&&e.sets===3&&e.rir==='2'&&e.rest_seconds===120;
 L.check(mode+' baseline/live prescription remains complete and coherent',es[0].target===target&&es[0].sets===3&&es[0].rir==='2'&&es[0].rest_seconds===120&&faithful);
 const all=await L.must(L.table('mock','routine_revisions','routine_id=eq.'+c.routine));L.check(mode+' only one baseline revision captured',all.length===1&&all[0].id===m.current_revision_id);
 c.mesocycle=m.id;c.revision=m.current_revision_id;fs.writeFileSync(L.file('race-fixture.json'),JSON.stringify(manifest,null,2));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{const result={rows:L.rows,total:L.rows.length,completed:!process.exitCode,inconclusive,elapsed_ms:elapsed,request_started_at,request_finished_at,provider_dispatches:0,requires_external_lock_observation:true};fs.writeFileSync(path.join(__dirname,'results/race-'+mode+'.json'),JSON.stringify(result,null,2));console.log(L.rows.filter(r=>r.pass).length+'/'+L.rows.length+' race '+mode+' checks; '+(inconclusive?'blocking timing inconclusive':'awaiting corroborating lock observation'));});
