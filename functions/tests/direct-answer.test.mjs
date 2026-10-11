import test from "node:test";
import assert from "node:assert/strict";
import {findDirectFaqAnswer,faqKey,extractFaqEntries} from "../lib/direct-answer.js";
const docs=[{id:"doc1",text:"Q: What are your opening hours?\nA: 9 AM to 5 PM, Monday to Friday.\n\nQ: Where are you located?\nA: Ranchi."}];
test("exact FAQ match answers without model",()=>{
 assert.deepEqual(findDirectFaqAnswer("what are your opening hours?!",docs),{answer:"9 AM to 5 PM, Monday to Friday.",sourceId:"doc1"});
});
test("similar but not identical questions require AI fallback",()=>{
 assert.equal(findDirectFaqAnswer("Are you open on Sunday?",docs),null);
 assert.equal(findDirectFaqAnswer("What are your holiday opening hours?",docs),null);
});
test("conflicting FAQ sources require fallback",()=>{
 assert.equal(findDirectFaqAnswer("Where are you located?",[...docs,{id:"doc2",text:"Q: Where are you located?\nA: Delhi."}]),null);
});
test("unstructured passages never fabricate answers",()=>{
 assert.equal(findDirectFaqAnswer("refund policy",[{id:"x",text:"Refund policy 7 days"}]),null);
});
\ntest("FAQ indexing extracts complete original document, not split chunks",()=>{
 const entries=extractFaqEntries("Intro\\nQ: Do you deliver?\\nA: Yes, within Ranchi.\\nQ: When?\\nA: Tomorrow.");
 assert.equal(entries.length,2);
 assert.equal(faqKey("Do you deliver?"),faqKey("do you deliver"));
 assert.notEqual(faqKey("Do you deliver?"),faqKey("Do you deliver tomorrow?"));
});
