/* MyWebTalker embeddable widget shell. No API key or private customer data is exposed. */
(()=>{
 "use strict";
 const script=document.currentScript;
 if(!script)return;
 const siteId=script.getAttribute("data-site-id");
 const endpoint=new URL(script.src);
 if(!siteId||!/^[A-Za-z0-9_-]{1,100}$/.test(siteId)||document.getElementById("mywebtalker-widget-root"))return;
 const host=document.createElement("div");
 host.id="mywebtalker-widget-root";
 host.style.cssText="position:fixed;bottom:20px;right:20px;z-index:2147483647;font-family:system-ui,sans-serif";
 const shadow=host.attachShadow({mode:"closed"});
 const style=document.createElement("style");
 style.textContent="button{cursor:pointer;font:inherit} .launch{background:#6d5efc;color:white;border:0;border-radius:100px;padding:15px 20px;box-shadow:0 5px 22px #0003}.panel{display:none;width:min(340px,calc(100vw - 40px));height:400px;background:white;border-radius:14px;box-shadow:0 8px 35px #0003;overflow:hidden;margin-bottom:12px;border:1px solid #ddd}.panel.open{display:flex;flex-direction:column}.head{padding:16px;background:#6d5efc;color:white;font-weight:700}.body{padding:18px;flex:1;color:#333;font-size:14px}.foot{padding:12px;border-top:1px solid #eee;color:#666;font-size:12px}";
 const panel=document.createElement("section");
 panel.className="panel";
 panel.setAttribute("role","dialog");
 panel.setAttribute("aria-label","Website assistant");
 const header=document.createElement("div");header.className="head";header.textContent="Website assistant";
 const body=document.createElement("div");body.className="body";body.textContent="The chatbot is being configured. Please contact this website directly for assistance.";
 const footer=document.createElement("div");footer.className="foot";footer.textContent="Powered by MyWebTalker";
 const launch=document.createElement("button");launch.className="launch";launch.type="button";launch.textContent="Chat with us";launch.setAttribute("aria-expanded","false");
 launch.addEventListener("click",()=>{const open=panel.classList.toggle("open");launch.setAttribute("aria-expanded",String(open));launch.textContent=open?"Close chat":"Chat with us";});
 panel.append(header,body,footer);shadow.append(style,panel,launch);document.body.append(host);
 // Endpoint origin is intentionally not used for requests until the public API is secured.
 void endpoint;
})();
