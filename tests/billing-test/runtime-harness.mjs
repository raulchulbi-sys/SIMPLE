import fs from 'node:fs/promises';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
export const BASE_NOW=Date.parse('2026-11-01T13:30:00Z');
export async function loadRuntime(now=BASE_NOW,overrides={}) {
  const env={SUPABASE_URL:'https://dmqjexigdnfzobarhnib.supabase.co',STRIPE_TEST_SECRET_KEY:'rk_test_OFFLINE_ONLY',SUPABASE_SERVICE_ROLE_KEY:'OFFLINE_ONLY',STRIPE_TEST_WEBHOOK_SECRET:'whsec_OFFLINE_ONLY',BILLING_TEST_RETURN_URL:'http://127.0.0.1:4270/billing-test.html',BILLING_TEST_USER_IDS:'owner,other',...overrides};
  const constructors=[];
  class FakeStripe {constructor(key,options){constructors.push({key,options});}static createFetchHttpClient(){return {};}}
  class Clock extends Date {static now(){return now;}}
  const context=vm.createContext({Date:Clock,URL,Response,Request,TextEncoder,TextDecoder,Uint8Array,console:{log(){},error(){}},Deno:{env:{get:k=>env[k]}},fetch(){throw Error('OFFLINE_NETWORK_FORBIDDEN');}});
  const contract=new vm.SourceTextModule(await fs.readFile(new URL('../../supabase/functions/_shared/billing-test-contract.mjs',import.meta.url),'utf8'),{context});
  const checkout=new vm.SourceTextModule(await fs.readFile(new URL('../../supabase/functions/_shared/billing-test-checkout.mjs',import.meta.url),'utf8'),{context});
  await checkout.link(()=>contract);
  const stripe=new vm.SyntheticModule(['default'],function(){this.setExport('default',FakeStripe);},{context});
  const supabase=new vm.SyntheticModule(['createClient'],function(){this.setExport('createClient',()=>({rpc:async()=>({data:{},error:null})}));},{context});
  const source=await fs.readFile(new URL('../../supabase/functions/_shared/billing-test-runtime.ts',import.meta.url),'utf8');
  const module=new vm.SourceTextModule(stripTypeScriptTypes(source,{mode:'strip'}),{context});
  await module.link(spec=>{
    if(spec==='npm:stripe@23.0.0')return stripe;
    if(spec==='npm:@supabase/supabase-js@2.115.0')return supabase;
    if(spec==='./billing-test-contract.mjs')return contract;
    if(spec==='./billing-test-checkout.mjs')return checkout;
    throw Error('OFFLINE_IMPORT_FORBIDDEN');
  });
  await module.evaluate();
  return {api:module.namespace,env,constructors};
}
export function checkoutHarness(options={}) {
  const now=options.now??BASE_NOW;
  const customer='cus_ExistingOffline';
  const state={customer:{customer_id:customer,customer_key:'preserved-key',created_at:'2026-11-01T13:22:53.903158Z'},job:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',plan:'basic',created_at:'2026-11-01T13:22:53.903158Z',expires_at:1793542974,session_id:null,status:'reserved'},busy:false,lease:0,createDispatches:[],createdObjects:[],customerCreates:0,retrieves:[],changes:[],cache:new Map(),...options.state};
  const list=data=>({object:'list',has_more:options.hasMore===true,data});
  const prices={};
  for(const [name,id,product,cents]of [['basic','price_1UWx9n6soMMQB8IRZp5nTwsE','prod_VY3GVLWgZ4MJFv',499],['premium','price_1UWx9v6soMMQB8IRLixagQc6','prod_VY3GE7MJ9zTRXn',1299]]) prices[id]={id,object:'price',active:true,livemode:false,product,currency:'eur',unit_amount:cents,type:'recurring',recurring:{interval:'month',interval_count:1,usage_type:'licensed'},billing_scheme:'per_unit',tax_behavior:'unspecified'};
  const copy=x=>JSON.parse(JSON.stringify(x));
  const rpc=async(name,args)=>{
    if(name==='billing_test_begin'){
      if(state.busy)throw Error('billing_busy');state.busy=true;state.lease++;
      return{customer:copy(state.customer),checkout:copy(state.job),lease:state.lease};
    }
    if(name!=='billing_test_change'||args.p_lease!==state.lease)throw Error('billing_stale_lease');
    state.changes.push(copy(args));
    if(args.p_action==='customer')state.customer.customer_id=args.p_data.customer_id;
    if(args.p_action==='checkout'){
      if(options.databaseFailureBefore){options.databaseFailureBefore=false;throw Error('storage response lost before commit');}
      state.job.session_id=args.p_data.session_id;state.job.status=args.p_data.status;
      if(options.databaseFailureAfter){options.databaseFailureAfter=false;throw Error('storage response lost after commit');}
    }
    if(args.p_action==='release')state.busy=false;
    return {ok:true};
  };
  const stripe={
    accounts:{retrieve:async()=>({id:options.account??'acct_1UWwZP6soMMQB8IR'})},
    prices:{retrieve:async id=>copy(prices[id])},
    customers:{create:async()=>{state.customerCreates++;return{id:customer,object:'customer',livemode:false};},retrieve:async id=>({id,object:'customer',livemode:false})},
    subscriptions:{list:async()=>list(options.subscriptions??[])},
    invoices:{list:async()=>list(options.invoices??[])},
    checkout:{sessions:{
      retrieve:async id=>{state.retrieves.push(id);return options.retrieved??state.createdObjects.find(s=>s.id===id);},
      create:async(params,request)=>{
        const p=copy(params),key=request.idempotencyKey;state.createDispatches.push({params:p,key});
        const cached=state.cache.get(key);
        if(cached){if(cached.params!==JSON.stringify(p))throw Error('StripeIdempotencyError');return copy(cached.session);}
        if(options.providerError)throw options.providerError;
        const s={id:'cs_test_Offline'+(state.createdObjects.length+1),object:'checkout.session',livemode:false,customer:params.customer,mode:'subscription',client_reference_id:params.client_reference_id,status:'open',url:'https://checkout.stripe.com/c/pay/cs_test_Offline1',...options.session};
        state.createdObjects.push(s);state.cache.set(key,{params:JSON.stringify(p),session:s});
        if(options.lostProviderResponse){options.lostProviderResponse=false;throw Error('network response lost');}
        return copy(s);
      }
    }}
  };
  return {state,stripe,rpc,prices,now};
}
