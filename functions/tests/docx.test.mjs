import test from "node:test";
import assert from "node:assert/strict";
import mammoth from "mammoth";
import {extractKnowledge} from "../lib/knowledge.js";

/** Build a minimal standards-compliant DOCX in memory and verify the actual extraction path. */
test("DOCX extraction reads multiple paragraphs",async()=>{
 const {default:JSZip}=await import("jszip");
 const zip=new JSZip();
 zip.file("[Content_Types].xml",'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file("_rels/.rels",'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 zip.file("word/document.xml",'<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>First paragraph</w:t></w:r></w:p><w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p></w:body></w:document>');
 const bytes=await zip.generateAsync({type:"nodebuffer"});
 const result=await extractKnowledge("example.docx",bytes);
 assert.equal(result.type,"docx");
 assert.match(result.text,/First paragraph/);
 assert.match(result.text,/Second paragraph/);
 assert.ok(result.chunks.length>0);
 assert.equal(typeof mammoth.extractRawText,"function");
});
