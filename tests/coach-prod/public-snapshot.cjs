// Read-only public deployment and unauthenticated staging gateway checks.
const fs=require('fs'),crypto=require('crypto'),cp=require('child_process');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
(async()=>{const url='https://raulchulbi-sys.github.io/SIMPLE/';const r=await fetch(url+'?coach_readonly='+Date.now(),{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('public HTTP '+r.status);const html=await r.text();const base=cp.execFileSync('git',['show','7cf24fa:index.html'],{encoding:'utf8',maxBuffer:5e6});
const edge=await fetch('https://dmqjexigdnfzobarhnib.supabase.co/functions/v1/simple-coach-mock',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
const result={url,http:r.status,public_sha256:digest(html),baseline_sha256:digest(base),exact_published_base:html===base,staging_unauthenticated_edge_http:edge.status};fs.writeFileSync('tests/coach-prod/results/public-before.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.exact_published_base||edge.status!==401)process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1});
