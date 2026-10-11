/* MyWebTalker public widget. Installation IDs are public; backend enforces all access. */
(()=>{
 "use strict";
 const script=document.currentScript;
 if(!script||document.getElementById("mywebtalker-widget-root"))return;
 const installationId=script.getAttribute("data-installation-id");
 const api=script.getAttribute("data-api-url");
 if(!/^w_[a-f0-9]{40}$/.test(installationId||"")||!api)return;
 let endpoint;
 try{endpoint=new URL(api);if(endpoint.protocol!=="https:")return;}catch{return;}
 const root=document.createElement("div");root.id="mywebtalker-widget-root";
 root.style.cssText="position:fixed;bottom:20px;right:20px;z-index:2147483647;font:14px system-ui,sans-serif";
 const shadow=root.attachShadow({mode:"closed"});
 const style=document.createElement("style");
 style.textContent=".panel{display:none;flex-direction:column;width:min(350px,calc(100vw - 40px));height:420px;margin-bottom:12px;border:1px solid #ddd;border-radius:14px;overflow:hidden;background:white;box-shadow:0 8px 30px #0003}.panel.open{display:flex}.head{padding:15px;background:#6d5efc;color:white;font-weight:700}.messages{flex:1;overflow-y:auto;padding:14px;white-space:pre-wrap;overflow-wrap:anywhere}.msg{margin-bottom:12px;padding:9px;border-radius:8px;background:#f3f3fa}.msg.user{background:#e9e5ff}.form{display:flex;gap:5px;padding:10px;border-top:1px solid #ddd}.form input{min-width:0;flex:1;padding:9px}.form button,.launch{border:0;border-radius:9px;background:#6d5efc;color:white;padding:11px;cursor:pointer}.form button:disabled{opacity:.5}.launch{border-radius:40px}.powered{padding:5px;text-align:center;color:#666;font-size:11px}";
 const panel=document.createElement("section");panel.className="panel";panel.setAttribute("role","dialog");panel.setAttribute("aria-label","Website assistant");
 const header=document.createElement("div");header.className="head";header.textContent="Website assistant";
 const messages=document.createElement("div");messages.className="messages";messages.setAttribute("role","log");messages.setAttribute("aria-live","polite");
 const form=document.createElement("form");form.className="form";
 const input=document.createElement("input");input.maxLength=500;input.placeholder="Ask a question";input.setAttribute("aria-label","Your question");input.required=true;
 const send=document.createElement("button");send.type="submit";send.textContent="Send";
 const leadForm=document.createElement("form");leadForm.className="form";leadForm.style.cssText="display:flex;flex-direction:column;gap:8px";
 const leadName=document.createElement("input");leadName.placeholder="Your name";leadName.required=true;leadName.minLength=2;leadName.maxLength=100;
 const leadEmail=document.createElement("input");leadEmail.placeholder="Email address";leadEmail.type="email";leadEmail.required=true;leadEmail.maxLength=254;
 const leadMobile=document.createElement("input");leadMobile.placeholder="Mobile number with country code";leadMobile.type="tel";leadMobile.required=true;leadMobile.pattern="[+]?[1-9][0-9]{7,14}";
 const leadButton=document.createElement("button");leadButton.type="submit";leadButton.textContent="Start chatting";
 const leadError=document.createElement("div");leadError.style.color="#a00";leadError.setAttribute("role","alert");
 leadForm.append(leadName,leadEmail,leadMobile,leadButton,leadError);
 let leadSaved=false,visitorToken="";
 leadForm.addEventListener("submit",async event=>{
  event.preventDefault();if(leadSaved||leadButton.disabled)return;
  const name=leadName.value.trim(),email=leadEmail.value.trim(),mobile=leadMobile.value.trim();
  if(name.length<2||!leadEmail.validity.valid||!leadMobile.validity.valid){leadError.textContent="Enter valid name, email and mobile number.";return;}
  leadButton.disabled=true;leadError.textContent="";
  try{
   const leadUrl=new URL(endpoint);leadUrl.pathname=leadUrl.pathname.slice(0,leadUrl.pathname.lastIndexOf("/")+1)+"captureVisitorLead";leadUrl.searchParams.set("installationId",installationId);
   const response=await fetch(leadUrl.toString(),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({installationId,name,email,mobile}),credentials:"omit"});
   if(!response.ok)throw Error("Unable to save visitor details");
   const saved=await response.json();
   if(typeof saved.visitorToken!=="string")throw Error("Missing visitor session");
   visitorToken=saved.visitorToken;
   leadSaved=true;leadForm.remove();form.style.display="flex";input.focus();
  }catch{leadError.textContent="Could not start chat. Please retry.";}
  finally{leadButton.disabled=false;}
 });
 form.style.display="none";
 const powered=document.createElement("div");powered.className="powered";powered.textContent="Powered by MyWebTalker";
 const configUrl=new URL(endpoint);configUrl.pathname=configUrl.pathname.slice(0,configUrl.pathname.lastIndexOf("/")+1)+"publicWidgetConfig";configUrl.searchParams.set("installationId",installationId);
 void fetch(configUrl.toString(),{credentials:"omit"}).then(response=>{if(!response.ok)throw Error("config");return response.json();}).then(config=>{if(config.brandingRemoved===true)powered.remove();if(typeof config.botName==="string"&&config.botName.trim())header.textContent=config.botName.slice(0,80);if(typeof config.color==="string"&&/^#[0-9a-fA-F]{6}$/.test(config.color)){header.style.backgroundColor=config.color;send.style.backgroundColor=config.color;leadButton.style.backgroundColor=config.color;launch.style.backgroundColor=config.color;}}).catch(()=>undefined);
 const launch=document.createElement("button");launch.className="launch";launch.type="button";launch.textContent="Chat with us";launch.setAttribute("aria-expanded","false");
 function addMessage(value,user){const msg=document.createElement("div");msg.className="msg"+(user?" user":"");msg.textContent=value;messages.append(msg);messages.scrollTop=messages.scrollHeight;}
 addMessage("Hello! How can I help you?",false);
 launch.addEventListener("click",()=>{const open=panel.classList.toggle("open");launch.setAttribute("aria-expanded",String(open));launch.textContent=open?"Close chat":"Chat with us";if(open)(leadSaved?input:leadName).focus();});
 form.addEventListener("submit",async event=>{
  event.preventDefault();const question=input.value.trim();if(question.length<2||send.disabled)return;
  input.value="";addMessage(question,true);send.disabled=true;input.disabled=true;
  try{
   const url=new URL(endpoint);url.searchParams.set("installationId",installationId);
   const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),35000);
   try{
    const response=await fetch(url.toString(),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({installationId,question,visitorToken}),signal:controller.signal,credentials:"omit"});
    const data=await response.json();
    addMessage(response.ok&&typeof data.answer==="string"?data.answer:"Assistant unavailable. Please try again later.",false);
   }finally{clearTimeout(timer);}
  }catch{addMessage("Connection unavailable. Please try again later.",false);}
  finally{send.disabled=false;input.disabled=false;input.focus();}
 });
 form.append(input,send);panel.append(header,messages,leadForm,form,powered);shadow.append(style,panel,launch);document.body.append(root);
})();
