import test from "node:test";
import assert from "node:assert/strict";
import {extractKnowledge,chunkText,rankPassages} from "../lib/knowledge.js";

test("TXT extraction retains the 125th record",async()=>{
 const text=Array.from({length:125},(_,i)=>"Record "+(i+1)).join("\n");
 const result=await extractKnowledge("records.txt",Buffer.from(text));
 assert.match(result.text,/Record 125/);
});
test("JSON extraction retains 125 records",async()=>{
 const records=Array.from({length:125},(_,i)=>({id:i+1}));
 const result=await extractKnowledge("records.json",Buffer.from(JSON.stringify(records)));
 assert.equal(JSON.parse(result.text).length,125);
});
test("chunking and ranked retrieval",()=>{
 assert.ok(chunkText("a".repeat(2500)).length>1);
 assert.equal(rankPassages("invoice",[{id:"a",text:"invoice total"},{id:"b",text:"other"}])[0]?.id,"a");
});

test("all supported formats reject files larger than 256 KB",async()=>{
 for(const extension of ["txt","md","json","docx","xlsx"]){
  await assert.rejects(extractKnowledge("huge."+extension,Buffer.alloc(256*1024+1,65)),/256 KB maximum/);
 }
});

test("Office uploads reject non-ZIP data before extraction",async()=>{
 for(const extension of ["docx","xlsx"]){
  await assert.rejects(extractKnowledge("fake."+extension,Buffer.from("not a zip")),/Invalid Office ZIP archive/);
 }
});
