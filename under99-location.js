/* ==========================================================================
   99 Store — shared Eatswada location pill
   Extracted verbatim from under99.html. Independent of under99-app.js.
   ========================================================================== */
/* ===== 99 STORE — SHARED EATSWADA LOCATION ===== */
(() => {
  const LOCATION_KEYS=[
    'nearbite_address','nearbite_selected_address','nearbite_onboarding_geocode','nearbite_onboarding_location',
    'eatswada_location','userLocation','deliveryLocation',
    'selectedLocation','location'
  ];
  const CHANGE_LOCATION_URL='location-onboarding.html';

  function parseValue(value){
    if(value==null)return null;
    if(typeof value==='string'){
      const t=value.trim(); if(!t)return null;
      try{return parseValue(JSON.parse(t));}catch{return t;}
    }
    if(Array.isArray(value)){
      for(const item of value){const found=parseValue(item);if(found)return found;}
      return null;
    }
    if(typeof value==='object'){
      const preferred=[
        value.area,value.locality,value.neighborhood,value.suburb,
        value.formattedAddress,value.formatted_address,value.addressLine,value.addressLine1,
        value.localityName,value.areaName,value.neighborhoodName,value.street,
        value.address,value.label,value.name,value.city,value.town
      ];
      for(const item of preferred)if(typeof item==='string'&&item.trim())return item.trim();
      for(const key of ['addressData','address','location','geocode','data']){
        if(value[key]&&typeof value[key]==='object'){
          const found=parseValue(value[key]);if(found)return found;
        }
      }
    }
    return null;
  }

  function readSavedLocation(){
    for(const key of LOCATION_KEYS){
      try{const found=parseValue(localStorage.getItem(key));if(found)return found;}catch{}
    }
    return null;
  }

  function updateLocationUI(){
    const pill=document.getElementById('loc-pill');
    const nameEl=document.getElementById('loc-name');
    const subEl=document.getElementById('loc-sub');
    if(!pill||!nameEl)return;
    const saved=readSavedLocation();
    if(saved){
      nameEl.textContent=saved;
      if(subEl)subEl.textContent='Within 10 km';
      pill.classList.remove('loc-unset');
    }else{
      nameEl.textContent='Set location';
      if(subEl)subEl.textContent='Tap to choose your area';
      pill.classList.add('loc-unset');
    }
  }

  document.addEventListener('DOMContentLoaded',()=>{
    updateLocationUI();
    const pill=document.getElementById('loc-pill');
    if(pill)pill.addEventListener('click',()=>{window.location.href=CHANGE_LOCATION_URL;});
    window.addEventListener('storage',updateLocationUI);
  });
})();
