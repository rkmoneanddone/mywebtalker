import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {extractKnowledge} from "../lib/knowledge.js";

test("single worksheet retains row 126",async()=>{
 const workbook=new ExcelJS.Workbook();
 const sheet=workbook.addWorksheet("Products");
 sheet.addRow(["ID","Name"]);
 for(let i=1;i<=125;i++)sheet.addRow([i,"Product "+i]);
 const result=await extractKnowledge("products.xlsx",Buffer.from(await workbook.xlsx.writeBuffer()));
 assert.match(result.text,/Worksheet: Products/);
 assert.match(result.text,/Row 126: A=125/);
});
test("reject Excel with multiple worksheets",async()=>{
 const workbook=new ExcelJS.Workbook();
 workbook.addWorksheet("North").addRow(["A"]);
 workbook.addWorksheet("South").addRow(["B"]);
 await assert.rejects(extractKnowledge("two.xlsx",Buffer.from(await workbook.xlsx.writeBuffer())),/exactly one worksheet/);
});
test("reject Excel exceeding row or column limits",async()=>{
 const workbook=new ExcelJS.Workbook();
 workbook.addWorksheet("Large").getCell("A501").value="out of bounds";
 await assert.rejects(extractKnowledge("large.xlsx",Buffer.from(await workbook.xlsx.writeBuffer())),/500 rows/);
 const wide=new ExcelJS.Workbook();
 wide.addWorksheet("Wide").getCell("AE1").value="out of bounds";
 await assert.rejects(extractKnowledge("wide.xlsx",Buffer.from(await wide.xlsx.writeBuffer())),/30 columns/);
});
