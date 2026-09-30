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
| M5 | **Furniture & props** — couches, tables, beds, practicals placed on furniture | |
| M6 | **Room presets** — bedroom, kitchen, lounge, office as editable starting points | |
| M7 | **Save / load / undo** | |
| M8 | **Realistic subjects** — human models, height, pose | |

## Later ideas
- WebGPU renderer with WebGL2 fallback
- Installable offline web app (PWA); optional desktop wrapper
- Grip: flags, floppies, bounce boards, diffusion frames, negative fill
- Gear list export (every fixture + modifier in the scene)
- Lighting diagram PDF export
- Storyboard frames captured from placed cameras
- More brands: Aputure, ARRI, Astera, Godox
