// Final state of this task-only helper: no credentials, admin client or privileged route.
Deno.serve(()=>new Response(JSON.stringify({error:'qa_retired'}),{status:410,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}));
