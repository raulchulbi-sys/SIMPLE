import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
test('billing deployment config requires user JWT; webhook uses signature authentication',()=>{
 const config=fs.readFileSync(path.join(root,'supabase/config.toml'),'utf8');
 const setting=name=>config.split(`[functions.${name}]`)[1]?.split('\n[')[0];
 assert.match(setting('billing-test'),/verify_jwt\s*=\s*true/);
 assert.match(setting('billing-test-webhook'),/verify_jwt\s*=\s*false/);
 const hook=fs.readFileSync(path.join(root,'supabase/functions/billing-test-webhook/index.ts'),'utf8');
 assert(hook.indexOf('constructEventAsync(raw,signature,secret')<hook.indexOf('await verifyProvider'));
});
test('billing package resolves its complete relative import graph with pinned public SDKs',()=>{
 const files=new Set();const external=new Set();
 function scan(file){if(files.has(file))return;files.add(file);const src=fs.readFileSync(file,'utf8');
  for(const [,spec]of src.matchAll(/from ['"]([^'"]+)['"]/g)){
   if(spec.startsWith('.')){const target=path.resolve(path.dirname(file),spec);assert(target.startsWith(path.join(root,'supabase/functions')+path.sep));scan(target);}
   else external.add(spec);
  }
 }
 for(const name of ['billing-test','billing-test-webhook'])scan(path.join(root,`supabase/functions/${name}/index.ts`));
 assert.equal(files.size,6);assert.deepEqual([...external].sort(),['npm:@supabase/supabase-js@2.115.0','npm:stripe@23.0.0']);
});
