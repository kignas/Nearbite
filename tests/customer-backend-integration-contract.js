'use strict';
// Static contract smoke tests only; these do not call a live Eatswada API.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }
function must(haystack, needle, label) {
  if (!haystack.includes(needle)) throw new Error('Missing integration contract: ' + label + ' (' + needle + ')');
}
const location = read('location-onboarding.html');
const tracking = read('track-order.html');
const restaurant = read('restaurant-shell.html');
const support = read('order-support.html');

must(location, "'/restaurants/serviceability?'", 'location checks backend serviceability');
must(location, "serviceability.serviceable", 'location blocks unserviceable locations');
must(location, "'Checking availability…'", 'location shows pending state');
must(tracking, '/review`', 'tracking page reads/writes order review endpoint');
must(tracking, 'itemRatings:', 'tracking page sends per-item ratings');
must(tracking, "result.success !== true", 'review submission requires an explicit API success');
must(restaurant, "'/reviews?page='", 'restaurant detail loads paginated public reviews');
must(restaurant, 'vendorReply', 'restaurant detail renders vendor replies');
must(restaurant, 'itemRatings', 'restaurant detail renders per-item ratings');
must(support, "'?since='", 'support polling uses incremental since filter');
must(support, 'ingest(fresh, !!newest)', 'support merges incremental messages');
must(tracking, 'id="review-photo-input" hidden disabled', 'review-photo upload remains disabled pending privacy-safe upload');
must(tracking, 'nothing is uploaded anywhere', 'review photo safety explanation remains');
console.log('PASS: customer backend integration static contract checks (13 assertions).');
