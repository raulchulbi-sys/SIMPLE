'use strict';
// No network/Auth/SQL implementation. The authorized operator supplies a bounded
// request callback and a committed-revocation acknowledgement consumer later.
const assert=require('node:assert/strict');
function expiry(jwt){
 assert.equal(typeof jwt,'string','jwt_required');
 const parts=jwt.split('.');assert.equal(parts.length,3,'jwt_shape');
 let claims;try{claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));}catch{throw Error('jwt_claims_invalid');}
 assert.ok(Number.isFinite(claims.exp),'jwt_expiry_required');return claims.exp*1000;
}
async function observeRevocation({jwt,expectedOperation,deadline,requestQueue,awaitRevoked,now=Date.now}){
 // JWT is retained only inside this invocation. No hash, URL, body or token is
 // returned. Sign-out belongs to the operator's finally block, even on failure.
 const original=jwt,expiresAt=expiry(original),start=now();
 assert.ok(typeof expectedOperation==='string'&&expectedOperation.length>0,'operation_required');
 assert.ok(Number.isFinite(deadline)&&deadline>start&&deadline-start<=3600000,'window_limit');
 const valid=()=>assert.ok(now()<deadline&&now()<expiresAt,'token_or_window_expired');
 valid();const before=await requestQueue(original);valid();
 assert.equal(before?.http,200,'initial_http');assert.ok(Array.isArray(before.rows)&&before.rows.length===1,'initial_queue');
 assert.equal(before.rows[0]?.operation?.id,expectedOperation,'unexpected_operation');
 const proof=await awaitRevoked();valid();
 assert.equal(proof?.commitConfirmed,true,'revocation_uncommitted');
 assert.equal(proof?.admissionStillValid,true,'admission_expired');assert.equal(proof?.consentUnchanged,true,'consent_changed');
 assert.equal(proof?.noRefresh,true,'refresh_observed');
 const after=await requestQueue(original);valid();
 assert.equal(after?.http,200,'revoked_http');assert.deepEqual(after.rows,[],'revoked_queue');
 // Re-query administrative validity after the second read, using the existing
 // coordinator. The callback must consume a fresh SQL-clock proof, not recycle it.
 const finalProof=await awaitRevoked({phase:'after_hidden'});valid();
 assert.equal(finalProof?.commitConfirmed,true,'revocation_unconfirmed_after');
 assert.equal(finalProof?.admissionStillValid,true,'admission_expired_after');
 assert.equal(finalProof?.consentUnchanged,true,'consent_changed_after');assert.equal(finalProof?.noRefresh,true,'refresh_after');
 return Object.freeze({initialHttp:200,initialCount:1,revokedHttp:200,revokedCount:0,sameJWT:true,noRefresh:true});
}
module.exports={observeRevocation};
if(require.main===module){process.stdout.write('PREPARED ONLY: one original JWT, one initial read, committed assignment revocation, one HTTP200 empty read, then restore/logout. No Auth, network or SQL executed.\n');}
