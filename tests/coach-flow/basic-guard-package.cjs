// Offline packaging only. Retain every deployed file and CORS origin; no network/deploy.
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto');
const directory=process.argv[2];assert(directory,'Pass an ignored private deployment directory');
const root=path.resolve(__dirname,'../..'),dir=path.resolve(directory);
assert(dir.startsWith(path.join(__dirname,'private')+path.sep));
const before=JSON.parse(fs.readFileSync(path.join(dir,'before-edge.json'),'utf8'));
assert.equal(before.slug,'simple-coach-mock');assert.equal(before.verify_jwt,true);assert.equal(before.import_map,false);
const normalize=s=>s.replaceAll('\r\n','\n'),entry='supabase/functions/simple-coach-mock/index.ts';
const base=normalize(cp.execFileSync('git',['show','3183b36:'+entry],{cwd:root,encoding:'utf8'}));
const current=normalize(fs.readFileSync(path.join(root,entry),'utf8'));
const remote=normalize(before.files.find(f=>f.name===entry).content);
const origins=s=>s.match(/^const allowed=.*$/m)?.[0];assert(origins(base)&&origins(remote)&&origins(current));
assert.equal(remote.replace(origins(remote),''),base.replace(origins(base),''),'Unreviewed deployed entrypoint drift');
for(const f of before.files.filter(f=>f.name!==entry))assert.equal(normalize(f.content).trimEnd(),normalize(fs.readFileSync(path.join(root,f.name),'utf8')).trimEnd(),'Unreviewed dependency drift: '+f.name);
const candidate=structuredClone(before.files);
candidate.find(f=>f.name===entry).content=current.replace(origins(current),origins(remote));
const guard='supabase/functions/simple-coach-mock/staging-cost-guard.mjs';
assert(!candidate.some(f=>f.name===guard),'Already contains guard; investigate before reapplying');
candidate.push({name:guard,content:fs.readFileSync(path.join(root,guard),'utf8')});
assert.equal(origins(candidate.find(f=>f.name===entry).content),origins(remote));
for(const f of before.files.filter(f=>f.name!==entry))assert.equal(candidate.find(x=>x.name===f.name).content,f.content);
const project_id='dmqjexigdnfzobarhnib',common={project_id,name:before.slug,entrypoint_path:entry,verify_jwt:true};
const deployment={...common,files:candidate},rollback={...common,files:before.files};
fs.writeFileSync(path.join(dir,'deployment.json'),JSON.stringify(deployment,null,2)+'\n');
fs.writeFileSync(path.join(dir,'rollback.json'),JSON.stringify(rollback,null,2)+'\n');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const summary={project:project_id,previousVersion:before.version,verify_jwt:true,unchangedFiles:before.files.length-1,changed:[entry],added:[guard],corsPreserved:true,
 deploymentSHA256:sha(JSON.stringify(deployment)),rollbackSHA256:sha(JSON.stringify(rollback)),files:candidate.map(f=>({name:f.name,sha256:sha(f.content)}))};
fs.writeFileSync(path.join(dir,'package-summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
