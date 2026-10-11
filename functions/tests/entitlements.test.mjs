import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_PLANS,evaluateAccess,paidStateFromVerifiedEvent} from "../lib/entitlements.js";
const plan=DEFAULT_PLANS.managed;
test("trial grants access until expiry",()=>{
 const billing={status:"trial",planId:"managed",trialEndMs:100000,brandingEnabled:false};
 assert.equal(evaluateAccess(billing,plan,99999,0).allowed,true);
 assert.equal(evaluateAccess(billing,plan,100000,0).allowed,false);
});
test("client payment status alone cannot grant expired access",()=>{
 const billing={status:"active",planId:"managed",trialEndMs:0,brandingEnabled:false};
 assert.equal(evaluateAccess(billing,plan,100,0).allowed,false);
});
test("paid access expires at period end",()=>{
 const billing={status:"active",planId:"managed",trialEndMs:0,periodEndMs:200,brandingEnabled:false};
 assert.equal(evaluateAccess(billing,plan,199,0).allowed,true);
 assert.equal(evaluateAccess(billing,plan,200,0).allowed,false);
});
test("quota blocks responses",()=>{
 const billing={status:"trial",planId:"managed",trialEndMs:100000,brandingEnabled:false};
 assert.equal(evaluateAccess(billing,plan,10,plan.responsesPerMonth).reason,"quota");
});
test("verified event adapter rejects missing payment reference",()=>{
 assert.throws(()=>paidStateFromVerifiedEvent("managed",Date.now()+10000,"",""));
});
