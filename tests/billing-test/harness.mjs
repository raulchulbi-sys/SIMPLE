import fs from 'node:fs/promises';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto,randomUUID} from 'node:crypto';
import {projection} from '../../supabase/functions/_shared/billing-test-contract.mjs';
import {fixture,OWNER,OTHER,ATTEMPT,NOW,copy,list} from './fixtures.mjs';
export function harness(f=fixture()){
  const h={f,now:NOW,calls:[],fail:'',snapshots:0,commits:0,handler:null,barrier:null};
  const makeCustomer=(user,id)=>({user_id:user,customer_id:id,customer_key:'synthetic-key',created_at:'2027-01-15T07:00:00Z',hold:false,lease:null,lease_until:null});
  h.state={customers:[makeCustomer(OWNER,f.s.customer),makeCustomer(OTHER,'cus_Other')],
    checkouts:[{id:ATTEMPT,user_id:OWNER,plan:f.plan,status:'open',session_id:f.session.id,created_at:'2027-01-15T07:00:00Z',expires_at:1800003600},
      {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',user_id:OWNER,plan:'basic',status:'expired',session_id:null,created_at:'2026-01-01T00:00:00Z',expires_at:1767229200}],
    subscriptions:[],invoices:[],events:[]};
  h.access=user=>({...projection(h.state.invoices.filter(x=>x.user_id===user),{hold:h.state.customers.find(x=>x.user_id===user)?.hold,now:h.now/1000}),environment:'STRIPE_TEST',aiQuotaChanged:false});
  const fail=message=>{throw Error(message);};
  // Transactional storage double. It is NOT PostgreSQL or a SQL execution claim.
  h.rpc=async(name,a)=>{
    h.calls.push({name,args:copy(a)});
    if(name==='billing_test_event'){
      const customer=h.state.customers.find(x=>x.customer_id===a.p_customer);
      if(!customer)return{ignored:true};
      let event=h.state.events.find(x=>x.event_id===a.p_id);
      if(event&&(event.digest!==a.p_digest||event.customer_id!==a.p_customer||event.event_type!==a.p_type))fail('billing_event_conflict');
      if(!event){event={event_id:a.p_id,digest:a.p_digest,customer_id:a.p_customer,event_type:a.p_type,processed_at:null};h.state.events.push(event);}
      return{user_id:customer.user_id,processed:event.processed_at!==null};
    }
    const c=h.state.customers.find(x=>x.user_id===a.p_user);
    if(name==='billing_test_begin'){
      if(!c)fail('billing_client_required');if(c.lease_until>h.now)fail('billing_busy');
      c.lease=randomUUID();c.lease_until=h.now+120000;
      return {customer:copy(c),lease:c.lease};
    }
    if(name!=='billing_test_change')fail('OFFLINE_RPC_FORBIDDEN');
    if(!c||!a.p_lease||c.lease!==a.p_lease||!c.lease_until||c.lease_until<=h.now)fail('billing_stale_lease');
    if(['hold','release'].includes(a.p_action)){
      if(a.p_action==='hold')c.hold=true;c.lease=null;c.lease_until=null;return{ok:true};
    }
    if(a.p_action!=='snapshot')fail('OFFLINE_NON_SNAPSHOT_WRITE_FORBIDDEN');
    h.snapshots++;
    const data=a.p_data, tx=copy(h.state), tc=tx.customers.find(x=>x.user_id===a.p_user);
    if(c.customer_id!==data.customer_id||!Array.isArray(data.subscriptions)||!Array.isArray(data.invoices)||!Array.isArray(data.checkouts))fail('billing_snapshot_invalid');
    for(const old of tx.subscriptions.filter(x=>x.user_id===a.p_user))if(!data.subscriptions.some(s=>s.subscription_id===old.subscription_id))fail('billing_snapshot_missing_history');
    for(const sub of data.subscriptions){
      const old=tx.subscriptions.find(x=>x.subscription_id===sub.subscription_id);
      if(old&&(old.user_id!==a.p_user||old.plan!==sub.plan||(old.status==='canceled'&&sub.status!=='canceled')))fail('billing_subscription_conflict');
      if(old)Object.assign(old,sub);else tx.subscriptions.push({...sub,user_id:a.p_user});
    }
    for(const inv of data.invoices){
      if(!tx.subscriptions.some(s=>s.subscription_id===inv.subscription_id&&s.user_id===a.p_user&&s.plan===inv.plan))fail('billing_invoice_binding');
      const old=tx.invoices.find(x=>x.invoice_id===inv.invoice_id);
      if(old){
        const immutable=x=>Object.fromEntries(Object.entries(x).filter(([k])=>!['user_id','refunded','disputed'].includes(k)));
        if(old.user_id!==a.p_user||JSON.stringify(immutable(old))!==JSON.stringify(immutable(inv))||old.refunded>inv.refunded)fail('billing_invoice_conflict');
        Object.assign(old,inv);
      }else tx.invoices.push({...inv,user_id:a.p_user});
    }
    if(h.fail==='partial'){h.fail='';fail('storage_failed_before_commit');}
    const completed=[];
    for(const proof of data.checkouts){
      const j=tx.checkouts.find(x=>x.id===proof.id&&x.user_id===a.p_user);
      if(!j||j.plan!==proof.plan||!['reserved','open','complete'].includes(j.status)
        ||(j.session_id!==null&&j.session_id!==proof.session_id)||(j.session_id===null&&j.status!=='reserved'))fail('billing_checkout_conflict');
      if(proof.customer_id!==c.customer_id||proof.status!=='complete'||proof.payment_status!=='paid')fail('billing_checkout_proof_invalid');
      if(!data.subscriptions.some(x=>x.subscription_id===proof.subscription_id&&x.plan===j.plan)
        ||!data.invoices.some(x=>x.invoice_id===proof.invoice_id&&x.subscription_id===proof.subscription_id&&x.plan===j.plan))fail('billing_checkout_paid_invoice_required');
      if(completed.includes(proof.session_id))fail('billing_checkout_duplicate');
      j.status='complete';j.session_id=proof.session_id;completed.push(proof.session_id);
    }
    if(data.event_id){const e=tx.events.find(x=>x.event_id===data.event_id&&x.customer_id===c.customer_id);if(!e)fail('billing_event_binding');e.processed_at??=h.now;}
    tc.hold=false;tc.lease=null;tc.lease_until=null;h.state=tx;h.commits++;
    if(h.fail==='lost'){h.fail='';fail('response_lost_after_commit');}
    return h.legacyAck?{ok:true}:{ok:true,checkout_protocol:1,completed_checkouts:completed};
  };
  const read=(name,value)=>async(...args)=>{h.calls.push({name,args});if(h.barrier&&name==='subscriptions.list')await h.barrier;if(h.fail===name)fail('OFFLINE_PROVIDER_FAILURE');return copy(typeof value==='function'?value(...args):value);};
  const forbidden=()=>fail('OFFLINE_PROVIDER_MUTATION_FORBIDDEN');
  h.stripe={
    accounts:{retrieve:read('accounts.retrieve',{id:'acct_1UWwZP6soMMQB8IR'})},
    prices:{retrieve:read('prices.retrieve',id=>f.prices[id]??fixture('premium').price)},
    customers:{retrieve:read('customers.retrieve',id=>({id,object:'customer',livemode:false})),create:forbidden},
    subscriptions:{list:read('subscriptions.list',()=>list(h.noSubscriptions?[]:[f.s]))},
    invoices:{list:read('invoices.list',()=>list(h.noInvoices?[]:[f.inv])),retrieve:read('invoices.retrieve',()=>f.inv)},
    paymentIntents:{retrieve:read('paymentIntents.retrieve',()=>f.pi)},charges:{retrieve:read('charges.retrieve',()=>f.ch)},
    checkout:{sessions:{list:read('checkout.list',()=>h.sessionList??list([f.session])),retrieve:read('checkout.retrieve',()=>f.session),create:forbidden}},
    billingPortal:{sessions:{create:forbidden}},
    webhooks:{constructEventAsync:async(raw,signature)=>{if(signature!=='synthetic-valid-signature')fail('invalid_signature');return JSON.parse(raw);}}
  };
  return h;
}
export async function load(h,entry){
  const env={SUPABASE_URL:'https://dmqjexigdnfzobarhnib.supabase.co',STRIPE_TEST_SECRET_KEY:'rk_test_SYNTHETIC',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC',
    SUPABASE_ANON_KEY:'SYNTHETIC',STRIPE_TEST_WEBHOOK_SECRET:'whsec_SYNTHETIC',BILLING_TEST_USER_IDS:[OWNER,OTHER].join(','),BILLING_TEST_RETURN_URL:'https://simple-staging-raulchulbi.pages.dev/billing-test.html',...h.env};
  class FakeStripe{constructor(){return h.stripe;}static createFetchHttpClient(){return{};}static createSubtleCryptoProvider(){return h.cryptoProvider??{};}}
  class Clock extends Date{static now(){return h.now;}}
  const db={rpc:async(n,a)=>{try{return{data:await h.rpc(n,a),error:null};}catch(e){return{error:{message:e.message}};}},
    auth:{getUser:async token=>({data:{user:token==='owner.token.signature'?{id:OWNER}:token==='other.token.signature'?{id:OTHER}:null}})},
    from:()=>({select:()=>({eq:()=>({single:async()=>({data:{role:'client'}})})})})};
  const context=vm.createContext({Date:Clock,URL,Response,Request,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,
    Deno:{env:{get:k=>env[k]},serve:fn=>{h.handler=fn;}},fetch:async(url,args)=>{
      if(!url.endsWith('/rest/v1/rpc/billing_test_my_access'))throw Error('OFFLINE_NETWORK_FORBIDDEN');
      const user=args.headers.authorization==='Bearer owner.token.signature'?OWNER:OTHER;
      return new Response(JSON.stringify(h.access(user)),{status:200});
    }});
  const cache=new Map();
  async function moduleAt(url){
    if(cache.has(url.href))return cache.get(url.href);
    let source=await fs.readFile(url,'utf8');if(url.pathname.endsWith('.ts'))source=stripTypeScriptTypes(source,{mode:'strip'});
    const mod=new vm.SourceTextModule(source,{context,identifier:url.href});cache.set(url.href,mod);
    await mod.link(async(spec,from)=>{
      if(spec==='npm:stripe@23.0.0')return new vm.SyntheticModule(['default'],function(){this.setExport('default',FakeStripe);},{context});
      if(spec==='npm:@supabase/supabase-js@2.115.0')return new vm.SyntheticModule(['createClient'],function(){this.setExport('createClient',()=>db);},{context});
      if(!spec.startsWith('.'))throw Error('OFFLINE_IMPORT_FORBIDDEN');return moduleAt(new URL(spec,from.identifier));
    });return mod;
  }
  const file=entry?`../../supabase/functions/${entry}/index.ts`:'../../supabase/functions/_shared/billing-test-runtime.ts';
  const mod=await moduleAt(new URL(file,import.meta.url));await mod.evaluate();return mod.namespace;
}
