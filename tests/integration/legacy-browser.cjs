// Loading adapter for archived single-HTML harnesses. Product source and test
// assertions remain unchanged. Onboarding suites test separate assets directly.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..'),read=fs.readFileSync;
fs.readFileSync=function(file,...args){
 let value=read.call(this,file,...args);
 if(typeof value!=='string')return value;
 const name=String(file).replaceAll('\\','/');
 if(name.endsWith('/index.html')||name==='index.html'){
  value=value.replace('<link rel="stylesheet" href="assets/auth.css">',()=>'<style>'+read(path.join(root,'assets/auth.css'),'utf8')+'</style>');
  value=value.replace('<script src="assets/auth.js"></script>',()=>'<script>'+read(path.join(root,'assets/auth.js'),'utf8')+'</script>');
 }
 if(name.endsWith('.cjs')&&!name.includes('/tests/onboarding/')){
  // Finish real bootstrap before legacy fixtures seed an authenticated user.
  // These pre-onboarding suites start on the credential form, so navigate there.
  value=value.replace(/await (\w+)\.goto\((['"])https?:\/\/simple\.test\/\2\);/g,(match,p)=>match+`await ${p}.waitForFunction(()=>typeof simpleAuth!=='undefined'&&!simpleAuth.busy);await ${p}.evaluate(()=>authNavigate('login'));`);
  value=value.replace(/await (\w+)\.setContent\(source\);/g,(match,p)=>match+`await ${p}.waitForFunction(()=>typeof simpleAuth!=='undefined'&&!simpleAuth.busy);await ${p}.evaluate(()=>authNavigate('login'));`);
 }
 return value;
};
