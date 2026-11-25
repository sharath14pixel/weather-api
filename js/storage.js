/**
 * Storage Layer with Graceful Fallbacks
 * Safely wraps localStorage and sessionStorage with try/catch to protect
 * against disabled storage, private browsing restrictions, and quota limits.
 */

import { CONFIG } from './config.js';

// In-memory fallback dictionary if browser storage APIs are blocked
const memoryStorage = new Map();

/**
 * Tests whether localStorage is accessible and writable.
 * 
 * @returns {boolean}
 */
function isStorageAvailable() {
  try {
    const testKey = '__aerocast_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const storageSupported = isStorageAvailable();

/* =====================================================================
   GENERIC STORAGE ACCESSORS
   ===================================================================== */

/**
 * Safely reads a value from storage.
 * 
 * @template T
 * @param {string} key - Storage key
 * @param {T} fallback - Fallback value if missing or unreadable
 * @returns {T}
 */
export function getStoredItem(key, fallback) {
  try {
    if (storageSupported) {
      const item = window.localStorage.getItem(key);
      if (item === null) return fallback;
      return JSON.parse(item);
    }
    if (memoryStorage.has(key)) {
      return memoryStorage.get(key);
    }
  } catch {
    // JSON parse error or access restriction
  }
  return fallback;
}

/**
 * Safely writes a value to storage.
 * 
 * @param {string} key - Storage key
 * @param {any} value - Value to serialize and store
 * @returns {boolean} Success status
 */
export function setStoredItem(key, value) {
  try {
    if (storageSupported) {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    }
    memoryStorage.set(key, value);
    return true;
  } catch {
    // Quota exceeded or private browsing block
    memoryStorage.set(key, value);
    return false;
  }
}

/**
 * Safely removes a key from storage.
 * 
 * @param {string} key - Storage key
 */
export function removeStoredItem(key) {
  try {
    if (storageSupported) {
      window.localStorage.removeItem(key);
    }
    memoryStorage.delete(key);
  } catch {
    // Ignore cleanup errors
  }
}

/* =====================================================================
   DOMAIN SPECIFIC HELPERS
   ===================================================================== */

/**
 * Retrieves the last active city object.
 * 
 * @returns {Object|null}
 */
export function getLastCity() {
  return getStoredItem(CONFIG.STORAGE_KEYS.LAST_CITY, null);
}

/**
 * Saves the last active city.
 * 
 * @param {Object} city - City details { name, lat, lon, country, admin1, timezone }
 */
export function saveLastCity(city) {
  if (!city || typeof city.lat !== 'number' || typeof city.lon !== 'number') return;
  setStoredItem(CONFIG.STORAGE_KEYS.LAST_CITY, city);
}

/**
 * Retrieves the recent search history (up to 5 items).
 * 
 * @returns {Array<Object>}
 */
export function getRecentSearches() {
  const recents = getStoredItem(CONFIG.STORAGE_KEYS.RECENT_SEARCHES, []);
  return Array.isArray(recents) ? recents : [];
}

/**
 * Adds a city to the recent searches list, deduping by coordinates.
 * 
 * @param {Object} city - City object
 */
export function addRecentSearch(city) {
  if (!city || !city.name || typeof city.lat !== 'number') return;
  const current = getRecentSearches();

  // Deduplicate by approx lat/lon or city name + country
  const filtered = current.filter((item) => {
    const sameCoords = Math.abs(item.lat - city.lat) < 0.05 && Math.abs(item.lon - city.lon) < 0.05;
    const sameName = item.name.toLowerCase() === city.name.toLowerCase() && item.country === city.country;
    return !sameCoords && !sameName;
  });

  const updated = [city, ...filtered].slice(0, CONFIG.LIMITS.MAX_RECENT_SEARCHES);
  setStoredItem(CONFIG.STORAGE_KEYS.RECENT_SEARCHES, updated);
}

/**
 * Clears all recent searches from storage.
 */
export function clearRecentSearches() {
  removeStoredItem(CONFIG.STORAGE_KEYS.RECENT_SEARCHES);
}

/**
 * Gets unit preference ('metric' | 'imperial').
 * 
 * @returns {'metric'|'imperial'}
 */
export function getUnitPreference() {
  return getStoredItem(CONFIG.STORAGE_KEYS.UNIT_PREFERENCE, CONFIG.UNITS.CELSIUS);
}

/**
 * Stores unit preference.
 * 
 * @param {'metric'|'imperial'} unit
 */
export function saveUnitPreference(unit) {
  setStoredItem(CONFIG.STORAGE_KEYS.UNIT_PREFERENCE, unit);
}

/**
 * Gets stored manual theme preference ('auto' | 'light' | 'dark').
 * 
 * @returns {string}
 */
export function getThemePreference() {
  return getStoredItem(CONFIG.STORAGE_KEYS.THEME_PREFERENCE, 'auto');
}

/**
 * Stores theme preference.
 * 
 * @param {string} theme
 */
export function saveThemePreference(theme) {
  setStoredItem(CONFIG.STORAGE_KEYS.THEME_PREFERENCE, theme);
}

/* =====================================================================
   IN-MEMORY + SESSIONSTORAGE WEATHER CACHE (10-minute TTL)
   ===================================================================== */

/**
 * Constructs a normalized coordinate cache key.
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {string}
 */
function buildCacheKey(lat, lon) {
  return `${CONFIG.STORAGE_KEYS.CACHE_PREFIX}${Number(lat).toFixed(3)}_${Number(lon).toFixed(3)}`;
}

/**
 * Checks in-memory and sessionStorage for fresh weather data.
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Object|null} Cached weather data or null if expired/missing
 */
export function getCachedWeather(lat, lon) {
  const key = buildCacheKey(lat, lon);
  try {
    let raw = null;
    if (typeof window.sessionStorage !== 'undefined') {
      raw = window.sessionStorage.getItem(key);
    }
    if (!raw && memoryStorage.has(key)) {
      raw = JSON.stringify(memoryStorage.get(key));
    }
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const age = Date.now() - (parsed.timestamp || 0);

    if (age < CONFIG.TIMING.CACHE_TTL_MS) {
      return parsed;
    }
    // Expired
    if (typeof window.sessionStorage !== 'undefined') {
      window.sessionStorage.removeItem(key);
    }
    memoryStorage.delete(key);
  } catch {
    // Ignore cache retrieval errors
  }
  return null;
}

/**
 * Writes fresh weather data to sessionStorage and memory cache.
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Object} data - Forecast data payload
 */
export function setCachedWeather(lat, lon, data) {
  const key = buildCacheKey(lat, lon);
  const cachePayload = {
    timestamp: Date.now(),
    data,
  };

  try {
    memoryStorage.set(key, cachePayload);
    if (typeof window.sessionStorage !== 'undefined') {
      window.sessionStorage.setItem(key, JSON.stringify(cachePayload));
    }
  } catch {
    // Ignore cache write failures
  }
}
