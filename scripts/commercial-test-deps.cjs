// Optional public test tooling only. No account, login, provider API or installation script.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..'),base=path.join(root,'.tests-local');
const stripeIntegrity='sha512-MDE2A5ZVVluYURORaZEVghSmnLJc3w6aHAlZSxDQMsOjOb3V0O6ro/CiaeFlJS4N7uIVmsg98ocRsPmUK6YfyA==';
const sdkHash='0d8509e5aab9a4d8b0b0525c27082149a849f50df7ebbddfcd9c33d2ba645ad7';
async function download(url){const r=await fetch(url);if(!r.ok)throw Error('Public tooling download failed');return Buffer.from(await r.arrayBuffer());}
(async()=>{
 if(process.argv.includes('--download')){
  fs.mkdirSync(base,{recursive:true});const sdk=await download('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0');
  if(crypto.createHash('sha256').update(sdk).digest('hex')!==sdkHash)throw Error('Pinned Supabase SDK mismatch');fs.writeFileSync(path.join(base,'supabase-2.115.0.js'),sdk);
  const data=await download('https://registry.npmjs.org/stripe/-/stripe-23.0.0.tgz');if('sha512-'+crypto.createHash('sha512').update(data).digest('base64')!==stripeIntegrity)throw Error('Pinned Stripe SDK mismatch');
  const dest=path.join(base,'stripe-sdk');fs.mkdirSync(dest,{recursive:true});const archive=path.join(dest,'stripe.tgz');fs.writeFileSync(archive,data);
  const entries=execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).trim().split(/\r?\n/);if(entries.some(x=>!x.startsWith('package/')||x.includes('..')||x.includes('\\')))throw Error('Unsafe package path');execFileSync('tar',['-xzf',archive,'-C',dest]);
 }
 const sdk=fs.readFileSync(path.join(base,'supabase-2.115.0.js'));if(crypto.createHash('sha256').update(sdk).digest('hex')!==sdkHash)throw Error('Supabase SDK mismatch');
 const pkg=JSON.parse(fs.readFileSync(path.join(base,'stripe-sdk/package/package.json')));if(pkg.version!=='23.0.0')throw Error('Stripe SDK mismatch');console.log('Pinned public SDKs available; no service called.');
})().catch(e=>{console.error(e.message+'; use --download to obtain public tooling if needed.');process.exitCode=1;});
