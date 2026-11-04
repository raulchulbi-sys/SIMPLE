import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {webcrypto} from 'node:crypto';
import {harness,load} from '../billing-test/harness.mjs';import {API_VERSION} from '../../supabase/functions/_shared/billing-test-contract.mjs';
const require=createRequire(import.meta.url);const Stripe=require('../../.tests-local/stripe-sdk/package/cjs/stripe.cjs.node.js');
const sdk=new Stripe('sk_test_SYNTHETIC_OFFLINE_ONLY'),secret='whsec_SYNTHETIC';
const event=h=>({id:'evt_RealCryptoOffline',object:'event',livemode:false,api_version:API_VERSION,type:'invoice.paid',data:{object:h.f.inv}});
async function ready(){const h=harness();h.stripe.webhooks=sdk.webhooks;h.cryptoProvider=Stripe.createSubtleCryptoProvider(webcrypto.subtle);await load(h,'billing-test-webhook');return h;}
const sign=(payload,opts={})=>sdk.webhooks.generateTestHeaderString({payload,secret,timestamp:Math.floor(Date.now()/1000),...opts});
const deliver=(h,payload,signature)=>h.handler(new Request('https://offline.invalid',{method:'POST',headers:signature?{'stripe-signature':signature}:{},body:payload}));
test('real Stripe SDK 23 cryptography + actual webhook: valid signature and duplicate converge once',async()=>{
 const h=await ready(),raw=JSON.stringify(event(h)),signature=sign(raw);assert.equal((await deliver(h,raw,signature)).status,200);assert.equal(h.commits,1);
 const repeated=await deliver(h,raw,signature);assert.equal(repeated.status,200);assert.equal((await repeated.json()).duplicate,true);assert.equal(h.commits,1);
});
for(const mode of ['missing','wrong secret','tampered body','expired timestamp','LIVE','wrong API'])test('real cryptography rejects '+mode+' before any provider/storage read',async()=>{
 const h=await ready(),data=event(h);if(mode==='LIVE')data.livemode=true;if(mode==='wrong API')data.api_version='2020-01-01';let raw=JSON.stringify(data);
 let signature=sign(raw,mode==='wrong secret'?{secret:'whsec_WRONG'}:mode==='expired timestamp'?{timestamp:Math.floor(Date.now()/1000)-601}:{});
 if(mode==='missing')signature='';if(mode==='tampered body')raw=raw.replace('invoice.paid','invoice.payment_failed');
 assert.equal((await deliver(h,raw,signature)).status,400);assert.equal(h.calls.length,0);assert.equal(h.commits,0);
});
