# SimCompare

A side-by-side comparison tool for [Raidbots](https://www.raidbots.com/) simulation reports. Paste two or more report URLs and instantly see how builds stack up across DPS, talents, stats, abilities, buffs, and timelines.

**Live at [simcompare.vercel.app](https://simcompare.vercel.app)**

## Features

- **Summary** — DPS comparison with distribution overlap analysis, confidence intervals, and consistency metrics
- **Abilities** — Stacked DPS breakdown, cast efficiency scatter plot (log scale), and per-ability stats table
- **Talents** — Talent diff matrix showing which nodes each build selected, with differences-only filtering
- **Stats** — Radar chart for secondary stats, detailed primary/secondary stat comparison with delta highlighting
- **Timeline** — DPS over time with burst window detection and resource timeline
- **Buffs** — Buff uptime comparison across builds

## Tech Stack

- [Next.js](https://nextjs.org/) 16 (App Router)
- [React](https://react.dev/) 19
- [Recharts](https://recharts.org/) for data visualization
- [Tailwind CSS](https://tailwindcss.com/) v4
- Deployed on [Vercel](https://vercel.com/)

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), paste a Raidbots report URL, and add more to compare.

## How It Works

1. Paste a Raidbots Top Gear or Droptimizer report URL
2. The app fetches the simulation JSON via `/api/report/[reportId]`
3. Talent trees are decoded client-side and matched against Blizzard's talent data via `/api/talent-tree/[specId]`
4. All comparison views render from the parsed report data — no data is stored server-side

## License

MIT
