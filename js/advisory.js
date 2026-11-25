/**
 * Smart Weather Advisory & Lifestyle Intelligence Engine
 * Transforms raw meteorological metrics into actionable lifestyle guidance:
 * - Outdoor Activity & Workout Index
 * - Smart Umbrella / Rain Alert with peak-hour prediction
 * - Thermal Comfort & Layering / Clothing Guide
 * - UV Sun Exposure Index & Protection Guidance
 * - Celestial Daylight Arc Solar Progress
 */

/**
 * Calculates outdoor activity suitability score (0-100%) and recommendation.
 * Ideal conditions: 15°C - 23°C, wind < 20 km/h, humidity 35-65%, no rain.
 * 
 * @param {number} temp - Current temperature in Celsius
 * @param {number} wind - Wind speed in km/h
 * @param {number} humidity - Relative humidity in %
 * @param {number} rainProb - Rain probability in %
 * @param {number} weatherCode - WMO weather code
 * @returns {{ score: number, status: string, advice: string, badgeClass: string }}
 */
export function calculateActivityIndex(temp, wind, humidity, rainProb = 0, weatherCode = 0) {
  let score = 100;

  // Severe weather codes (Thunderstorm, Heavy rain, Snow)
  if ([95, 96, 99, 65, 75, 82].includes(weatherCode)) {
    return {
      score: 15,
      status: 'Avoid Outdoors',
      advice: 'Adverse weather conditions. High lightning or storm risk; indoor workout recommended.',
      badgeClass: 'advisory-bad',
    };
  }

  // Precipitation impact
  if (rainProb > 60) score -= 45;
  else if (rainProb > 25) score -= 20;

  // Temperature penalty (ideal is 15-22°C)
  if (temp < 0) score -= 40;
  else if (temp < 10) score -= 20;
  else if (temp > 35) score -= 40;
  else if (temp > 28) score -= 20;

  // Wind penalty (> 25 km/h is strenuous)
  if (wind > 35) score -= 30;
  else if (wind > 22) score -= 15;

  // Humidity penalty (> 80% is stifling, < 20% is parched)
  if (humidity > 85) score -= 20;
  else if (humidity > 75) score -= 10;

  score = Math.max(10, Math.min(100, Math.round(score)));

  if (score >= 80) {
    return {
      score,
      status: 'Prime Conditions',
      advice: 'Optimal weather for running, cycling, or outdoor sports with pleasant thermal comfort.',
      badgeClass: 'advisory-good',
    };
  }

  if (score >= 55) {
    return {
      score,
      status: 'Moderate',
      advice: 'Decent outdoor conditions. Stay hydrated and dress appropriately for current breeze/humidity.',
      badgeClass: 'advisory-moderate',
    };
  }

  return {
    score,
    status: 'Caution',
    advice: 'Challenging outdoor weather. Consider a relaxed pace, adequate layers, or indoor alternatives.',
    badgeClass: 'advisory-caution',
  };
}

/**
 * Predicts whether rain is imminent within the next 12 hours and flags peak precipitation hour.
 * 
 * @param {string[]} hourlyTimes - Array of ISO timestamps from Open-Meteo
 * @param {number[]} hourlyRainProbs - Array of rain probabilities
 * @param {string} [currentTimeIso] - Current ISO timestamp
 * @returns {{ needUmbrella: boolean, peakProb: number, peakTime: string, message: string }}
 */
export function calculateUmbrellaAlert(hourlyTimes, hourlyRainProbs, currentTimeIso) {
  if (!Array.isArray(hourlyTimes) || !Array.isArray(hourlyRainProbs) || hourlyTimes.length === 0) {
    return {
      needUmbrella: false,
      peakProb: 0,
      peakTime: '',
      message: 'Dry conditions expected across the forecast window.',
    };
  }

  const now = currentTimeIso ? new Date(currentTimeIso).getTime() : Date.now();
  
  // Find start index matching current hour
  let startIndex = 0;
  for (let i = 0; i < hourlyTimes.length; i++) {
    if (new Date(hourlyTimes[i]).getTime() >= now - 30 * 60 * 1000) {
      startIndex = i;
      break;
    }
  }

  // Scan next 12 hours
  const windowEnd = Math.min(hourlyTimes.length, startIndex + 12);
  let maxProb = 0;
  let peakTimeIso = '';

  for (let i = startIndex; i < windowEnd; i++) {
    const prob = hourlyRainProbs[i] || 0;
    if (prob > maxProb) {
      maxProb = prob;
      peakTimeIso = hourlyTimes[i];
    }
  }

  if (maxProb >= 40) {
    const peakHour = peakTimeIso ? new Date(peakTimeIso).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }) : 'soon';
    return {
      needUmbrella: true,
      peakProb: maxProb,
      peakTime: peakHour,
      message: `Take an umbrella! Up to ${maxProb}% rain likelihood around ${peakHour}.`,
    };
  }

  if (maxProb >= 20) {
    return {
      needUmbrella: false,
      peakProb: maxProb,
      peakTime: '',
      message: `Low precipitation chance (${maxProb}% max). Umbrella optional.`,
    };
  }

  return {
    needUmbrella: false,
    peakProb: maxProb,
    peakTime: '',
    message: 'Zero rain expected in the next 12 hours. Clear skies!',
  };
}

/**
 * Recommends clothing and layering based on apparent (feels-like) temperature and wind.
 * 
 * @param {number} apparentTempC - Apparent temperature in Celsius
 * @param {number} windSpeed - Wind speed in km/h
 * @returns {{ summary: string, details: string }}
 */
export function calculateClothingRecommendation(apparentTempC, windSpeed = 0) {
  const windy = windSpeed > 25;
  const windText = windy ? ' Expect noticeable wind chill.' : '';

  if (apparentTempC <= 0) {
    return {
      summary: 'Heavy Winter Wear',
      details: `Sub-zero chill! Heavy down coat, thermal base layer, insulated gloves, and beanie required.${windText}`,
    };
  }

  if (apparentTempC <= 10) {
    return {
      summary: 'Warm Layers & Jacket',
      details: `Chilly outdoors. Thick fleece or wool jacket with long trousers and closed shoes recommended.${windText}`,
    };
  }

  if (apparentTempC <= 18) {
    return {
      summary: 'Light Outerwear',
      details: `Crisp & mild. A lightweight sweater, denim jacket, or hoodie is ideal for evening.${windText}`,
    };
  }

  if (apparentTempC <= 26) {
    return {
      summary: 'Comfortable Casual',
      details: `Ideal thermal balance! Breathable cotton t-shirt, jeans/chinos, and casual sneakers.${windText}`,
    };
  }

  if (apparentTempC <= 33) {
    return {
      summary: 'Warm & Breathable',
      details: `Warm conditions. Light linen shirts, shorts, sunglasses, and hydration recommended.`,
    };
  }

  return {
    summary: 'Hot & Sun-Safe',
    details: `Intense heat! Ultra-lightweight clothing, wide-brim hat, UV sunglasses, and continuous water intake.`,
  };
}

/**
 * Analyzes UV index and provides protection advice.
 * 
 * @param {number} uvIndex - Maximum UV index value
 * @returns {{ level: string, uvValue: number, advice: string, badgeClass: string }}
 */
export function calculateUvAdvisory(uvIndex = 0) {
  const rounded = Math.round(uvIndex * 10) / 10;

  if (rounded <= 2) {
    return {
      level: 'Low',
      uvValue: rounded,
      advice: 'Minimal sun hazard. Safe to enjoy outdoors without sunscreen.',
      badgeClass: 'advisory-good',
    };
  }

  if (rounded <= 5) {
    return {
      level: 'Moderate',
      uvValue: rounded,
      advice: 'Moderate exposure. Wear sunglasses and apply SPF 15+ if outdoors for extended periods.',
      badgeClass: 'advisory-moderate',
    };
  }

  if (rounded <= 7) {
    return {
      level: 'High',
      uvValue: rounded,
      advice: 'High UV! Seek shade during midday, apply SPF 30+ sunscreen, and wear protective hat.',
      badgeClass: 'advisory-caution',
    };
  }

  return {
    level: 'Very High',
    uvValue: rounded,
    advice: 'Intense radiation! Avoid direct midday sun (11 AM–3 PM), wear UV-rated eyewear and cover up.',
    badgeClass: 'advisory-bad',
  };
}

/**
 * Calculates solar daylight progress percentage and time until sunset/sunrise.
 * 
 * @param {string} sunriseIso - "YYYY-MM-DDTHH:MM"
 * @param {string} sunsetIso - "YYYY-MM-DDTHH:MM"
 * @param {string} currentIso - Current time string
 * @returns {{ isDay: boolean, progressPercent: number, statusText: string, daylightDuration: string }}
 */
export function calculateSolarProgress(sunriseIso, sunsetIso, currentIso) {
  if (!sunriseIso || !sunsetIso) {
    return {
      isDay: true,
      progressPercent: 50,
      statusText: 'Daylight info unavailable',
      daylightDuration: '--',
    };
  }

  const sunrise = new Date(sunriseIso).getTime();
  const sunset = new Date(sunsetIso).getTime();
  const current = currentIso ? new Date(currentIso).getTime() : Date.now();

  const totalDaylightMs = sunset - sunrise;
  const daylightHours = Math.floor(totalDaylightMs / (1000 * 60 * 60));
  const daylightMinutes = Math.floor((totalDaylightMs % (1000 * 60 * 60)) / (1000 * 60));
  const daylightDuration = `${daylightHours}h ${daylightMinutes}m`;

  if (current >= sunrise && current <= sunset) {
    // Daytime
    const elapsed = current - sunrise;
    const progressPercent = Math.max(0, Math.min(100, Math.round((elapsed / totalDaylightMs) * 100)));

    const remainingMs = sunset - current;
    const remHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      isDay: true,
      progressPercent,
      statusText: `${remHours}h ${remMins}m of daylight remaining`,
      daylightDuration,
    };
  }

  // Nighttime
  const progressPercent = current < sunrise ? 0 : 100;
  return {
    isDay: false,
    progressPercent,
    statusText: 'Sun has set • Clear night sky',
    daylightDuration,
  };
}
