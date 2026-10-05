// Local preparation only. Generates reviewed production Edge files; never deploys.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'results');
const shared=['supabase/functions/simple-coach-premium/series-contract.mjs','supabase/functions/simple-coach-premium/contract.mjs','assets/coach-intake.js','assets/coach-programming-v4.js','assets/coach-programming-v5.js'];
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function pack(name){
 const entry='supabase/functions/'+name+'/index.ts',contract='supabase/functions/'+name+'/'+(name==='simple-coach-chat'?'chat-contract.mjs':'weekly-contract.mjs');
 const names=[entry,contract,...(name==='simple-coach-premium'?['supabase/functions/simple-coach-premium/distribution-contract.mjs']:[]),...shared];const files=names.map(name=>({name,content:fs.readFileSync(path.join(root,name),'utf8')}));
 const f=files[0],before=f.content;
 assert.equal(before.split("URL!=='https://dmqjexigdnfzobarhnib.supabase.co'").length,2,'One explicit target guard');
 f.content=before.replace("URL!=='https://dmqjexigdnfzobarhnib.supabase.co'","URL!=='https://yvguatdqncadkwewlepe.supabase.co'");
 const originDeclaration=/const (allowed|origins)=new Set\(\[[^\n]+?\]\);/;
 assert(originDeclaration.test(f.content),'One explicit origin allow-list');
 f.content=f.content.replace(originDeclaration,(_m,n)=>'const '+n+"=new Set(['https://raulchulbi-sys.github.io']);");
 const approved=before.replace("URL!=='https://dmqjexigdnfzobarhnib.supabase.co'","URL!=='https://yvguatdqncadkwewlepe.supabase.co'").replace(originDeclaration,(_m,n)=>'const '+n+"=new Set(['https://raulchulbi-sys.github.io']);");
 assert.equal(f.content,approved,'Only project guard and origin changes');
 assert(!f.content.includes('http://127.0.0.1:')&&!f.content.includes('http://localhost:'),'No local production CORS origins');
 return {project_id:'yvguatdqncadkwewlepe',name,entrypoint_path:entry,verify_jwt:true,files,review:{source_entry_sha256:sha(before),production_entry_sha256:sha(f.content),only_changes:['explicit project guard','GitHub Pages origin'],contains_credentials:false}};
}
if(require.main===module){fs.mkdirSync(out,{recursive:true});for(const n of ['simple-coach-premium','simple-coach-chat']){const p=pack(n);fs.writeFileSync(path.join(out,'production-'+n+'.json'),JSON.stringify(p,null,2));console.log(JSON.stringify({name:n,review:p.review}));}console.log('Local artifacts only; no network or publication.');}
module.exports={pack};
