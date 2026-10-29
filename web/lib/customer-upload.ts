/* ================================================================
   EATSWADA — CUSTOMER IMAGE UPLOAD  (customer-upload.js → lib/customer-upload.ts)
   ----------------------------------------------------------------
   Line-for-line port. Uploads one photo through the customer image upload
   endpoint and resolves to its https URL. Photos are downscaled in the
   browser first (max 1280px, JPEG ~0.8).

     EWUpload.image(file) -> Promise<string url>

   Endpoint: POST /upload/customer-media (customer accounts only), multipart
   field "images". The legacy file was a classic script publishing
   `window.EWUpload`; `installCustomerUpload()` publishes the same global.
   ================================================================ */

const w: any = typeof window !== "undefined" ? window : undefined;

const MAX_EDGE = 1280;
const MAX_BYTES = 8 * 1024 * 1024;

function token(): string {
  const t =
    localStorage.getItem("nearbite_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("nearbite_token") ||
    "";
  return t === "undefined" || t === "null" ? "" : t;
}

function shrink(file: any): Promise<any> {
  return new Promise(function (resolve) {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type) || typeof (w as any).createImageBitmap !== "function") {
      resolve(file);
      return;
    }
    (w as any).createImageBitmap(file)
      .then(function (bmp: any) {
        const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
        const width = Math.round(bmp.width * scale);
        const height = Math.round(bmp.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(bmp, 0, 0, width, height);
        if (bmp.close) bmp.close();
        canvas.toBlob(function (blob: any) { resolve(blob && blob.size < file.size ? blob : file); }, "image/jpeg", 0.8);
      })
      .catch(function () { resolve(file); });
  });
}

function image(file: any): Promise<string> {
  if (!file || !/^image\//i.test(file.type)) return Promise.reject(new Error("Please choose an image file."));
  if (file.size > MAX_BYTES * 2) return Promise.reject(new Error("That photo is too large."));
  const base = (w && w.CONFIG && w.CONFIG.API_BASE_URL) || "";
  const path = (w && w.CONFIG && w.CONFIG.UPLOAD_IMAGE_ENDPOINT) || "/upload/customer-media";
  return shrink(file)
    .then(function (blob: any) {
      if (blob.size > MAX_BYTES) throw new Error("That photo is too large.");
      const fd = new FormData();
      fd.append("images", blob, "photo.jpg");
      const t = token();
      return fetch(base + path, { method: "POST", headers: t ? { Authorization: "Bearer " + t } : {}, body: fd });
    })
    .then(function (res: any) {
      return res
        .json()
        .catch(function () { return null; })
        .then(function (j: any) {
          if (!res.ok) throw new Error((j && j.message) || "Photo upload failed.");
          const urls = j && j.data && j.data.urls;
          const url = Array.isArray(urls) ? urls[0] : j && j.url;
          if (!url || !/^https:\/\//i.test(url)) throw new Error("Photo upload failed.");
          return url;
        });
    });
}

export const EWUpload = { image: image };

export function installCustomerUpload(): void {
  if (!w) return;
  if (w.EWUpload) return;
  w.EWUpload = EWUpload;
}

export default installCustomerUpload;
