import {renderHeader} from "./sections/header.js";
import {renderHours} from "./sections/hours.js";
import {renderServices} from "./sections/services.js";
import {renderFssai} from "./sections/fssai.js";

const $=s=>document.querySelector(s);
const id=new URLSearchParams(location.search).get("id");
let currentRestaurant=null;

function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]));}

$("#back-btn").addEventListener("click",()=>history.back());
$("#menu-btn").addEventListener("click",()=>location.href=id?`restaurant.html?id=${encodeURIComponent(id)}`:"index.html");
$("#share-btn").addEventListener("click",async()=>{
 const name=currentRestaurant?.name||"Restaurant";
 try{
   if(navigator.share){await navigator.share({title:name,url:location.href});}
   else {await navigator.clipboard.writeText(location.href);showToast("Link copied");}
 }catch(e){}
});
function showToast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1600);}

async function init(){
 if(!id){showError("Restaurant ID is missing.");return;}
 try{
   const r=await window.API.getObject(window.API.routes.restaurant(id));
   currentRestaurant=r;
   document.title=`${r.name||"Restaurant"} – Eatswada`;
   renderHeader(r,esc);
   renderHours(r,esc);
   renderServices(r,esc);
   renderFssai(r);
   $("#loading-card").hidden=true;
   $("#restaurant-card").hidden=false;
 }catch(err){
   showError(err?.message||"Please try again.");
 }
}
function showError(msg){
 $("#loading-card").hidden=true;
 $("#error-card").hidden=false;
 $("#error-text").textContent=msg;
}
document.addEventListener("DOMContentLoaded",init);
