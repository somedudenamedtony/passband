# Passband

A Progressive Web App for working amateur radio satellites: which passes are worth your time,
where to point, what to tune to, and a log that LoTW accepts. Built for beginners with a handheld
and an antenna, useful to anyone chasing grids.

Works offline in the field once loaded. Nothing you enter leaves your device.

- **[SPEC.md](SPEC.md)** — what it does and the decisions behind it.
- Status: **M1** (scaffold, satellite catalog, pass prediction, Tonight screen) built. M2 (live pass) is next.

## Develop

Needs Node.js 22+. In PowerShell or any shell:

```
npm install
npm run catalog     # fetch CelesTrak + SatNOGS, merge data/overlay → public/catalog.json
npm run dev         # http://localhost:5173/passband/
```

| Command | What it does |
|---|---|
| `npm run check` | Typecheck, spec lint (D2/D6/D16), unit tests |
| `npm run build` | Production build into `dist/` |
| `npm run test:e2e` | Offline test (§10) against the production build; run `npm run build` first |
| `npx tsx scripts/make-icons.ts` | Re-render the PNG icons from `public/icon.svg` |

## Data

`.github/workflows/deploy.yml` rebuilds `catalog.json` daily and deploys to GitHub Pages
(Settings → Pages → Source: **GitHub Actions**). Curated facts live in `data/overlay/`, one file
per satellite; any override of SatNOGS data carries a `source` (D6).

MIT licensed — see [LICENSE](LICENSE).
