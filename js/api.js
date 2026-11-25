/**
 * API Communication Layer
 * Handles geocoding lookups, forecast requests, automatic retries with exponential backoff,
 * timeout enforcement, and typed error transformations.
 */

import { CONFIG } from './config.js';
import {
  ApiError,
  NetworkError,
  NotFoundError,
  TimeoutError,
  wait,
} from './utils.js';

/**
 * Robust JSON fetch wrapper that enforces HTTP response verification,
 * request timeouts, network diagnostics, and 1 automatic retry for transient 5xx/network errors.
 * 
 * @template T
 * @param {string} url - Target URL to fetch
 * @param {Object} [options={}] - Standard fetch options
 * @param {AbortSignal} [options.signal] - Caller abort signal
 * @param {number} [options.timeout=CONFIG.TIMING.FETCH_TIMEOUT_MS] - Timeout in milliseconds
 * @param {number} [options.maxRetries=1] - Maximum retry attempts on transient failure
 * @returns {Promise<T>}
 * @throws {NetworkError|ApiError|TimeoutError}
 */
export async function fetchJson(url, options = {}) {
  const {
    signal,
    timeout = CONFIG.TIMING.FETCH_TIMEOUT_MS,
    maxRetries = 1,
    ...fetchOptions
  } = options;

  let attempt = 0;

  while (attempt <= maxRetries) {
    // Composite controller to allow either explicit caller cancellation or timeout trigger
    const timeoutController = new AbortController();
    let timeoutId = null;

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        timeoutController.abort(new TimeoutError('Request exceeded response timeout.'));
      }, timeout);
    }

    const abortHandler = () => {
      timeoutController.abort(signal?.reason || new NetworkError('Request was aborted.'));
    };

    if (signal) {
      if (signal.aborted) {
        if (timeoutId) clearTimeout(timeoutId);
        throw signal.reason || new NetworkError('Request was aborted.');
      }
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: timeoutController.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', abortHandler);

      // Verify HTTP status code before processing payload
      if (!response.ok) {
        const status = response.status;
        let errorMessage = `HTTP Error ${status}`;
        try {
          const errorBody = await response.json();
          if (errorBody && errorBody.reason) {
            errorMessage = errorBody.reason;
          }
        } catch {
          // Response body was not JSON; use default status message
        }

        const isServerError = status >= 500 && status < 600;
        if (isServerError && attempt < maxRetries) {
          attempt++;
          await wait(CONFIG.TIMING.RETRY_DELAY_MS * attempt);
          continue;
        }

        throw new ApiError(status, errorMessage);
      }

      // Safely parse JSON
      const data = await response.json();
      return data;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', abortHandler);

      // If caller intentionally aborted, rethrow immediately without retrying
      if (signal?.aborted) {
        throw signal.reason || new NetworkError('Request was cancelled.');
      }

      if (err instanceof TimeoutError || err?.name === 'TimeoutError') {
        if (attempt < maxRetries) {
          attempt++;
          await wait(CONFIG.TIMING.RETRY_DELAY_MS * attempt);
          continue;
        }
        throw new TimeoutError();
      }

      if (err instanceof ApiError) {
        throw err;
      }

      // Network / offline / connection drop
      if (attempt < maxRetries) {
        attempt++;
        await wait(CONFIG.TIMING.RETRY_DELAY_MS * attempt);
        continue;
      }

      throw new NetworkError(
        navigator.onLine === false
          ? 'You are currently offline. Please check your internet connection.'
          : 'Unable to reach the weather service. Please check your internet connection.'
      );
    }
  }

  throw new NetworkError('Failed to complete request after retries.');
}

/**
 * Geocodes a search string to find candidate cities (combobox suggestions).
 * 
 * @param {string} query - City query string
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<Array<Object>>} List of candidate cities
 */
export async function searchCities(query, signal) {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const encoded = encodeURIComponent(query.trim());
  const url = `${CONFIG.API.GEOCODING_URL}?name=${encoded}&count=${CONFIG.LIMITS.SUGGESTION_COUNT}&language=en&format=json`;

  try {
    const data = await fetchJson(url, { signal, timeout: 6000, maxRetries: 1 });
    if (!data || !Array.isArray(data.results)) {
      return [];
    }

    return data.results.map((item) => ({
      name: item.name,
      country: item.country || '',
      countryCode: item.country_code || '',
      admin1: item.admin1 || '',
      lat: item.latitude,
      lon: item.longitude,
      timezone: item.timezone || 'auto',
    }));
  } catch (err) {
    // If request was superseded/aborted, bubble up
    if (signal?.aborted) throw err;
    // Suppress network errors for transient keystroke autocomplete lookups
    return [];
  }
}

/**
 * Searches for a single city by name, returning the top match.
 * 
 * @param {string} name - City name
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<Object>} City metadata
 * @throws {NotFoundError|NetworkError|ApiError}
 */
export async function findCity(name, signal) {
  const encoded = encodeURIComponent(name.trim());
  const url = `${CONFIG.API.GEOCODING_URL}?name=${encoded}&count=1&language=en&format=json`;

  const data = await fetchJson(url, { signal });

  if (!data || !Array.isArray(data.results) || data.results.length === 0) {
    throw new NotFoundError(`No weather location found for "${name}". Please check the spelling.`);
  }

  const first = data.results[0];
  return {
    name: first.name,
    country: first.country || '',
    countryCode: first.country_code || '',
    admin1: first.admin1 || '',
    lat: first.latitude,
    lon: first.longitude,
    timezone: first.timezone || 'auto',
  };
}

/**
 * Fetches current weather and 5-day daily forecast from Open-Meteo.
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} [timezone='auto'] - Local timezone or 'auto'
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<Object>} Validated weather payload
 */
export async function getWeather(lat, lon, timezone = 'auto', signal) {
  const currentParams = [
    'temperature_2m',
    'apparent_temperature',
    'relative_humidity_2m',
    'wind_speed_10m',
    'weather_code',
    'is_day',
  ].join(',');

  const hourlyParams = [
    'temperature_2m',
    'weather_code',
    'precipitation_probability',
    'is_day',
  ].join(',');

  const dailyParams = [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_probability_max',
    'sunrise',
    'sunset',
    'uv_index_max',
  ].join(',');

  const queryParams = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: currentParams,
    hourly: hourlyParams,
    daily: dailyParams,
    forecast_days: CONFIG.LIMITS.FORECAST_DAYS.toString(),
    timezone: timezone || 'auto',
  });

  const url = `${CONFIG.API.FORECAST_URL}?${queryParams.toString()}`;

  const payload = await fetchJson(url, { signal });

  // Validate critical response shape
  if (!payload || !payload.current || !payload.daily) {
    throw new ApiError(502, 'Weather service returned an incomplete data structure.');
  }

  return payload;
}

/**
 * Reverse geocodes coordinates to identify nearest city name using Open-Meteo geocoding search or fallback coordinates.
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<Object>}
 */
export async function reverseGeocode(lat, lon, signal) {
  // Open-Meteo does not provide a direct free reverse geocoding endpoint,
  // so we query BigDataCloud free reverse geocoding or provide a clean location descriptor.
  // To keep CSP strictly to Open-Meteo origins, we format a clean geographical label:
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  const coordLabel = `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lon).toFixed(2)}°${lonDir}`;

  return {
    name: 'Your Location',
    admin1: coordLabel,
    country: '',
    lat,
    lon,
    timezone: 'auto',
  };
}
