import test from "node:test";
import assert from "node:assert/strict";
import {estimatedProviderMicroUsd,budgetAllowed,COST_PER_REQUEST_MICRO_USD,CUSTOMER_DAILY_MICRO_USD,CUSTOMER_MONTHLY_MICRO_USD,PLATFORM_DAILY_MICRO_USD,PLATFORM_MONTHLY_MICRO_USD} from "../lib/ai-budget.js";
import {allowedBrowserOrigin,validInstallationId,validVisitorQuestion,minuteBucket} from "../lib/widget-security.js";

test("each budget fails closed at the configured micro-USD limit",()=>{
 for(const limit of [CUSTOMER_DAILY_MICRO_USD,CUSTOMER_MONTHLY_MICRO_USD,PLATFORM_DAILY_MICRO_USD,PLATFORM_MONTHLY_MICRO_USD]){
  assert.equal(budgetAllowed(0,limit),true);
  assert.equal(budgetAllowed(limit-COST_PER_REQUEST_MICRO_USD,limit),true);
  assert.equal(budgetAllowed(limit-COST_PER_REQUEST_MICRO_USD+1,limit),false);
  assert.equal(budgetAllowed(limit,limit),false);
 }
});
test("invalid counters never authorize AI calls",()=>{
 for(const value of [-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1]){
  assert.equal(budgetAllowed(value,CUSTOMER_DAILY_MICRO_USD),false);
 }
});
test("widget origin rejects cross-domain, suffix, http, and port tricks",()=>{
 const site="https://example.com";
 for(const origin of ["https://evil.example.com","https://example.com.evil.test","http://example.com","https://example.com:444","null","https://example.com/path","https://example.com@evil.test"]){
  assert.equal(allowedBrowserOrigin(origin,site),false,origin);
 }
 assert.equal(allowedBrowserOrigin("https://example.com",site),true);
});
test("widget identifiers and questions reject invalid input",()=>{
 assert.equal(validInstallationId("w_"+"a".repeat(40)),true);
 assert.equal(validInstallationId("w_"+"z".repeat(40)),false);
 assert.equal(validVisitorQuestion("a".repeat(501)),false);
 assert.equal(validVisitorQuestion("ok"),true);
 assert.equal(minuteBucket(Date.UTC(2026,0,1,0,0,1)),minuteBucket(Date.UTC(2026,0,1,0,0,59)));
});

test("token accounting uses integer micro-USD and rejects invalid usage",()=>{assert.equal(estimatedProviderMicroUsd(1000,500),1200);assert.throws(()=>estimatedProviderMicroUsd(-1,10));});
