const days=[
 ["monday","Monday"],["tuesday","Tuesday"],["wednesday","Wednesday"],
 ["thursday","Thursday"],["friday","Friday"],["saturday","Saturday"],["sunday","Sunday"]
];
function parseTime(h){
 if(!h) return null;
 if(h.closed===true) return {closed:true};
 const open=h.opensAt||h.open||h.from, close=h.closesAt||h.close||h.to;
 return open&&close?{open,close}:null;
}
export function renderHours(r,esc){
 const src=r.openingHours||r.hours||{};
 const today=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][new Date().getDay()];
 const todayT=parseTime(src[today]);
 const isOpen=(r.availability&&typeof r.availability.isOpen==="boolean")?r.availability.isOpen:
   (typeof r.isOpen==="boolean"?r.isOpen:true);
 const status=isOpen
   ? `<span class="open">Open now</span>${todayT?.close?` • Closes ${esc(todayT.close)}`:""}`
   : `<span class="closed">Closed now</span>${todayT?.open?` • Opens ${esc(todayT.open)}`:""}`;
 const rows=days.map(([key,label])=>{
   const t=parseTime(src[key]);
   const value=t?.closed?"Closed":t?`${t.open} - ${t.close}`:"Hours not available";
   return `<div class="hour-row ${key===today?"today":""}"><span class="day">${label}</span><span class="time">${esc(value)}</span></div>`;
 }).join("");
 document.querySelector("#restaurant-hours").innerHTML=`
  <button class="hours-head" id="hours-toggle" aria-expanded="true">
    <span class="clock material-symbols-outlined">schedule</span>
    <span class="status">${status}</span>
    <span class="chevron material-symbols-outlined">keyboard_arrow_up</span>
  </button>
  <div class="hours-list" id="hours-list">${rows}</div>`;
 const btn=document.querySelector("#hours-toggle"),list=document.querySelector("#hours-list");
 btn.addEventListener("click",()=>{
   const open=btn.getAttribute("aria-expanded")==="true";
   btn.setAttribute("aria-expanded",String(!open));
   list.classList.toggle("collapsed",open);
   btn.querySelector(".chevron").textContent=open?"keyboard_arrow_down":"keyboard_arrow_up";
 });
}
