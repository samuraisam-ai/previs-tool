# Lighting library

`fixtures.ts` holds the Nanlite / Nanlux catalog; `modifiers.ts` the softboxes, lanterns, parabolics,
fresnels and projection attachments; `photometry.ts` turns a fixture + modifier + settings into
candela, beam shape and colour for the Live View and the light meter.

## Data notes
- `luxAt1m` is the manufacturer's on-axis figure at 5600K, 1 m. For COB spotlights it is measured with
  the included reflector. Since illuminance at 1 m equals luminous intensity, it is used directly as candela.
- Entries with `approx: true` were not confirmed from a published spec and are estimated from sibling
  models. The UI shows them with "≈".
- Modifier `transmission` values are previs-grade estimates of on-axis output relative to the
  reflector spec (softboxes ~0.15–0.4, projection lenses concentrate above 1).
- Specs gathered September 2026.

## Sources
- Nanlite product pages: https://nanliteus.com/ · https://www.nanlite.com/
- Nanlux Evoke: https://www.nanlux.com/
- B&H Photo spec sheets (FC-500C, FC-720C, FS-300B, FS-60B, PavoTube II 15X/60X, PavoSlim 120C, Evoke 1200B/2400B/900C)
- Newsshooter announcements and reviews (Forza II series, FC-60B/120B, FC-300B/500B, FC-720C, FC-1200B/C,
  PavoSlim 60C/120C/240C/360C, Alien 150C/300C, PavoTube II 15C/30C, projection attachments, FL-20G)
- CineD (PJ-BM 19/36, PJ-BM-25-45, PJ-FMM-18-36, PavoBulb 10C, LitoLite 5C)
