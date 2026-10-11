import KnowledgePanel from "./KnowledgePanel";
import {getFunctions,httpsCallable} from "firebase/functions";
import {useEffect,useState} from "react";
import {collection,doc,getDoc,getDocs,serverTimestamp,setDoc,updateDoc} from "firebase/firestore";
import type {Timestamp} from "firebase/firestore";
import type {User} from "firebase/auth";
import {Bot,MessageCircle} from "lucide-react";
import {app,db} from "./firebase";

const positions=["bottom-right","bottom-center","top-right"] as const;
type Position=typeof positions[number];
type Settings={companyName:string;botName:string;color:string;position:Position};
type Website={id:string;url:string;status:string;widgetInstallationId?:string;widgetPublished?:boolean};
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
 const [activeTab,setActiveTab]=useState<"websites"|"knowledge"|"appearance">("websites");
 const [settings,setSettings]=useState<Settings>(defaults);
 const [createdAt,setCreatedAt]=useState<Timestamp>();
 const [websites,setWebsites]=useState<Website[]>([]);
 const [site,setSite]=useState("");
 const [installations,setInstallations]=useState<Record<string,string>>({});
 const [selectedWebsite,setSelectedWebsite]=useState("");
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [open,setOpen]=useState(true);
 const [verification,setVerification]=useState<Record<string,{recordName:string;recordValue:string}>>({});
 const [verificationMethod,setVerificationMethod]=useState<Record<string,"dns"|"html">>({});
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
    if(active){setSettings(loaded);setCreatedAt(data?.createdAt as Timestamp|undefined);setWebsites(sites.docs.map(d=>({id:d.id,url:String(d.data().url),status:String(d.data().status),widgetInstallationId:d.data().widgetInstallationId,widgetPublished:d.data().widgetPublished===true})));}
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
  if(!db||!app)return;
  setSaving(true);setError("");setNotice("");
  try{
   const url=normalizeWebsite(site.trim());
   if(websites.some(w=>w.url===url))throw Error("Website already registered.");
   const result=await httpsCallable<{url:string},{websiteId:string}>(getFunctions(app,"asia-south1"),"registerWebsite")({url});
   setWebsites(v=>[...v,{id:result.data.websiteId,url,status:"pending"}]);setSite("");
   setNotice("Website registered. Start ownership verification below.");
  }catch(e){setError(e instanceof Error?e.message:"Website registration failed");}
  finally{setSaving(false);}
 }
 /** Mint installation IDs and publish only via authenticated owner functions. */
 async function manageWidget(id:string,publish?:boolean){
  if(!app)return;
  setSaving(true);setError("");setNotice("");
  try{
   const functions=getFunctions(app,"asia-south1");
   if(typeof publish==="boolean"){
    await httpsCallable(functions,"setWidgetPublication")({websiteId:id,published:publish});
    setWebsites(items=>items.map(w=>w.id===id?{...w,widgetPublished:publish}:w));
    setNotice(publish?"Widget published.":"Widget unpublished.");
   }else{
    const result=await httpsCallable<{websiteId:string},{installationId:string}>(functions,"createWidgetInstallation")({websiteId:id});
    setInstallations(v=>({...v,[id]:result.data.installationId}));
    setWebsites(items=>items.map(w=>w.id===id?{...w,widgetInstallationId:result.data.installationId,widgetPublished:false}:w));
    setNotice("Installation created. Publish separately after testing.");
   }
  }catch(e){setError(e instanceof Error?e.message:"Widget action failed");}
  finally{setSaving(false);}
 }
 /** Issue and confirm ownership proofs through trusted Firebase Functions. */
 async function verifySite(id:string,confirm:boolean,method:"dns"|"html"="dns"){
  if(!app)return;
  setSaving(true);setError("");setNotice("");
  try{
   const name=confirm?"confirmWebsiteVerification":"beginWebsiteVerification";
   const result=await httpsCallable<{websiteId:string;method:"dns"|"html"},{verified:boolean;recordName?:string;recordValue?:string}>(getFunctions(app,"asia-south1"),name)({websiteId:id,method});
   if(result.data.verified){setWebsites(items=>items.map(w=>w.id===id?{...w,status:"verified"}:w));setVerification(v=>{const next={...v};delete next[id];return next;});setNotice("Website ownership verified. You can now install and publish your chatbot.");}
   else if(result.data.recordName&&result.data.recordValue){setVerification(v=>({...v,[id]:{recordName:result.data.recordName!,recordValue:result.data.recordValue!}}));setNotice("Choose DNS TXT or HTML file verification below. Either method is sufficient.");}
  }catch(e){setError(e instanceof Error?e.message:"Verification failed");}
  finally{setSaving(false);}
 }
 return <div>
  <div className="notice"><strong>{trialInfo(createdAt)}</strong> · {user.email}</div>
  {error&&<div className="config-note" role="alert">{error}</div>}
  {notice&&<div className="notice" role="status">{notice}</div>}
  <nav aria-label="Workspace sections" style={{display:"flex",gap:10,flexWrap:"wrap",margin:"20px 0"}}>{([["websites","My Websites"],["knowledge","Knowledge Library"],["appearance","Appearance"]] as const).map(([id,label])=><button key={id} type="button" aria-current={activeTab===id?"page":undefined} className={activeTab===id?"btn":"btn secondary"} onClick={()=>{setActiveTab(id);setError("");setNotice("");}}>{label}</button>)}</nav>
  {loading?<div className="dash-card">Loading your workspace…</div>:<>
   {activeTab==="appearance"&&<div className="dash-grid">
    <div className="dash-card appearance-settings"><span className="setup-eyebrow">CHATBOT BRANDING</span><h2>Appearance</h2><p className="subtle">Make your chatbot match your website. Preview changes before saving.</p>
     <label>Company name<input value={settings.companyName} maxLength={80} onChange={e=>setSettings(s=>({...s,companyName:e.target.value}))}/></label>
     <label>Chatbot name<input value={settings.botName} maxLength={80} onChange={e=>setSettings(s=>({...s,botName:e.target.value}))}/></label>
     <label>Chat colour<div className="appearance-color-row"><input aria-label="Chat colour" type="color" value={settings.color} onChange={e=>setSettings(s=>({...s,color:e.target.value}))}/><code>{settings.color.toUpperCase()}</code></div></label>
     <fieldset className="appearance-position"><legend>Chat position</legend><div className="position-choices">{positions.map(p=><button type="button" key={p} aria-pressed={settings.position===p} className={settings.position===p?"selected":""} onClick={()=>setSettings(s=>({...s,position:p}))}>{p.replaceAll("-"," ")}</button>)}</div></fieldset>
     <div className="appearance-save"><button className="btn" disabled={saving} onClick={()=>void save()}>{saving?"Saving…":"Save appearance"}</button></div>
    </div>
    <div className="dash-card appearance-preview"><span className="setup-eyebrow">INSTANT PREVIEW</span><h2>Live preview</h2><p className="subtle">A sample of how visitors will see your chatbot.</p><div className="preview"><div className="preview-chat" style={{borderColor:settings.color}}>
     <div className="preview-header" style={{background:settings.color}}><Bot size={20}/><div><strong>{settings.botName}</strong><small>{settings.companyName}</small></div><button onClick={()=>setOpen(!open)}>{open?"−":"+"}</button></div>
     {open&&<><div className="preview-message">Hello! 👋 How can I help you today?</div><div className="preview-input">Type your message...</div><div className="powered">Powered by <b>mywebtalker</b></div></>}
    </div><button aria-label="Toggle chat preview" className={"preview-launch "+settings.position} style={{background:settings.color,border:0}} onClick={()=>setOpen(!open)}><MessageCircle/></button></div></div>
   </div>}
   {activeTab==="websites"&&<><div className="dash-card" style={{marginTop:20}}><h2>My websites</h2><p className="subtle">Register a public HTTPS domain. Verify ownership with either a DNS TXT record or an HTTPS verification file.</p>
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><input aria-label="Website URL" style={{flex:"1 1 240px",padding:12,border:"1px solid #dcdfe9",borderRadius:8}} placeholder="https://example.com" value={site} onChange={e=>setSite(e.target.value)}/><button className="btn" disabled={saving||!site.trim()} onClick={()=>void registerSite()}>Add website</button></div>
    {websites.map(w=><section key={w.id} className="website-setup">
     <div className="website-setup-header"><div><span className="setup-eyebrow">WEBSITE</span><h3>{new URL(w.url).hostname}</h3><span className={w.status==="verified"?"status-pill verified":"status-pill"}>{w.status==="verified"?"Verified":"Verification required"}</span></div>{w.status!=="verified"&&<button className="btn secondary small" disabled={saving} onClick={()=>void verifySite(w.id,false)}>{verification[w.id]?"Refresh instructions":"Start verification"}</button>}</div>
     {w.status!=="verified"&&verification[w.id]&&<div className="verification-flow">
      <div className="setup-step"><span className="step-number">1</span><div><h4>Choose a verification method</h4><p className="subtle">Use either DNS TXT or an HTML verification file. Only one is required.</p><div className="method-switch"><button className={(verificationMethod[w.id]||"dns")==="dns"?"selected":""} onClick={()=>setVerificationMethod(v=>({...v,[w.id]:"dns"}))}>DNS TXT record</button><button className={verificationMethod[w.id]==="html"?"selected":""} onClick={()=>setVerificationMethod(v=>({...v,[w.id]:"html"}))}>HTML file</button></div></div></div>
      <div className="setup-step"><span className="step-number">2</span><div className="verification-fields"><h4>{verificationMethod[w.id]==="html"?"Upload the verification file":"Add a DNS TXT record"}</h4>
       {verificationMethod[w.id]==="html"?<><p className="subtle">Download the file and place it at this exact HTTPS location on your website.</p><div className="verification-field"><span>File URL</span><code>{w.url}/.well-known/mywebtalker-verification.txt</code><button className="btn secondary small" onClick={()=>void navigator.clipboard.writeText(w.url+"/.well-known/mywebtalker-verification.txt")}>Copy URL</button></div><button className="btn secondary small" onClick={()=>{const blob=new Blob([verification[w.id].recordValue+"\n"],{type:"text/plain;charset=utf-8"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="mywebtalker-verification.txt";link.click();URL.revokeObjectURL(url)}}>Download verification file</button></>:<><p className="subtle">Add this record in your domain's DNS settings, then allow time for propagation.</p><div className="verification-field"><span>Record type</span><strong>TXT</strong></div><div className="verification-field"><span>Record name</span><code>{verification[w.id].recordName}</code><button className="btn secondary small" onClick={()=>void navigator.clipboard.writeText(verification[w.id].recordName)}>Copy</button></div><div className="verification-field"><span>Record value</span><code>{verification[w.id].recordValue}</code><button className="btn secondary small" onClick={()=>void navigator.clipboard.writeText(verification[w.id].recordValue)}>Copy</button></div></>}
      </div></div>
      <div className="setup-step"><span className="step-number">3</span><div><h4>Confirm ownership</h4><p className="subtle">Once your record or file is publicly accessible, verify it here.</p><button className="btn" disabled={saving} onClick={()=>void verifySite(w.id,true,verificationMethod[w.id]||"dns")}>{saving?"Checking…":"Verify ownership"}</button></div></div>
     </div>}
     {w.status==="verified"&&<p className="subtle">Ownership confirmed. Your website is ready for chatbot installation.</p>}
    </section>)}
   </div>
   {websites.filter(w=>w.status==="verified").map(w=><div key={"widget-"+w.id} className="dash-card" style={{marginTop:16}}>
    <h3>Widget installation — {w.url}</h3>
    <p className="subtle">Publishing activates the live AI endpoint once Firebase Functions are deployed and the OpenAI secret is configured. AI usage may incur charges.</p>
    <button disabled={saving} onClick={()=>void manageWidget(w.id)}>Generate installation ID</button>
    {(installations[w.id]||w.widgetInstallationId)&&<>
     <p>Installation ID: <code>{installations[w.id]||w.widgetInstallationId}</code></p>
     <p>Publication: <strong>{w.widgetPublished?"Published":"Off"}</strong></p>
     <button disabled={saving} onClick={()=>void manageWidget(w.id,!w.widgetPublished)}>{w.widgetPublished?"Unpublish":"Publish"}</button>
    </>}
   </div>)}
   </>}
   {activeTab==="knowledge"&&<>{websites.length===0&&<div className="dash-card">Add a website in My Websites before uploading knowledge.</div>}
   {websites.length>0&&<div className="knowledge-site-bar"><label htmlFor="knowledge-site">Website knowledge</label><select id="knowledge-site" value={selectedWebsite||websites[0]?.id||""} onChange={e=>setSelectedWebsite(e.target.value)}>{websites.map(w=><option key={w.id} value={w.id}>{new URL(w.url).hostname} · {w.status==="verified"?"Verified":"Pending verification"}</option>)}</select></div>}
   {websites.length>0&&<><p className="subtle">Knowledge can be prepared before verification. Publishing the chatbot requires verified website ownership.</p><KnowledgePanel key={selectedWebsite||websites[0].id} websiteId={selectedWebsite||websites[0].id}/></>}
   </>}
  </>}
 </div>;
}
