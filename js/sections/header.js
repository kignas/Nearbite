export function renderHeader(r, esc){
  const cuisine = Array.isArray(r.cuisine) ? r.cuisine.join(" · ") :
    Array.isArray(r.cuisines) ? r.cuisines.join(" · ") :
    (r.cuisineDisplay || (typeof r.cuisine === "string" ? r.cuisine : ""));
  const address = r.address || (r.location && r.location.address) || "";
  const phone = String(r.phone || r.contactNumber || "").trim();
  const c = r?.location?.coordinates;
  let maps = "";
  if(Array.isArray(c) && c.length >= 2){
    const lng=Number(c[0]),lat=Number(c[1]);
    if(Number.isFinite(lat)&&Number.isFinite(lng)) maps=`${lat},${lng}`;
  }
  if(!maps && address) maps=address;
  const mapsUrl=maps ? "https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(maps) : "";
  document.querySelector("#restaurant-header").innerHTML=`
    <div class="restaurant-header">
      <h1>${esc(r.name || "Restaurant")}</h1>
      ${cuisine?`<p class="cuisine">${esc(cuisine)}</p>`:""}
      ${address?`<p class="address">${esc(address)}</p>`:""}
      <div class="actions">
        ${phone?`<a class="action-circle" href="tel:${esc(phone)}" aria-label="Call"><span class="material-symbols-outlined">call</span></a>`:""}
        ${mapsUrl?`<a class="action-circle" href="${esc(mapsUrl)}" target="_blank" rel="noopener" aria-label="Directions"><span class="material-symbols-outlined">directions</span></a>`:""}
      </div>
    </div>`;
}
