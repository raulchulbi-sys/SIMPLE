'use strict';
// Local deterministic assembly only. Never connects or deploys.
const fs=require('node:fs'),path=require('node:path');
const dir=__dirname,root=path.resolve(dir,'../..'),migration=path.join(root,'supabase/migrations/20261007230107_premium_analysis_receipt_bounds.sql');
const m=JSON.parse(fs.readFileSync(path.join(dir,'preflight-manifest.json'),'utf8'));
const pre=fs.readFileSync(path.join(dir,'preflight-engine.sql'),'utf8').replace('MANIFEST',JSON.stringify(m));
const start='-- FINANCE PREFLIGHT BEGIN',end='-- FINANCE PREFLIGHT END';
let source=fs.readFileSync(migration,'utf8').replace(/\r\n/g,'\n');
source=source.replace(/-- FINANCE PREFLIGHT BEGIN[\s\S]*?-- FINANCE PREFLIGHT END\n/,'');
if(/\bb\.premium_enabled\b/.test(source+fs.readFileSync(path.join(dir,'rollback-financial.sql'),'utf8')))throw Error('static_dependency_on_optional_control');
source=source.replace("begin;\n","begin;\n"+start+'\n'+pre+end+'\n');
fs.writeFileSync(migration,source);fs.writeFileSync(path.join(dir,'preflight.sql'),pre);
const rollback=path.join(dir,'rollback-financial.sql');
let roll=fs.readFileSync(rollback,'utf8').replace(/\r\n/g,'\n').replace(/-- FINANCE PREFLIGHT BEGIN[\s\S]*?-- FINANCE PREFLIGHT END\n/,'');
roll=roll.replace("begin;\n","begin;\n"+start+'\n'+pre+end+'\n');fs.writeFileSync(rollback,roll);
console.log('Read-only preflight assembled: '+m.tables.length+' tables, '+m.functions.length+' function versions.');
