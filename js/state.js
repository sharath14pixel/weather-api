/**
 * State Management & UI State Machine
 * Centralizes application state: idle, loading, success, empty, error.
 * Manages active AbortController to guarantee race-condition freedom.
 */

import { CONFIG } from './config.js';
import { getUnitPreference, saveUnitPreference } from './storage.js';

/**
 * @typedef {'idle' | 'loading' | 'success' | 'empty' | 'error'} UIState
 */

class WeatherStore {
  constructor() {
    /** @type {UIState} */
    this.status = 'idle';

    /** @type {Object|null} */
    this.activeCity = null;

    /** @type {Object|null} */
    this.weatherData = null;

    /** @type {Error|null} */
    this.lastError = null;

    /** @type {'metric'|'imperial'} */
    this.unit = getUnitPreference();

    /** @type {number|null} */
    this.lastUpdatedTimestamp = null;

    /** @type {AbortController|null} */
    this._activeController = null;

    /** @type {Set<(state: WeatherStore) => void>} */
    this._subscribers = new Set();
  }

  /**
   * Subscribes a listener to store state updates.
   * 
   * @param {(state: WeatherStore) => void} listener
   * @returns {() => void} Unsubscribe function
   */
  subscribe(listener) {
    this._subscribers.add(listener);
    return () => this._subscribers.delete(listener);
  }

  /**
   * Notifies all subscribers of state mutation.
   */
  _notify() {
    for (const listener of this._subscribers) {
      try {
        listener(this);
      } catch (err) {
        console.error('State subscriber error:', err);
      }
    }
  }

  /**
   * Begins a new network operation, aborting any prior in-flight request.
   * 
   * @returns {AbortSignal} Fresh abort signal for the new request
   */
  beginRequest() {
    if (this._activeController) {
      this._activeController.abort('Superseded by a newer request');
    }
    this._activeController = new AbortController();
    this.status = 'loading';
    this.lastError = null;
    this._notify();
    return this._activeController.signal;
  }

  /**
   * Cancels in-flight requests without modifying current visible data.
   */
  cancelRequest() {
    if (this._activeController) {
      this._activeController.abort('Operation cancelled by user');
      this._activeController = null;
    }
  }

  /**
   * Sets the store to the success state with fresh weather data.
   * 
   * @param {Object} city - Resolved city object
   * @param {Object} weather - Forecast payload
   * @param {number} [timestamp=Date.now()] - Timestamp
   */
  setSuccess(city, weather, timestamp = Date.now()) {
    this._activeController = null;
    this.status = 'success';
    this.activeCity = city;
    this.weatherData = weather;
    this.lastError = null;
    this.lastUpdatedTimestamp = timestamp;
    this._notify();
  }

  /**
   * Sets the store to the error state.
   * 
   * @param {Error} error - Error instance
   */
  setError(error) {
    this._activeController = null;
    this.status = 'error';
    this.lastError = error;
    this._notify();
  }

  /**
   * Sets the store to empty state.
   */
  setEmpty() {
    this.cancelRequest();
    this.status = 'empty';
    this.activeCity = null;
    this.weatherData = null;
    this.lastError = null;
    this._notify();
  }

  /**
   * Toggles or sets unit preference ('metric' | 'imperial').
   * Converts existing data client-side with zero network refetch.
   * 
   * @param {'metric'|'imperial'} [newUnit]
   */
  setUnit(newUnit) {
    const targetUnit = newUnit || (this.unit === CONFIG.UNITS.CELSIUS ? CONFIG.UNITS.FAHRENHEIT : CONFIG.UNITS.CELSIUS);
    if (this.unit === targetUnit) return;

    this.unit = targetUnit;
    saveUnitPreference(targetUnit);
    this._notify();
  }
}

export const store = new WeatherStore();
