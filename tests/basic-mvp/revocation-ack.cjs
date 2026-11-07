'use strict';
// File acknowledgements only. No database, Auth, SDK, network or credential access.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const steps=['prepared','visible','revoked','hidden','restored','signed_out','final'];
const fields={prepared:{clockTtlSeconds:n=>Number.isInteger(n)&&n>0&&n<=3600,scopeViewOnly:x=>x===true},visible:{http:x=>x===200,queueLength:x=>x===1,onlyExpectedOperation:x=>x===true},revoked:{commitConfirmed:x=>x===true,admissionStillValid:x=>x===true,consentUnchanged:x=>x===true},hidden:{http:x=>x===200,queueLength:x=>x===0,sameJWT:x=>x===true,noRefresh:x=>x===true},restored:{originalConfigHashMatched:x=>x===true,assignmentCount:x=>x===0,fixtureRows:x=>x===0},signed_out:{signoutConfirmed:x=>x===true},final:{integrityMatched:x=>x===true,billingMatched:x=>x===true,securityMatched:x=>x===true}};
function validate(plan,ack,next,now=Date.now()){
 if(!plan||plan.project!=='dmqjexigdnfzobarhnib'||!/^[a-f0-9]{64}$/.test(plan.sha)||!/^[a-f0-9]{32}$/.test(plan.challenge))throw Error('Invalid plan');
 if(!ack||Object.keys(ack).sort().join(',')!=='challenge,createdAt,planSha,project,proof,run,schema,seq,step')throw Error('Unexpected acknowledgement fields');
 if(ack.schema!==1||ack.project!==plan.project||ack.run!==plan.run||ack.planSha!==plan.sha||ack.challenge!==plan.challenge||ack.seq!==next+1||ack.step!==steps[next])throw Error('Wrong run, phase or sequence');
 const at=Date.parse(ack.createdAt);if(!Number.isFinite(at)||at<plan.startedAt||at>plan.deadline||now>plan.deadline||at>now+1000)throw Error('Stale or expired acknowledgement');
 const keys=fields[ack.step];if(!ack.proof||Object.keys(ack.proof).sort().join(',')!==Object.keys(keys).sort().join(','))throw Error('Unexpected proof fields');
 for(const [k,check]of Object.entries(keys))if(!check(ack.proof[k]))throw Error('Insufficient proof: '+k);
 return ack;
}
function publish(directory,ack,plan,next,now=Date.now()){
 validate(plan,ack,next,now); // Refuse credential fields and path/phase input before any write.
 const dir=fs.realpathSync(directory),file=path.join(dir,String(ack.seq).padStart(2,'0')+'-'+ack.step+'.json'),bytes=JSON.stringify(ack)+'\n';
 if(fs.existsSync(file)){if(fs.readFileSync(file,'utf8')!==bytes)throw Error('Conflicting immutable acknowledgement');return file;}
 const temp=path.join(dir,'.ack-'+crypto.randomUUID()+'.tmp');const fd=fs.openSync(temp,'wx');try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 try{fs.linkSync(temp,file);}finally{fs.unlinkSync(temp);}return file;
}
function consume(plan,directory,next,now=Date.now()){
 const file=path.join(directory,String(next+1).padStart(2,'0')+'-'+steps[next]+'.json');
 if(!fs.existsSync(file))return null;return validate(plan,JSON.parse(fs.readFileSync(file,'utf8')),next,now);
}
module.exports={steps,fields,validate,publish,consume};
