import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {setup,sql,query} from './postgres-local.mjs';
await setup();
const read=async f=>fs.readFile(new URL('../../supabase/'+f,import.meta.url),'utf8');
const hash=()=>query("select to_jsonb(md5(pg_get_functiondef('public.billing_test_change(uuid,uuid,text,jsonb)'::regprocedure)));");
test('guarded installer rejects missing/wrong project attestation without changing function',async()=>{
 const installer=await read('billing-test-install.sql');const before=hash();
 for(const approval of ['',"SET LOCAL simple.approved_project='not-approved';"]){const result=sql(installer.replace('BEGIN;','BEGIN;\n'+approval),{allowError:true});assert.equal(result.ok,false);assert.match(result.error,/authorization_required/);assert.equal(hash(),before);}
});
test('guarded real PostgreSQL installation and restore verify exact hashes/ACL, refuse drift',async()=>{
 sql(await read('rollback-billing-test-change.sql'));assert.equal(hash(),'cbe9e10d28bbf874b1ef96e685a2c0e0');
 const localAttestation=s=>s.replace('BEGIN;',"BEGIN;\nSET LOCAL simple.approved_project='dmqjexigdnfzobarhnib';");
 sql(localAttestation(await read('billing-test-install.sql')));assert.equal(hash(),'725010c6affa7bd961af76090115e296');
 const repeat=sql(localAttestation(await read('billing-test-install.sql')),{allowError:true});assert.equal(repeat.ok,false);assert.match(repeat.error,/definition_drift/);
 sql(localAttestation(await read('billing-test-restore.sql')));assert.equal(hash(),'cbe9e10d28bbf874b1ef96e685a2c0e0');
 assert.equal(query("select to_jsonb(has_function_privilege('authenticated','public.billing_test_change(uuid,uuid,text,jsonb)','execute'));"),false);
});
