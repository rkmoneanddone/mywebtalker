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
   if(file.size>256*1024)throw Error("Maximum upload size is 256 KB");
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
 return <div className="dash-card knowledge-workspace">
  <div className="section-title"><div><span className="setup-eyebrow">KNOWLEDGE SOURCE</span><h2>Knowledge library</h2><p className="subtle">Add documents your chatbot can use to answer visitor questions.</p></div><span className="knowledge-count">{items.length} document{items.length===1?"":"s"}</span></div>
  {error&&<p role="alert" className="config-note">{error}</p>}
  {message&&<p role="status" className="notice">{message}</p>}
  <section className="knowledge-section"><div className="knowledge-section-heading"><span className="step-number">1</span><div><h3>Add knowledge</h3><p className="subtle">TXT, Markdown, JSON, DOCX or XLSX · Up to 256 KB per file · Excel: one sheet, 500 rows × 30 columns</p></div></div>
   <label className="knowledge-upload"><span className="upload-symbol">↑</span><strong>{file?file.name:"Choose a document to upload"}</strong><small>{file?(file.size/1024).toFixed(1)+" KB selected":"Browse files on your device"}</small><input type="file" accept=".txt,.md,.json,.docx,.xlsx" onChange={e=>{const selected=e.target.files?.[0]||null;setError("");if(selected&&selected.size>256*1024){setFile(null);setError("Maximum upload size is 256 KB");e.target.value="";return;}setFile(selected);}}/></label>
   <div className="knowledge-actions"><button className="btn" disabled={busy||!file} onClick={()=>void upload()}>{busy?"Working…":"Upload and index"}</button>{file&&<button className="btn secondary" disabled={busy} onClick={()=>setFile(null)}>Clear selection</button>}</div>
  </section>
  <section className="knowledge-section"><div className="knowledge-section-heading"><span className="step-number">2</span><div><h3>Uploaded documents</h3><p className="subtle">Manage the information available to this website's chatbot.</p></div></div>
   {items.length===0?<div className="knowledge-empty">No documents uploaded yet. Add your first file above.</div>:<div className="knowledge-documents">{items.map(item=><div key={item.id} className="knowledge-document"><div><strong>{item.filename}</strong><small>{item.chunkCount} indexed passages</small></div><button className="btn secondary small" disabled={busy} onClick={()=>void remove(item.id)}>Delete</button></div>)}</div>}
  </section>
  <section className="knowledge-section"><div className="knowledge-section-heading"><span className="step-number">3</span><div><h3>Test your knowledge</h3><p className="subtle">Search passages without using AI quota, or ask AI for a generated answer.</p></div></div>
   <label className="knowledge-question">Your question<input value={question} maxLength={500} placeholder="e.g. What services does my business offer?" onChange={e=>setQuestion(e.target.value)}/></label>
   <div className="knowledge-actions"><button className="btn secondary" disabled={busy||question.trim().length<2} onClick={()=>void search()}>Find relevant passages</button><button className="btn" disabled={busy||question.trim().length<2} onClick={()=>void askAI()}>Ask AI · Uses quota</button></div>
   {answer&&<div role="status" className="knowledge-result"><strong>AI answer</strong><p style={{whiteSpace:"pre-wrap"}}>{answer}</p></div>}
   {passages.length>0&&<div className="knowledge-result"><strong>Relevant passages</strong>{passages.map(p=><p key={p.id} style={{whiteSpace:"pre-wrap"}}>{p.text}</p>)}</div>}
  </section>
 </div>;
}
