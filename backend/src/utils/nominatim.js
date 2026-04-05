const axios = require('axios');

/**
 * Reverse geocode a lat/lng using Nominatim.
 * Returns { wardName, city, raw } — wardName/city may be null if not found.
 */
async function resolveWard(lat, lng) {
  try {
    const { data } = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: { lat, lon: lng, format: 'json', addressdetails: 1 },
      headers: { 'User-Agent': 'UrbanLens/1.0 (urbanlens@example.com)', 'Accept-Language': 'en' },
      timeout: 8000
    });

    const addr = data.address || {};

    // Log raw address so we can debug what fields Nominatim returns
    console.log('[Nominatim] raw address:', JSON.stringify(addr, null, 2));

    // Ward name: try every possible field Nominatim returns for Indian localities
    const wardName =
      addr.quarter        ||
      addr.suburb         ||
      addr.neighbourhood  ||
      addr.residential    ||
      addr.hamlet         ||
      addr.village        ||
      addr.town           ||
      addr.road           ||
      addr.city           ||  // fallback to city if no finer grain available
      addr.city_district  ||
      addr.district       ||
      addr.county         ||
      addr.state_district ||
      null;

    // City: prefer city → city_district → district → county → state_district
    const city =
      addr.city           ||
      addr.city_district  ||
      addr.district       ||
      addr.county         ||
      addr.state_district ||
      addr.state          ||
      null;

    return { wardName, city, raw: addr };
  } catch (err) {
    console.error('[Nominatim] error:', err.message);
    return { wardName: null, city: null, raw: {} };
  }
}

module.exports = { resolveWard };
