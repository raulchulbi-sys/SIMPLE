import Stripe from 'npm:stripe@23.0.0';
import { runtime, verifyProvider, reconcile, readBody, json } from '../_shared/billing-test-runtime.ts';
import { EVENTS, API_VERSION, ensure, id, testObject } from '../_shared/billing-test-contract.mjs';
Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return json({error:'method'},405);
  let verified=false;
  try{
    const {stripe,rpc}=runtime();
    const raw=await readBody(req,262144), signature=req.headers.get('stripe-signature')??'';
    const secret=Deno.env.get('STRIPE_TEST_WEBHOOK_SECRET')??'';
    ensure(secret.startsWith('whsec_'),'billing_webhook_not_configured');
    const event=await stripe.webhooks.constructEventAsync(raw,signature,secret,300,Stripe.createSubtleCryptoProvider());
    ensure(event.livemode===false && event.api_version===API_VERSION && !event.account && !event.context,'billing_event_environment');
    verified=true;
    if(!EVENTS.has(event.type))return json({ignored:true});
    const prices=await verifyProvider(stripe);
    const object=event.data.object;
    // Signed event only supplies routing; state and payment evidence are fetched from Stripe.
    let customer=id(object.customer);
    if(!customer && object.object==='dispute'){
      const charge=await stripe.charges.retrieve(id(object.charge)); testObject(charge,'charge'); customer=id(charge.customer);
    }
    ensure(customer && /^cus_[A-Za-z0-9]+$/.test(customer),'billing_event_customer');
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))))
      .map(b=>b.toString(16).padStart(2,'0')).join('');
    const receipt=await rpc('billing_test_event',{p_id:event.id,p_digest:digest,p_type:event.type,p_customer:customer});
    if(receipt.ignored || receipt.processed)return json({received:true,duplicate:receipt.processed===true});
    await reconcile(stripe,rpc,receipt.user_id,prices,event.id);
    return json({received:true});
  }catch(_e){return json({error:verified?'billing_reconciliation_pending':'billing_signature_or_configuration_invalid'},verified?503:400);}
});
