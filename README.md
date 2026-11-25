# AeroCast — Live Weather Dashboard

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript ES2020+](https://img.shields.io/badge/JavaScript-ES2020%2B-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Open-Meteo API](https://img.shields.io/badge/API-Open--Meteo-0284c7?style=flat-square)](https://open-meteo.com/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-22c55e?style=flat-square)](#)

> A production-quality, accessible, and responsive **Live Weather Dashboard** built strictly with **vanilla HTML5, CSS3, and ES2020+ JavaScript modules**. Zero frameworks, zero build tools, zero external JavaScript libraries, and zero API keys required. Engineered to run directly with VS Code Live Server and deploy as-is to GitHub Pages.

---

## Live Demo & Repository

- **Repository**: [https://github.com/sharath14pixel/weather-api](https://github.com/sharath14pixel/weather-api)
- **Live Demo (GitHub Pages)**: [https://sharath14pixel.github.io/weather-api/](https://sharath14pixel.github.io/weather-api/) *(Enable Pages in Repository Settings → Pages → `main` / `/root`)*
- **Unit Test Suite**: Open `tests.html` via Live Server to run automated in-browser assertions.

---

## Key Features & Uniqueness Highlights

1. **Smart Lifestyle & Weather Advisory Engine (`js/advisory.js`)**:
   - Evaluates current meteorological conditions and computes 4 actionable real-time lifestyle advisories:
     - **Outdoor Activity Index**: Analyzes thermal comfort, wind, and precipitation to score fitness/running suitability (*Prime Conditions*, *Moderate*, or *Caution*).
     - **Smart Umbrella & Rain Watch**: Scans the next 12 hours of hourly forecast data and warns of peak precipitation likelihood and exact hour (e.g., *"Take an umbrella! Up to 85% rain likelihood around 3:00 PM."*).
     - **Clothing & Layering Guide**: Recommends appropriate attire based on apparent feels-like temperature and wind chill.
     - **UV Sun Exposure & Protection**: Translates daily UV index into dermatological protection advice (SPF recommendations and peak sun hazard windows).
2. **24-Hour Hourly Timeline Scroller**:
   - Smooth horizontal touch and scroll-wheel timeline detailing the upcoming 24 consecutive hours with hourly temperatures, condition icons, and rain probability badges.
3. **Celestial Daylight & Solar Arc Visualizer**:
   - Mathematical SVG parabolic arc mapping the sun's trajectory across the sky from dawn to dusk in real time, showing total daylight duration and remaining daylight countdown.
4. **Living Weather Ambience Particle Engine (`js/ambience.js`)**:
   - Lightweight HTML5 Canvas backdrop generating subtle atmospheric weather effects matching live conditions (drifting snowflakes, angled raindrops, twinkling night stars, golden sun shimmer, or rolling fog mist).
   - Includes a header toggle button and automatically pauses under `@media (prefers-reduced-motion: reduce)` or when the browser tab is hidden.
5. **One-Click Share Weather Briefing**:
   - Copies a formatted plain-text weather report to the clipboard and triggers a floating glassmorphic toast notification.
6. **Accessible ARIA Combobox Autocomplete**:
   - Debounced search (380ms) querying candidate cities via Open-Meteo Geocoding.
   - Full W3C ARIA Combobox implementation (`role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-activedescendant`, `role="listbox"`, `role="option"`) with `ArrowDown`, `ArrowUp`, `Enter`, and `Escape` keyboard support.
7. **Robust Request Control & Race Condition Safety**:
   - `AbortController` cancels stale in-flight requests when a new search starts.
   - 8-second fetch timeout enforcement and 1 automatic retry with exponential backoff on transient network drops or HTTP 5xx responses.
8. **Resilient Typed Error Hierarchy**:
   - Custom error classes (`ValidationError`, `NotFoundError`, `NetworkError`, `ApiError`, `TimeoutError`) routed through a centralized state machine (`state.js`) with contextual **"Try Again"** recovery.
9. **Instant Client-Side Unit Switching & Caching**:
   - Switch between Metric (`°C, km/h`) and Imperial (`°F, mph`) with `aria-pressed` toggle buttons—100% client-side with zero redundant API calls.
   - 10-minute coordinate-keyed cache in `sessionStorage` + memory, plus URL query sync (`?city=Tokyo`) and recent search chips in `localStorage`.
10. **Dynamic Weather & Day/Night Theming**:
    - CSS custom property themes adapt dynamically by WMO weather code and `is_day` status while maintaining WCAG AA contrast (`>= 4.5:1`), plus a manual Light/Dark mode toggle.
11. **Responsive Layout & Print Stylesheet**:
    - Shimmer skeleton loaders prevent layout shift (`CLS = 0`).
    - Responsive across `360px` (mobile), `768px` (tablet), `1280px` (desktop), and `1920px`, plus a clean monochrome `@media print` stylesheet.

---

## Project Structure

```text
weather-api/
├── index.html                  # Semantic HTML5 entry point, strict CSP & inline SVG sprite
├── tests.html                  # Standalone browser unit test suite (plain JS assertions)
├── css/
│   ├── base.css                # CSS reset, [hidden] guard, design tokens, dynamic themes
│   ├── components.css          # Combobox, hero card, solar arc, hourly scroller, advisory, forecast
│   └── responsive.css          # Breakpoints (360px-1920px), reduced-motion, print stylesheet
├── js/
│   ├── config.js               # API URLs, limits, timeouts, storage keys, default city
│   ├── api.js                  # fetchJson with timeout/retry, findCity, searchCities, getWeather
│   ├── weatherCodes.js         # WMO code -> label, SVG icon key, and theme key map
│   ├── advisory.js             # Smart lifestyle engine (Activity, Umbrella, Dressing, UV, Solar Arc)
│   ├── ambience.js             # Living weather particle canvas engine
│   ├── render.js               # Pure DOM rendering (createElement + textContent only)
│   ├── state.js                # Reactive UI state machine (idle | loading | success | empty | error)
│   ├── storage.js              # Safe localStorage/sessionStorage wrapper with try/catch
│   ├── utils.js                # Debounce, validators, formatters, unit converters, typed errors
│   └── main.js                 # Bootstrap, event wiring, combobox controls, orchestration
├── assets/
│   └── icons/
│       └── weather-icons.svg   # Hand-crafted SVG weather icon sprite (currentColor)
└── README.md                   # Project documentation & Error Handling Note
```

---

## API Flow (Geocoding → Forecast)

The application consumes two free, keyless endpoints from **[Open-Meteo](https://open-meteo.com/)**:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Main as js/main.js
    participant API as js/api.js
    participant Geo as Open-Meteo Geocoding API
    participant Forecast as Open-Meteo Forecast API
    participant Render as js/render.js

    User->>Main: Types city name (e.g. "Tokyo")
    Main->>API: searchCities("Tokyo") [Debounced >= 380ms]
    API->>Geo: GET /v1/search?name=Tokyo&count=5
    Geo-->>API: 200 OK (Candidate list)
    API-->>Main: Parsed candidate array
    Main->>Render: renderSuggestions()

    User->>Main: Submits form or selects suggestion
    Main->>API: findCity("Tokyo") & getWeather(lat, lon)
    API->>Forecast: GET /v1/forecast?latitude=35.69&longitude=139.69&current=...&hourly=...&daily=...
    Forecast-->>API: 200 OK (Current + 24h Hourly + 5-day Daily)
    API-->>Main: Validated Weather Payload
    Main->>Render: Hero + Solar Arc + Hourly + Advisory + 5-Day Forecast
```

---

## Security & Accessibility

- **XSS Prevention**: Zero `innerHTML` usage with API or user-derived data. All DOM nodes are built via `document.createElement`, `textContent`, and `document.createElementNS`.
- **Strict Content Security Policy (CSP)**:
  ```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://geocoding-api.open-meteo.com https://api.open-meteo.com;">
  ```
- **WCAG 2.1 AA Accessibility**: Semantic landmarks (`header`, `main`, `footer`), `aria-live="polite"` screen-reader announcements, visible `:focus-visible` outlines, full keyboard operation, `>= 44px` tap targets, and `@media (prefers-reduced-motion: reduce)` support.

---

## How to Run Locally

> **Note**: Because the app uses native ES Modules (`<script type="module">`), it must be served over `http://` rather than opened directly as `file://`.

### Option 1: VS Code Live Server (Recommended)
1. Clone the repository:
   ```bash
   git clone https://github.com/sharath14pixel/weather-api.git
   cd weather-api
   ```
2. Open the folder in **VS Code**.
3. Right-click `index.html` and select **"Open with Live Server"** (or click **"Go Live"** in the status bar).

### Option 2: Python / Node Local Server
```bash
# Python 3
python -m http.server 8000

# Or Node.js
npx serve .
```
Then open `http://localhost:8000` in your browser.

---

## GitHub Pages Deployment

1. Push your code to the `main` branch of `https://github.com/sharath14pixel/weather-api`.
2. Open **Settings → Pages** in your GitHub repository.
3. Under **Build and deployment → Source**, select **Deploy from a branch**.
4. Choose **`main`** and **`/ (root)`**, then click **Save**.
5. Access the live site at `https://sharath14pixel.github.io/weather-api/`.

---

## Automated Unit Tests

Open `tests.html` through Live Server (e.g., `http://127.0.0.1:5500/tests.html`) to execute plain-JS assertions covering:
- `validateCity` (empty, whitespace, max length 80, Unicode characters, pure digits/symbols)
- Unit conversions (`celsiusToFahrenheit`, `kmhToMph`)
- WMO weather code coverage across all 28 supported codes
- URL encoding and `debounce` timing/cancellation
- Smart Advisory calculations (`calculateActivityIndex`, `calculateUmbrellaAlert`, `calculateClothingRecommendation`, `calculateUvAdvisory`, `calculateSolarProgress`)

---

## Error Handling Note (Internship Submission)

> The application treats error handling as a core part of the user experience rather than an afterthought. Every failure mode is mapped to a custom typed error class (`ValidationError`, `NotFoundError`, `NetworkError`, `ApiError`, `TimeoutError`) and managed through a centralized state machine in `js/state.js` (`idle | loading | success | empty | error`).
>
> - **Empty & Invalid Input**: On submit, `validateCity()` trims and collapses whitespace, enforces an 80-character limit, and checks for at least one Unicode letter (`/\p{L}/u`). Invalid inputs display an inline error linked via `aria-describedby` and `aria-invalid="true"` without making any network call.
> - **City Not Found**: If the Open-Meteo Geocoding API returns no matching results, `findCity()` throws a `NotFoundError` with clear spelling guidance.
> - **Network Failure, Timeout & Non-OK Responses**: `fetchJson()` enforces an 8-second `AbortSignal` timeout, verifies `response.ok` before parsing JSON, and catches malformed payloads. Transient network failures and HTTP `5xx` errors automatically trigger one retry with exponential backoff before rendering an accessible error card with a **"Try Again"** button.
> - **Geolocation Denial & Race Conditions**: `navigator.geolocation` denials fall back to friendly search guidance, while each new search aborts any prior in-flight `AbortController` so stale responses can never overwrite newer results.
