// Use the JavaScript parser to find the actual end of a declaration, including
// template strings and nested braces. No product code is evaluated here.
const vm=require('vm');
module.exports=function functionSource(source,name){
 const match=new RegExp('(?:async )?function '+name+'\\(').exec(source);
 if(!match)throw Error('Missing function '+name);
 for(let end=source.indexOf('}',match.index);end>=0;end=source.indexOf('}',end+1)){
  const candidate=source.slice(match.index,end+1);
  try{new vm.Script('('+candidate+')');return candidate;}catch(_){}
 }
 throw Error('Incomplete function '+name);
};
