'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../../assets/subscription.js'),'utf8');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.textContent='';this.classList={add(){}};}
 append(...x){this.children.push(...x);}replaceChildren(...x){this.children=x;this.textContent='';}setAttribute(k,v){this.attrs[k]=v;}
 querySelectorAll(tag){return this.children.flatMap(c=>[...(c.tag===tag?[c]:[]),...c.querySelectorAll(tag)]);}
 get text(){return this.textContent+this.children.map(c=>c.text).join(' ');}click(){if(!this.disabled)return this.onclick?.();}
}
const idle=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};
const none={environment:'STRIPE_TEST',state:'none',plan:null,accessActive:false,monthlyCents:null,currency:'eur',paidUntil:null,nextBillingAt:null,cancelAtPeriodEnd:false,portalAvailable:false,canCheckout:true,aiQuotaChanged:false};
const active={...none,state:'active',plan:'basic',accessActive:true,monthlyCents:499,paidUntil:'2070-01-01T00:00:00Z',portalAvailable:true,canCheckout:false};
async function fixture({status=none,readOnly=false}={}){
 const state={user:'synthetic-A',status,calls:[],authenticated:0,capability:{basicActive:true,basicGenerationEnabled:false,premiumEnabled:false,quotasChanged:false,humanReviewRequired:true}};
 const root=new Element('div'),window={SimpleAppRuntime:{billingValidationReadOnly:readOnly}};let changed;
 const db={auth:{getUser:async()=>({data:{user:state.user?{id:state.user}:null}}),onAuthStateChange:f=>(changed=f,{data:{subscription:{unsubscribe(){}}}})},
 functions:{invoke:async(n,{body})=>{state.calls.push(body);if(state.invoke)return state.invoke(body);return {data:state.status};}},
 rpc:async()=>{if(state.rpc)return state.rpc();return {data:state.capability};}};
 vm.runInNewContext(source,{window,document:{createElement:t=>new Element(t)},location:{},URL,Date,Intl,queueMicrotask});
 const view=window.SimpleSubscription.mount(root,{db,onAuthenticated:()=>state.authenticated++,onCoach:()=>{throw Error('Unexpected generation UI action');}});
 await idle();return {root,state,view,changed:()=>changed(),remount:()=>{view.destroy();return window.SimpleSubscription.mount(root,{db});},button:s=>root.querySelectorAll('button').find(b=>b.textContent===s)};
}
test('identity replacement during capability await clears old plan and never opens Coach',async()=>{
 const f=await fixture({status:active});f.state.rpc=async()=>{f.state.user='synthetic-B';return {data:{...f.state.capability,basicGenerationEnabled:true}};};
 await f.view.refresh();assert(!f.root.text.includes('Tu plan está activo'));assert(!f.button('Abrir SIMPLE Coach'));assert(f.root.text.includes('Inicia sesión'));
});
test('validation-only no-plan view cannot create checkout',async()=>{const f=await fixture({readOnly:true});assert(!f.button('Probar Basic en TEST'));assert(f.root.text.includes('Consulta de validación'));assert(f.state.calls.every(x=>x.action==='status'));});
test('validation-only paid view cannot create Portal sessions',async()=>{const f=await fixture({status:active,readOnly:true});assert(f.root.text.includes('Tu plan está activo'));assert(!f.button('Gestionar suscripción y facturas'));assert(f.state.calls.every(x=>x.action==='status'));});
test('validation-only uncertain billing view cannot reconcile Stripe',async()=>{const f=await fixture({status:{...none,state:'reconciling',canCheckout:false},readOnly:true});assert(!f.button('Comprobar pago'));assert(f.button('Actualizar estado'));assert(f.state.calls.every(x=>x.action==='status'));});
test('checkout uncertainty survives token refresh for the same owner',async()=>{
 const f=await fixture();f.state.invoke=async body=>{if(body.action==='checkout')throw Error('lost');return {data:none};};
 await f.button('Probar Basic en TEST').click();f.changed();await idle();assert(!f.button('Probar Basic en TEST'));assert(f.button('Comprobar pago'));assert.equal(f.state.calls.filter(x=>x.action==='checkout').length,1);
});
test('checkout uncertainty does not leak into a different account',async()=>{
 const f=await fixture();f.state.invoke=async body=>{if(body.action==='checkout')throw Error('lost');return {data:none};};
 await f.button('Probar Basic en TEST').click();f.state.user='synthetic-B';f.changed();await idle();assert(f.button('Probar Basic en TEST'));assert(!f.button('Comprobar pago'));assert.equal(f.state.calls.filter(x=>x.action==='checkout').length,1);
});
test('A to B to A preserves unresolved A while B stays independent',async()=>{
 const f=await fixture();f.state.invoke=async body=>{if(body.action==='checkout')throw Error('lost');return {data:none};};
 await f.button('Probar Basic en TEST').click();f.state.user='synthetic-B';f.changed();await idle();assert(f.button('Probar Basic en TEST'));
 f.state.user='synthetic-A';f.changed();await idle();assert(!f.button('Probar Basic en TEST'));assert(f.button('Comprobar pago'));assert.equal(f.state.calls.filter(x=>x.action==='checkout').length,1);
});
test('owner switch during checkout preserves uncertainty despite discarded response',async()=>{
 const f=await fixture();let finish;f.state.invoke=body=>body.action==='checkout'?new Promise(resolve=>finish=resolve):Promise.resolve({data:none});
 const originalButton=f.button('Probar Basic en TEST'),pending=originalButton.click();await idle();f.state.user='synthetic-B';f.changed();await idle();assert(f.button('Probar Basic en TEST'));
 finish({data:{url:'https://checkout.stripe.com/c/pay/synthetic'}});await pending;f.state.user='synthetic-A';f.changed();await idle();assert(!f.button('Probar Basic en TEST'));assert(f.button('Comprobar pago'));
 await originalButton.onclick();assert.equal(f.state.calls.filter(x=>x.action==='checkout').length,1);
});
test('reconciliation clears only the confirmed owner unresolved checkout',async()=>{
 const f=await fixture();f.state.invoke=async body=>{if(body.action==='checkout')throw Error('lost');return {data:none};};
 await f.button('Probar Basic en TEST').click();f.state.user='synthetic-B';f.changed();await idle();await f.button('Probar Basic en TEST').click();
 await f.button('Comprobar pago').click();assert(f.button('Probar Basic en TEST'));f.state.user='synthetic-A';f.changed();await idle();assert(!f.button('Probar Basic en TEST'));assert(f.button('Comprobar pago'));
});
test('closing and reopening the view preserves unresolved checkout in page memory',async()=>{
 const f=await fixture();f.state.invoke=async body=>{if(body.action==='checkout')throw Error('lost');return {data:none};};
 await f.button('Probar Basic en TEST').click();const reopened=f.remount();await idle();assert(!f.button('Probar Basic en TEST'));assert(f.button('Comprobar pago'));assert.equal(f.state.calls.filter(x=>x.action==='checkout').length,1);reopened.destroy();
});
test('verified view callback occurs only after identity and projection validation',async()=>{const f=await fixture();assert.equal(f.state.authenticated,1);f.state.status={...active,currency:'usd'};await f.view.refresh();assert.equal(f.state.authenticated,1);});
test('paid-period payment failure remains server-controlled and generation closed',async()=>{const f=await fixture({status:{...active,state:'payment_failed'}});assert(f.root.text.includes('Tu periodo ya pagado sigue disponible'));assert(!f.button('Abrir SIMPLE Coach'));});
