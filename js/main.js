/**
 * Application Entry Point & Orchestrator
 * Coordinates state, DOM rendering, network actions, accessibility combobox controls,
 * geolocation, offline monitoring, URL synchronization, and dynamic theming.
 */

import { CONFIG } from './config.js';
import {
  findCity,
  getWeather,
  reverseGeocode,
  searchCities,
} from './api.js';
import { store } from './state.js';
import {
  addRecentSearch,
  clearRecentSearches,
  getCachedWeather,
  getLastCity,
  getRecentSearches,
  getThemePreference,
  saveLastCity,
  saveThemePreference,
  setCachedWeather,
} from './storage.js';
import {
  celsiusToFahrenheit,
  debounce,
  formatTemperature,
  kmhToMph,
  validateCity,
} from './utils.js';
import { getWeatherInterpretation, getSupportedWmoCodes } from './weatherCodes.js';
import { ambienceEngine } from './ambience.js';
import {
  announceToScreenReader,
  renderCurrentWeather,
  renderEmpty,
  renderError,
  renderForecast,
  renderHourlyForecast,
  renderRecentSearches,
  renderSkeleton,
  renderSmartAdvisory,
  renderSuggestions,
  renderToast,
} from './render.js';

/* =====================================================================
   DOM ELEMENT REFERENCES
   ===================================================================== */

const elements = {
  root: document.documentElement,
  searchForm: document.getElementById('search-form'),
  searchInput: document.getElementById('search-input'),
  searchBtn: document.getElementById('search-submit-btn'),
  inputError: document.getElementById('input-error'),
  suggestionsList: document.getElementById('suggestions-list'),
  locationBtn: document.getElementById('location-btn'),
  recentSearchesContainer: document.getElementById('recent-searches'),
  unitMetricBtn: document.getElementById('unit-metric-btn'),
  unitImperialBtn: document.getElementById('unit-imperial-btn'),
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  ambienceToggleBtn: document.getElementById('ambience-toggle-btn'),
  ambienceCanvas: document.getElementById('ambience-canvas'),
  weatherContent: document.getElementById('weather-content'),
  offlineBanner: document.getElementById('offline-banner'),
  statusAnnouncer: document.getElementById('status-announcer'),
};

// Tracks active combobox suggestion navigation index
let activeSuggestionIndex = -1;
let currentSuggestions = [];

/* =====================================================================
   DYNAMIC THEME APPLIER
   ===================================================================== */

/**
 * Updates application theme class based on active weather conditions and day/night.
 * 
 * @param {number} weatherCode - WMO weather code
 * @param {number} isDay - 1 for day, 0 for night
 */
function applyWeatherTheme(weatherCode, isDay = 1) {
  const interp = getWeatherInterpretation(weatherCode, isDay);
  elements.root.setAttribute('data-weather-theme', interp.themeKey);

  // Sync living weather particle ambience
  ambienceEngine.setWeatherCondition(weatherCode, isDay);

  // Sync meta theme-color for mobile address bars
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    const isNight = isDay === 0;
    metaThemeColor.setAttribute('content', isNight ? '#0b1329' : '#1e3a8a');
  }
}

/* =====================================================================
   CORE DATA FETCHING & ORCHESTRATION
   ===================================================================== */

/**
 * Loads weather for a resolved city object.
 * Checks cache first (10 min TTL), otherwise initiates network fetch.
 * 
 * @param {Object} city - City metadata { name, lat, lon, country, admin1, timezone }
 * @param {boolean} [forceRefresh=false] - Bypasses cache if true
 */
async function loadCityWeather(city, forceRefresh = false) {
  if (!city || typeof city.lat !== 'number' || typeof city.lon !== 'number') {
    return;
  }

  // Check 10-minute cache if not forced
  if (!forceRefresh) {
    const cached = getCachedWeather(city.lat, city.lon);
    if (cached) {
      store.setSuccess(city, cached.data, cached.timestamp);
      saveLastCity(city);
      addRecentSearch(city);
      updateUrlParameter(city.name);
      announceToScreenReader(`Showing cached weather for ${city.name}, ${city.country || ''}`);
      return;
    }
  }

  // Acquire new abort signal and transition UI state to 'loading'
  const signal = store.beginRequest();
  announceToScreenReader(`Loading weather for ${city.name}...`);

  try {
    const weatherPayload = await getWeather(city.lat, city.lon, city.timezone, signal);

    // Save to cache and update state
    setCachedWeather(city.lat, city.lon, weatherPayload);
    store.setSuccess(city, weatherPayload);
    saveLastCity(city);
    addRecentSearch(city);
    updateUrlParameter(city.name);

    announceToScreenReader(
      `Showing current weather for ${city.name}, ${city.country || ''}. Temperature is ${Math.round(
        weatherPayload.current.temperature_2m
      )} degrees.`
    );
  } catch (err) {
    if (signal.aborted) {
      // Ignored if superseded by a newer request
      return;
    }
    store.setError(err);
    announceToScreenReader(`Error: ${err.message}`);
  }
}

/**
 * Searches for a city name and loads its weather.
 * 
 * @param {string} cityName - Query string
 */
async function handleCitySearch(cityName) {
  const validation = validateCity(cityName);
  if (!validation.isValid) {
    showInputError(validation.error);
    return;
  }
  clearInputError();
  closeSuggestions();

  const signal = store.beginRequest();
  announceToScreenReader(`Searching for ${validation.normalized}...`);

  try {
    const city = await findCity(validation.normalized, signal);
    await loadCityWeather(city);
  } catch (err) {
    if (signal.aborted) return;
    store.setError(err);
    announceToScreenReader(`Error: ${err.message}`);
  }
}

/* =====================================================================
   URL SYNCHRONIZATION
   ===================================================================== */

/**
 * Reflects active city in the browser URL query parameter (?city=...)
 * 
 * @param {string} cityName
 */
function updateUrlParameter(cityName) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('city', cityName);
    window.history.replaceState({ city: cityName }, '', url.toString());
  } catch {
    // History API might be restricted in some sandbox iframes
  }
}

/**
 * Reads city from initial URL parameters if present.
 * 
 * @returns {string|null}
 */
function getCityFromUrl() {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get('city');
  } catch {
    return null;
  }
}

/* =====================================================================
   INPUT VALIDATION & INLINE ERROR UI
   ===================================================================== */

function showInputError(message) {
  elements.inputError.textContent = message;
  elements.inputError.hidden = false;
  elements.searchInput.setAttribute('aria-invalid', 'true');
  elements.searchInput.focus();
}

function clearInputError() {
  elements.inputError.textContent = '';
  elements.inputError.hidden = true;
  elements.searchInput.setAttribute('aria-invalid', 'false');
}

/* =====================================================================
   AUTOCOMPLETE COMBOBOX & KEYBOARD NAVIGATION
   ===================================================================== */

/**
 * Debounced search function triggered on typing in the search input.
 */
const debouncedAutocomplete = debounce(async (query) => {
  if (query.trim().length < 2) {
    closeSuggestions();
    return;
  }

  try {
    const results = await searchCities(query);
    currentSuggestions = results;
    activeSuggestionIndex = -1;

    if (results.length > 0) {
      renderSuggestions(elements.suggestionsList, results, (selectedCity) => {
        elements.searchInput.value = selectedCity.name;
        clearInputError();
        closeSuggestions();
        loadCityWeather(selectedCity);
      });
      elements.searchInput.setAttribute('aria-expanded', 'true');
    } else {
      closeSuggestions();
    }
  } catch {
    closeSuggestions();
  }
}, CONFIG.TIMING.DEBOUNCE_MS);

function closeSuggestions() {
  currentSuggestions = [];
  activeSuggestionIndex = -1;
  elements.suggestionsList.textContent = '';
  elements.suggestionsList.hidden = true;
  elements.searchInput.setAttribute('aria-expanded', 'false');
  elements.searchInput.removeAttribute('aria-activedescendant');
}

function updateActiveSuggestion(index) {
  const options = elements.suggestionsList.querySelectorAll('[role="option"]');
  options.forEach((opt, idx) => {
    const isSelected = idx === index;
    opt.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    opt.classList.toggle('suggestion-active', isSelected);
    if (isSelected) {
      elements.searchInput.setAttribute('aria-activedescendant', opt.id);
      opt.scrollIntoView({ block: 'nearest' });
    }
  });

  if (index === -1) {
    elements.searchInput.removeAttribute('aria-activedescendant');
  }
}

/* =====================================================================
   EVENT WIREUP
   ===================================================================== */

function initEventListeners() {
  // 1. Search Form Submission
  elements.searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    debouncedAutocomplete.cancel();

    // If an item was actively highlighted in suggestions via arrow keys, select it
    if (activeSuggestionIndex >= 0 && currentSuggestions[activeSuggestionIndex]) {
      const selected = currentSuggestions[activeSuggestionIndex];
      elements.searchInput.value = selected.name;
      closeSuggestions();
      loadCityWeather(selected);
      return;
    }

    handleCitySearch(elements.searchInput.value);
  });

  // 2. Input typing for Autocomplete
  elements.searchInput.addEventListener('input', (e) => {
    clearInputError();
    debouncedAutocomplete(e.target.value);
  });

  // 3. Combobox Keyboard Navigation
  elements.searchInput.addEventListener('keydown', (e) => {
    if (elements.suggestionsList.hidden || currentSuggestions.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex + 1) % currentSuggestions.length;
      updateActiveSuggestion(activeSuggestionIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeSuggestionIndex =
        activeSuggestionIndex <= 0 ? currentSuggestions.length - 1 : activeSuggestionIndex - 1;
      updateActiveSuggestion(activeSuggestionIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSuggestions();
    }
  });

  // 4. Click outside to dismiss suggestions
  document.addEventListener('click', (e) => {
    if (!elements.searchForm.contains(e.target)) {
      closeSuggestions();
    }
  });

  // 5. Geolocation Button
  elements.locationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      store.setError(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    elements.locationBtn.classList.add('loading-pulse');
    announceToScreenReader('Requesting current location...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        elements.locationBtn.classList.remove('loading-pulse');
        const { latitude, longitude } = position.coords;
        try {
          const locationInfo = await reverseGeocode(latitude, longitude);
          loadCityWeather(locationInfo);
        } catch {
          loadCityWeather({
            name: 'My Location',
            lat: latitude,
            lon: longitude,
            timezone: 'auto',
          });
        }
      },
      (geoError) => {
        elements.locationBtn.classList.remove('loading-pulse');
        let msg = 'Unable to retrieve your location.';
        if (geoError.code === geoError.PERMISSION_DENIED) {
          msg = 'Location access was denied. Please search for your city name instead.';
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          msg = 'Location information is currently unavailable.';
        } else if (geoError.code === geoError.TIMEOUT) {
          msg = 'Location request timed out. Please try again.';
        }
        store.setError(new Error(msg));
        announceToScreenReader(msg);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  });

  // 6. Units Toggle
  elements.unitMetricBtn.addEventListener('click', () => {
    store.setUnit(CONFIG.UNITS.CELSIUS);
  });

  elements.unitImperialBtn.addEventListener('click', () => {
    store.setUnit(CONFIG.UNITS.FAHRENHEIT);
  });

  // 7. Manual Light / Dark Theme Toggle
  elements.themeToggleBtn.addEventListener('click', () => {
    const currentTheme = elements.root.getAttribute('data-color-scheme') || 'auto';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    elements.root.setAttribute('data-color-scheme', nextTheme);
    saveThemePreference(nextTheme);
    elements.themeToggleBtn.setAttribute(
      'aria-label',
      `Switch to ${nextTheme === 'dark' ? 'light' : 'dark'} mode`
    );
  });

  // 8. Living Weather Ambience Toggle
  if (elements.ambienceToggleBtn) {
    elements.ambienceToggleBtn.classList.toggle('active', ambienceEngine.isEnabled);
    elements.ambienceToggleBtn.addEventListener('click', () => {
      const active = ambienceEngine.toggle();
      elements.ambienceToggleBtn.classList.toggle('active', active);
      elements.ambienceToggleBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
      renderToast(`Living weather ambience ${active ? 'enabled' : 'disabled'}`, 'info');
    });
  }

  // 9. Offline & Online Network Awareness
  window.addEventListener('offline', () => {
    elements.offlineBanner.hidden = false;
    announceToScreenReader('You are currently offline. Displaying cached data if available.');
  });

  window.addEventListener('online', () => {
    elements.offlineBanner.hidden = true;
    announceToScreenReader('Internet connection restored.');
    // If currently displaying an error or stale data, refresh automatically
    if (store.status === 'error' && store.activeCity) {
      loadCityWeather(store.activeCity, true);
    }
  });

  // Initialize banner visibility based on browser online status
  elements.offlineBanner.hidden = (navigator.onLine !== false);
}

/* =====================================================================
   REACTIVE STATE SUBSCRIPTION
   ===================================================================== */

function initStoreSubscription() {
  store.subscribe((state) => {
    // 1. Sync Search Controls Loading State & Busy Attributes
    const isLoading = state.status === 'loading';
    elements.searchBtn.disabled = isLoading;
    elements.searchInput.disabled = isLoading;
    elements.locationBtn.disabled = isLoading;
    elements.weatherContent.setAttribute('aria-busy', isLoading ? 'true' : 'false');

    // 2. Sync Unit Button ARIA States
    const isMetric = state.unit === CONFIG.UNITS.CELSIUS;
    elements.unitMetricBtn.setAttribute('aria-pressed', isMetric ? 'true' : 'false');
    elements.unitMetricBtn.classList.toggle('active', isMetric);
    elements.unitImperialBtn.setAttribute('aria-pressed', !isMetric ? 'true' : 'false');
    elements.unitImperialBtn.classList.toggle('active', !isMetric);

    // 3. Render State in Weather Content
    if (state.status === 'loading') {
      renderSkeleton(elements.weatherContent);
      return;
    }

    if (state.status === 'error') {
      renderError(elements.weatherContent, state.lastError || new Error('Unknown error'), () => {
        if (state.activeCity) {
          loadCityWeather(state.activeCity, true);
        } else {
          handleCitySearch(elements.searchInput.value || CONFIG.DEFAULT_CITY.name);
        }
      });
      return;
    }

    if (state.status === 'empty') {
      renderEmpty(elements.weatherContent);
      return;
    }

    if (state.status === 'success' && state.activeCity && state.weatherData) {
      elements.weatherContent.textContent = '';

      // Update condition-based background theme and particle ambience
      applyWeatherTheme(state.weatherData.current.weather_code, state.weatherData.current.is_day ?? 1);

      const dashboardWrapper = document.createElement('div');
      dashboardWrapper.className = 'dashboard-layout fade-in';

      // 1. Current Conditions Hero Card (includes Solar Arc and Share action)
      const hero = renderCurrentWeather(
        dashboardWrapper,
        state.activeCity,
        state.weatherData,
        state.unit,
        state.lastUpdatedTimestamp,
        () => loadCityWeather(state.activeCity, true),
        () => handleShareWeather(state.activeCity, state.weatherData, state.unit)
      );
      dashboardWrapper.appendChild(hero);

      // 2. Next 24-Hour Forecast Timeline
      if (state.weatherData.hourly) {
        const hourlyCard = renderHourlyForecast(
          state.weatherData.hourly,
          state.weatherData.current.time,
          state.activeCity.timezone,
          state.unit
        );
        dashboardWrapper.appendChild(hourlyCard);
      }

      // 3. Smart Weather Insights & Lifestyle Advisory
      const advisoryCard = renderSmartAdvisory(
        state.weatherData.current,
        state.weatherData.hourly,
        state.weatherData.daily,
        state.activeCity.timezone
      );
      dashboardWrapper.appendChild(advisoryCard);

      // 4. 5-Day Forecast
      const forecast = renderForecast(state.weatherData.daily, state.unit);
      dashboardWrapper.appendChild(forecast);

      elements.weatherContent.appendChild(dashboardWrapper);

      // Update Recent Searches Chips
      refreshRecentSearchesUI();
    }
  });
}

/**
 * Generates an aesthetic text briefing and copies it to clipboard.
 * 
 * @param {Object} city
 * @param {Object} weather
 * @param {'metric'|'imperial'} unit
 */
async function handleShareWeather(city, weather, unit) {
  const current = weather.current;
  const daily = weather.daily;
  const isDay = current.is_day ?? 1;
  const interp = getWeatherInterpretation(current.weather_code, isDay);
  const tempStr = formatTemperature(current.temperature_2m, unit);
  const feelsStr = formatTemperature(current.apparent_temperature, unit);
  const maxStr = formatTemperature(daily.temperature_2m_max?.[0] ?? current.temperature_2m, unit);
  const minStr = formatTemperature(daily.temperature_2m_min?.[0] ?? current.temperature_2m, unit);
  const rain = daily.precipitation_probability_max?.[0] ?? 0;

  const summary = `🌤️ AeroCast Weather Report • ${city.name}, ${city.country || ''}\n` +
    `• Condition: ${interp.label}\n` +
    `• Temperature: ${tempStr} (Feels like ${feelsStr})\n` +
    `• Today's Range: High ${maxStr} / Low ${minStr}\n` +
    `• Rain Likelihood: ${rain}%\n` +
    `• View live forecast: ${window.location.href}`;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(summary);
      renderToast('Weather summary copied to clipboard!', 'success');
    } else {
      window.prompt('Copy your weather briefing:', summary);
    }
  } catch {
    renderToast('Weather briefing ready to share!', 'info');
  }
}

function refreshRecentSearchesUI() {
  const recents = getRecentSearches();
  renderRecentSearches(
    elements.recentSearchesContainer,
    recents,
    (city) => {
      elements.searchInput.value = city.name;
      loadCityWeather(city);
    },
    () => {
      clearRecentSearches();
      refreshRecentSearchesUI();
      announceToScreenReader('Recent search history cleared.');
    }
  );
}

/* =====================================================================
   DEV-MODE SELF-CHECK SUITE
   ===================================================================== */

/**
 * Runs a quiet internal assertion self-test to guarantee weather code mapping,
 * conversion correctness, and validation integrity.
 */
function runSelfCheck() {
  try {
    // 1. Validate WMO Coverage
    const codes = getSupportedWmoCodes();
    for (const code of codes) {
      const interp = getWeatherInterpretation(code, 1);
      if (!interp || !interp.label || !interp.iconKey || !interp.themeKey) {
        console.warn(`[Self-Check] Incomplete WMO code descriptor for code ${code}`);
      }
    }

    // 2. Validate Conversions
    const testC = 0;
    const testF = celsiusToFahrenheit(testC);
    if (testF !== 32) console.warn('[Self-Check] 0°C should equal 32°F');

    const testKmh = 10;
    const testMph = kmhToMph(testKmh);
    if (Math.abs(testMph - 6.2) > 0.1) console.warn('[Self-Check] kmhToMph failed');

    // 3. Validate String Sanitizer
    const valid = validateCity('  San Francisco  ');
    if (!valid.isValid || valid.normalized !== 'San Francisco') {
      console.warn('[Self-Check] validateCity failed on normal string');
    }

    const invalid = validateCity('   ');
    if (invalid.isValid) console.warn('[Self-Check] validateCity allowed empty string');
  } catch (err) {
    console.warn('[Self-Check] Verification encounter:', err);
  }
}

/* =====================================================================
   BOOTSTRAP
   ===================================================================== */

function initApp() {
  // Apply saved color scheme preference if set
  const savedScheme = getThemePreference();
  if (savedScheme && savedScheme !== 'auto') {
    elements.root.setAttribute('data-color-scheme', savedScheme);
  }

  // Initialize living weather ambience engine
  if (elements.ambienceCanvas) {
    ambienceEngine.init(elements.ambienceCanvas);
  }

  initEventListeners();
  initStoreSubscription();
  refreshRecentSearchesUI();
  runSelfCheck();

  // Determine initial city: URL query param -> Last searched city -> Default City (Bengaluru)
  const urlCity = getCityFromUrl();
  if (urlCity) {
    elements.searchInput.value = urlCity;
    handleCitySearch(urlCity);
    return;
  }

  const lastCity = getLastCity();
  if (lastCity) {
    elements.searchInput.value = lastCity.name;
    loadCityWeather(lastCity);
    return;
  }

  // Fallback to sensible default
  elements.searchInput.value = CONFIG.DEFAULT_CITY.name;
  loadCityWeather(CONFIG.DEFAULT_CITY);
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
