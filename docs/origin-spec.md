# MARTA Transit App - Complete Project Specification

## Table of Contents
1. [Project Overview](#project-overview)
2. [Problem Statement](#problem-statement)
3. [Technical Stack](#technical-stack)
4. [Architecture & Design Principles](#architecture--design-principles)
5. [Core Features](#core-features)
6. [API Integration](#api-integration)
7. [Data Management & Caching](#data-management--caching)
8. [Internationalization](#internationalization)
9. [PWA Requirements](#pwa-requirements)
10. [UI/UX Guidelines](#uiux-guidelines)
11. [Legal & Compliance](#legal--compliance)
12. [Development Timeline](#development-timeline)
13. [Launch Strategy](#launch-strategy)
14. [Future Enhancements](#future-enhancements)

---

## Project Overview

### What We're Building
A Progressive Web App (PWA) for real-time MARTA bus tracking in Atlanta, focused on providing a superior user experience for daily commuters.

### Target Users
- Daily MARTA bus commuters in Atlanta
- Primary focus: Virginia-Highland area (Route 36 & 102)
- Users frustrated with bus cancellations and poor real-time information

### Why This Project Exists
- MARTA's official website is "okay" but not optimized for quick mobile checks
- Existing apps (Transit, Google Maps) have poor UX for Atlanta-specific use cases
- Route cancellations are frequent and current solutions don't handle them well
- Terminus app (by Chad Etzel) has excellent train support but limited bus features

### Unique Value Proposition
- **Better UX** than MARTA's website
- **Faster** than Google Maps for quick checks
- **Focused** on Atlanta (unlike generic Transit app)
- **Real-time data** (unlike static schedules)
- **Free and open source**

---

## Problem Statement

### Personal Pain Point
- Route 36 (preferred) frequently canceled
- Route 102 (backup) is 12-min walk away
- Need quick way to check: "Is my bus actually coming?"
- Current solutions require too many taps/clicks

### User Journey Problems
1. Open MARTA website or Google Maps
2. Navigate to stop/route
3. Wait for page load
4. Check if bus is running
5. Too slow for morning commute decisions

### Our Solution
- One-tap access to favorite stops
- Geolocation for nearby stops
- Real-time arrivals immediately visible
- Clear indication of cancellations

---

## Technical Stack

### Frontend
- **Framework:** React 18+ with TypeScript
- **Build Tool:** Vite (fast dev server, optimized builds)
- **Styling:** Tailwind CSS (utility-first, mobile-optimized)
- **State Management:** React Context API (sufficient for MVP)
- **i18n:** react-i18next (English + Spanish)

### Hosting & Deployment
- **Hosting:** Vercel (free tier)
  - Unlimited bandwidth
  - Auto-deploy from GitHub
  - Preview deployments for PRs
  - Custom domain support
- **Source Control:** GitHub (public repo)
- **CI/CD:** Vercel's built-in deployment

### APIs & Data Sources
- **MARTA Bus Real-time:** GTFS-Realtime feeds (no API key)
- **MARTA Rail Real-time:** RESTful API (free API key, optional)
- **Geolocation:** Browser Geolocation API
- **Maps (future):** Potentially Mapbox/Google Maps

### Data Storage
- **localStorage:** User favorites, cached schedules
- **Service Worker Cache:** Static assets, offline support
- **In-memory State:** Real-time arrivals during session

---

## Architecture & Design Principles

### Component Architecture

#### Dumb Components (Presentational)
```typescript
// ✅ Good - Just renders props
interface StopCardProps {
  routeNumber: string;
  arrivalTime: number;
  status: 'on-time' | 'delayed' | 'canceled';
  showAlert?: boolean;
}

function StopCard({ routeNumber, arrivalTime, status, showAlert }: StopCardProps) {
  return (
    <div className="card">
      <h3>Route {routeNumber}</h3>
      <p>{arrivalTime} min</p>
      <StatusBadge status={status} />
      {showAlert && <Alert>Route canceled</Alert>}
    </div>
  );
}
```

#### Smart Components (Container)
```typescript
// Handles logic, data fetching, business rules
function StopCardContainer({ stopId }: { stopId: string }) {
  const stop = useMartaStop(stopId);
  const user = useUser();
  
  return (
    <StopCard
      routeNumber={stop.route}
      arrivalTime={stop.arrival}
      status={stop.status}
      showAlert={shouldShowAlert(stop, user)}
    />
  );
}
```

### Business Logic Separation
- **Pure functions** for all business logic
- **Framework-agnostic** core utilities
- **Easy to test** without React
- **Easy to migrate** if needed

```typescript
// utils/stopHelpers.ts
export function shouldShowAlert(stop: Stop, user: User): boolean {
  return stop.route === "36" && 
         stop.status === "canceled" && 
         user.area === "virginia-highland";
}

export function formatArrivalTime(minutes: number): string {
  if (minutes < 1) return "Arriving";
  if (minutes === 1) return "1 min";
  return `${minutes} min`;
}
```

### Project Structure
```
src/
├── components/
│   ├── ui/              # Dumb components
│   │   ├── StopCard.tsx
│   │   ├── Badge.tsx
│   │   └── Alert.tsx
│   └── containers/      # Smart components
│       ├── StopCardContainer.tsx
│       └── NearbyStopsContainer.tsx
├── services/
│   ├── martaApi.ts      # API calls
│   └── geolocation.ts   # Browser geolocation
├── utils/
│   ├── stopHelpers.ts   # Business logic
│   ├── cache.ts         # Caching utilities
│   └── formatting.ts    # Display formatting
├── hooks/
│   ├── useMartaStop.ts
│   └── useGeolocation.ts
├── types/
│   └── marta.ts         # TypeScript interfaces
├── i18n/
│   ├── en.json
│   └── es.json
└── App.tsx
```

---

## Core Features

### 1. Stops Near Me
**Description:** Show nearby MARTA stops based on user location

**Requirements:**
- Request geolocation permission on first use
- Calculate distance to all stops
- Sort by proximity
- Show top 5-10 closest stops
- Display walking time estimate
- Refresh when user moves significantly

**Technical Details:**
- Use Browser Geolocation API
- Calculate distance using Haversine formula
- Store stop coordinates from GTFS static data
- Update every 60 seconds if user grants continuous location

### 2. Favorites
**Description:** Save frequently used stops for quick access

**Requirements:**
- Add/remove stops from favorites
- Show favorites at top of homepage
- Persist across sessions
- Quick access without geolocation
- Star/heart icon to favorite

**Technical Details:**
- Store in localStorage as JSON array
- Key: `marta-favorites` (array of stop IDs)
- Sync with real-time data on load
- Max 10 favorites (prevents clutter)

### 3. Real-time Arrivals
**Description:** Show live bus arrival times for a stop

**Requirements:**
- Display all routes serving a stop
- Show next 2-3 arrivals per route
- Clear indication of canceled routes
- Auto-refresh every 30 seconds
- Show "Arriving" for buses <1 min away
- Show last updated timestamp

**Technical Details:**
- Fetch from GTFS-Realtime vehicle positions
- Parse Protocol Buffers format
- Calculate arrival time from vehicle position
- Match with static schedule data
- Handle missing/stale data gracefully

### 4. Route Status Alerts
**Description:** Show service disruptions and cancellations

**Requirements:**
- Display active alerts for routes
- Show cancellations prominently
- Link to MARTA's service alerts page
- Cache alerts for 5 minutes
- Show alert icon on affected routes

---

## API Integration

### MARTA Bus Real-time (GTFS-Realtime)

#### Vehicle Positions
```
URL: https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/vehicle/vehiclepositions.pb
Format: Protocol Buffers
Authentication: None required
```

**What it provides:**
- Current location of all buses (lat/lng)
- Vehicle ID
- Route ID
- Trip ID
- Speed
- Timestamp

**Usage:**
```typescript
async function fetchVehiclePositions(): Promise<VehiclePosition[]> {
  const response = await fetch(
    'https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/vehicle/vehiclepositions.pb'
  );
  const buffer = await response.arrayBuffer();
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
    new Uint8Array(buffer)
  );
  return feed.entity;
}
```

#### Trip Updates
```
URL: https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/tripupdate/tripupdates.pb
Format: Protocol Buffers
Authentication: None required
```

**What it provides:**
- Delays and schedule deviations
- Stop arrival predictions
- Trip cancellations

### MARTA Rail Real-time (Optional)
```
URL: https://developerservices.itsmarta.com:18096/itsmarta/railrealtimearrivals/developerservices/traindata?apiKey=xxxx
Format: JSON
Authentication: Free API key required
```

**To add rail support:**
1. Register at MARTA developer portal
2. Get free API key
3. Store in `.env.local` (git ignored)
4. Reference as `import.meta.env.VITE_MARTA_API_KEY`

### GTFS Static Data
```
URL: https://itsmarta.com/google_transit_feed/google_transit.zip
Format: ZIP containing CSV files
Update Frequency: Weekly/monthly
```

**Files needed:**
- `stops.txt` - All stop locations and names
- `routes.txt` - Route information
- `trips.txt` - Trip definitions
- `stop_times.txt` - Schedule information

**Usage:**
- Download and parse on app startup
- Cache in localStorage for 24 hours
- Use for stop names, route colors, schedules

---

## Data Management & Caching

### Caching Strategy

#### Cache Durations
```typescript
const CACHE_DURATION = {
  REAL_TIME: 30 * 1000,           // 30 seconds - bus arrivals
  ALERTS: 5 * 60 * 1000,          // 5 minutes - service alerts
  SCHEDULES: 24 * 60 * 60 * 1000, // 24 hours - static GTFS data
} as const;
```

#### Implementation Pattern
```typescript
// utils/cache.ts

export function isCacheStale(key: string, maxAge: number): boolean {
  const timestamp = parseInt(
    localStorage.getItem(`${key}-timestamp`) || '0'
  );
  return Date.now() - timestamp > maxAge;
}

export function getCached<T>(key: string, maxAge: number): T | null {
  if (isCacheStale(key, maxAge)) return null;
  
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

export function setCache(key: string, data: unknown): void {
  localStorage.setItem(key, JSON.stringify(data));
  localStorage.setItem(`${key}-timestamp`, Date.now().toString());
}

// Usage
const schedules = getCached<Schedule[]>('gtfs-schedules', CACHE_DURATION.SCHEDULES);
if (!schedules) {
  const fresh = await fetchSchedules();
  setCache('gtfs-schedules', fresh);
}
```

### Storage Layers

#### localStorage (Persistent)
- User favorites
- GTFS static data (stops, routes, schedules)
- Cache timestamps
- User preferences (language, theme)

#### sessionStorage (Not Used)
- Too short-lived for our use case
- Data cleared on tab close

#### In-memory State (React)
- Real-time arrivals for current session
- Active service alerts
- Current user location

#### Service Worker Cache (PWA)
- Static assets (JS, CSS, images)
- API responses for offline mode
- GTFS static data as fallback

### Why Unix Timestamps
```typescript
// ✅ Simple, reliable
const timestamp = Date.now(); // milliseconds since Unix epoch
const age = Date.now() - timestamp;
const isStale = age > maxAge;

// ❌ Don't do this - parsing overhead, timezone issues
const timestamp = new Date().toISOString();
const age = new Date().getTime() - new Date(timestamp).getTime();
```

**Benefits:**
- Just a number (easy comparison)
- No timezone issues
- No date parsing
- Universal (works in all languages)
- Same as Java's `System.currentTimeMillis()`

---

## Internationalization

### Supported Languages
1. **English** (default/fallback)
2. **Spanish** (secondary)

### Implementation

#### Structure
```typescript
// i18n/en.json
{
  "stops.nearby": "Stops Near Me",
  "stops.favorites": "Favorites",
  "arrival.minutes": "{{minutes}} min",
  "arrival.arriving": "Arriving",
  "status.onTime": "On Time",
  "status.delayed": "Delayed",
  "status.canceled": "Canceled",
  "alert.routeCanceled": "Route canceled"
}

// i18n/es.json
{
  "stops.nearby": "Paradas Cerca",
  "stops.favorites": "Favoritos",
  "arrival.minutes": "{{minutes}} min",
  "arrival.arriving": "Llegando",
  "status.onTime": "A Tiempo",
  "status.delayed": "Retrasado",
  "status.canceled": "Cancelado",
  "alert.routeCanceled": "Ruta cancelada"
}
```

#### Configuration
```typescript
// i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import es from './es.json';

i18n
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    lng: 'en', // Default language
    resources: {
      en: { translation: en },
      es: { translation: es }
    },
    interpolation: {
      escapeValue: false // React already escapes
    }
  });
```

#### TypeScript Typing
```typescript
// Ensure Spanish has same keys as English
const es: typeof en = {
  "stops.nearby": "Paradas Cerca",
  // TypeScript will error if keys don't match
};
```

### Time Format Notes
- **Minutes:** "min" works in both languages
- **Hours:** "hr" (English) vs "h" (Spanish)
- For bus arrivals, we only need minutes

---

## PWA Requirements

### Manifest File
```json
// public/manifest.json
{
  "name": "Atlanta Transit - Unofficial MARTA Tracker",
  "short_name": "ATL Transit",
  "description": "Real-time MARTA bus arrivals for Atlanta",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0066CC",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Service Worker
- Cache static assets
- Cache GTFS static data
- Network-first for real-time data
- Cache-first for static resources
- Offline fallback page

### Installation Instructions
- Show banner on first visit: "Add to home screen for quick access"
- Explain iOS: Tap Share icon (□↑) → Add to Home Screen
- Explain Android: Browser will show install prompt
- Dismissible (store in localStorage)

---

## UI/UX Guidelines

### Design Principles
1. **Speed over features** - Get info fast
2. **Mobile-first** - Design for one-handed use
3. **Clear hierarchy** - Most important info biggest
4. **Universal icons** - Minimize text where possible
5. **Glanceable** - Understand in 2 seconds

### Color System
- **On-time:** Green (#22c55e)
- **Delayed:** Yellow (#eab308)
- **Canceled:** Red (#ef4444)
- **Primary:** Blue (#0066CC) - MARTA-adjacent
- **Background:** White/Light gray
- **Text:** Dark gray (#1f2937)

### Typography
- **Headers:** Bold, large (24-32px)
- **Arrival times:** Extra large (32-48px)
- **Body text:** 16px minimum (readable on mobile)
- **Font:** System font stack (fast, native)

### Key Screens

#### Homepage
```
┌─────────────────────────┐
│  🏠 Favorites    ⭐     │
├─────────────────────────┤
│                         │
│  Route 36               │
│  Virginia Ave @ N High  │
│  ⏱ 3 min                │
│  ⏱ 18 min               │
│                         │
│  Route 102              │
│  Ponce @ Barnett        │
│  🚫 Canceled            │
│                         │
├─────────────────────────┤
│  📍 Stops Near Me       │
│                         │
│  [Automatically loads   │
│   based on location]    │
└─────────────────────────┘
```

#### Stop Detail
```
┌─────────────────────────┐
│  ← Virginia @ N High ⭐ │
├─────────────────────────┤
│                         │
│  Route 36               │
│  Midtown → Decatur      │
│                         │
│  ⏱ Arriving             │
│  ⏱ 15 min               │
│  ⏱ 30 min               │
│                         │
│  Route 2                │
│  North Ave → East Lake  │
│                         │
│  ⏱ 8 min                │
│  ⏱ 23 min               │
│                         │
│  Last updated: 2 sec ago│
└─────────────────────────┘
```

### Interaction Patterns
- **Pull to refresh** - Update real-time data
- **Tap stop** - View arrivals
- **Swipe left on stop** - Remove from favorites
- **Long press** - Add to favorites
- **Auto-refresh** - Every 30 seconds when viewing stop

---

## Legal & Compliance

### MARTA Trademark Policy
From MARTA's developer resources:

> "You further agree not to use, copy, modify, display, or distribute any MARTA Marks for any commercial or non-commercial purpose, including but not limited to the development of apps, websites, or any digital media, without prior written consent from MARTA."

### What This Means
- ❌ Cannot use MARTA logo
- ❌ Cannot use "MARTA" in app name
- ✅ Can use MARTA's public data
- ✅ Can reference "MARTA" descriptively
- ✅ Can say "Unofficial MARTA tracker"

### App Naming
- **Good:** "Atlanta Transit" or "ATL Bus Tracker"
- **Bad:** "MARTA App" or "Official MARTA"

### Branding
- Use generic transit icons (🚍, 🚏)
- Create own logo (not derived from MARTA's)
- Clearly label as "Unofficial"
- Credit: "Data provided by MARTA"

### Disclaimer
Include in About/Settings:
> "This is an unofficial app and is not affiliated with or endorsed by MARTA. Real-time data provided by MARTA's public APIs."

---

## Development Timeline

### Realistic Schedule (60-90 min/day)

#### Week 1: Foundation
- Day 1-2: Vite + React + TypeScript setup
- Day 3-4: Get MARTA API working, display raw data
- Day 5: Basic stop list rendering

#### Week 2: Core Features
- Day 1-2: Geolocation + "Stops Near Me"
- Day 3-4: Real-time arrivals display
- Day 5: Route status indicators

#### Week 3: Polish
- Day 1-2: Favorites (localStorage)
- Day 3-4: UI/UX improvements, Tailwind styling
- Day 5: Responsive design

#### Week 4: PWA & i18n
- Day 1-2: PWA setup (manifest, service worker)
- Day 3-4: Spanish translations
- Day 5: Deploy to Vercel

#### Week 5-6: Testing & Iteration
- Use daily on actual commute
- Fix bugs discovered in real usage
- Refine UX based on experience
- Performance optimization

#### Week 7-8: Launch Prep
- Final polish
- README documentation
- Screenshots for Reddit
- Soft launch on r/Atlanta

### Total: 6-8 weeks to public launch

---

## Launch Strategy

### Phase 1: Personal Use (Week 5-6)
- Use yourself daily
- Fix critical bugs
- Validate core functionality
- Ensure it solves your problem

### Phase 2: Soft Launch (Week 7-8)
**Reddit Posts:**
- r/Atlanta (main audience)
- r/MARTA (targeted)

**Post Template:**
> **Title:** Built a simple site for real-time MARTA bus arrivals
> 
> Got tired of Route 36 cancellations screwing up my commute, so I built [yoursite.com] - a quick way to check real-time bus arrivals.
> 
> Features:
> - Real-time arrivals (actually live, not just schedules)
> - Stops near you via GPS
> - Save favorite stops
> - Works on iPhone/Android (just bookmark it)
> 
> It's free, no ads, open source. Built by a frustrated Atlanta commuter.
> 
> Feedback welcome!

**Keep it humble:**
- Don't oversell
- Admit it's early/rough
- Ask for feedback
- Show you're solving your own problem

### Phase 3: Iterate Based on Feedback
- Monitor Reddit comments
- Fix reported bugs quickly
- Add requested features if reasonable
- Build credibility through responsiveness

### Phase 4: Optional - Contact Chad (Terminus dev)
**Only if:**
- Your app is stable and well-used
- You have real-time bus data working well
- You can show traction (100+ users?)

**Message template:**
> Hey Chad - I'm a daily MARTA commuter who built an open-source PWA for real-time bus tracking [link]. Love Terminus for trains but noticed buses use static schedules. 
> 
> Would you be open to discussing real-time bus integration? Happy to contribute code or collaborate.

### Metrics to Track
- Daily active users (via analytics)
- Most used features
- Most viewed routes/stops
- Bug reports
- Feature requests

---

## Future Enhancements

### Phase 2 Features (Post-Launch)
1. **Route planning** - Multi-leg trips
2. **Service alerts** - Push notifications for favorite routes
3. **Arrival predictions** - ML model for better ETAs
4. **Crowdsourced data** - Users report bus fullness
5. **Historical reliability** - Track which routes cancel most

### Phase 3 Features (If Popular)
1. **Native app wrapper** - Capacitor for App Store
2. **Backend API** - Historical data, user accounts
3. **Rail integration** - Real-time train arrivals
4. **Trip history** - Track your commutes
5. **Share stops** - Send stop link to friends

### Technical Debt to Address
- Add proper error boundaries
- Implement retry logic for failed API calls
- Add loading skeletons
- Optimize bundle size
- Add E2E tests (Playwright)
- Performance monitoring

### Accessibility Improvements
- Screen reader support
- High contrast mode
- Larger text option
- Keyboard navigation
- Voice commands (future)

---

## Development Best Practices

### Git Workflow
- **main** branch - Production, always deployable
- **develop** branch - Integration branch
- **feature/** branches - Individual features
- Squash merge to main
- Semantic commit messages

### Code Quality
- TypeScript strict mode
- ESLint + Prettier
- Pre-commit hooks (Husky)
- Component tests for utilities
- Integration tests for critical paths

### Performance
- Code splitting by route
- Lazy load components
- Minimize bundle size
- Optimize images
- Use production builds

### Documentation
- README with setup instructions
- API documentation (JSDoc)
- Architecture decision records
- Inline comments for complex logic

---

## Resources & References

### MARTA Developer Resources
- Developer Portal: https://itsmarta.com/app-developer-resources.aspx
- GTFS Static: https://itsmarta.com/google_transit_feed/google_transit.zip
- Bus Real-time: https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/vehicle/vehiclepositions.pb

### Technical Documentation
- GTFS Specification: https://developers.google.com/transit/gtfs
- GTFS-Realtime: https://developers.google.com/transit/gtfs-realtime
- Protocol Buffers: https://developers.google.com/protocol-buffers

### Similar Projects (Inspiration)
- Terminus (iOS): https://rideterminus.app
- Transit App: https://transitapp.com
- Citymapper: https://citymapper.com

### Tools & Libraries
- Vite: https://vitejs.dev
- React: https://react.dev
- TypeScript: https://www.typescriptlang.org
- Tailwind CSS: https://tailwindcss.com
- react-i18next: https://react.i18next.com
- Vercel: https://vercel.com

---

## Contact & Attribution

**Developer:** tckelly  
**GitHub:** [Your GitHub Profile]  
**License:** MIT  
**Data Source:** MARTA (Metropolitan Atlanta Rapid Transit Authority)

---

## Appendix: Key Decisions & Rationale

### Why PWA over Native App?
- **Faster to build** - Use existing web skills
- **Zero deployment friction** - No App Store approval
- **Instant updates** - Push changes immediately
- **Cross-platform** - Works on iOS and Android
- **No $99/year fee** - Apple Developer account not needed
- **Can always wrap later** - Capacitor if needed

### Why Vercel over GitHub Pages?
- **Better DX** - Auto-deploy, preview builds
- **Faster** - Global CDN
- **Serverless functions** - If we need backend later
- **Still free** - No cost for personal projects

### Why English + Spanish Only?
- **Spanish covers 95%+** of non-English Atlanta transit users
- **Keep scope manageable** - Ship faster
- **Can add more later** - Vietnamese/Korean/Chinese if users request

### Why No Backend Initially?
- **MARTA API is public** - Can call directly
- **localStorage works** - No user accounts needed
- **Simpler architecture** - Fewer things to break
- **Add later if needed** - For historical data, etc.

### Why React over Svelte/Vue?
- **Most familiar** - Matches your day job
- **Best ecosystem** - Libraries, tooling, examples
- **Easiest to hire for** - If project grows
- **Portfolio value** - Most companies use React

---

## Final Notes

This is a living document. As the project evolves:
- Update this spec with new decisions
- Document why choices were made
- Keep it as reference for future features
- Share with contributors if project grows

**Remember:** The goal is to build something useful for your daily commute, not to build the perfect app. Ship early, iterate based on real usage, and make something that solves your problem.

**Made with ❤️ by a frustrated Atlanta commuter**