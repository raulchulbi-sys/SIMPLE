// Offline regeneration of the two reviewed final hardening definitions only.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const dir=__dirname,root=path.resolve(dir,'../..'),read=f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
const migration=path.join(root,'supabase/migrations/20261003231239_coach_premium_weekly.sql');
const originalsFile=path.join(dir,'private/phase3-originals.json');
const original=read('private/phase3-originals.json');
const line=" if p->>'field' is null then raise exception 'premium_invalid_patch';end if;\n";
const check=original.find(f=>f.proname==='premium_check_patch');assert(check);
if(!check.definition.includes(line)){
 assert(check.definition.includes('begin\n select current_revision_id'));
 fs.writeFileSync(path.join(dir,'private/phase3-originals-before-final-hardening.json'),JSON.stringify(original,null,2));
 fs.writeFileSync(path.join(dir,'private/phase3-before-final-hardening.sql'),fs.readFileSync(migration));
 check.definition=check.definition.replace('begin\n select current_revision_id',()=> 'begin\n'+line+' select current_revision_id');
 fs.writeFileSync(originalsFile,JSON.stringify(original,null,2));
}
require('./phase2-guard.cjs');
require('./build-backend.cjs');
const final=read('private/phase3-final-definitions.json');
const names=['premium_check_patch','premium_weekly_permission'];
const sql=fs.readFileSync(migration,'utf8');
const defs=names.map(name=>{
 const schema=name==='premium_check_patch'?'coach_private':'public';
 const match=sql.match(new RegExp('create (?:or replace )?function '+schema+'\\.'+name+'\\(','i'));
 assert(match,'Required generated definition '+name);
 const tail=sql.slice(match.index),opening=tail.match(/\bas\s+(\$[a-z_]*\$)/i);assert(opening);
 const tag=opening[1],end=tail.indexOf(tag+';',opening.index+opening[0].length);assert(end>0);
 return tail.slice(0,end+tag.length+1).replace(/^create function/i,'create or replace function');
});
const preflight=names.map(name=>{
 const f=final.find(f=>f.name===name);assert(f);
 return ` if md5(pg_get_functiondef('${f.schema}.${name}(${name==='premium_check_patch'?'jsonb,uuid,boolean':'uuid,boolean'})'::regprocedure)) is distinct from '${f.hash}' then raise exception 'premium_hardening_definition_changed: ${name}';end if;`;
}).join('\n');
const delta='-- STAGING ONLY. Reviewed two-function delta; exact previous-definition hashes required.\nbegin;\ndo $$ begin\n'+preflight+'\nend $$;\n\n'+defs.join('\n\n')+'\ncommit;\n';
assert.equal((delta.match(/create or replace function/gi)||[]).length,2);
fs.writeFileSync(path.join(dir,'phase3-hardening-delta.sql'),delta);
console.log(JSON.stringify({definitions:names,bytes:Buffer.byteLength(delta),candidate_sha256:crypto.createHash('sha256').update(sql).digest('hex'),delta_sha256:crypto.createHash('sha256').update(delta).digest('hex')}));
