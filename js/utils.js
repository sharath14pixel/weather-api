/**
 * Utility Functions & Custom Typed Error Hierarchy
 * Pure helper functions for formatting, validation, unit conversion, and debouncing.
 */

import { CONFIG } from './config.js';

/* =====================================================================
   TYPED ERROR HIERARCHY
   ===================================================================== */

/**
 * Base Application Error
 */
export class AppError extends Error {
  /**
   * @param {string} message - User-facing or internal error message
   * @param {boolean} [isRetryable=false] - Whether the user can retry this operation
   */
  constructor(message, isRetryable = false) {
    super(message);
    this.name = 'AppError';
    this.isRetryable = isRetryable;
  }
}

/**
 * Thrown when client-side input validation fails
 */
export class ValidationError extends AppError {
  constructor(message) {
    super(message, false);
    this.name = 'ValidationError';
  }
}

/**
 * Thrown when a geocoded city lookup returns no results
 */
export class NotFoundError extends AppError {
  constructor(message = 'City not found. Please verify the spelling and try again.') {
    super(message, false);
    this.name = 'NotFoundError';
  }
}

/**
 * Thrown when network connectivity fails or request is aborted
 */
export class NetworkError extends AppError {
  constructor(message = 'Network connection issue. Please check your internet connection.') {
    super(message, true);
    this.name = 'NetworkError';
  }
}

/**
 * Thrown when API returns an HTTP 4xx or 5xx status
 */
export class ApiError extends AppError {
  /**
   * @param {number} status - HTTP status code
   * @param {string} message - Descriptive error message
   */
  constructor(status, message = 'Weather service encountered an issue.') {
    const retryable = status >= 500;
    super(`${message} (HTTP ${status})`, retryable);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Thrown when an HTTP request exceeds configured timeout
 */
export class TimeoutError extends AppError {
  constructor(message = 'The weather service took too long to respond.') {
    super(message, true);
    this.name = 'TimeoutError';
  }
}

/* =====================================================================
   INPUT VALIDATION & STRING CLEANING
   ===================================================================== */

/**
 * Validates and normalizes user city input.
 * 
 * @param {string} raw - Raw input string
 * @returns {{ isValid: boolean, normalized: string, error?: string }}
 */
export function validateCity(raw) {
  if (typeof raw !== 'string') {
    return { isValid: false, normalized: '', error: 'Input must be a valid text string.' };
  }

  // Collapse consecutive whitespaces and trim
  const trimmed = raw.replace(/\s+/g, ' ').trim();

  if (trimmed.length === 0) {
    return { isValid: false, normalized: '', error: 'Type a city name to search.' };
  }

  if (trimmed.length > CONFIG.LIMITS.MAX_INPUT_LENGTH) {
    return {
      isValid: false,
      normalized: trimmed,
      error: `City name cannot exceed ${CONFIG.LIMITS.MAX_INPUT_LENGTH} characters.`
    };
  }

  // Reject strings made only of numbers and punctuation symbols (must contain at least one letter)
  // Supports international Unicode letters (Latin, Devanagari, Cyrillic, CJK, Arabic, etc.)
  const hasLetterRegex = /\p{L}/u;
  if (!hasLetterRegex.test(trimmed)) {
    return {
      isValid: false,
      normalized: trimmed,
      error: 'Please enter a valid city name containing letters.'
    };
  }

  return { isValid: true, normalized: trimmed };
}

/* =====================================================================
   TIMING & ASYNC UTILITIES
   ===================================================================== */

/**
 * Creates a debounced version of a function with cancellation support.
 * 
 * @template T
 * @param {(...args: any[]) => T} fn - Function to debounce
 * @param {number} delayMs - Milliseconds to delay execution
 * @returns {((...args: any[]) => void) & { cancel: () => void }}
 */
export function debounce(fn, delayMs = CONFIG.TIMING.DEBOUNCE_MS) {
  let timeoutId = null;

  const debounced = function (...args) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn.apply(this, args);
    }, delayMs);
  };

  debounced.cancel = function () {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Promisified delay helper for exponential backoff.
 * 
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* =====================================================================
   UNIT CONVERSION & FORMATTING
   ===================================================================== */

/**
 * Converts Celsius to Fahrenheit.
 * 
 * @param {number} celsius - Temperature in °C
 * @returns {number} Temperature in °F (rounded to 1 decimal place)
 */
export function celsiusToFahrenheit(celsius) {
  if (typeof celsius !== 'number' || Number.isNaN(celsius)) return 0;
  return Math.round(((celsius * 9) / 5 + 32) * 10) / 10;
}

/**
 * Converts km/h to mph.
 * 
 * @param {number} kmh - Wind speed in km/h
 * @returns {number} Wind speed in mph (rounded to 1 decimal place)
 */
export function kmhToMph(kmh) {
  if (typeof kmh !== 'number' || Number.isNaN(kmh)) return 0;
  return Math.round(kmh * 0.621371 * 10) / 10;
}

/**
 * Formats a temperature value according to selected unit preference.
 * 
 * @param {number} celsiusValue - Base temperature in °C
 * @param {'metric'|'imperial'} unit - Selected unit mode
 * @returns {string} E.g., "24°C" or "75°F"
 */
export function formatTemperature(celsiusValue, unit = CONFIG.UNITS.CELSIUS) {
  if (typeof celsiusValue !== 'number' || Number.isNaN(celsiusValue)) {
    return '--';
  }
  const isMetric = unit === CONFIG.UNITS.CELSIUS;
  const temp = isMetric ? Math.round(celsiusValue) : Math.round(celsiusToFahrenheit(celsiusValue));
  return `${temp}°${isMetric ? 'C' : 'F'}`;
}

/**
 * Formats a wind speed value according to selected unit preference.
 * 
 * @param {number} kmhValue - Base wind speed in km/h
 * @param {'metric'|'imperial'} unit - Selected unit mode
 * @returns {string} E.g., "15 km/h" or "9.3 mph"
 */
export function formatWindSpeed(kmhValue, unit = CONFIG.UNITS.CELSIUS) {
  if (typeof kmhValue !== 'number' || Number.isNaN(kmhValue)) {
    return '--';
  }
  const isMetric = unit === CONFIG.UNITS.CELSIUS;
  const speed = isMetric ? Math.round(kmhValue) : kmhToMph(kmhValue);
  return `${speed} ${isMetric ? 'km/h' : 'mph'}`;
}

/* =====================================================================
   DATE & TIME FORMATTING
   ===================================================================== */

/**
 * Formats an ISO date string into a localized day and date (e.g., "Mon, 24 Nov").
 * 
 * @param {string} dateString - "YYYY-MM-DD"
 * @param {string} [timeZone] - IANA Timezone identifier
 * @returns {string}
 */
export function formatDisplayDate(dateString, timeZone = 'UTC') {
  try {
    // Appending T12:00:00 avoids daylight savings/local date drift
    const date = new Date(`${dateString}T12:00:00Z`);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Formats an ISO date string into just the localized short day name (e.g. "Today", "Mon").
 * 
 * @param {string} dateString - "YYYY-MM-DD"
 * @param {boolean} [isToday=false] - Whether this date is the current day
 * @returns {string}
 */
export function formatWeekday(dateString, isToday = false) {
  if (isToday) return 'Today';
  try {
    const date = new Date(`${dateString}T12:00:00Z`);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Formats an ISO datetime string into a 12-hour or 24-hour time string with timezone.
 * 
 * @param {string} isoString - ISO datetime string
 * @param {string} [timeZone='UTC'] - IANA Timezone
 * @returns {string} E.g., "06:14 AM"
 */
export function formatLocalTime(isoString, timeZone = 'UTC') {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timeZone || 'UTC',
    }).format(date);
  } catch {
    return isoString.split('T')[1]?.slice(0, 5) || '--:--';
  }
}

/**
 * Generates relative elapsed time string (e.g. "Just now", "3m ago").
 * 
 * @param {number} timestampMs - Milliseconds timestamp
 * @returns {string}
 */
export function formatRelativeTime(timestampMs) {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour}h ago`;
}
