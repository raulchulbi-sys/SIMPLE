import { runtime, authenticate, verifyProvider, createCheckout, createPortal, reconcile, json, readBody, ORIGINS } from '../_shared/billing-test-runtime.ts';
import { ensure, checkoutInput } from '../_shared/billing-test-contract.mjs';
import { subscriptionStatus } from '../_shared/billing-test-status.mjs';
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin')??'';
  if(origin && !ORIGINS.includes(origin))return json({error:'billing_origin_denied'},403);
  if(req.method==='OPTIONS')return json({},200,origin);
  if(req.method!=='POST')return json({error:'billing_method_denied'},405,origin);
  try{
    const {db,rpc}=runtime(false); const user=await authenticate(req,db);
    const body=JSON.parse(await readBody(req,1024)); const action=body.action; delete body.action;
    ensure(['checkout','portal','reconcile','access','status'].includes(action),'billing_action_invalid');
    if(action==='access' || action==='status'){
      ensure(Object.keys(body).length===0,'billing_parameters_invalid');
      // Forward the same verified end-user JWT to the invoker/RLS projection.
      const response=await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/billing_test_my_access`,{
        method:'POST',headers:{apikey:Deno.env.get('SUPABASE_ANON_KEY')!,authorization:req.headers.get('authorization')!,'Content-Type':'application/json'},body:'{}'});
      ensure(response.ok,'billing_projection_failed'); const access=await response.json();
      if(action==='access')return json(access,200,origin);
      const {stripe}=runtime();const prices=await verifyProvider(stripe);
      return json(await subscriptionStatus(stripe,rpc,user,prices,access),200,origin);
    }
    const {stripe}=runtime(); const prices=await verifyProvider(stripe);
    if(action==='checkout')return json(await createCheckout(stripe,rpc,user,checkoutInput(body),prices),200,origin);
    ensure(Object.keys(body).length===0,'billing_parameters_invalid');
    if(action==='portal')return json(await createPortal(stripe,rpc,user,prices),200,origin);
    return json(await reconcile(stripe,rpc,user,prices),200,origin);
  }catch(e){
    const message=e instanceof Error && /^billing_[a-z_]+$/.test(e.message)?e.message:'billing_request_failed';
    return json({error:message},message==='billing_auth_required'?401:message.includes('not_enabled')?403:409,origin);
  }
});
