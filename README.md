# Previs Tool — by Leverage AI

A pre-visualisation tool for directors and cinematographers, in the browser.

- **Floor Plan** — build the location (rooms, walls, doors, windows), place subjects, Nanlite/Nanlux lights and cameras.
- **Live View** — see it in 3D through a Sony FX3 + Sigma Aizu primes with physically based exposure, depth of field, white balance and a Sony-style monitor (zebras, false colour, scopes).
- **Setups** — productions → scenes → floor plan setups and storyboard frames, captured straight from the plan and the camera; 6-panel storyboards with Print / PDF.

Milestones: see [docs/ROADMAP.md](docs/ROADMAP.md).

## Development
```
npm install
npm run serve   # dev server on http://localhost:8080
npm run build   # production build in dist/
npm run lint
```

## Deploy (Vercel)
Framework preset **Vue.js** · build `npm run build` · output `dist`. No environment variables.

Saved productions live in each visitor's browser (IndexedDB) for now; export/import moves them between machines.
