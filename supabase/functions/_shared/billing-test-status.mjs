import {ensure, id, testObject, listComplete, subscription, PLANS} from './billing-test-contract.mjs';

// Stripe describes current billing. Only the reconciled SQL projection grants access.
// This action performs reads only, and never accepts an owner or provider ID from the browser.
export async function subscriptionStatus(stripe, rpc, user, prices, access, now=Date.now()/1000) {
  ensure(access?.environment==='STRIPE_TEST' && ['active','inactive','expired_or_revoked','review_required'].includes(access.state),
    'billing_projection_failed');
  ensure(access.aiQuotaChanged===false && (access.state!=='active' || Object.hasOwn(PLANS,access.plan)
    && typeof access.paidUntil==='string' && Date.parse(access.paidUntil)>now*1000),'billing_projection_failed');
  const mapping=await rpc('billing_test_read_customer',{p_user:user});
  const result={environment:'STRIPE_TEST',state:'none',plan:access.state==='active'?access.plan:null,
    accessActive:access.state==='active',monthlyCents:access.state==='active'?PLANS[access.plan].cents:null,
    currency:'eur',paidUntil:access.paidUntil??null,nextBillingAt:null,cancelAtPeriodEnd:false,
    portalAvailable:false,canCheckout:false,aiQuotaChanged:false};
  if(!mapping?.customer_id){
    ensure(access.state!=='active','billing_customer_mismatch');
    result.canCheckout=!mapping?.hold && !mapping?.checkout; return result;
  }
  const customer=testObject(await stripe.customers.retrieve(mapping.customer_id),'customer');
  ensure(customer.id===mapping.customer_id,'billing_customer_mismatch');
  const raw=listComplete(await stripe.subscriptions.list({customer:customer.id,status:'all',limit:100}));
  const subs=raw.map(s=>subscription(s,customer.id,prices));
  const current=subs.filter(s=>!['canceled','incomplete_expired'].includes(s.status));
  ensure(current.length<=1,'billing_multiple_subscriptions');
  const sessions=listComplete(await stripe.checkout.sessions.list({customer:customer.id,limit:100}));
  for(const s of sessions){testObject(s,'checkout.session');ensure(id(s.customer)===customer.id && s.mode==='subscription'
    && ['open','expired','complete'].includes(s.status),'billing_checkout_binding');}
  const sub=current[0], source=raw.find(s=>s.id===sub?.subscription_id);
  if(result.accessActive)ensure(subs.some(s=>s.plan===result.plan),'billing_subscription_mismatch');
  result.portalAvailable=subs.length>0;
  result.cancelAtPeriodEnd=sub?.cancel_at_period_end===true || (!sub && access.cancelAtPeriodEnd===true);
  const end=source?.items?.data?.[0]?.current_period_end;
  if(Number.isSafeInteger(end) && end>now && !result.cancelAtPeriodEnd)result.nextBillingAt=new Date(end*1000).toISOString();
  if(mapping.hold || access.state==='review_required')result.state='review_required';
  else if(sub && ['past_due','unpaid'].includes(sub.status))result.state='payment_failed';
  else if(result.accessActive)result.state=result.cancelAtPeriodEnd?'scheduled_cancel':'active';
  else if(sub?.status==='incomplete')result.state='pending';
  else if(!sub && (access.state==='expired_or_revoked' || subs.length))result.state='expired';
  else if(sub || sessions.some(s=>s.status==='complete'))result.state='reconciling';
  else if(sessions.some(s=>s.status==='open'))result.state='open';
  else if(access.state==='expired_or_revoked' || subs.length || mapping.checkout?.status==='expired'
    || sessions.some(s=>s.status==='expired'))result.state='expired';
  else if(mapping.checkout && ['open','reserved'].includes(mapping.checkout.status))result.state='pending';
  // Ambiguous/old attempts must be reconciled by the backend, never overwritten from this page.
  result.canCheckout=!result.accessActive && !sub && !mapping.hold
    && !['open','reserved'].includes(mapping.checkout?.status) && !['open','pending','reconciling','review_required'].includes(result.state);
  return result;
}
