import test from "node:test";
import assert from "node:assert/strict";
import {allowedBrowserOrigin,validInstallationId,validVisitorQuestion,minuteBucket} from "../lib/widget-security.js";
test("public widget identifiers must have server-issued format",()=>{
 assert.equal(validInstallationId("w_"+"a".repeat(40)),true);
 assert.equal(validInstallationId("../customers/another"),false);
 assert.equal(validInstallationId("w_"+"z".repeat(40)),false);
});
test("public widget questions are bounded",()=>{
 assert.equal(validVisitorQuestion("Where are you located?"),true);
 assert.equal(validVisitorQuestion("a"),false);
 assert.equal(validVisitorQuestion("a".repeat(501)),false);
});
test("browser origin must match verified website exactly",()=>{
 assert.equal(allowedBrowserOrigin("https://example.com","https://example.com"),true);
 assert.equal(allowedBrowserOrigin("https://evil.example.com","https://example.com"),false);
 assert.equal(allowedBrowserOrigin("http://example.com","https://example.com"),false);
 assert.equal(allowedBrowserOrigin("https://example.com.evil.test","https://example.com"),false);
});
test("minute rate bucket is stable within a minute",()=>{
 assert.equal(minuteBucket(60000),minuteBucket(119999));
 assert.notEqual(minuteBucket(60000),minuteBucket(120000));
});
