/**
 * WMO Weather Code Interpreter
 * Maps WMO weather interpretation codes to accessible human-readable labels,
 * semantic icon identifiers, and UI theme classifications.
 * 
 * Supports both daytime and nighttime variants where applicable.
 */

/**
 * @typedef {Object} WeatherInterpretation
 * @property {string} label - Human-readable condition label (emoji-free)
 * @property {string} iconKey - Identifier used to render the corresponding inline SVG
 * @property {string} themeKey - CSS theme classification ('clear', 'cloudy', 'rain', 'snow', 'thunderstorm', 'fog')
 */

/**
 * Resolves a WMO code and day/night status to a rich weather descriptor.
 * 
 * @param {number} code - WMO weather interpretation code
 * @param {number|boolean} [isDay=1] - 1 for day, 0 for night
 * @returns {WeatherInterpretation}
 */
export function getWeatherInterpretation(code, isDay = 1) {
  const day = Boolean(isDay);

  switch (code) {
    case 0:
      return {
        label: 'Clear sky',
        iconKey: day ? 'sun' : 'moon',
        themeKey: day ? 'theme-clear-day' : 'theme-clear-night',
      };

    case 1:
      return {
        label: 'Mainly clear',
        iconKey: day ? 'sun' : 'moon',
        themeKey: day ? 'theme-clear-day' : 'theme-clear-night',
      };

    case 2:
      return {
        label: 'Partly cloudy',
        iconKey: day ? 'partly-cloudy-day' : 'partly-cloudy-night',
        themeKey: day ? 'theme-partly-cloudy-day' : 'theme-partly-cloudy-night',
      };

    case 3:
      return {
        label: 'Overcast',
        iconKey: 'cloud',
        themeKey: 'theme-cloudy',
      };

    case 45:
      return {
        label: 'Fog',
        iconKey: 'fog',
        themeKey: 'theme-fog',
      };

    case 48:
      return {
        label: 'Depositing rime fog',
        iconKey: 'fog',
        themeKey: 'theme-fog',
      };

    case 51:
      return {
        label: 'Light drizzle',
        iconKey: 'drizzle',
        themeKey: 'theme-rain',
      };

    case 53:
      return {
        label: 'Moderate drizzle',
        iconKey: 'drizzle',
        themeKey: 'theme-rain',
      };

    case 55:
      return {
        label: 'Dense drizzle',
        iconKey: 'drizzle',
        themeKey: 'theme-rain',
      };

    case 56:
      return {
        label: 'Light freezing drizzle',
        iconKey: 'drizzle',
        themeKey: 'theme-snow',
      };

    case 57:
      return {
        label: 'Dense freezing drizzle',
        iconKey: 'drizzle',
        themeKey: 'theme-snow',
      };

    case 61:
      return {
        label: 'Slight rain',
        iconKey: 'rain',
        themeKey: 'theme-rain',
      };

    case 63:
      return {
        label: 'Moderate rain',
        iconKey: 'rain',
        themeKey: 'theme-rain',
      };

    case 65:
      return {
        label: 'Heavy rain',
        iconKey: 'rain',
        themeKey: 'theme-rain',
      };

    case 66:
      return {
        label: 'Light freezing rain',
        iconKey: 'rain',
        themeKey: 'theme-snow',
      };

    case 67:
      return {
        label: 'Heavy freezing rain',
        iconKey: 'rain',
        themeKey: 'theme-snow',
      };

    case 71:
      return {
        label: 'Slight snow fall',
        iconKey: 'snow',
        themeKey: 'theme-snow',
      };

    case 73:
      return {
        label: 'Moderate snow fall',
        iconKey: 'snow',
        themeKey: 'theme-snow',
      };

    case 75:
      return {
        label: 'Heavy snow fall',
        iconKey: 'snow',
        themeKey: 'theme-snow',
      };

    case 77:
      return {
        label: 'Snow grains',
        iconKey: 'snow',
        themeKey: 'theme-snow',
      };

    case 80:
      return {
        label: 'Slight rain showers',
        iconKey: 'rain',
        themeKey: 'theme-rain',
      };

    case 81:
      return {
        label: 'Moderate rain showers',
        iconKey: 'rain',
        themeKey: 'theme-rain',
      };

    case 82:
      return {
        label: 'Violent rain showers',
        iconKey: 'rain',
        themeKey: 'theme-rain',
      };

    case 85:
      return {
        label: 'Slight snow showers',
        iconKey: 'snow',
        themeKey: 'theme-snow',
      };

    case 86:
      return {
        label: 'Heavy snow showers',
        iconKey: 'snow',
        themeKey: 'theme-snow',
      };

    case 95:
      return {
        label: 'Thunderstorm',
        iconKey: 'thunderstorm',
        themeKey: 'theme-thunderstorm',
      };

    case 96:
      return {
        label: 'Thunderstorm with slight hail',
        iconKey: 'thunderstorm',
        themeKey: 'theme-thunderstorm',
      };

    case 99:
      return {
        label: 'Thunderstorm with heavy hail',
        iconKey: 'thunderstorm',
        themeKey: 'theme-thunderstorm',
      };

    default:
      return {
        label: 'Variable conditions',
        iconKey: day ? 'sun' : 'moon',
        themeKey: day ? 'theme-clear-day' : 'theme-clear-night',
      };
  }
}

/**
 * Returns a set of all standard WMO codes supported by the system.
 * Useful for automated test verification.
 * 
 * @returns {number[]}
 */
export function getSupportedWmoCodes() {
  return [
    0, 1, 2, 3, 45, 48,
    51, 53, 55, 56, 57,
    61, 63, 65, 66, 67,
    71, 73, 75, 77,
    80, 81, 82, 85, 86,
    95, 96, 99
  ];
}
