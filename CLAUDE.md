# Fantasy Dashboard — CLAUDE.md

## Project Overview

React + Vite single-page dashboard for the Sleeper dynasty fantasy football league "The Ragtag Band of Misfits". No router, no UI library, no chart library. Pure CSS dark theme, custom SVG charts, all analytics computed client-side.

## Season Config

```js
// src/lib/sleeper.jsx
USER_ID  = '591358817996939264'          // harryz
SEASONS  = { '2024': '1130652624027676672', '2025': '1185277150819115008' }
DEFAULT_SEASON = '2025'
```

## Project Structure

```
fantasy-dashboard/
├── index.html                  ← Google Fonts (DM Sans, DM Mono)
├── vite.config.js
├── package.json
└── src/
    ├── main.jsx                ← ReactDOM.createRoot
    ├── App.jsx                 ← Season switcher, tab state, top-level render
    ├── App.css                 ← All styles (CSS variables, layout, components)
    ├── lib/
    │   ├── sleeper.jsx         ← API helpers, constants, fetchAllMatchups/Transactions
    │   └── analytics.jsx       ← Pure functions: H2H, luck, superlatives, narrative
    ├── hooks/
    │   └── useLeagueData.jsx   ← Parallel data fetching, merges "all time" mode
    └── components/
        ├── Standings.jsx
        ├── Matchups.jsx
        ├── PointsChart.jsx     ← Custom SVG line chart with hover tooltip
        ├── Transactions.jsx
        ├── Rivalries.jsx       ← Expandable rivalry rows, narrative, game log
        ├── Superlatives.jsx    ← Award cards with emoji + stat + detail
        └── ScheduleLuck.jsx    ← Expected vs actual wins, bar chart
```

## Sleeper API Reference

Base URL: `https://api.sleeper.app/v1`

| Endpoint | Description |
|---|---|
| `GET /league/<id>` | League settings and metadata |
| `GET /league/<id>/rosters` | All 12 rosters with wins/losses/fpts |
| `GET /league/<id>/users` | User display names and avatars |
| `GET /league/<id>/matchups/<week>` | Matchup scores for a week |
| `GET /league/<id>/winners_bracket` | Playoff bracket |
| `GET /league/<id>/losers_bracket` | Toilet bowl bracket |
| `GET /league/<id>/transactions/<week>` | Trades, waivers, FA moves |
| `GET /state/nfl` | Current NFL week |
| `https://sleepercdn.com/avatars/thumbs/<avatar_id>` | Team avatar image |

All endpoints are public (no auth). Data is fetched via plain `fetch()`.

## Analytics Functions (`src/lib/analytics.jsx`)

### `buildRosterMap(rosters, users) → object`
Returns `{ [rosterId]: { rosterId, ownerId, displayName, avatar, username } }`.

### `flattenMatchups(allMatchupsRaw, season) → array`
Converts `[{week, data}]` from `fetchAllMatchups` into flat entries `{ week, season, rosterId, points, matchupId }`.

### `buildGames(flatEntries) → array`
Groups flat entries into head-to-head game objects: `{ week, season, team1Id, team1Points, team2Id, team2Points, winnerId }`.

### `computeH2H(games, rosterMap) → object`
Computes win/loss records for every pair. Returns keyed object with `{ teamAId, teamBId, wins, totalGames, avgMargin, closestGame, biggestBlowout, games[] }`.

### `generateRivalryNarrative(rec, rosterMap) → string`
Generates a natural-language string like "HarryZ dominates JohnDoe 4–1, winning by 23 pts on average."

### `computeScheduleLuck(games, rosterMap) → array`
For each team: actual wins, expected wins (beat how many opponents each week / total opponents), and `luckDelta = actual − expected`. Sorted by delta descending.

### `computeSuperlatives(games, rosterMap, standings) → object`
Returns: `highScore`, `lowScore`, `mostPoints`, `leastPoints`, `bestRecord`, `lucky`, `unlucky`, `biggestBlowout`, `closestWin` — each with team name, stat, and context.

## Data Flow

```
useLeagueData(season)
  ├── single season: loadSeason(leagueId, season) → rosterMap, games, standings
  │     └── computeH2H / computeScheduleLuck / computeSuperlatives
  └── "all": loadSeason × 2 in parallel → tag games with season prefix → merge rosterMaps → same analytics
```

`App.jsx` receives `data` and passes slices to each tab component. The `currentSeasonData` field always points to 2025 for week-by-week tabs (Matchups, Points, Transactions).

## Design Tokens (`App.css`)

```css
--bg: #0f1117     /* page background */
--bg2: #161b26    /* card background */
--bg3: #1e2433    /* nested surfaces */
--bg4: #252c3d    /* hover / avatar placeholder */
--border: #2a3245
--text: #e2e8f0
--text2: #94a3b8
--text3: #64748b
--blue: #3b82f6
--green: #10b981
--red: #ef4444
--gold: #f59e0b
--purple: #8b5cf6
--font: 'DM Sans'
--mono: 'DM Mono'
```

## Getting Started

```bash
cd fantasy-dashboard
npm install
npm run dev
```

Open http://localhost:5173. The dashboard auto-loads 2025 season data on mount.

## Known Constraints

- Sleeper transactions API returns player IDs (e.g. `4984`), not player names. To show names you would need to fetch the full NFL players endpoint (`/players/nfl`) which is a very large JSON (~8 MB). The Transactions tab currently displays player IDs.
- "All Time" mode tags roster IDs with season prefix (`2024_3`, `2025_3`) to prevent collisions when a roster slot was occupied by different owners across seasons.
- Regular season is assumed to be weeks 1–14 for the Points chart.
