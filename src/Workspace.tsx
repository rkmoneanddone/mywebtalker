import {useEffect,useState} from "react";
import {addDoc,collection,doc,getDoc,getDocs,serverTimestamp,setDoc,updateDoc} from "firebase/firestore";
import type {Timestamp} from "firebase/firestore";
import type {User} from "firebase/auth";
import {Bot,MessageCircle} from "lucide-react";
import {db} from "./firebase";

const positions=["bottom-right","bottom-center","top-right"] as const;
type Position=typeof positions[number];
type Settings={companyName:string;botName:string;color:string;position:Position};
type Website={id:string;url:string;status:string};
const defaults:Settings={companyName:"Your Company",botName:"Your AI Assistant",color:"#6d5efc",position:"bottom-right"};

/** Normalize user input to a public HTTPS hostname; never accept credentials or local addresses. */
function normalizeWebsite(raw:string):string{
 const url=new URL(raw.startsWith("https://")?raw:"https://"+raw);
 if(url.protocol!=="https:"||url.username||url.password||url.port||url.pathname!=="/"||url.search||url.hash)throw Error("Enter a public HTTPS website domain, without paths or ports.");
 const host=url.hostname.toLowerCase();
 if(host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||!host.includes(".")||/^(10|127|169\.254|192\.168)\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host))throw Error("Enter a public website domain.");
 return url.origin;
}
/** Validate editable appearance before any database write. */
function validateSettings(s:Settings):void{
 if(!s.companyName.trim()||s.companyName.length>80||!s.botName.trim()||s.botName.length>80||!/^#[0-9a-fA-F]{6}$/.test(s.color)||!positions.includes(s.position))throw Error("Enter valid names, colour and position.");
}
/** Convert Firestore server-created trial timestamp into a non-authoritative UI countdown. */
function trialInfo(createdAt?:Timestamp):string{
 if(!createdAt)return "Trial activation pending server confirmation";
 const end=createdAt.toMillis()+7*86400000;
 const remaining=Math.max(0,Math.ceil((end-Date.now())/86400000));
 return remaining>0?`Free trial · ${remaining} day(s) remaining`:"Trial expired · Subscription required for paid features";
}
/** Signed-in workspace; only Firestore rules can grant tenant access and enforce trial writes. */
export default function Workspace({user}:{user:User}){
 const [settings,setSettings]=useState<Settings>(defaults);
 const [createdAt,setCreatedAt]=useState<Timestamp>();
 const [websites,setWebsites]=useState<Website[]>([]);
 const [site,setSite]=useState("");
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [open,setOpen]=useState(true);
 /** Load one account document and a bounded list of website registrations after authentication. */
 useEffect(()=>{
  let active=true;
  async function load(){
   if(!db)return;
   try{
    const account=doc(db,"customers",user.uid);
    let snap=await getDoc(account);
    if(!snap.exists()){
     try{await setDoc(account,{email:user.email||"",createdAt:serverTimestamp(),settings:defaults});}
     catch(e){const latest=await getDoc(account);if(!latest.exists())throw e;}
     snap=await getDoc(account);
    }
    const data=snap.data();
    const stored=data?.settings as Partial<Settings>|undefined;
    const loaded:Settings={...defaults,...stored};
    validateSettings(loaded);
    const sites=await getDocs(collection(db,"customers",user.uid,"websites"));
    if(active){setSettings(loaded);setCreatedAt(data?.createdAt as Timestamp|undefined);setWebsites(sites.docs.map(d=>({id:d.id,url:String(d.data().url),status:String(d.data().status)})));}
   }catch(e){if(active)setError(e instanceof Error?e.message:"Could not load workspace");}
   finally{if(active)setLoading(false);}
  }
  void load();
  return()=>{active=false};
 },[user.uid,user.email]);
 /** Save only changed appearance data to the signed-in tenant document. */
 async function save(){
  if(!db)return;
  setSaving(true);setError("");setNotice("");
  try{validateSettings(settings);await updateDoc(doc(db,"customers",user.uid),{settings});setNotice("Appearance saved to Firebase.");}
  catch(e){setError(e instanceof Error?e.message:"Save failed");}
  finally{setSaving(false);}
 }
 /** Register a website as pending; verification must be performed by a trusted backend. */
 async function registerSite(){
  if(!db)return;
  setSaving(true);setError("");setNotice("");
  try{
   const url=normalizeWebsite(site.trim());
   if(websites.length>=5)throw Error("Maximum 5 registered websites for now.");
   if(websites.some(w=>w.url===url))throw Error("Website already registered.");
   const added=await addDoc(collection(db,"customers",user.uid,"websites"),{url,status:"pending",createdAt:serverTimestamp()});
   setWebsites(v=>[...v,{id:added.id,url,status:"pending"}]);setSite("");
   setNotice("Website registered as pending. HTML-file verification is not yet available.");
  }catch(e){setError(e instanceof Error?e.message:"Website registration failed");}
  finally{setSaving(false);}
 }
 return <div>
  <div className="notice">Signed in as {user.email}. {trialInfo(createdAt)}. AI responses, verification and billing remain unavailable until their secure services are deployed.</div>
  {error&&<div className="config-note" role="alert">{error}</div>}
  {notice&&<div className="notice" role="status">{notice}</div>}
  {loading?<div className="dash-card">Loading your workspace…</div>:<>
   <div className="dash-grid">
    <div className="dash-card"><h2>Appearance</h2><p className="subtle">Changes are previewed immediately. Save to persist them.</p>
     <label>Company name<input value={settings.companyName} maxLength={80} onChange={e=>setSettings(s=>({...s,companyName:e.target.value}))}/></label>
     <label>Chatbot name<input value={settings.botName} maxLength={80} onChange={e=>setSettings(s=>({...s,botName:e.target.value}))}/></label>
     <label>Chat colour<input type="color" value={settings.color} onChange={e=>setSettings(s=>({...s,color:e.target.value}))}/></label>
     <label>Position<select value={settings.position} onChange={e=>setSettings(s=>({...s,position:e.target.value as Position}))}>{positions.map(p=><option key={p}>{p}</option>)}</select></label>
     <button className="btn" disabled={saving} onClick={()=>void save()}>{saving?"Saving…":"Save appearance"}</button>
    </div>
    <div className="dash-card"><h2>Live preview</h2><div className="preview"><div className="preview-chat" style={{borderColor:settings.color}}>
     <div className="preview-header" style={{background:settings.color}}><Bot size={20}/><div><strong>{settings.botName}</strong><small>{settings.companyName}</small></div><button onClick={()=>setOpen(!open)}>{open?"−":"+"}</button></div>
     {open&&<><div className="preview-message">Hello! 👋 How can I help you today?</div><div className="preview-input">Type your message...</div><div className="powered">Powered by <b>mywebtalker</b></div></>}
    </div><button aria-label="Toggle chat preview" className={"preview-launch "+settings.position} style={{background:settings.color,border:0}} onClick={()=>setOpen(!open)}><MessageCircle/></button></div></div>
   </div>
   <div className="dash-card" style={{marginTop:20}}><h2>My websites</h2><p className="subtle">Register a public HTTPS domain. Ownership verification will require an HTML file and a trusted backend check.</p>
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><input aria-label="Website URL" style={{flex:"1 1 240px",padding:12,border:"1px solid #dcdfe9",borderRadius:8}} placeholder="https://example.com" value={site} onChange={e=>setSite(e.target.value)}/><button className="btn" disabled={saving||!site.trim()} onClick={()=>void registerSite()}>Add website</button></div>
    {websites.map(w=><p key={w.id} style={{overflowWrap:"anywhere"}}>{w.url} — <strong>{w.status==="pending"?"Pending verification":w.status}</strong></p>)}
   </div>
  </>}
 </div>;
}
