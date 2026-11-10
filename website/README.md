# ethanyanghq.com

The solar system at true scale, drawn where everything is right now. Black, white, one pixel per pixel, no size floor: a body too small to cover a pixel centre is not drawn, and its label marks the spot.

## Run

    python3 -m http.server 8000 -d website     # from the repo root, then open http://localhost:8000

Static files only. No build step for the site itself.

## Controls

Scroll or pinch to zoom about the cursor, drag to pan, click a body or its label to fly there. `Esc` flies out to the whole system. `]` and `[` run time ×10 faster or slower, `0` returns to now.

## Where the numbers come from

- Sun, planets, Pluto, the Moon and the Galilean moons: [astronomy-engine](https://github.com/cosinekitty/astronomy) 2.1.19 (`vendor/`, MIT), VSOP87-based, ±1 arcminute.
- All other named moons: JPL SSD [mean orbital elements](https://ssd.jpl.nasa.gov/sats/elem/) and [mean radii](https://ssd.jpl.nasa.gov/sats/phys_par/), fetched into `data/moons.json` by `tools/fetch_moons.py`. Moons known only by a provisional designation (S/2004 S 12 and ~290 others, mostly Saturn's) are left out. Each moon is propagated as a precessing Kepler ellipse in its published reference plane (ecliptic, local Laplace plane, or planet equator). A `~` before a label means the published period is too coarse to fix the moon's position along its orbit today (mostly the small inner moons of Uranus and Neptune, and Mars' two).
- Radii are mean radii; moons without a published radius are drawn as 2 km, which never reaches a pixel.

## Preview as an artifact

    python3 tools/bundle.py > preview.html

writes a single-file version that loads astronomy-engine from jsDelivr.
