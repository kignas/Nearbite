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

  // Visible brand name
  BRAND_NAME: "EatSwada",

  // Firebase Web config is public by design.
  // The Firebase Admin service-account key NEVER belongs here.
  FIREBASE: {
    enabled: true,
    apiKey: "AIzaSyA0bqVE3RCmiJORcufx-v6Gew16GMCfFp0",
    authDomain: "eatswada.firebaseapp.com",
    projectId: "eatswada",
    storageBucket: "eatswada.firebasestorage.app",
    messagingSenderId: "644274579271",
    appId: "1:644274579271:web:ba72c4cd4f81c568fa0e62"
  }
};

window.CONFIG = CONFIG;
