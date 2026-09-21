(() => {
  const keys=['nearbite_address','nearbite_selected_address','nearbite_onboarding_geocode','nearbite_onboarding_location','eatswada_location','userLocation','deliveryLocation','selectedLocation','location'];
  function parse(v){
    if(v==null)return null;
    if(typeof v==='string'){const t=v.trim();if(!t)return null;try{return parse(JSON.parse(t))}catch{return t}}
    if(Array.isArray(v)){for(const x of v){const y=parse(x);if(y)return y}return null}
    if(typeof v==='object'){
      for(const x of [v.area,v.locality,v.neighborhood,v.suburb,v.formattedAddress,v.formatted_address,v.addressLine,v.addressLine1,v.city,v.town,v.address,v.label,v.name]){
        if(typeof x==='string'&&x.trim())return x.trim()
      }
    }
    return null;
  }
  function update(){
    const name=document.getElementById('u99-location-name'),sub=document.getElementById('u99-location-sub');
    let found=null;
    for(const k of keys){try{found=parse(localStorage.getItem(k));if(found)break}catch{}}
    if(name)name.textContent=found||'Set location';
    if(sub)sub.textContent='Delivery in 35–40 minutes';
  }
  document.addEventListener('DOMContentLoaded',()=>{
    update();
    document.getElementById('u99-location')?.addEventListener('click',()=>location.href='location-onboarding.html');
    window.addEventListener('storage',update);
  });
})();
