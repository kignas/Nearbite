// Phase 2h — headers + redirects + status-code parity vs legacy `vercel.json`
// and `api/restaurant-seo.js`.
//
// Usage: node scripts/headers-redirects-parity.mjs [newOrigin]
const NEW = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const ID = "6ac8f95828669b5f4e30f0ba";
let checks = 0, fails = 0;
const ok = (cond, label) => { checks++; if (!cond) { fails++; console.log("  FAIL " + label); } else console.log("  pass " + label); };

const head = async (p) => { const r = await fetch(NEW + p, { redirect: "manual" }); return r; };

/* Phase 3a: policy / info pages (batch 1). */
const BATCH1 = [
  ["/about.html", "/about"],
  ["/faq.html", "/faq"],
  ["/terms.html", "/terms"],
  ["/refund-policy.html", "/refund-policy"],
  ["/legal.html", "/legal"],
  ["/delivery-areas-and-charges.html", "/delivery-areas-and-charges"],
  ["/food-delivery-in-maynaguri.html", "/food-delivery-in-maynaguri"],
  ["/partner-rules.html", "/partner-rules"],
];

/* Phase 3b: auth + onboarding pages. */
const AUTH = [
  ["/login.html", "/login"],
  ["/forgot-password.html", "/forgot-password"],
  ["/reset-password.html", "/reset-password"],
  ["/complete-profile.html", "/complete-profile"],
  ["/location-onboarding.html", "/location-onboarding"],
];

/* Phase 3c: account + orders pages. */
const ACCOUNT = [
  ["/profile.html", "/profile"],
  ["/address.html", "/address"],
  ["/address-new.html", "/address-new"],
  ["/orders.html", "/orders"],
  ["/track-order.html", "/track-order"],
];

/* Phase 3d: partner + support / info pages. */
const SUPPORT = [
  ["/partner-with-us.html", "/partner-with-us"],
  ["/apply.html", "/apply"],
  ["/application-status.html", "/application-status"],
  ["/support.html", "/support"],
  ["/order-help.html", "/order-help"],
  ["/order-support.html", "/order-support"],
  ["/rate-us.html", "/rate-us"],
  ["/storage-check.html", "/storage-check"],
  ["/privacy-data.html", "/privacy-data"],
];

console.log("== cleanUrls redirects (legacy vercel.json cleanUrls:true) ==");
for (const [file, clean] of [
  ["/restaurant-shell.html", "/restaurant-shell"],
  ["/under99.html", "/under99"],
  ["/category.html", "/category"],
  ["/search.html", "/search"],
  ["/index.html", "/"],
  // Phase 2 cart + payment (added with the cart close-out)
  ["/cart.html", "/cart"],
  ["/payment-success.html", "/payment-success"],
  ["/payment-failed.html", "/payment-failed"],
  ["/payment-pending.html", "/payment-pending"],
  // Phase 3a policy / info pages (batch 1)
  ...BATCH1,
  // Phase 3b auth + onboarding
  ...AUTH,
  // Phase 3c account + orders
  ...ACCOUNT,
  // Phase 3d partner + support / info
  ...SUPPORT,
]) {
  const r = await head(file);
  ok(r.status === 301, `${file} -> 301`);
  ok((r.headers.get("location") || "").endsWith(clean), `${file} -> ${clean}`);
}

console.log("== cleanUrls redirects preserve the query string ==");
for (const [file, clean] of [
  ["/cart.html", "/cart"],
  ["/payment-success.html", "/payment-success"],
  ["/payment-failed.html", "/payment-failed"],
  ["/payment-pending.html", "/payment-pending"],
  // Phase 3a batch 1
  ...BATCH1,
  // Phase 3b auth + onboarding
  ...AUTH,
  // Phase 3c account + orders
  ...ACCOUNT,
  // Phase 3d partner + support / info
  ...SUPPORT,
]) {
  const r = await head(`${file}?orderId=abc&x=1`);
  ok(r.status === 301, `${file}?query -> 301`);
  const loc = r.headers.get("location") || "";
  ok(loc.endsWith(`${clean}?orderId=abc&x=1`), `${file}?query -> ${clean}?orderId=abc&x=1`);
}

console.log("== clean cart/payment URLs are 200 ==");
for (const p of ["/cart", "/payment-success", "/payment-failed", "/payment-pending"]) {
  const r = await head(p);
  ok(r.status === 200, `${p} 200`);
}

console.log("== clean batch-1 policy / info URLs are 200 ==");
for (const [, clean] of BATCH1) {
  const r = await head(clean);
  ok(r.status === 200, `${clean} 200`);
}

console.log("== clean auth + onboarding URLs are 200 ==");
for (const [, clean] of AUTH) {
  const r = await head(clean);
  ok(r.status === 200, `${clean} 200`);
}

console.log("== clean account + orders URLs are 200 ==");
for (const [, clean] of ACCOUNT) {
  const r = await head(clean);
  ok(r.status === 200, `${clean} 200`);
}

console.log("== clean partner + support / info URLs are 200 ==");
for (const [, clean] of SUPPORT) {
  const r = await head(clean);
  ok(r.status === 200, `${clean} 200`);
}

console.log("== orphan restaurant-details -> /restaurant (query preserved) ==");
for (const p of ["/restaurant-details", "/restaurant-details.html"]) {
  const r = await head(p + "?id=abc&x=1");
  ok(r.status === 301, `${p}?id=abc&x=1 -> 301`);
  ok((r.headers.get("location") || "").endsWith("/restaurant?id=abc&x=1"), `${p}?id=abc&x=1 -> /restaurant?id=abc&x=1`);
}
for (const p of ["/restaurant-info", "/restaurant-info.html"]) {
  const r = await head(p + "?id=abc&x=1");
  ok(r.status === 301, `${p}?id=abc&x=1 -> 301`);
  ok((r.headers.get("location") || "").endsWith("/restaurant?id=abc&x=1"), `${p}?id=abc&x=1 -> /restaurant?id=abc&x=1`);
}
{
  /* /track-order?id=… is the query-preserving case the payment-success page
     links to; confirm the query survives the .html redirect. */
  const r = await head("/track-order.html?id=abc123");
  ok(r.status === 301 && (r.headers.get("location") || "").endsWith("/track-order?id=abc123"), "/track-order.html?id=abc123 -> /track-order?id=abc123");
}
{
  const r = await head("/restaurant.html");
  ok(r.status === 301 && (r.headers.get("location") || "").endsWith("/restaurant"), "/restaurant.html -> 301 /restaurant (explicit vercel redirect)");
}

console.log("== X-Robots-Tag (legacy vercel headers) ==");
{
  const r = await head("/restaurant-shell");
  ok(r.status === 200, "/restaurant-shell 200");
  ok((r.headers.get("x-robots-tag") || "").toLowerCase().includes("noindex"), "/restaurant-shell X-Robots-Tag noindex, nofollow");
}
{
  const r = await head(`/restaurant?id=${ID}`);
  ok(r.status === 200, "/restaurant valid id 200");
  ok(!r.headers.get("x-robots-tag"), "/restaurant has NO X-Robots-Tag (indexable URL)");
  ok((r.headers.get("cache-control") || "").includes("s-maxage=300"), "/restaurant Cache-Control matches legacy");
}

console.log("== status codes (legacy api/restaurant-seo.js) ==");
ok((await head("/restaurant")).status === 404, "missing id -> 404");
ok((await head("/restaurant?id=short")).status === 404, "invalid id -> 404");
ok((await head(`/restaurant?id=${ID}`)).status === 200, "eligible id -> 200");
ok((await head("/restaurant?id=6ac5cbd0933976c30865d23e")).status === 404, "NEVER_INDEX test id -> 404");

console.log("== xml / pwa ==");
{
  const r = await head("/sitemap-restaurants.xml");
  ok(r.status === 200 && (r.headers.get("content-type") || "").includes("xml"), "/sitemap-restaurants.xml 200 xml");
}
{
  const r = await head("/sitemap.xml");
  ok(r.status === 200 && (r.headers.get("content-type") || "").includes("xml"), "/sitemap.xml 200 xml");
}
{
  const r = await head("/manifest.webmanifest");
  ok(r.status === 200, "/manifest.webmanifest 200");
}
{
  const r = await head("/robots.txt");
  ok(r.status === 200, "/robots.txt 200");
}
{
  const r = await head("/sw.js");
  ok(r.status === 200, "/sw.js 200");
}
{
  const r = await head("/firebase-messaging-sw.js");
  ok(r.status === 200, "/firebase-messaging-sw.js 200 (exact root path)");
}

console.log(`\n${checks - fails}/${checks} checks PASS`);
process.exit(fails ? 1 : 0);
