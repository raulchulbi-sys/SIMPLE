'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Offline model of the proposed SQL loop. No backend, Auth or application writes.
const ids = ['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005'];
const days = ids.map((id, order) => ({id, order, name:['PUSH','PULL','LEG','UPPER','ARMS'][order], created:'2026-08-24T09:00:00Z'}));
const row = (index, date='2026-10-19', extra={}) => ({uuid:ids[index], date, created:date+'T12:00:00Z', ...extra});
function cycle(rows, options={}) {
  const effective = options.days || days;
  if (!effective.length) return 0;
  const ordered = effective.map((d,i)=>({...d, ordinal:i})).sort((a,b)=>(a.order??Infinity)-(b.order??Infinity) || (options.custom?a.ordinal-b.ordinal:Date.parse(a.created)-Date.parse(b.created)) || a.id.localeCompare(b.id));
  const anchor = ordered[0].id;
  const orderedRows = rows.filter(r=>!options.stage || Date.parse(r.created)>=Date.parse(options.stage)).map((r,i)=>({...r, ordinal:i})).sort((a,b)=>a.date.localeCompare(b.date)||Date.parse(a.created)-Date.parse(b.created)||a.ordinal-b.ordinal);
  const alias = options.alias;
  let seen = new Set(), lastCompletion = null;
  for (const r of orderedRows) {
    let key = '';
    if (r.uuid) {
      if (effective.some(d=>d.id===r.uuid)) key=r.uuid;
      else if (alias && alias.client===options.client && alias.routine===options.routine && alias.old===r.uuid && effective.some(d=>d.id===alias.current)) key=alias.current;
    } else {
      const matches=effective.filter(d=>d.name.trim().toLowerCase()===String(r.name||'').trim().toLowerCase());
      if(matches.length===1) key=matches[0].id;
    }
    if(!key) continue;
    if(seen.size>0 && seen.size<effective.length && (seen.has(key) || (!options.legacy && key===anchor))) seen=new Set([key]);
    else seen.add(key);
    if(seen.size>=effective.length) { lastCompletion=r.date; seen=new Set(); }
  }
  return lastCompletion===(options.today||'2026-10-20') ? effective.length : seen.size;
}
const checks=[];
function test(name, body) { body(); checks.push(name); }
test('empty history',()=>assert.equal(cycle([]),0));
test('routine without sessions',()=>assert.equal(cycle([row(0)],{days:[]}),0));
test('first session starts at one',()=>assert.equal(cycle([row(0)]),1));
test('normal partial progression',()=>assert.equal(cycle([row(0),row(1),row(2)]),3));
const actualTrace=[row(0,'2026-10-05'),row(1,'2026-10-06'),row(2,'2026-10-07'),row(1,'2026-10-13'),row(2,'2026-10-14'),row(3,'2026-10-16'),row(0,'2026-10-19')];
test('reported missed-first-session sequence: old 4, new 1',()=>{assert.equal(cycle(actualTrace,{legacy:true}),4);assert.equal(cycle(actualTrace),1);});
test('calendar Monday alone does not restart',()=>assert.equal(cycle([row(1,'2026-10-16'),row(2,'2026-10-19')]),2));
test('initial session restarts a partial cycle without prior initial session',()=>assert.equal(cycle([row(1),row(2),row(0)]),1));
test('repeated non-initial session still restarts',()=>assert.equal(cycle([row(0),row(1),row(2),row(1)]),1));
test('five completed today stays 5/5',()=>assert.equal(cycle(ids.map((_,i)=>row(i,'2026-10-20'))),5));
test('yesterday completion rolls to zero',()=>assert.equal(cycle(ids.map((_,i)=>row(i))),0));
test('first session after yesterday completion starts one',()=>assert.equal(cycle([...ids.map((_,i)=>row(i)),row(0,'2026-10-20')]),1));
test('completion today retains existing precedence after another workout',()=>assert.equal(cycle([...ids.map((_,i)=>row(i,'2026-10-20')),row(0,'2026-10-20',{created:'2026-10-20T13:00:00Z'})]),5));
test('same-day second initial session does not add a day',()=>assert.equal(cycle([row(0),row(0)]),1));
test('unknown usable UUID cannot fall back to matching name',()=>assert.equal(cycle([row(0,'2026-10-19',{uuid:'00000000-0000-4000-8000-999999999999',name:'PUSH'})]),0));
test('legacy unique name only without usable UUID',()=>assert.equal(cycle([row(0,'2026-10-19',{uuid:'',name:' push '})]),1));
test('ambiguous legacy names remain unassociated',()=>assert.equal(cycle([row(0,'2026-10-19',{uuid:'',name:'PUSH'})],{days:[...days,{...days[1],name:'PUSH'}]}),0));
const alias={client:'client-a',routine:'routine-a',old:'00000000-0000-4000-8000-999999999999',current:ids[0]};
test('confirmed alias preserves target identity and start reset',()=>assert.equal(cycle([row(1),row(0,'2026-10-19',{uuid:alias.old})],{alias,client:'client-a',routine:'routine-a'}),1));
test('alias rejected for another client',()=>assert.equal(cycle([row(0,'2026-10-19',{uuid:alias.old})],{alias,client:'client-b',routine:'routine-a'}),0));
test('alias rejected for another routine',()=>assert.equal(cycle([row(0,'2026-10-19',{uuid:alias.old})],{alias,client:'client-a',routine:'routine-b'}),0));
test('rename preserves UUID based restart',()=>assert.equal(cycle([row(1),row(0)],{days:days.map(d=>({...d,name:'Renamed '+d.id}))}),1));
test('reorder explicitly changes the effective starting session',()=>{const reordered=days.map(d=>({...d,order:d.order===0?1:d.order===1?0:d.order}));assert.equal(cycle([row(1),row(2),row(0)]),1);assert.equal(cycle([row(1),row(2),row(0)],{days:reordered}),3);});
test('statistics stage excludes earlier workouts',()=>assert.equal(cycle([row(0,'2026-10-18'),row(1,'2026-10-19')],{stage:'2026-10-19T00:00:00Z'}),1));
test('custom effective order supplies the anchor',()=>{const custom=days.map(d=>({...d,order:d.order===0?2:d.order===2?0:d.order}));assert.equal(cycle([row(1),row(2)],{days:custom,custom:true}),1);});
test('custom day-order tie uses JSON ordinal consistently',()=>{const custom=[{...days[1],order:0},{...days[0],order:0},...days.slice(2)];assert.equal(cycle([row(2),row(1)],{days:custom,custom:true}),1);});
test('insertion order does not replace workout chronological order',()=>assert.equal(cycle([row(0,'2026-10-20'),row(1,'2026-10-19')]),1));
test('no midnight calendar reset of an unfinished cycle',()=>assert.equal(cycle([row(1,'2026-10-19'),row(2,'2026-10-20')]),2));

const candidate=fs.readFileSync(path.join(__dirname,'candidate.sql'),'utf8');
const rollback=fs.readFileSync(path.join(__dirname,'rollback.sql'),'utf8');
const parse=sql=>[...sql.matchAll(/(CREATE OR REPLACE FUNCTION public\.(get_client_[a-z_]+)\(p_client_id uuid, p_routine_id uuid\)[\s\S]*?\$function\$);/g)].map(m=>({name:m[2],definition:m[1]+'\n',md5:crypto.createHash('md5').update(m[1]+'\n').digest('hex')}));
const next=parse(candidate), prior=parse(rollback);
test('exactly the same three existing functions',()=>{assert.equal(next.length,3);assert.deepEqual(next.map(x=>x.name),prior.map(x=>x.name));});
test('SQL contains no table/data/security mutations',()=>{for(const sql of [candidate,rollback])assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|GRANT|REVOKE|CREATE\s+(?:TABLE|INDEX|TRIGGER|POLICY|SCHEMA))\b/i);});
test('candidate and rollback hashes are guarded in both directions',()=>{for(const f of [...next,...prior]){assert.ok(candidate.includes("='"+f.md5+"'"),f.name);assert.ok(rollback.includes("='"+f.md5+"'"),f.name);}});
test('guarded one transaction plus owner ACL config and definer checks',()=>{for(const sql of [candidate,rollback]){assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,1);assert.equal((sql.match(/AND pg_get_userbyid\(p.proowner\)='postgres'/g)||[]).length,6);assert.equal((sql.match(/AND p.prosecdef=true/g)||[]).length,6);assert.equal((sql.match(/AND to_jsonb\(p.proacl\)=/g)||[]).length,6);assert.equal((sql.match(/AND to_jsonb\(p.proconfig\)=/g)||[]).length,6);}});
test('only anchor declaration, ordered count and loop predicate change',()=>{for(const f of next){const old=prior.find(x=>x.name===f.name);let restored=f.definition.replace('  v_start_day text;\n','');const marker='where d.routine_id=p_routine_id;';const oldStart=old.definition.indexOf(f.name.includes('custom')?'  with effective_days as (select':'  select count(*) into v_total');assert.ok(oldStart>=0,old.name);const oldCount=old.definition.slice(oldStart,old.definition.indexOf(marker,oldStart)+marker.length);const start=restored.indexOf(f.name.includes('custom')?'  with effective_days as (\n':'  select count(*),\n');const end=restored.indexOf(marker,start)+marker.length;restored=restored.slice(0,start)+oldCount+restored.slice(end);const from=restored.indexOf('    -- The first session in the current routine order');const to=restored.indexOf(' then\n',from)+' then'.length;const oldLoop=old.definition.match(/    -- A repeated day[^\n]*\n    --[^\n]*\n    if v_key=any\(v_seen\) and v_done<v_total then/)[0];restored=restored.slice(0,from)+oldLoop+restored.slice(to);assert.equal(restored,old.definition,f.name);}});
console.log(JSON.stringify({mode:'offline synthetic + source contracts; no real JWT/backend tests',passed:checks.length,failed:0,cases:checks},null,2));
