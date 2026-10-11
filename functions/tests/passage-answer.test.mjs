import test from "node:test";
import assert from "node:assert/strict";
import {extractPassageAnswer} from "../lib/passage-answer.js";
test("quotes a single matching document sentence without AI",()=>{
 const result=extractPassageAnswer("X500 warranty",[{id:"doc_1",text:"The X500 warranty covers manufacturing defects for two years."}]);
 assert.deepEqual(result,{answer:"The X500 warranty covers manufacturing defects for two years.",sourceId:"doc_1"});
});
test("rejects ambiguous and reasoning requests",()=>{
 const docs=[{id:"one",text:"The X500 warranty covers manufacturing defects for two years."},{id:"two",text:"The X500 warranty is extended to three years for members."}];
 assert.equal(extractPassageAnswer("X500 warranty",docs),null);
 assert.equal(extractPassageAnswer("Why is the X500 warranty better?",docs),null);
 assert.equal(extractPassageAnswer("Compare X500 warranty with X600",docs),null);
});
test("does not answer if all keywords are not in one sentence",()=>{
 assert.equal(extractPassageAnswer("X500 price",[{id:"doc",text:"The X500 includes Wi-Fi. The price is ₹5000 for a different model."}]),null);
});
