/* ================================================================
   EATSWADA — CUSTOMER IMAGE UPLOAD  (window.EWUpload)
   ----------------------------------------------------------------
   Uploads one photo through the customer image upload endpoint and
   resolves to its https URL. Photos are downscaled in the browser first
   (max 1280px, JPEG ~0.8) so a phone photo is ~200–400 KB, not 5 MB.

     EWUpload.image(file) -> Promise<string url>

   Endpoint: POST /upload/customer-media (customer accounts only), multipart
   field "images"; response { success, data:{ urls:[https://res.cloudinary.com/…] } }.
   Override with CONFIG.UPLOAD_IMAGE_ENDPOINT if the route ever moves.
   Requires: config.js
   ================================================================ */
(function () {
  'use strict';
  if (window.EWUpload) return;

  var MAX_EDGE = 1280;
  var MAX_BYTES = 8 * 1024 * 1024;

  function token() {
    var t = localStorage.getItem('nearbite_token') || localStorage.getItem('token') || sessionStorage.getItem('nearbite_token') || '';
    return (t === 'undefined' || t === 'null') ? '' : t;
  }

  function shrink(file) {
    return new Promise(function (resolve) {
      if (!/^image\/(jpeg|png|webp)$/i.test(file.type) || typeof createImageBitmap !== 'function') { resolve(file); return; }
      createImageBitmap(file).then(function (bmp) {
        var scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
        var w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
        if (bmp.close) bmp.close();
        canvas.toBlob(function (blob) { resolve(blob && blob.size < file.size ? blob : file); }, 'image/jpeg', 0.8);
      }).catch(function () { resolve(file); });
    });
  }

  function image(file) {
    if (!file || !/^image\//i.test(file.type)) return Promise.reject(new Error('Please choose an image file.'));
    if (file.size > MAX_BYTES * 2) return Promise.reject(new Error('That photo is too large.'));
    var base = (window.CONFIG && window.CONFIG.API_BASE_URL) || '';
    var path = (window.CONFIG && window.CONFIG.UPLOAD_IMAGE_ENDPOINT) || '/upload/customer-media';
    return shrink(file).then(function (blob) {
      if (blob.size > MAX_BYTES) throw new Error('That photo is too large.');
      var fd = new FormData();
      fd.append('images', blob, 'photo.jpg');
      var t = token();
      return fetch(base + path, { method: 'POST', headers: t ? { Authorization: 'Bearer ' + t } : {}, body: fd });
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (j) {
        if (!res.ok) throw new Error((j && j.message) || 'Photo upload failed.');
        var urls = j && j.data && j.data.urls;
        var url = Array.isArray(urls) ? urls[0] : (j && j.url);
        if (!url || !/^https:\/\//i.test(url)) throw new Error('Photo upload failed.');
        return url;
      });
    });
  }

  window.EWUpload = { image: image };
})();
