export function renderFssai(r){
 const value=String(r.fssaiLicenseNumber||r.fssai||"").trim();
 const box=document.querySelector("#fssai");
 if(!value){box.hidden=true;return;}
 document.querySelector("#fssai-value").textContent=value;
 box.hidden=false;
}
