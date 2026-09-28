// Explicit synthetic backend receipts for exhaustive review transitions; NOT model evidence.
const a=require('./api.cjs'),{fs,path}=a;
(async()=>{const {validFixture}=await import('../coach-ai/cases.mjs');const ops=JSON.parse(fs.readFileSync(path.join(__dirname,'private/operations.json')));let sql='begin;\n';
for(const w of ['owner','stale','rollback']){const u=a.c.users[w].id,o=ops[w].operation.id;
 sql+=`update public.coach_operations set expires_at=now()+interval '5 minutes' where id='${o}';\nselect set_config('request.jwt.claims','{"role":"service_role"}',true);\nselect public.coach_backend_claim('${u}','${o}','gpt-5.4-2026-03-05');\nselect public.coach_backend_finish('${u}','${o}','${JSON.stringify(validFixture()).replaceAll("'","''")}',null,100,'[{"status":200,"latency_ms":100,"input_tokens":0,"output_tokens":0,"cached_input_tokens":0,"error_code":null}]');\n`;
}sql+='commit;';fs.writeFileSync(path.join(__dirname,'private/finish-fixtures.sql'),sql);})();
