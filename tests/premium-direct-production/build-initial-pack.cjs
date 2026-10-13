'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const names=["supabase/functions/simple-coach-initial-premium/index.ts","supabase/functions/simple-coach-initial-premium/contract.mjs","supabase/functions/simple-coach-mock/contract-v5.mjs","supabase/functions/simple-coach-mock/contract-v4.mjs","supabase/functions/simple-coach-mock/contract-v3.mjs","supabase/functions/simple-coach-mock/contract-v2.mjs","assets/coach-intake.js","assets/coach-programming-v4.js","assets/coach-programming-v5.js","supabase/functions/simple-coach-initial-premium/provider.mjs","supabase/functions/simple-coach-premium/provider-receipt.mjs"];
const pack={name:'simple-coach-initial-premium',entrypoint_path:names[0],verify_jwt:true,files:names.map(name=>({name,content:fs.readFileSync(path.join(root,name),'utf8')}))};
process.stdout.write(JSON.stringify(pack));
