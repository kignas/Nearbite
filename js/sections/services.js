export function renderServices(r,esc){
 const rows=[["shopping_bag","Provides delivery"]];
 const free=Number(r.freeDeliveryAbove);
 if(r.freeDeliveryEnabled!==false && Number.isFinite(free) && free>0)
   rows.push(["two_wheeler",`Free delivery on orders above ₹${free.toFixed(0)}`]);
 const radius=Number(r.deliveryRadiusKm);
 if(Number.isFinite(radius)&&radius>0) rows.push(["location_on",`Delivers within ${radius} km`]);
 if(r.codEnabled===true) rows.push(["payments","Cash on delivery available"]);
 document.querySelector("#restaurant-services").innerHTML=rows.map(([icon,text])=>
   `<div class="service-row"><span class="service-icon material-symbols-outlined">${icon}</span><span>${esc(text)}</span></div>`
 ).join("");
}
