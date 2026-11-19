'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../../assets/subscription.js'),'utf8');
// Minimal DOM adapter, no network, SDK, storage, secrets or provider requests.
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.textContent='';this.classList={add(){}};}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=items;this.textContent='';}
 setAttribute(k,v){this.attrs[k]=v;}
 querySelectorAll(tag){return this.children.flatMap(c=>[...(c.tag===tag?[c]:[]),...c.querySelectorAll(tag)]);}
 get text(){return this.textContent+this.children.map(c=>c.text).join(' ');}
 click(){if(!this.disabled)return this.onclick?.();}
}
const idle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
const base={environment:'STRIPE_TEST',state:'none',plan:null,accessActive:false,monthlyCents:null,currency:'eur',paidUntil:null,nextBillingAt:null,cancelAtPeriodEnd:false,portalAvailable:false,canCheckout:true,aiQuotaChanged:false};
const active={...base,state:'active',plan:'basic',accessActive:true,monthlyCents:499,paidUntil:'2070-12-01T00:00:00Z',canCheckout:false,portalAvailable:true};
async function fixture(status=base){
 const state={status:structuredClone(status),user:'synthetic-owner',calls:[],nav:[],auth:0,coach:0,cap:{basicActive:true,basicGenerationEnabled:false,premiumEnabled:false,quotasChanged:false,humanReviewRequired:true}};
 const root=new Element('div'),window={};let cb;
 const db={auth:{getUser:async()=>({data:{user:state.user?{id:state.user}:null}}),onAuthStateChange:f=>(cb=f,{data:{subscription:{unsubscribe(){cb=null;}}}})},functions:{invoke:async(name,{body})=>{
  assert.equal(name,'billing-test');state.calls.push(structuredClone(body));if(state.invoke)return state.invoke(body);
  return {data:body.action==='status'?structuredClone(state.status):{url:'https://checkout.stripe.com/c/pay/synthetic'}};
 }},rpc:async(name)=>{assert.equal(name,'billing_test_capabilities');return {data:state.cap};}};
 vm.runInNewContext(source,{window,document:{createElement:t=>new Element(t)},location:{},URL,Date,Intl,queueMicrotask});
 const view=window.SimpleSubscription.mount(root,{db,navigate:u=>state.nav.push(u),onAuthNeeded:()=>state.auth++,onCoach:()=>state.coach++});
 await idle();return {state,root,view,change:()=>cb?.(),button:text=>root.querySelectorAll('button').find(b=>b.textContent===text)};
}
for(const [state,title]of Object.entries({none:'Elige tu plan',open:'Compra sin terminar',pending:'Pago pendiente',payment_failed:'Revisa tu pago',reconciling:'Confirmando tu suscripción',active:'Tu plan está activo',scheduled_cancel:'Cancelación programada',expired:'Suscripción finalizada',review_required:'Comprobación pendiente'}))test('renders server state '+state,async()=>{
 const f=await fixture({...(['active','scheduled_cancel'].includes(state)?active:base),state,canCheckout:['none','expired'].includes(state),cancelAtPeriodEnd:state==='scheduled_cancel'});assert(f.root.text.includes(title));
});
test('Basic offered at 4.99 monthly; no Premium purchase and no generation promise',async()=>{const f=await fixture();assert(f.button('Probar Basic en TEST'));assert(!f.button('Probar Premium en TEST'));assert(f.root.text.includes('4,99 € / mes'));assert(f.root.text.includes('pendientes de aprobación'));});
test('double click dispatches one authenticated checkout with only Basic selector',async()=>{const f=await fixture();const b=f.button('Probar Basic en TEST');b.click();b.click();await idle();assert.deepEqual(f.state.calls.filter(x=>x.action==='checkout'),[{action:'checkout',plan:'basic'}]);assert.equal(f.state.nav.length,1);});
test('lost checkout response suppresses a second purchase until reconciliation',async()=>{const f=await fixture();f.state.invoke=async()=>{throw Error('network');};await f.button('Probar Basic en TEST').click();assert(!f.button('Probar Basic en TEST'));assert(f.button('Comprobar pago'));assert.equal(f.state.nav.length,0);});
test('refresh and reload-equivalent new mount never dispatch a purchase',async()=>{const a=await fixture({...base,state:'pending',canCheckout:false});await a.view.refresh();const b=await fixture({...base,state:'pending',canCheckout:false});assert([...a.state.calls,...b.state.calls].every(x=>x.action==='status'));});
test('active Basic does not open generation while capability is closed',async()=>{const f=await fixture(active);assert(!f.button('Abrir SIMPLE Coach'));assert(f.root.text.includes('todavía no está habilitada'));});
test('explicit capability opens existing human-review flow',async()=>{const f=await fixture(active);f.state.cap.basicGenerationEnabled=true;await f.view.refresh();f.button('Abrir SIMPLE Coach').click();assert.equal(f.state.coach,1);});
for(const patch of [{basicGenerationEnabled:'true'},{basicGenerationEnabled:true,humanReviewRequired:false},{basicGenerationEnabled:true,quotasChanged:true},{basicGenerationEnabled:true,premiumEnabled:true}])test('unexpected capability fails closed '+JSON.stringify(patch),async()=>{const f=await fixture(active);Object.assign(f.state.cap,patch);await f.view.refresh();assert(!f.button('Abrir SIMPLE Coach'));});
test('401 from invoke is treated as expired authentication and clears access',async()=>{const f=await fixture(active);f.state.invoke=async()=>({error:{context:{status:401}}});await f.view.refresh();assert.equal(f.state.auth,1);assert(f.root.text.includes('Inicia sesión'));assert(!f.button('Gestionar suscripción y facturas'));});
test('backend auth error is treated as expired authentication',async()=>{const f=await fixture(active);f.state.invoke=async()=>({data:{error:'billing_auth_required'}});await f.view.refresh();assert.equal(f.state.auth,1);});
test('network error clears stale active state',async()=>{const f=await fixture(active);f.state.invoke=async()=>{throw Error('offline');};await f.view.refresh();assert(!f.root.text.includes('Tu plan está activo'));assert(!f.button('Abrir SIMPLE Coach'));});
for(const patch of [{paidUntil:'invalid'},{paidUntil:'2000-01-01T00:00:00Z'},{monthlyCents:1},{currency:'usd'},{canCheckout:'true'},{environment:'LIVE'},{canCheckout:true},{aiQuotaChanged:true}])test('rejects invalid active projection '+JSON.stringify(patch),async()=>{const f=await fixture({...active,...patch});assert(f.root.text.includes('No se pudo cargar'));assert(!f.button('Gestionar suscripción y facturas'));});
for(const url of ['https://checkout.stripe.com.evil.invalid/','javascript:alert(1)','https://user:pass@checkout.stripe.com/','http://checkout.stripe.com/'])test('rejects untrusted redirect '+url,async()=>{const f=await fixture();f.state.invoke=async()=>({data:{url}});await f.button('Probar Basic en TEST').click();assert.equal(f.state.nav.length,0);});
test('signout ignores a late response from previous owner',async()=>{const f=await fixture();let finish;f.state.invoke=()=>new Promise(r=>finish=r);const pending=f.view.refresh();await idle();f.state.user=null;f.change();await idle();finish({data:active});await pending;await idle();assert(!f.root.text.includes('Tu plan está activo'));assert(f.root.text.includes('Inicia sesión'));});
test('account replacement before response cannot navigate with previous owner',async()=>{const f=await fixture();f.state.invoke=async()=>{f.state.user='another-synthetic';return {data:{url:'https://checkout.stripe.com/c/pay/synthetic'}};};await f.button('Probar Basic en TEST').click();assert.equal(f.state.nav.length,0);assert.equal(f.state.auth,1);});
test('destroy discards responses and unsubscribes',async()=>{const f=await fixture();let finish;f.state.invoke=()=>new Promise(r=>finish=r);const p=f.view.refresh();await idle();f.view.destroy();finish({data:active});await p;assert.equal(f.root.text,'');});
test('production integration is closed and return reads no URL entitlement',()=>{const app=fs.readFileSync(path.resolve(__dirname,'../../assets/subscription-app.js'),'utf8'),ret=fs.readFileSync(path.resolve(__dirname,'../../assets/subscription-return.js'),'utf8');assert(app.includes('billingTest!==true'));assert(app.includes('dmqjexigdnfzobarhnib'));assert(ret.includes("history.replaceState(null,'',location.pathname)"));assert(ret.includes('detectSessionInUrl:false'));assert(!/searchParams|URLSearchParams|localStorage/.test(ret+source));});
