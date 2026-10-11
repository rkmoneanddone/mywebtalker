import test from "node:test";
import assert from "node:assert/strict";
import {initializeApp,deleteApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import ExcelJS from "exceljs";

/** Smoke-test Firebase Admin SDK initialization without making network requests. */
test("Firebase Admin Firestore SDK initializes under dependency overrides",async()=>{
 const app=initializeApp({projectId:"mywebtalker-test"},"dependency-smoke-test");
 try{
  const firestore=getFirestore(app);
  assert.equal(firestore.doc("smoke/test").path,"smoke/test");
 }finally{await deleteApp(app);}
});
/** Exercise ExcelJS workbook serialization and parsing with overridden transitive dependencies. */
test("ExcelJS writes and reads a workbook",async()=>{
 const book=new ExcelJS.Workbook();
 book.addWorksheet("Sheet1").addRow(["item","value"]);
 const bytes=await book.xlsx.writeBuffer();
 const restored=new ExcelJS.Workbook();
 await restored.xlsx.load(bytes);
 assert.equal(restored.getWorksheet("Sheet1")?.getRow(1).getCell(2).value,"value");
});
