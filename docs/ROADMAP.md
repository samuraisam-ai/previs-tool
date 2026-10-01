# Previs — Roadmap

Two views on one scene: **Floor Plan** (2D, where everything is edited) and **Live View** (3D, look-only).

| # | Milestone | Status |
|---|---|---|
| M1 | **Foundation** — Floor Plan + Live View on one shared scene; subject, light, camera | ✅ Done |
| M2 | **Lighting library** — Nanlite/Nanlux fixtures (COB, panels, tubes, practicals), modifiers (softboxes, lanterns, parabolics, fresnels, projection), Kelvin/HSI colour, dimmer, real output (lux@1m), exposure + light meter | ✅ Done |
| M3 | **Camera & lens** — Sony FX3 + Sigma Aizu Prime Line (18–125mm T1.3); Sony-style monitor: shutter angle/speed, T-stop, ISO (dual base), variable ND + polarizer rings, WB/tint, physically accurate bokeh & focus (AF/MF), camera tilt wheel, frame lines, grid, zebras, false colour, M.M. meter, histogram / RGB waveform / RGB parade / vectorscope, DISP toggle | ✅ Done |
| M3.1 | **Image fidelity** — fixed Babylon's per-channel 30 cd/m² PBR clamp (caused the faded/grey highlights and colour shifts when stopping down), replaced ACES with a hue-preserving Rec.709-style camera display transform (ColorChecker mean ΔE 1.7, exact reciprocity), whole-image white balance, room bounce estimate, render quality (Draft/Standard/High) at device pixel ratio | ✅ Done |
| M4 | **Build the world** — infinite 2D floor-plan canvas; Room (rectangle) and Wall (click to place, drag ends/thickness) tools; shared walls between adjoining rooms; doors (single/double/sliding, open/close with a wheel or double-click), windows, doorways; tape measure; exact dimensions for walls, rooms, openings; select/marquee, move, nudge, rotate, scale, duplicate, copy/paste, delete, undo/redo; 3D walls with openings, door leaves, glass, floors (wood/tile/concrete/carpet), ceilings for camera views, dollhouse cutaway in orbit, walls cast shadows (window/door light); bounce counts outside light only through openings; Auto render quality | ✅ Done |
| M4.5 | **Performance & reach** — render on demand (zero GPU when idle or on the Floor Plan), batched incremental 3D sync, light pool (no shader recompiles: adding a light 7.6 s → 60 ms), shadow budget by importance (shadowed-light count was the main GPU cost), camera dials re-process the last frame instead of redrawing (≈15 ms vs 60–77 ms), non-blocking GPU-downsampled scopes, draft resolution while orbiting, merged architecture meshes, device detection + Performance levels (Auto / Lite / Standard / High), tree-shaken production build (6.2 MB → 1.5 MB, 373 KB gzipped) | ✅ Done |
| M4.6 | **Tidy Floor Plan toolbar** — one single-row bar: Select · ＋ Elements ▾ (Room elements: room, wall, door, window, doorway · On set: subject, light, camera) · Measure, an active-tool chip ("Placing: Door · Esc to cancel"), icon Undo/Redo/Fit; labels collapse to icons when narrow; menu is data-driven so Furniture slots in | ✅ Done |
| M7.1 | **Field-test fixes + set tools** — Step 1 ✅ Vercel Web Analytics; doors/windows/doorways cut through overlapping walls (2D + 3D); Pointer/Hand toggle (V/H); camera PAN wheel in the Live View monitor · Step 2 ✅ corner attach/detach (Corners section in the wall panel; detached ends move alone; Attach snaps within 30 cm) · Step 3 world light presets (Morning/Day/Evening/Night) + Blackout, 180° line · Step 4 blocking T marks with traced paths and ▶ Play | In progress |
| M5 | **Furniture & props** — couches, tables, beds, practicals placed on furniture | |
| M6 | **Room presets** — bedroom, kitchen, lounge, office as editable starting points | |
| M7 | **Setups & storyboards (pre-production) + save/load** — Setups page: Production → Scene (number, INT/EXT, location, time of day, synopsis) → floor plan setups + storyboard frames; each capture stores its image and the full scene ("Open in Floor Plan" restores it, undoable); star selects, archive, delete, drag to reorder with auto-numbering; export/import a production as one file; storage behind a swappable `SetupsStorage` interface (IndexedDB now, account-backed database later). Step 1 ✅ Setups page + data · Step 2 ✅ capture from Floor Plan (C key or Capture button → plan + light/camera legend, save dialog with inline new production/scene, background save) · Step 3 ✅ Live View storyboard frames (◉ FRAME / C: clean graded still without zebras/false colour/OSD, shot size, movement, action, dialogue, auto camera settings) + Storyboard tab (frame strip, 6-panel pages, drag/drop, swap, click-to-place, auto-fill, editable captions, trailing new page, Print / PDF) | ✅ Done |
| M8 | **Realistic subjects** — human models, height, pose | |

## Later ideas
- WebGPU renderer with WebGL2 fallback
- Installable offline web app (PWA); optional desktop wrapper
- Grip: flags, floppies, bounce boards, diffusion frames, negative fill
- Gear list export (every fixture + modifier in the scene)
- Lighting diagram PDF export
- More brands: Aputure, ARRI, Astera, Godox
