import {useEffect,useState} from "react";
import {getFunctions,httpsCallable} from "firebase/functions";
import {app} from "./firebase";

type KnowledgeItem={id:string;filename:string;type:string;characters:number;chunkCount:number};
const functions=app?getFunctions(app,"asia-south1"):null;

/** Convert a small selected file to base64 without sending bytes to third-party services. */
function readBase64(file:File):Promise<string>{
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(Error("Unable to read file"));
  reader.onload=()=>resolve(String(reader.result).split(",")[1]||"");
  reader.readAsDataURL(file);
 });
}
/** Provide authenticated customer knowledge management for one registered website. */
export default function KnowledgePanel({websiteId}:{websiteId:string}){
 const [items,setItems]=useState<KnowledgeItem[]>([]);
 const [file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [question,setQuestion]=useState("");
 const [passages,setPassages]=useState<{id:string;text:string;score:number}[]>([]);
 const [answer,setAnswer]=useState("");
 /** Refresh only the selected website's document catalogue. */
 async function refresh(){
  if(!functions)return;
  const fn=httpsCallable<{websiteId:string},{documents:KnowledgeItem[]}>(functions,"listKnowledge");
  const response=await fn({websiteId});
  setItems(response.data.documents);
 }
 useEffect(()=>{let active=true;const load=async()=>{
  try{
   if(!functions)return;
   const fn=httpsCallable<{websiteId:string},{documents:KnowledgeItem[]}>(functions,"listKnowledge");
   const result=await fn({websiteId});
   if(active)setItems(result.data.documents);
  }catch(e){if(active)setError(e instanceof Error?e.message:"Could not load documents");}
 };void load();return()=>{active=false};},[websiteId]);
 /** Upload one supported document and refresh the catalogue after the server commits its chunks. */
 async function upload(){
  if(!functions||!file)return;
  setBusy(true);setError("");setMessage("");
  try{
   if(file.size>5*1024*1024)throw Error("Maximum upload size is 5 MB");
   if(!/\.(txt|md|json|docx|xlsx)$/i.test(file.name))throw Error("Supported: TXT, MD, JSON, DOCX, XLSX");
   const base64=await readBase64(file);
   const fn=httpsCallable(functions,"uploadKnowledge",{timeout:120000});
   await fn({websiteId,filename:file.name,base64});
   setFile(null);setMessage("Knowledge uploaded and indexed.");await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Upload failed");}
  finally{setBusy(false);}
 }
 /** Remove an uploaded document and all its indexed passages from the tenant's website. */
 async function remove(id:string){
  if(!functions||!window.confirm("Delete this knowledge document?"))return;
  setBusy(true);setError("");
  try{
   await httpsCallable(functions,"deleteKnowledge")({websiteId,documentId:id});
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Delete failed");}
  finally{setBusy(false);}
 }
 /** Preview relevant source passages before enabling the AI provider adapter. */
 async function search(){
  if(!functions||question.trim().length<2)return;
  setBusy(true);setError("");
  try{
   const result=await httpsCallable<{websiteId:string;question:string},{passages:{id:string;text:string;score:number}[]}>(functions,"searchKnowledge")({websiteId,question});
   setPassages(result.data.passages);
  }catch(e){setError(e instanceof Error?e.message:"Search failed");}
  finally{setBusy(false);}
 }
 /** Request an AI answer grounded only in uploaded knowledge, subject to backend quotas. */
 async function askAI(){
  if(!functions||question.trim().length<2)return;
  setBusy(true);setError("");setAnswer("");
  try{
   const result=await httpsCallable<{websiteId:string;question:string},{answer:string}>(functions,"askPrivateKnowledge",{timeout:60000})({websiteId,question});
   setAnswer(result.data.answer);
  }catch(e){setError(e instanceof Error?e.message:"AI is not configured or available");}
  finally{setBusy(false);}
 }
 return <div className="dash-card" style={{marginTop:20}}>
  <h2>Knowledge library</h2>
  <p className="subtle">Upload TXT, JSON, Word DOCX, Excel XLSX or Markdown. Maximum 5 MB per file. Uploaded content is private to your account.</p>
  {error&&<p role="alert" className="config-note">{error}</p>}
  {message&&<p role="status" className="notice">{message}</p>}
  <input type="file" accept=".txt,.md,.json,.docx,.xlsx" onChange={e=>setFile(e.target.files?.[0]||null)}/>
  <button className="btn" disabled={busy||!file} style={{marginTop:12}} onClick={()=>void upload()}>{busy?"Working…":"Upload and index"}</button>
  {items.map(item=><div key={item.id} style={{display:"flex",gap:12,justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid #eee"}}>
   <span style={{overflowWrap:"anywhere"}}>{item.filename} · {item.chunkCount} passages</span>
   <button className="btn secondary small" disabled={busy} onClick={()=>void remove(item.id)}>Delete</button>
  </div>)}
  <h3>Test knowledge retrieval</h3>
  <p className="subtle">Shows matching excerpts. This is not yet an AI-generated answer.</p>
  <input value={question} maxLength={500} placeholder="Ask a question about your documents" onChange={e=>setQuestion(e.target.value)}/>
  <button className="btn secondary small" disabled={busy||question.trim().length<2} onClick={()=>void search()}>Find relevant passages</button>
  <button className="btn small" style={{marginLeft:8}} disabled={busy||question.trim().length<2} onClick={()=>void askAI()}>Ask AI (uses quota)</button>
  {answer&&<p role="status" style={{whiteSpace:"pre-wrap",padding:12,background:"#f5f3ff",borderRadius:8}}>{answer}</p>}
  {passages.map(p=><p key={p.id} style={{whiteSpace:"pre-wrap",fontSize:12,padding:12,background:"#f8f8ff",borderRadius:8}}>{p.text}</p>)}
 </div>;
}
