const a=require('./api.cjs'),{check,rpc,table,fs,path}=a;
(async()=>{await a.login();for(const w of ['browser1','expired','stale','rollback']){const r=await rpc(w,'get_my_coach_access');check(w+' expired disabled or no adult denied',r.ok&&!r.data.authorized&&!r.data.can_generate);}
const state=await rpc('browser1','get_my_coach_access'),rid=JSON.parse(fs.readFileSync(path.join(__dirname,'private/browser1-ui.json'))).routine;
check('expiry preserves accepted routine access',state.data.routine_id===rid&&(await table('browser1','routines','id=eq.'+rid)).data.length===1);
const op=(await table('browser1','coach_operations','state=eq.accepted')).data[0];check('expiry preserves acceptance idempotence',(await rpc('browser1','accept_basic_plan',{p_operation:op.id})).data===rid);
check('expiry keeps training history',(await table('browser1','workouts','data->>routine_id=eq.'+rid)).data.length===2);
check('expired reviewer capability false',(await rpc('reviewer','get_coach_reviewer_access')).data===false);
for(const name of ['get_coach_review_queue','get_coach_pilot_metrics'])check('expired reviewer denied '+name,!(await rpc('reviewer',name)).ok);
check('expired reviewer feedback hidden',(await table('reviewer','coach_pilot_feedback')).data.length===0);
const access=await rpc('owner','get_my_coach_access');check('generation consumed reported',access.data.generation_consumed===true&&!access.data.can_generate);
a.save('expiry');})().catch(e=>{a.save('expiry');console.error(e.message);process.exitCode=1});
