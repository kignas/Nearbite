/* ================================================================
   EATSWADA — RESTAURANT AVAILABILITY & BADGES  (window.EWAvailability)
   ----------------------------------------------------------------
   One reader for the backend's ranking/availability fields so every
   listing surface (home, search, category, 99-store, restaurant page)
   agrees. This module NEVER computes availability or order — it reads
   what the backend already returned.

   Backend fields it understands (controllers/restaurantController.js):
     availabilityStatus : 'orderable'|'busy'|'temporarily_closed'|
                          'closed_today'|'outside_hours'|'suspended'|
                          'unapproved'|'inactive'|'unknown'
     availabilityInfo   : { class, orderable, visible, reason, label, nextOpening }
     orderable / online : booleans
     availability       : { isOpen, status, closedReason }
     operational        : { open, status, reason, message, nextOpening }
     serviceable        : boolean|null   (backend distance test)
     sponsored / sponsoredLabel / featured / pinned : ranking badges

   Fallbacks exist ONLY for cached/legacy payloads that predate these
   fields; they reproduce the legacy `availability.isOpen` read and never
   invent a distance or a price.

   Requires: nothing.
   ================================================================ */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EWAvailability = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var LABELS = {
    orderable: 'Open',
    busy: 'Busy — accepting orders',
    temporarily_closed: 'Temporarily closed',
    closed_today: 'Closed today',
    outside_hours: 'Outside opening hours',
    suspended: 'Suspended by Eatswada',
    unapproved: 'Not approved yet',
    inactive: 'Inactive',
    unknown: 'Unavailable'
  };

  var OFFLINE = {
    temporarily_closed: true, closed_today: true, outside_hours: true,
    suspended: true, unapproved: true, inactive: true, unknown: true
  };

  function isObject(v) { return v && typeof v === 'object'; }

  function boolOrNull(v) { return typeof v === 'boolean' ? v : null; }

  /* Best available availability class for a restaurant object. */
  function classify(res) {
    var r = res || {};
    var info = isObject(r.availabilityInfo) ? r.availabilityInfo : null;

    /* 1. Explicit backend class. */
    var cls = info && typeof info.class === 'string' ? info.class
      : (typeof r.availabilityStatus === 'string' ? r.availabilityStatus : '');

    if (cls) {
      var orderable = boolOrNull(info ? info.orderable : null);
      if (orderable === null) orderable = boolOrNull(r.orderable);
      if (orderable === null) orderable = !OFFLINE[cls];
      var visible = boolOrNull(info ? info.visible : null);
      if (visible === null) visible = !(cls === 'suspended' || cls === 'unapproved' || cls === 'inactive');
      return {
        class: cls,
        orderable: orderable,
        visible: visible,
        reason: (info && info.reason) || r.availabilityReason || '',
        label: (info && info.label) || LABELS[cls] || LABELS.unknown,
        nextOpening: (info && info.nextOpening) || (isObject(r.operational) ? r.operational.nextOpening : null) || null
      };
    }

    /* 2. orderable / online booleans. */
    var ord = boolOrNull(r.orderable);
    if (ord === null) ord = boolOrNull(r.online);
    if (ord !== null) {
      var klass = ord ? (isObject(r.availability) && r.availability.status === 'busy' ? 'busy' : 'orderable') : 'temporarily_closed';
      return { class: klass, orderable: ord, visible: true, reason: '', label: LABELS[klass], nextOpening: null };
    }

    /* 3. Legacy availability.isOpen. */
    var avail = isObject(r.availability) ? r.availability : {};
    var isOpen = typeof avail.isOpen === 'boolean' ? avail.isOpen : boolOrNull(r.isOpen);
    if (isOpen === false) {
      var reason = avail.closedReason || r.closedReason || '';
      var offlineClass = reason === 'closed_today' ? 'closed_today'
        : reason === 'outside_hours' ? 'outside_hours'
        : reason === 'temporarily_closed' ? 'temporarily_closed'
        : 'temporarily_closed';
      return { class: offlineClass, orderable: false, visible: true, reason: reason, label: LABELS[offlineClass], nextOpening: null };
    }
    return { class: 'orderable', orderable: true, visible: true, reason: '', label: LABELS.orderable, nextOpening: null };
  }

  function isOrderable(res) { return classify(res).orderable === true; }
  function isVisible(res) { return classify(res).visible !== false; }

  /* Distinguish a temporary closure (closed/paused/outside hours) from an
     administrative one. Administrative reasons must not be shown to customers
     unless the backend itself returns the restaurant. */
  function isTemporaryClosure(cls) {
    return cls === 'temporarily_closed' || cls === 'closed_today' || cls === 'outside_hours';
  }
  function isAdministrative(cls) {
    return cls === 'suspended' || cls === 'unapproved' || cls === 'inactive';
  }

  function isSponsored(res) {
    var r = res || {};
    if (r.sponsored === true) return true;
    /* Legacy/alias fields a card may carry. */
    return r.isSponsored === true;
  }
  function sponsoredLabel(res) {
    var r = res || {};
    if (!isSponsored(r)) return '';
    return r.sponsoredLabel || 'Sponsored';
  }
  function isFeatured(res) {
    var r = res || {};
    return r.featured === true || r.isFeatured === true;
  }
  function isPinned(res) {
    var r = res || {};
    return r.pinned === true || r.isPinned === true;
  }

  /* Backend distance (km) if present, else null. Never computed here. */
  function distanceKm(res) {
    var r = res || {};
    if (Number.isFinite(Number(r.distanceKm))) return Number(r.distanceKm);
    if (Number.isFinite(Number(r.distanceMeters))) return Number(r.distanceMeters) / 1000;
    return null;
  }

  /* Backend serviceability when known, else null (unknown — do not block). */
  function serviceable(res) {
    var r = res || {};
    return typeof r.serviceable === 'boolean' ? r.serviceable : null;
  }

  return {
    LABELS: LABELS,
    classify: classify,
    isOrderable: isOrderable,
    isVisible: isVisible,
    isTemporaryClosure: isTemporaryClosure,
    isAdministrative: isAdministrative,
    isSponsored: isSponsored,
    sponsoredLabel: sponsoredLabel,
    isFeatured: isFeatured,
    isPinned: isPinned,
    distanceKm: distanceKm,
    serviceable: serviceable
  };
});
