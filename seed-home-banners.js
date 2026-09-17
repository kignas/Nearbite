'use strict';

/*
 * Eatswada — seed the 3 missing home banners (Pink / Purple / Magenta)
 * so the header matches the 4-slide benchmark.
 *
 * HOW TO RUN
 *   1. Put this file in your backend root (same folder as your app, so the
 *      require path './models/HomeBanner' below resolves — adjust if needed).
 *   2. Fill in the three IMAGE_* URLs below (upload the burger/pizza/biryani
 *      pictures via your admin image uploader first, then paste the URLs).
 *   3. Make sure MONGODB_URI is set (it already is on your server / .env).
 *   4. node seed-home-banners.js
 *
 * Safe to re-run: it matches on (headerTheme + searchPlaceholder) and updates
 * instead of creating duplicates. It does NOT touch your existing anime banner
 * except to bump its priority to 40 so it stays first.
 */

const mongoose = require('mongoose');
const HomeBanner = require('./models/HomeBanner'); // <-- adjust path if your models live elsewhere

// ── Fill these in ────────────────────────────────────────────────
const IMAGE_BURGER  = 'PASTE_BURGER_IMAGE_URL_HERE';
const IMAGE_PIZZA   = 'PASTE_PIZZA_IMAGE_URL_HERE';
const IMAGE_BIRYANI = 'PASTE_BIRYANI_IMAGE_URL_HERE';
// ─────────────────────────────────────────────────────────────────

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

const banners = [
  {
    headerTheme: 'pink',
    title: 'Good Food\nCloser to Home.',
    subtitle: 'Tasty food, Happier you.',
    searchPlaceholder: 'Burger',
    ctaText: 'Order Now',
    ctaUrl: '/deals',
    image: IMAGE_BURGER,
    background: '',      // blank = let the theme drive the colours
    textColor: 'dark',
    priority: 30,
    active: true,
  },
  {
    headerTheme: 'lavender',
    title: 'Good Food\nCloser to Home.',
    subtitle: 'Pizza makes everything better!',
    searchPlaceholder: 'Pizza',
    ctaText: 'Order Now',
    ctaUrl: '/deals',
    image: IMAGE_PIZZA,
    background: '',
    textColor: 'light',
    priority: 20,
    active: true,
  },
  {
    headerTheme: 'magenta',
    title: 'Good Food\nCloser to Home.',
    subtitle: 'Biryani starts at \u20B979',
    searchPlaceholder: 'Biryani',
    ctaText: 'Order Now',
    ctaUrl: '/deals',
    image: IMAGE_BIRYANI,
    background: '',
    textColor: 'light',
    priority: 10,
    active: true,
  },
];

async function run() {
  if (!MONGODB_URI) {
    console.error('✗ MONGODB_URI is not set. Export it or load your .env first.');
    process.exit(1);
  }
  const missing = banners.filter(b => !b.image || b.image.startsWith('PASTE_'));
  if (missing.length) {
    console.error('✗ Set the image URLs at the top of this file before running:');
    missing.forEach(b => console.error('   - ' + b.searchPlaceholder));
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  for (const b of banners) {
    const res = await HomeBanner.findOneAndUpdate(
      { headerTheme: b.headerTheme, searchPlaceholder: b.searchPlaceholder },
      { $set: b },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    console.log(`✓ ${b.headerTheme.padEnd(9)} (${b.searchPlaceholder}) → priority ${res.priority}`);
  }

  // Keep the anime banner first.
  const bumped = await HomeBanner.updateMany(
    { headerTheme: 'anime' },
    { $set: { priority: 40 } }
  );
  console.log(`✓ anime banner(s) bumped to priority 40 (${bumped.modifiedCount} updated)`);

  await mongoose.disconnect();
  console.log('✓ Done. Reload the homepage to see all four slides.');
}

run().catch(async (err) => {
  console.error('✗ Seed failed:', err.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
