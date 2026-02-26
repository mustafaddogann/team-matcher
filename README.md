# Team Matcher

Balance teams by skill points. Import participants via CSV/Excel or manual entry, choose 2-10 teams, and automatically generate balanced teams.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Features

- **Import**: CSV and Excel (.xlsx) with auto column detection
- **Manual entry**: Add participants inline with name, skill, role
- **Bulk add**: Paste "name, skill" lines
- **Balancing**: Greedy snake draft + local swap optimization
- **Lock/exclude**: Lock players to specific teams or exclude them
- **Manual adjustment**: Move players between teams after generation
- **Export**: Download CSV or copy formatted text to clipboard
- **Sessions**: Save/load sessions to localStorage

## Algorithm

1. **Snake draft**: Sort participants by skill descending, assign each to the team with the lowest current total
2. **Local optimization**: Try all pairwise swaps and moves between teams, accept improvements, repeat until stable (max 500 iterations)

Deterministic for the same input. Handles up to 200+ players in under a second.

## Build

```bash
npm run build    # Production build in dist/
npm run preview  # Preview production build
```

## Test

```bash
npm run test     # Run all tests
npm run test:watch  # Watch mode
```

## Sample Data

See `sample-data/` for example CSV files:
- `10-players.csv` — Basic 10-player list
- `17-players.csv` — Odd number for uneven team sizes
- `32-players-with-roles.csv` — Larger list with roles
- `import-errors.csv` — File with intentional errors for testing import
