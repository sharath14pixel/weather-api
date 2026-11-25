/**
 * Application Configuration & Constants
 * Single source of truth for endpoints, limits, timeouts, and default fallbacks.
 */

export const CONFIG = Object.freeze({
  APP_NAME: 'AeroCast Weather',
  DEFAULT_CITY: Object.freeze({
    name: 'Bengaluru',
    country: 'India',
    admin1: 'Karnataka',
    lat: 12.9716,
    lon: 77.5946,
    timezone: 'Asia/Kolkata',
  }),

  // API Endpoints
  API: Object.freeze({
    GEOCODING_URL: 'https://geocoding-api.open-meteo.com/v1/search',
    FORECAST_URL: 'https://api.open-meteo.com/v1/forecast',
  }),

  // Query & Interaction Limits
  LIMITS: Object.freeze({
    MAX_INPUT_LENGTH: 80,
    SUGGESTION_COUNT: 5,
    FORECAST_DAYS: 5,
    MAX_RECENT_SEARCHES: 5,
  }),

  // Timing and Retries (in milliseconds)
  TIMING: Object.freeze({
    DEBOUNCE_MS: 380,
    FETCH_TIMEOUT_MS: 8000,
    RETRY_DELAY_MS: 1200,
    CACHE_TTL_MS: 10 * 60 * 1000, // 10 minutes
    TOAST_DURATION_MS: 4000,
  }),

  // Storage Keys
  STORAGE_KEYS: Object.freeze({
    LAST_CITY: 'aerocast_last_city_v1',
    RECENT_SEARCHES: 'aerocast_recent_searches_v1',
    UNIT_PREFERENCE: 'aerocast_unit_pref_v1',
    THEME_PREFERENCE: 'aerocast_theme_pref_v1',
    CACHE_PREFIX: 'aerocast_cache_v1_',
  }),

  // Supported Units
  UNITS: Object.freeze({
    CELSIUS: 'metric',    // °C, km/h
    FAHRENHEIT: 'imperial' // °F, mph
  }),
});
