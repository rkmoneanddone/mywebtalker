import mammoth from "mammoth";
import ExcelJS from "exceljs";

export type KnowledgeFileType="txt"|"md"|"json"|"docx"|"xlsx";
export type ExtractedKnowledge={filename:string;type:KnowledgeFileType;text:string;chunks:string[];characters:number};
export const MAX_KNOWLEDGE_BYTES=256*1024;
const MAX_EXCEL_ROWS=500;
const MAX_EXCEL_COLUMNS=30;
const MAX_CHARS=100_000;
const MAX_CHUNKS=100;

/** Infer only explicitly supported file formats; reject misleading or unknown extensions. */
export function detectType(filename:string):KnowledgeFileType{
 const ext=filename.toLowerCase().split(".").pop();
 if(ext==="txt"||ext==="md"||ext==="json"||ext==="docx"||ext==="xlsx")return ext;
 throw Error("Unsupported file format. Use TXT, MD, JSON, DOCX or XLSX.");
}
/** Split the complete extracted document into overlapping, bounded retrieval passages. */
export function chunkText(text:string,size=1200,overlap=150):string[]{
 if(!Number.isInteger(size)||size<100||overlap<0||overlap>=size)throw Error("Invalid chunk size");
 const result:string[]=[];
 for(let start=0;start<text.length;start+=size-overlap){
  result.push(text.slice(start,start+size));
  if(result.length>MAX_CHUNKS)throw Error("Document exceeds indexing capacity");
  if(start+size>=text.length)break;
 }
 return result;
}
/** Reject multi-tab or oversized workbooks; only a single bounded worksheet is accepted. */
async function extractExcel(bytes:Buffer):Promise<string>{
 const workbook=new ExcelJS.Workbook();
 await workbook.xlsx.load(bytes as never);
 if(workbook.worksheets.length!==1)throw Error("Excel must contain exactly one worksheet/tab");
 const sheet=workbook.worksheets[0];
 if(sheet.rowCount>MAX_EXCEL_ROWS||sheet.columnCount>MAX_EXCEL_COLUMNS)
  throw Error("Excel limit: 500 rows and 30 columns maximum");
 const lines:string[]=[`Worksheet: ${sheet.name}`];
 sheet.eachRow({includeEmpty:false},(row,rowNumber)=>{
  if(rowNumber>MAX_EXCEL_ROWS||row.cellCount>MAX_EXCEL_COLUMNS||row.actualCellCount>MAX_EXCEL_COLUMNS)
   throw Error("Excel limit: 500 rows and 30 columns maximum");
  const cells:string[]=[];
  row.eachCell({includeEmpty:false},(cell,colNumber)=>{
   if(colNumber>MAX_EXCEL_COLUMNS)throw Error("Excel limit: 30 columns maximum");
   const value=cell.value;
   const text=value instanceof Date?value.toISOString():
    value&&typeof value==="object"&&"result" in value?String(value.result??""):
    value&&typeof value==="object"&&"richText" in value?(value.richText as {text:string}[]).map(x=>x.text).join(""):
    value===null?"":typeof value==="object"?JSON.stringify(value):String(value);
   cells.push(`${sheet.getColumn(colNumber).letter}=${text.replace(/\\r?\\n/g," ")}`);
  });
  lines.push(`Row ${rowNumber}: ${cells.join(" | ")}`);
 });
 return lines.join("\n");
}
/** Extract supported documents completely, validating size and JSON syntax before indexing. */
export async function extractKnowledge(filename:string,bytes:Buffer):Promise<ExtractedKnowledge>{
 if(!filename||filename.length>180||!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>MAX_KNOWLEDGE_BYTES)throw Error("Invalid file or file too large (256 KB maximum)");
 const type=detectType(filename);
 let text:string;
 if(type==="docx"){
  const result=await mammoth.extractRawText({buffer:bytes});
  text=result.value;
 }else if(type==="xlsx"){
  text=await extractExcel(bytes);
 }else{
  text=bytes.toString("utf8").replace(/^\uFEFF/,"");
  if(type==="json")text=JSON.stringify(JSON.parse(text),null,2);
 }
 if(!text.trim())throw Error("Document has no extractable text");
 if(text.length>MAX_CHARS)throw Error("Document contains too much text");
 return {filename,type,text,chunks:chunkText(text),characters:text.length};
}
/** Rank chunks locally by matched query tokens without sending unrelated documents to AI. */
export function rankPassages(query:string,documents:{id:string;text:string}[],limit=6):{id:string;text:string;score:number}[]{
 const terms=[...new Set((query.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu)||[]))].slice(0,30);
 return documents.map(doc=>{
  const lower=doc.text.toLowerCase();
  const score=terms.reduce((sum,term)=>sum+(lower.includes(term)?1:0),0);
  return {...doc,score};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit);
}
