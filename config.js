/* ================================================================
   EATSWADA — SINGLE SOURCE OF CONFIGURATION
   ----------------------------------------------------------------
   This is the ONLY place the API base URL is defined.
   Every page loads this file before api.js.
   To point the app at a different backend, change ONE line below.
   ================================================================ */
const CONFIG = {
  // Local development URL
  // API_BASE_URL: "http://localhost:5000/api",

  // Production Render URL
  API_BASE_URL: "https://eatswada.onrender.com/api",

  // Visible brand name. Used for page titles and UI copy so the
  // storefront can be renamed from one line instead of 16 files.
  BRAND_NAME: "EatSwada"
};

window.CONFIG = CONFIG;
