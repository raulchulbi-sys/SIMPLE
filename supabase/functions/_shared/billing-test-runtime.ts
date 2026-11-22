import Stripe from 'npm:stripe@23.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2.115.0';
import { completedCheckout } from './billing-test-checkout.mjs';
import { PROJECT, ACCOUNT, API_VERSION, PLANS, ensure, id, testObject, planForPrice,
  listComplete, subscription, paidInvoice } from './billing-test-contract.mjs';

export const ORIGINS = ['http://127.0.0.1:4270', 'https://simple-staging-raulchulbi.pages.dev'];
export function json(data: unknown, status = 200, origin?: string) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type':'application/json', 'Cache-Control':'no-store', 'Vary':'Origin',
    ...(origin && ORIGINS.includes(origin) ? { 'Access-Control-Allow-Origin':origin,
      'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info',
      'Access-Control-Allow-Methods':'POST,OPTIONS' } : {}),
  }});
}
export async function readBody(req: Request, max: number) {
  const reader = req.body?.getReader(); if (!reader) return '';
  const chunks: Uint8Array[] = []; let size=0;
  try { while (true) { const {value,done}=await reader.read(); if(done)break;
    size+=value.length; ensure(size<=max,'billing_body_too_large'); chunks.push(value); }
  } finally { await reader.cancel(); }
  const bytes=new Uint8Array(size); let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export function runtime(provider=true) {
  ensure(Deno.env.get('SUPABASE_URL')===`https://${PROJECT}.supabase.co`, 'billing_staging_only');
  const key=Deno.env.get('STRIPE_TEST_SECRET_KEY') ?? '';
  if(provider)ensure(/^(sk|rk)_test_/.test(key),'billing_test_key_missing');
  const stripe=provider?new Stripe(key,{apiVersion:API_VERSION,maxNetworkRetries:0,timeout:20000,
    httpClient:Stripe.createFetchHttpClient()}):null;
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const rpc=async(name:string,args:Record<string,unknown>)=>{const {data,error}=await db.rpc(name,args);
    if(error)throw new Error(/^billing_[a-z_]+$/.test(error.message)?error.message:'billing_storage_failed'); return data;};
  return {stripe,db,rpc};
}
export async function authenticate(req:Request,db:any) {
  const bearer=req.headers.get('authorization')??'';
  ensure(/^Bearer [A-Za-z0-9._-]+$/.test(bearer),'billing_auth_required');
  const {data,error}=await db.auth.getUser(bearer.slice(7));
  ensure(!error && data.user && !data.user.is_anonymous,'billing_auth_required');
  const allowed=(Deno.env.get('BILLING_TEST_USER_IDS')??'').split(',').map(x=>x.trim());
  ensure(allowed.includes(data.user.id),'billing_test_user_not_enabled');
  const profile=await db.from('profiles').select('role').eq('id',data.user.id).single();
  ensure(!profile.error && profile.data?.role==='client','billing_client_required');
  return data.user.id;
}
export async function verifyProvider(stripe:any) {
  const account=await stripe.accounts.retrieve(); ensure(account.id===ACCOUNT,'billing_account_mismatch');
  const prices:Record<string,any>={};
  for(const p of Object.values(PLANS)){const price=await stripe.prices.retrieve(p.price);planForPrice(price);prices[p.price]=price;}
  return prices;
}
export const change=(rpc:any,user:string,lease:string,action:string,data:unknown={}) =>
  rpc('billing_test_change',{p_user:user,p_lease:lease,p_action:action,p_data:data});
export async function reconcile(stripe:any,rpc:any,user:string,prices:any,eventId?:string) {
  const lock=await rpc('billing_test_begin',{p_user:user});
  try {
    const customer=lock.customer.customer_id; ensure(customer,'billing_customer_missing');
    const providerCustomer=testObject(await stripe.customers.retrieve(customer),'customer');
    ensure(providerCustomer.id===customer,'billing_customer_mismatch');
    const raw=listComplete(await stripe.subscriptions.list({customer,status:'all',limit:100}));
    const subs=raw.map((s:any)=>subscription(s,customer,prices));
    ensure(subs.filter((s:any)=>!['canceled','incomplete_expired'].includes(s.status)).length<=1,'billing_multiple_subscriptions');
    const invoices=[], initialInvoiceIds=new Set<string>();
    for(const sub of subs){
      const list=listComplete(await stripe.invoices.list({customer,subscription:sub.subscription_id,limit:100}));
      for(const row of list){
        if(row.status!=='paid')continue;
        const inv=await stripe.invoices.retrieve(row.id,{expand:['payments']});
        ensure(inv.id===row.id && inv.status==='paid','billing_invoice_snapshot_changed');
        const links=listComplete(inv.payments); ensure(links.length===1,'billing_payment_link');
        const piId=id(links[0].payment?.payment_intent); ensure(piId,'billing_payment_link');
        const pi=await stripe.paymentIntents.retrieve(piId);
        const chId=id(pi.latest_charge); ensure(chId,'billing_payment_unverified');
        const charge=await stripe.charges.retrieve(chId);
        invoices.push(paidInvoice(inv,sub,customer,prices,pi,charge));
        if(inv.billing_reason==='subscription_create')initialInvoiceIds.add(inv.id);
      }
    }
    // Fetch current sessions for this Customer. Never create/replay a Checkout here.
    // A missing/truncated response cannot silently complete a reservation.
    const sessions=listComplete(await stripe.checkout.sessions.list({customer,limit:100}));
    const checkouts=[];
    for(const row of sessions){
      const session=await stripe.checkout.sessions.retrieve(row.id,{expand:['line_items']});
      ensure(session.id===row.id,'billing_checkout_binding');
      const completion=completedCheckout(session,customer,subs,invoices,initialInvoiceIds,prices);
      if(completion)checkouts.push(completion);
    }
    ensure(new Set(checkouts.map(c=>c.id)).size===checkouts.length
      && new Set(checkouts.map(c=>c.session_id)).size===checkouts.length,'billing_checkout_duplicate');
    const saved=await change(rpc,user,lock.lease,'snapshot',{
      customer_id:customer,subscriptions:subs,invoices,checkouts,event_id:eventId});
    ensure(saved?.checkout_protocol===1 && Array.isArray(saved.completed_checkouts)
      && JSON.stringify([...saved.completed_checkouts].sort())===JSON.stringify(checkouts.map(c=>c.session_id).sort()),
      'billing_checkout_commit_unconfirmed');
    return {verified:true,completedCheckouts:saved.completed_checkouts};
  } catch(e) { await change(rpc,user,lock.lease,'hold').catch(()=>{}); throw e; }
}
export async function createCheckout(stripe:any,rpc:any,user:string,plan:string,prices:any) {
  ensure(Deno.env.get('STRIPE_TEST_WEBHOOK_SECRET')?.startsWith('whsec_'),'billing_webhook_not_configured');
  ensure(PLANS[plan] && prices[PLANS[plan].price],'billing_plan_required');
  const lock=await rpc('billing_test_begin',{p_user:user,p_plan:plan});
  try {
    let customer=lock.customer.customer_id;
    if(!customer){
      // Stripe may prune idempotency keys after 24h. Never replay an uncertain older create.
      ensure(Date.now()-Date.parse(lock.customer.created_at)<23*3600000,'billing_customer_reconciliation_required');
      const c=await stripe.customers.create({metadata:{simple_user:user,environment:PROJECT}},
        {idempotencyKey:`simple-test-customer-${lock.customer.customer_key}`});
      testObject(c,'customer'); customer=c.id;
      await change(rpc,user,lock.lease,'customer',{customer_id:customer});
    }
    testObject(await stripe.customers.retrieve(customer),'customer');
    // Do not trust a missing/delayed webhook to mean no existing subscription.
    const existing=listComplete(await stripe.subscriptions.list({customer,status:'all',limit:100}));
    ensure(existing.every((s:any)=>['canceled','incomplete_expired'].includes(s.status)),'billing_existing_subscription');
    const paid=listComplete(await stripe.invoices.list({customer,status:'paid',limit:100}));
    ensure(!paid.some((i:any)=>listComplete(i.lines).some((l:any)=>l.period?.end>Date.now()/1000)),
      'billing_paid_period_exists');
    const job=lock.checkout; let session;
    if(job.session_id){session=await stripe.checkout.sessions.retrieve(job.session_id);}
    else {
      ensure(Date.now()-Date.parse(job.created_at)<23*3600000,'billing_checkout_reconciliation_required');
      ensure(job.expires_at>Date.now()/1000+1800,'billing_checkout_reconciliation_required');
      const returnUrl=Deno.env.get('BILLING_TEST_RETURN_URL');
      ensure(returnUrl==='http://127.0.0.1:4270/billing-test.html'
        ||returnUrl==='https://simple-staging-raulchulbi.pages.dev/billing-test.html','billing_return_url_invalid');
      session=await stripe.checkout.sessions.create({mode:'subscription',customer,
        line_items:[{price:PLANS[plan].price,quantity:1}],client_reference_id:job.id,
        metadata:{simple_attempt:job.id},subscription_data:{metadata:{simple_attempt:job.id}},
        expires_at:job.expires_at,success_url:`${returnUrl}?checkout=returned`,cancel_url:returnUrl,
        allow_promotion_codes:false,managed_payments:{enabled:false},automatic_tax:{enabled:false},
        integration_identifier:'simple_billing_test_xqmrptva'},
        {idempotencyKey:`simple-test-checkout-${job.id}`});
    }
    testObject(session,'checkout.session');
    ensure(id(session.customer)===customer && session.mode==='subscription'
      && session.client_reference_id===job.id,'billing_checkout_binding');
    // Completion is reserved for the atomic, payment-verified snapshot above.
    ensure(session.status!=='complete','billing_checkout_completed_reconcile');
    await change(rpc,user,lock.lease,'checkout',{id:job.id,session_id:session.id,status:session.status});
    if(session.status==='expired')throw new Error('billing_checkout_expired');
    ensure(session.status==='open' && typeof session.url==='string'
      && new URL(session.url).origin==='https://checkout.stripe.com','billing_checkout_completed_reconcile');
    return {url:session.url};
  } finally {await change(rpc,user,lock.lease,'release').catch(()=>{});}
}
export async function createPortal(stripe:any,rpc:any,user:string,prices:any) {
  const configId=Deno.env.get('STRIPE_TEST_PORTAL_CONFIGURATION')??'';
  ensure(configId.startsWith('bpc_'),'billing_portal_not_configured');
  const config=await stripe.billingPortal.configurations.retrieve(configId);
  testObject(config,'billing_portal.configuration');
  ensure(config.active && config.features?.subscription_update?.enabled===false
    && config.features?.subscription_cancel?.enabled===true && config.features.subscription_cancel.mode==='at_period_end'
    && config.features?.payment_method_update?.enabled===true && config.features?.invoice_history?.enabled===true,
    'billing_portal_configuration_mismatch');
  const lock=await rpc('billing_test_begin',{p_user:user});
  try {
    ensure(lock.customer.customer_id,'billing_customer_missing');
    const customer=testObject(await stripe.customers.retrieve(lock.customer.customer_id),'customer');
    ensure(customer.id===lock.customer.customer_id,'billing_customer_mismatch');
    const subs=listComplete(await stripe.subscriptions.list({customer:customer.id,status:'all',limit:100}))
      .map((s:any)=>subscription(s,customer.id,prices));
    ensure(subs.length>0,'billing_subscription_missing');
    ensure(subs.filter((s:any)=>!['canceled','incomplete_expired'].includes(s.status)).length<=1,'billing_multiple_subscriptions');
    const returnUrl=Deno.env.get('BILLING_TEST_RETURN_URL');
    ensure(returnUrl==='http://127.0.0.1:4270/billing-test.html'
      ||returnUrl==='https://simple-staging-raulchulbi.pages.dev/billing-test.html','billing_return_url_invalid');
    const session=await stripe.billingPortal.sessions.create({customer:lock.customer.customer_id,configuration:configId,return_url:returnUrl});
    testObject(session,'billing_portal.session');
    ensure(id(session.customer)===customer.id && new URL(session.url).origin==='https://billing.stripe.com','billing_portal_url_invalid');
    return {url:session.url};
  } finally {await change(rpc,user,lock.lease,'release').catch(()=>{});}
}
