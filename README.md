# Coat Check

**A beautiful, glanceable weather app that tells you whether or not you'll need a coat.**

Live at: **[coat-check.vercel.app](https://coat-check.vercel.app/)**

![Coat Check Screenshot](https://img.shields.io/badge/Built%20With-Next.js%2016-black?style=flat-square&logo=next.js)
![React 19](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![MapLibre](https://img.shields.io/badge/Map-MapLibre%20GL-green?style=flat-square)

---

## Features

### Smart Coat Advice
- **Instant recommendation**: "Bring a coat" / "No coat needed" / "Coat recommended but not necessary"
- Logic based on temperature, rain probability, and weather conditions for the 9 to 5 commute
- Separate advice for **current hour**, **today**, and **tomorrow**

### Live Rain Map
- Full-screen interactive map background (MapLibre GL)
- Real-time precipitation overlay from OpenWeatherMap
- Pulsing location marker showing your selected city
- Smooth animated transitions between locations

### Auto Light/Dark Theme
- Automatically switches based on sunrise/sunset at your location
- Manual override available via theme toggle button
- Smooth fade transitions when switching themes
- Uses `suncalc` library for accurate sunrise/sunset calculations

### Location Search
- Search any city worldwide with autocomplete suggestions
- Geocoding powered by Open-Meteo API
- Location persisted in localStorage across sessions

### Robust Auto-Refresh System
A hybrid approach ensures data is **always fresh** when you need it:

| Mechanism | What It Does |
|-----------|--------------|
| **Hour-based staleness** | Refreshes at the top of each hour (minute 1) |
| **Heartbeat detection** | Detects browser tab suspension (30s heartbeat, 60s tolerance) |
| **Multiple wake events** | Listens to `visibilitychange`, `focus`, and `pageshow` events |
| **LocalStorage persistence** | Survives browser restarts; only refreshes if hour changed |

### Premium UI
- **Glass-morphism cards** with spotlight hover effects
- **Smooth fade transitions** on all data updates
- **Zoom control** for map (4 levels, persisted to localStorage)
- **Countdown timer** showing minutes until next auto-refresh

---

## APIs Used

| API | Purpose | Rate Limit |
|-----|---------|------------|
| **[Open-Meteo Weather](https://open-meteo.com/)** | Weather forecasts (temperature, precipitation, conditions) | Free, unlimited |
| **[Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api)** | City search and coordinates lookup | Free, unlimited |
| **[OpenWeatherMap Tiles](https://openweathermap.org/api/weathermaps)** | Precipitation radar overlay | Free tier (1M calls/month) |
| **[CARTO Basemaps](https://carto.com/basemaps/)** | Light/dark map tiles | Free |
| **[mapcn](https://mapcn.vercel.app/)** | MapLibre React component wrapper | N/A |

---

## Architecture

```
src/
├── app/
│   ├── page.tsx                 # Main app component + refresh logic
│   ├── layout.tsx               # Root layout with theme provider
│   ├── globals.css              # Global styles + glass-panel utilities
│   │
│   ├── components/
│   │   ├── RainViewerBackground.tsx   # MapLibre map + rain overlay
│   │   ├── WeatherCard.tsx            # Morning/afternoon forecast
│   │   ├── CurrentWeatherCard.tsx     # Current hour weather
│   │   ├── Header.tsx                 # Today/Tomorrow toggle
│   │   ├── LocationSearch.tsx         # City search with autocomplete
│   │   ├── ZoomControl.tsx            # Map zoom level selector
│   │   ├── ThemeToggle.tsx            # Light/dark mode button
│   │   ├── SpotlightCard.tsx          # Glass card with hover effect
│   │   ├── SpotlightText.tsx          # Text with spotlight effect
│   │   └── LoadingScreen.tsx          # Initial loading state
│   │
│   ├── hooks/
│   │   ├── useWeather.ts        # Fetches and processes weather data
│   │   ├── useLocation.ts       # Location state + localStorage
│   │   ├── useSunCalc.ts        # Sunrise/sunset calculations
│   │   └── useCoatAdvice.ts     # Coat recommendation logic
│   │
│   └── utils/
│       ├── weatherUtils.ts      # Weather code → condition mapping
│       └── mapUtils.ts          # Map tile coordinate helpers
│
└── components/ui/
    └── map.tsx                  # MapLibre React wrapper (1200+ lines)
```

---

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with Turbopack
- **UI Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Maps**: [MapLibre GL JS](https://maplibre.org/)
- **Theme**: [next-themes](https://github.com/pacocoursey/next-themes)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Sun Calculations**: [SunCalc](https://github.com/mourner/suncalc)

---

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).

---

## Credits

- Weather data by [Open-Meteo](https://open-meteo.com/)
- Map component by [mapcn](https://mapcn.vercel.app/)
- Map tiles by [CARTO](https://carto.com/)
- Precipitation overlay by [OpenWeatherMap](https://openweathermap.org/)
- Deployed on [Vercel](https://vercel.com/)
