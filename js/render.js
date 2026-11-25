/**
 * DOM Rendering Engine
 * Strictly constructs all UI elements using document.createElement and textContent.
 * ZERO innerHTML is used with dynamic, API, or user-provided strings.
 * Generates semantic, accessible, SVG-powered components.
 */

import { CONFIG } from './config.js';
import { getWeatherInterpretation } from './weatherCodes.js';
import {
  calculateActivityIndex,
  calculateClothingRecommendation,
  calculateSolarProgress,
  calculateUmbrellaAlert,
  calculateUvAdvisory,
} from './advisory.js';
import {
  formatDisplayDate,
  formatLocalTime,
  formatRelativeTime,
  formatTemperature,
  formatWeekday,
  formatWindSpeed,
} from './utils.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/* =====================================================================
   SVG ICON BUILDER
   ===================================================================== */

/**
 * Creates an inline SVG element referencing the embedded SVG sprite or paths.
 * 
 * @param {string} iconKey - Identifier corresponding to the SVG symbol (e.g., 'sun', 'rain')
 * @param {string} [className='weather-icon'] - CSS classes
 * @param {string} [ariaLabel=''] - Accessible label (empty indicates decorative)
 * @returns {SVGSVGElement}
 */
export function createSvgIcon(iconKey, className = 'weather-icon', ariaLabel = '') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');

  if (ariaLabel) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', ariaLabel);
  } else {
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
  }

  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#icon-${iconKey}`);
  // Also set xlink:href for older browser SVG compatibility
  use.setAttributeNS(XLINK_NS, 'xlink:href', `#icon-${iconKey}`);
  svg.appendChild(use);

  return svg;
}

/* =====================================================================
   ACCESSIBILITY LIVE REGION ANNOUNCER
   ===================================================================== */

/**
 * Announces status changes to screen readers via aria-live.
 * 
 * @param {string} message - Announcement message
 */
export function announceToScreenReader(message) {
  const liveRegion = document.getElementById('status-announcer');
  if (liveRegion) {
    // Clear and set textContent to ensure screen reader triggers announcement
    liveRegion.textContent = '';
    window.setTimeout(() => {
      liveRegion.textContent = message;
    }, 50);
  }
}

/* =====================================================================
   SKELETON SHIMMER LOADING PLACEHOLDER
   ===================================================================== */

/**
 * Renders layout-identical skeleton placeholders to eliminate Layout Shift (CLS = 0).
 * 
 * @param {HTMLElement} container
 */
export function renderSkeleton(container) {
  container.textContent = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'dashboard-layout skeleton-fade';

  // Hero Card Skeleton
  const heroCard = document.createElement('div');
  heroCard.className = 'card hero-card skeleton-card';

  const heroHeader = document.createElement('div');
  heroHeader.className = 'skeleton-line skeleton-title';
  heroCard.appendChild(heroHeader);

  const heroSubtitle = document.createElement('div');
  heroSubtitle.className = 'skeleton-line skeleton-subtitle';
  heroCard.appendChild(heroSubtitle);

  const heroTempRow = document.createElement('div');
  heroTempRow.className = 'skeleton-temp-row';

  const heroTempCircle = document.createElement('div');
  heroTempCircle.className = 'skeleton-circle';
  heroTempRow.appendChild(heroTempCircle);

  const heroTempText = document.createElement('div');
  heroTempText.className = 'skeleton-line skeleton-temp';
  heroTempRow.appendChild(heroTempText);

  heroCard.appendChild(heroTempRow);

  // Metrics Grid Skeleton
  const metricsGrid = document.createElement('div');
  metricsGrid.className = 'metrics-grid';
  for (let i = 0; i < 4; i++) {
    const metricBox = document.createElement('div');
    metricBox.className = 'metric-box skeleton-box';
    metricsGrid.appendChild(metricBox);
  }
  heroCard.appendChild(metricsGrid);
  wrapper.appendChild(heroCard);

  // Hourly Section Skeleton
  const hourlySection = document.createElement('div');
  hourlySection.className = 'card hourly-section skeleton-card';
  const hourlyTitle = document.createElement('div');
  hourlyTitle.className = 'skeleton-line skeleton-subtitle';
  hourlySection.appendChild(hourlyTitle);
  const hourlyRow = document.createElement('div');
  hourlyRow.className = 'skeleton-hourly-row';
  for (let i = 0; i < 6; i++) {
    const hourBox = document.createElement('div');
    hourBox.className = 'skeleton-box skeleton-hour-box';
    hourlyRow.appendChild(hourBox);
  }
  hourlySection.appendChild(hourlyRow);
  wrapper.appendChild(hourlySection);

  // Advisory Section Skeleton
  const advisorySection = document.createElement('div');
  advisorySection.className = 'card advisory-section skeleton-card';
  const advTitle = document.createElement('div');
  advTitle.className = 'skeleton-line skeleton-subtitle';
  advisorySection.appendChild(advTitle);
  const advGrid = document.createElement('div');
  advGrid.className = 'advisory-grid';
  for (let i = 0; i < 4; i++) {
    const advBox = document.createElement('div');
    advBox.className = 'skeleton-box skeleton-adv-box';
    advGrid.appendChild(advBox);
  }
  advisorySection.appendChild(advGrid);
  wrapper.appendChild(advisorySection);

  // Forecast Area Skeleton
  const forecastSection = document.createElement('div');
  forecastSection.className = 'card forecast-section skeleton-card';

  const forecastTitle = document.createElement('div');
  forecastTitle.className = 'skeleton-line skeleton-subtitle';
  forecastSection.appendChild(forecastTitle);

  const forecastGrid = document.createElement('div');
  forecastGrid.className = 'forecast-grid';
  for (let i = 0; i < 5; i++) {
    const dayCard = document.createElement('div');
    dayCard.className = 'forecast-card skeleton-box';
    forecastGrid.appendChild(dayCard);
  }
  forecastSection.appendChild(forecastGrid);
  wrapper.appendChild(forecastSection);

  container.appendChild(wrapper);
}

/* =====================================================================
   CURRENT CONDITIONS HERO & DETAILS
   ===================================================================== */

/**
 * Renders the hero card and current metrics grid.
 * 
 * @param {HTMLElement} container - Target container element
 * @param {Object} city - City details
 * @param {Object} weather - Open-Meteo weather payload
 * @param {'metric'|'imperial'} unit - Active unit preference
 * @param {number} [lastUpdated=Date.now()] - Timestamp
 * @param {() => void} [onRefresh] - Callback when user clicks refresh
 * @param {() => void} [onShare] - Callback when user clicks share
 */
export function renderCurrentWeather(container, city, weather, unit, lastUpdated = Date.now(), onRefresh = null, onShare = null) {
  const current = weather.current;
  const daily = weather.daily;
  const isDay = current.is_day ?? 1;
  const interp = getWeatherInterpretation(current.weather_code, isDay);

  const todayMin = daily.temperature_2m_min?.[0] ?? current.temperature_2m;
  const todayMax = daily.temperature_2m_max?.[0] ?? current.temperature_2m;
  const sunrise = daily.sunrise?.[0];
  const sunset = daily.sunset?.[0];

  const heroCard = document.createElement('div');
  heroCard.className = 'card hero-card';

  // --- Header: Location & Time ---
  const headerDiv = document.createElement('div');
  headerDiv.className = 'hero-header';

  const locationInfo = document.createElement('div');
  locationInfo.className = 'location-info';

  const titleH2 = document.createElement('h2');
  titleH2.className = 'city-name';
  titleH2.textContent = city.name;
  locationInfo.appendChild(titleH2);

  const regionP = document.createElement('p');
  regionP.className = 'city-region';
  const regionParts = [city.admin1, city.country].filter(Boolean);
  regionP.textContent = regionParts.length > 0 ? regionParts.join(', ') : 'Current Location';
  locationInfo.appendChild(regionP);

  headerDiv.appendChild(locationInfo);

  // Time & Refresh Button
  const metaDiv = document.createElement('div');
  metaDiv.className = 'hero-meta';

  const localTimeP = document.createElement('p');
  localTimeP.className = 'local-time';
  localTimeP.textContent = `Local: ${formatLocalTime(current.time, city.timezone)}`;
  metaDiv.appendChild(localTimeP);

  const updatedP = document.createElement('p');
  updatedP.className = 'last-updated';
  updatedP.textContent = `Updated ${formatRelativeTime(lastUpdated)}`;
  metaDiv.appendChild(updatedP);

  if (onRefresh) {
    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'btn-icon refresh-btn';
    refreshBtn.setAttribute('aria-label', 'Refresh weather data');
    refreshBtn.title = 'Refresh weather data';
    refreshBtn.appendChild(createSvgIcon('refresh', 'action-icon'));
    refreshBtn.addEventListener('click', onRefresh);
    metaDiv.appendChild(refreshBtn);
  }

  if (onShare) {
    const shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.className = 'btn-icon share-btn';
    shareBtn.setAttribute('aria-label', 'Copy weather summary to clipboard');
    shareBtn.title = 'Share / copy weather briefing';
    shareBtn.appendChild(createSvgIcon('share', 'action-icon'));
    shareBtn.addEventListener('click', onShare);
    metaDiv.appendChild(shareBtn);
  }

  headerDiv.appendChild(metaDiv);
  heroCard.appendChild(headerDiv);

  // --- Main Condition Display ---
  const mainCondition = document.createElement('div');
  mainCondition.className = 'main-condition';

  const conditionVisual = document.createElement('div');
  conditionVisual.className = 'condition-visual';

  const iconEl = createSvgIcon(interp.iconKey, 'hero-icon', interp.label);
  conditionVisual.appendChild(iconEl);

  const tempCol = document.createElement('div');
  tempCol.className = 'temp-column';

  const tempLarge = document.createElement('div');
  tempLarge.className = 'temp-large';
  tempLarge.textContent = formatTemperature(current.temperature_2m, unit);
  tempCol.appendChild(tempLarge);

  const conditionLabel = document.createElement('div');
  conditionLabel.className = 'condition-label';
  conditionLabel.textContent = interp.label;
  tempCol.appendChild(conditionLabel);

  const feelsLike = document.createElement('div');
  feelsLike.className = 'feels-like';
  feelsLike.textContent = `Feels like ${formatTemperature(current.apparent_temperature, unit)}`;
  tempCol.appendChild(feelsLike);

  conditionVisual.appendChild(tempCol);
  mainCondition.appendChild(conditionVisual);
  heroCard.appendChild(mainCondition);

  // --- Metrics Grid ---
  const metricsGrid = document.createElement('div');
  metricsGrid.className = 'metrics-grid';

  // 1. Humidity
  metricsGrid.appendChild(
    createMetricBox(
      'humidity',
      'Humidity',
      `${Math.round(current.relative_humidity_2m)}%`,
      'Relative atmospheric moisture'
    )
  );

  // 2. Wind
  metricsGrid.appendChild(
    createMetricBox(
      'wind',
      'Wind Speed',
      formatWindSpeed(current.wind_speed_10m, unit),
      'Surface wind velocity'
    )
  );

  // 3. Today High / Low
  metricsGrid.appendChild(
    createMetricBox(
      'sun',
      'Today Range',
      `${formatTemperature(todayMax, unit)} / ${formatTemperature(todayMin, unit)}`,
      'Daily maximum and minimum'
    )
  );

  // 4. Sunrise & Sunset
  const sunriseStr = sunrise ? formatLocalTime(sunrise, city.timezone) : '--';
  const sunsetStr = sunset ? formatLocalTime(sunset, city.timezone) : '--';
  metricsGrid.appendChild(
    createMetricBox(
      'sunrise',
      'Sun Schedule',
      `${sunriseStr} • ${sunsetStr}`,
      `Sunrise: ${sunriseStr}, Sunset: ${sunsetStr}`
    )
  );

  heroCard.appendChild(metricsGrid);

  // Celestial Solar Daylight Arc
  if (sunrise && sunset) {
    const solarArc = renderSolarArc(sunrise, sunset, current.time, city.timezone);
    heroCard.appendChild(solarArc);
  }

  return heroCard;
}

/**
 * Creates an accessible metric card element.
 */
function createMetricBox(iconKey, title, value, ariaDescription) {
  const box = document.createElement('div');
  box.className = 'metric-box';
  box.setAttribute('tabindex', '0');
  box.setAttribute('aria-label', `${title}: ${value}. ${ariaDescription}`);

  const header = document.createElement('div');
  header.className = 'metric-header';

  const icon = createSvgIcon(iconKey, 'metric-icon');
  header.appendChild(icon);

  const titleSpan = document.createElement('span');
  titleSpan.className = 'metric-title';
  titleSpan.textContent = title;
  header.appendChild(titleSpan);

  box.appendChild(header);

  const valDiv = document.createElement('div');
  valDiv.className = 'metric-value';
  valDiv.textContent = value;
  box.appendChild(valDiv);

  return box;
}

/* =====================================================================
   5-DAY FORECAST SECTION WITH RELATIVE RANGE BARS
   ===================================================================== */

/**
 * Renders the 5-day daily forecast cards with proportional temperature-range bars.
 * 
 * @param {Object} daily - Open-Meteo daily forecast object
 * @param {'metric'|'imperial'} unit - Active unit preference
 * @returns {HTMLElement}
 */
export function renderForecast(daily, unit) {
  const section = document.createElement('div');
  section.className = 'card forecast-section';

  const titleH3 = document.createElement('h3');
  titleH3.className = 'section-title';
  titleH3.textContent = '5-Day Forecast';
  section.appendChild(titleH3);

  const grid = document.createElement('div');
  grid.className = 'forecast-grid';

  const dates = daily.time || [];
  const minTemps = daily.temperature_2m_min || [];
  const maxTemps = daily.temperature_2m_max || [];
  const codes = daily.weather_code || [];
  const rainProbs = daily.precipitation_probability_max || [];

  // Compute global minimum and maximum across the 5 days to scale visual temperature bars
  const validMinTemps = minTemps.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  const validMaxTemps = maxTemps.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  const globalMin = validMinTemps.length > 0 ? Math.min(...validMinTemps) : 0;
  const globalMax = validMaxTemps.length > 0 ? Math.max(...validMaxTemps) : 35;
  const tempSpan = Math.max(1, globalMax - globalMin);

  for (let i = 0; i < Math.min(5, dates.length); i++) {
    const dateStr = dates[i];
    const isToday = i === 0;
    const minT = minTemps[i] ?? 0;
    const maxT = maxTemps[i] ?? 0;
    const code = codes[i] ?? 0;
    const rainProb = rainProbs[i] ?? 0;
    const interp = getWeatherInterpretation(code, 1);

    const card = document.createElement('div');
    card.className = 'forecast-card';
    card.setAttribute('tabindex', '0');
    card.setAttribute(
      'aria-label',
      `${formatWeekday(dateStr, isToday)}, ${formatDisplayDate(dateStr)}: ${interp.label}. High of ${formatTemperature(maxT, unit)}, low of ${formatTemperature(minT, unit)}. Precipitation chance ${rainProb} percent.`
    );

    // Day & Date Header
    const dayHeader = document.createElement('div');
    dayHeader.className = 'forecast-day';
    dayHeader.textContent = formatWeekday(dateStr, isToday);
    card.appendChild(dayHeader);

    const dateSub = document.createElement('div');
    dateSub.className = 'forecast-date';
    dateSub.textContent = formatDisplayDate(dateStr);
    card.appendChild(dateSub);

    // Weather Icon
    const iconContainer = document.createElement('div');
    iconContainer.className = 'forecast-icon-wrapper';
    iconContainer.appendChild(createSvgIcon(interp.iconKey, 'forecast-icon', interp.label));
    card.appendChild(iconContainer);

    // Condition text
    const condP = document.createElement('div');
    condP.className = 'forecast-condition';
    condP.textContent = interp.label;
    card.appendChild(condP);

    // Precipitation probability badge
    const rainBadge = document.createElement('div');
    rainBadge.className = 'rain-chance';
    if (rainProb > 0) {
      rainBadge.appendChild(createSvgIcon('raindrop', 'rain-icon'));
      const rainSpan = document.createElement('span');
      rainSpan.textContent = `${rainProb}%`;
      rainBadge.appendChild(rainSpan);
    } else {
      rainBadge.textContent = '0%';
    }
    card.appendChild(rainBadge);

    // Temperature Range Bar
    const rangeContainer = document.createElement('div');
    rangeContainer.className = 'temp-range-container';

    const minSpan = document.createElement('span');
    minSpan.className = 'temp-low';
    minSpan.textContent = formatTemperature(minT, unit);
    rangeContainer.appendChild(minSpan);

    const barTrack = document.createElement('div');
    barTrack.className = 'temp-bar-track';

    const barFill = document.createElement('div');
    barFill.className = 'temp-bar-fill';

    // Position fill proportionally relative to global 5-day span
    const leftPercent = Math.max(0, Math.min(100, ((minT - globalMin) / tempSpan) * 100));
    const widthPercent = Math.max(8, Math.min(100 - leftPercent, ((maxT - minT) / tempSpan) * 100));
    barFill.style.left = `${leftPercent.toFixed(1)}%`;
    barFill.style.width = `${widthPercent.toFixed(1)}%`;
    barTrack.appendChild(barFill);

    rangeContainer.appendChild(barTrack);

    const maxSpan = document.createElement('span');
    maxSpan.className = 'temp-high';
    maxSpan.textContent = formatTemperature(maxT, unit);
    rangeContainer.appendChild(maxSpan);

    card.appendChild(rangeContainer);
    grid.appendChild(card);
  }

  section.appendChild(grid);
  return section;
}

/* =====================================================================
   AUTOCOMPLETE COMBOBOX SUGGESTIONS
   ===================================================================== */

/**
 * Renders the suggestions dropdown listbox.
 * 
 * @param {HTMLElement} listboxEl - The <ul role="listbox"> element
 * @param {Array<Object>} items - Matching city suggestions
 * @param {(item: Object) => void} onSelect - Selection callback
 */
export function renderSuggestions(listboxEl, items, onSelect) {
  listboxEl.textContent = '';

  if (!items || items.length === 0) {
    listboxEl.hidden = true;
    return;
  }

  items.forEach((item, index) => {
    const li = document.createElement('li');
    li.id = `suggestion-option-${index}`;
    li.role = 'option';
    li.className = 'suggestion-item';
    li.setAttribute('aria-selected', 'false');

    const icon = createSvgIcon('location', 'suggestion-icon');
    li.appendChild(icon);

    const textWrapper = document.createElement('div');
    textWrapper.className = 'suggestion-text';

    const mainName = document.createElement('span');
    mainName.className = 'suggestion-name';
    mainName.textContent = item.name;
    textWrapper.appendChild(mainName);

    const subRegion = document.createElement('span');
    subRegion.className = 'suggestion-sub';
    const subParts = [item.admin1, item.country].filter(Boolean);
    subRegion.textContent = subParts.length > 0 ? ` (${subParts.join(', ')})` : '';
    textWrapper.appendChild(subRegion);

    li.appendChild(textWrapper);

    li.addEventListener('mousedown', (e) => {
      // Prevent input from losing focus before click resolves
      e.preventDefault();
      onSelect(item);
    });

    listboxEl.appendChild(li);
  });

  listboxEl.hidden = false;
}

/* =====================================================================
   RECENT SEARCHES CHIPS
   ===================================================================== */

/**
 * Renders the list of clickable recent searches with a Clear button.
 * 
 * @param {HTMLElement} container
 * @param {Array<Object>} recents
 * @param {(city: Object) => void} onSelect
 * @param {() => void} onClear
 */
export function renderRecentSearches(container, recents, onSelect, onClear) {
  container.textContent = '';

  if (!recents || recents.length === 0) {
    container.hidden = true;
    return;
  }

  container.hidden = false;

  const labelSpan = document.createElement('span');
  labelSpan.className = 'recent-label';
  labelSpan.textContent = 'Recent:';
  container.appendChild(labelSpan);

  const chipsWrapper = document.createElement('div');
  chipsWrapper.className = 'recent-chips';

  recents.forEach((city) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = city.name;
    chip.setAttribute('aria-label', `Load weather for ${city.name}, ${city.country || ''}`);
    chip.addEventListener('click', () => onSelect(city));
    chipsWrapper.appendChild(chip);
  });

  container.appendChild(chipsWrapper);

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'chip-clear';
  clearBtn.textContent = 'Clear';
  clearBtn.setAttribute('aria-label', 'Clear recent search history');
  clearBtn.addEventListener('click', onClear);
  container.appendChild(clearBtn);
}

/* =====================================================================
   ERROR STATE DISPLAY WITH RETRY
   ===================================================================== */

/**
 * Renders an accessible error alert card with details and optional retry button.
 * 
 * @param {HTMLElement} container
 * @param {Error|Object} error
 * @param {() => void} [onRetry]
 */
export function renderError(container, error, onRetry = null) {
  container.textContent = '';

  const card = document.createElement('div');
  card.className = 'card state-card error-card';
  card.setAttribute('role', 'alert');

  const icon = createSvgIcon('alert', 'state-icon alert-icon', 'Error alert');
  card.appendChild(icon);

  const heading = document.createElement('h2');
  heading.className = 'state-title';
  heading.textContent = error.name || 'Notice';
  card.appendChild(heading);

  const desc = document.createElement('p');
  desc.className = 'state-description';
  desc.textContent = error.message || 'An unexpected error occurred while fetching weather data.';
  card.appendChild(desc);

  if (error.isRetryable && onRetry) {
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'btn btn-primary retry-btn';
    retryBtn.textContent = 'Try Again';
    retryBtn.addEventListener('click', onRetry);
    card.appendChild(retryBtn);
  }

  container.appendChild(card);
}

/* =====================================================================
   EMPTY STATE DISPLAY
   ===================================================================== */

/**
 * Renders a friendly empty state when no location is loaded.
 * 
 * @param {HTMLElement} container
 */
export function renderEmpty(container) {
  container.textContent = '';

  const card = document.createElement('div');
  card.className = 'card state-card empty-card';

  const icon = createSvgIcon('search', 'state-icon', 'Search illustration');
  card.appendChild(icon);

  const heading = document.createElement('h2');
  heading.className = 'state-title';
  heading.textContent = 'Explore the Weather';
  card.appendChild(heading);

  const desc = document.createElement('p');
  desc.className = 'state-description';
  desc.textContent = 'Type a city name above or click "Use my location" to see live conditions and a 5-day forecast.';
  card.appendChild(desc);

  container.appendChild(card);
}

/* =====================================================================
   CELESTIAL DAYLIGHT & SOLAR ARC
   ===================================================================== */

/**
 * Renders an accessible SVG arc illustrating current position of the sun in the sky.
 * 
 * @param {string} sunriseIso
 * @param {string} sunsetIso
 * @param {string} currentIso
 * @param {string} timezone
 * @returns {HTMLElement}
 */
export function renderSolarArc(sunriseIso, sunsetIso, currentIso, timezone) {
  const container = document.createElement('div');
  container.className = 'solar-arc-container';

  const solar = calculateSolarProgress(sunriseIso, sunsetIso, currentIso);

  const header = document.createElement('div');
  header.className = 'solar-arc-header';

  const title = document.createElement('span');
  title.className = 'solar-title';
  title.textContent = 'Daylight & Sun Path';
  header.appendChild(title);

  const durationBadge = document.createElement('span');
  durationBadge.className = 'solar-badge';
  durationBadge.textContent = `Total: ${solar.daylightDuration}`;
  header.appendChild(durationBadge);

  container.appendChild(header);

  // SVG Arc
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 280 100');
  svg.setAttribute('class', 'solar-arc-svg');
  svg.setAttribute('aria-hidden', 'true');

  // Baseline dashed arc: center at (140, 100)
  const baseArc = document.createElementNS(SVG_NS, 'path');
  baseArc.setAttribute('d', 'M 30 95 A 110 85 0 0 1 250 95');
  baseArc.setAttribute('fill', 'none');
  baseArc.setAttribute('stroke', 'rgba(255, 255, 255, 0.2)');
  baseArc.setAttribute('stroke-width', '3');
  baseArc.setAttribute('stroke-dasharray', '5 5');
  svg.appendChild(baseArc);

  // Calculate sun position along semi-ellipse
  const pct = Math.max(0, Math.min(100, solar.progressPercent));
  const theta = Math.PI - (pct / 100) * Math.PI;
  const sunX = (140 + 110 * Math.cos(theta)).toFixed(1);
  const sunY = (95 - 85 * Math.sin(theta)).toFixed(1);

  // Progress arc up to sun
  if (solar.isDay && pct > 0) {
    const progArc = document.createElementNS(SVG_NS, 'path');
    progArc.setAttribute('d', `M 30 95 A 110 85 0 0 1 ${sunX} ${sunY}`);
    progArc.setAttribute('fill', 'none');
    progArc.setAttribute('stroke', 'var(--accent-color)');
    progArc.setAttribute('stroke-width', '3');
    svg.appendChild(progArc);
  }

  // Sun / Moon Orb
  const orbGroup = document.createElementNS(SVG_NS, 'g');
  orbGroup.setAttribute('transform', `translate(${sunX}, ${sunY})`);

  const glow = document.createElementNS(SVG_NS, 'circle');
  glow.setAttribute('r', '11');
  glow.setAttribute('fill', solar.isDay ? 'rgba(251, 191, 36, 0.35)' : 'rgba(165, 180, 252, 0.35)');
  orbGroup.appendChild(glow);

  const core = document.createElementNS(SVG_NS, 'circle');
  core.setAttribute('r', '6');
  core.setAttribute('fill', solar.isDay ? '#fbbf24' : '#c7d2fe');
  core.setAttribute('stroke', '#ffffff');
  core.setAttribute('stroke-width', '1.5');
  orbGroup.appendChild(core);

  svg.appendChild(orbGroup);
  container.appendChild(svg);

  // Footer labels
  const footer = document.createElement('div');
  footer.className = 'solar-footer';

  const leftTime = document.createElement('span');
  leftTime.className = 'solar-time-label';
  leftTime.textContent = `Dawn: ${formatLocalTime(sunriseIso, timezone)}`;
  footer.appendChild(leftTime);

  const statusSpan = document.createElement('span');
  statusSpan.className = 'solar-status-text';
  statusSpan.textContent = solar.statusText;
  footer.appendChild(statusSpan);

  const rightTime = document.createElement('span');
  rightTime.className = 'solar-time-label';
  rightTime.textContent = `Dusk: ${formatLocalTime(sunsetIso, timezone)}`;
  footer.appendChild(rightTime);

  container.appendChild(footer);
  return container;
}

/* =====================================================================
   24-HOUR HOURLY FORECAST SCROLLER
   ===================================================================== */

/**
 * Renders the 24-hour horizontal forecast timeline.
 * 
 * @param {Object} hourly - Open-Meteo hourly payload
 * @param {string} currentIso - Current time string
 * @param {string} timezone - IANA timezone
 * @param {'metric'|'imperial'} unit - Unit mode
 * @returns {HTMLElement}
 */
export function renderHourlyForecast(hourly, currentIso, timezone, unit) {
  const section = document.createElement('div');
  section.className = 'card hourly-section';

  const header = document.createElement('div');
  header.className = 'section-header';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'section-title-group';

  const icon = createSvgIcon('clock', 'section-icon');
  titleGroup.appendChild(icon);

  const title = document.createElement('h3');
  title.className = 'section-title';
  title.textContent = 'Next 24 Hours';
  titleGroup.appendChild(title);
  header.appendChild(titleGroup);

  const hint = document.createElement('span');
  hint.className = 'scroll-hint';
  hint.textContent = 'Scroll to explore →';
  header.appendChild(hint);

  section.appendChild(header);

  const scroller = document.createElement('div');
  scroller.className = 'hourly-scroller';
  scroller.setAttribute('role', 'region');
  scroller.setAttribute('aria-label', '24-hour forecast hourly scroller');
  scroller.setAttribute('tabindex', '0');

  const times = hourly?.time || [];
  const temps = hourly?.temperature_2m || [];
  const codes = hourly?.weather_code || [];
  const rainProbs = hourly?.precipitation_probability || [];
  const isDays = hourly?.is_day || [];

  const nowMs = currentIso ? new Date(currentIso).getTime() : Date.now();

  let startIndex = 0;
  for (let i = 0; i < times.length; i++) {
    if (new Date(times[i]).getTime() >= nowMs - 45 * 60 * 1000) {
      startIndex = i;
      break;
    }
  }

  const count = Math.min(24, times.length - startIndex);

  for (let i = 0; i < count; i++) {
    const idx = startIndex + i;
    const timeStr = times[idx];
    const isFirst = i === 0;
    const temp = temps[idx] ?? 0;
    const code = codes[idx] ?? 0;
    const rain = rainProbs[idx] ?? 0;
    const isDay = isDays[idx] ?? 1;
    const interp = getWeatherInterpretation(code, isDay);

    const item = document.createElement('div');
    item.className = 'hourly-item';
    if (isFirst) item.classList.add('hourly-item-active');

    // Time label
    const timeLabel = document.createElement('span');
    timeLabel.className = 'hourly-time';
    timeLabel.textContent = isFirst ? 'Now' : formatLocalTime(timeStr, timezone);
    item.appendChild(timeLabel);

    // Icon
    const itemIcon = createSvgIcon(interp.iconKey, 'hourly-icon', interp.label);
    item.appendChild(itemIcon);

    // Temp
    const tempLabel = document.createElement('span');
    tempLabel.className = 'hourly-temp';
    tempLabel.textContent = formatTemperature(temp, unit);
    item.appendChild(tempLabel);

    // Rain probability badge
    const rainBadge = document.createElement('span');
    rainBadge.className = 'hourly-rain';
    if (rain > 0) {
      rainBadge.textContent = `${rain}%`;
      rainBadge.classList.add('has-rain');
    } else {
      rainBadge.textContent = '·';
    }
    item.appendChild(rainBadge);

    scroller.appendChild(item);
  }

  section.appendChild(scroller);
  return section;
}

/* =====================================================================
   SMART WEATHER ADVISORY & LIFESTYLE INSIGHTS
   ===================================================================== */

/**
 * Renders the 4 smart advisory cards (Activity, Rain, Dressing, UV).
 * 
 * @param {Object} current - Open-Meteo current payload
 * @param {Object} hourly - Open-Meteo hourly payload
 * @param {Object} daily - Open-Meteo daily payload
 * @param {string} timezone - Local timezone
 * @returns {HTMLElement}
 */
export function renderSmartAdvisory(current, hourly, daily, timezone) {
  const section = document.createElement('div');
  section.className = 'card advisory-section';

  const header = document.createElement('div');
  header.className = 'section-header';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'section-title-group';

  const icon = createSvgIcon('sparkles', 'section-icon');
  titleGroup.appendChild(icon);

  const title = document.createElement('h3');
  title.className = 'section-title';
  title.textContent = 'Smart Weather Insights & Advisory';
  titleGroup.appendChild(title);
  header.appendChild(titleGroup);

  section.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'advisory-grid';

  // 1. Activity Index
  const rainProb = daily?.precipitation_probability_max?.[0] ?? 0;
  const activity = calculateActivityIndex(
    current.temperature_2m,
    current.wind_speed_10m,
    current.relative_humidity_2m,
    rainProb,
    current.weather_code
  );

  grid.appendChild(
    createAdvisoryCard(
      'activity',
      'Outdoor Activity',
      `${activity.status} (${activity.score}%)`,
      activity.advice,
      activity.badgeClass
    )
  );

  // 2. Umbrella Watch
  const umbrella = calculateUmbrellaAlert(
    hourly?.time || [],
    hourly?.precipitation_probability || [],
    current.time
  );

  grid.appendChild(
    createAdvisoryCard(
      'umbrella',
      'Rain & Umbrella Watch',
      umbrella.needUmbrella ? 'Umbrella Needed' : 'Dry Skies',
      umbrella.message,
      umbrella.needUmbrella ? 'advisory-caution' : 'advisory-good'
    )
  );

  // 3. Clothing & Layering
  const clothing = calculateClothingRecommendation(
    current.apparent_temperature,
    current.wind_speed_10m
  );

  grid.appendChild(
    createAdvisoryCard(
      'shirt',
      'Dressing Guide',
      clothing.summary,
      clothing.details,
      'advisory-neutral'
    )
  );

  // 4. UV Protection
  const uvMax = daily?.uv_index_max?.[0] ?? 2.5;
  const uv = calculateUvAdvisory(uvMax);

  grid.appendChild(
    createAdvisoryCard(
      'uv',
      'Sun & UV Index',
      `UV ${uv.uvValue} • ${uv.level}`,
      uv.advice,
      uv.badgeClass
    )
  );

  section.appendChild(grid);
  return section;
}

function createAdvisoryCard(iconKey, title, statusBadge, description, badgeClass) {
  const card = document.createElement('div');
  card.className = 'advisory-card';
  card.setAttribute('tabindex', '0');

  const cardHeader = document.createElement('div');
  cardHeader.className = 'advisory-card-header';

  const icon = createSvgIcon(iconKey, 'advisory-icon');
  cardHeader.appendChild(icon);

  const titleSpan = document.createElement('span');
  titleSpan.className = 'advisory-title';
  titleSpan.textContent = title;
  cardHeader.appendChild(titleSpan);

  const badge = document.createElement('span');
  badge.className = `advisory-badge ${badgeClass}`;
  badge.textContent = statusBadge;
  cardHeader.appendChild(badge);

  card.appendChild(cardHeader);

  const desc = document.createElement('p');
  desc.className = 'advisory-desc';
  desc.textContent = description;
  card.appendChild(desc);

  return card;
}

/* =====================================================================
   GLASSMORPHIC TOAST NOTIFICATION
   ===================================================================== */

/**
 * Displays an interactive floating toast notification.
 * 
 * @param {string} message - Toast text
 * @param {'info'|'success'|'warning'} [type='info'] - Style variant
 */
export function renderToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type} fade-in`;

  const iconKey = type === 'success' ? 'sparkles' : 'alert';
  toast.appendChild(createSvgIcon(iconKey, 'toast-icon'));

  const text = document.createElement('span');
  text.className = 'toast-text';
  text.textContent = message;
  toast.appendChild(text);

  container.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add('toast-exit');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, CONFIG.TIMING.TOAST_DURATION_MS || 3500);
}
