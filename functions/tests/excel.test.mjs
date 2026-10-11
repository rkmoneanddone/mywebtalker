import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {extractKnowledge} from "../lib/knowledge.js";

/** Verify XLSX extraction does not stop after the first 25 or 100 rows. */
test("XLSX extraction includes row 126 on both sheets",async()=>{
 const workbook=new ExcelJS.Workbook();
 for(const name of ["North","South"]){
  const sheet=workbook.addWorksheet(name);
  sheet.addRow(["ID","Name"]);
  for(let i=1;i<=125;i++)sheet.addRow([i,"Product "+i]);
 }
 const buffer=Buffer.from(await workbook.xlsx.writeBuffer());
 const result=await extractKnowledge("products.xlsx",buffer);
 assert.match(result.text,/Worksheet: North/);
 assert.match(result.text,/Worksheet: South/);
 assert.equal((result.text.match(/Row 126: A=125/g)||[]).length,2);
});
