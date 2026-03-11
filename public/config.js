/**
 * NadiCare — Frontend Configuration
 *
 * This file controls which backend URL the frontend talks to.
 *
 * HOW IT WORKS:
 *  - When running locally (localhost) → uses '' (relative URLs, same server)
 *  - When hosted on GitHub Pages → uses your Render backend URL
 *
 * AFTER YOU DEPLOY TO RENDER:
 *  Replace 'https://YOUR-APP.onrender.com' below with your actual Render URL
 *  then push to GitHub again.
 */
window.APP_CONFIG = {
  apiBase: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? ''
    : 'https://nadicare-hackathon.onrender.com'   // ← Replace this after Render deployment
};
