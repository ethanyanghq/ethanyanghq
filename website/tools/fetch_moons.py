#!/usr/bin/env python3
"""Build data/moons.json from JPL Solar System Dynamics.

Sources (fetched live):
  https://ssd.jpl.nasa.gov/sats/elem/      mean orbital elements of planetary satellites
  https://ssd.jpl.nasa.gov/sats/phys_par/  mean radii (available for the ~45 larger moons; others default to 2 km)

Only named moons are kept; provisional designations (S/2004 S 12 ...) are dropped.

Each row of the output:
  [parent, name, a_km, e, omega_deg, M_deg, i_deg, node_deg, P_days, P_apsis_yr, P_node_yr,
   frame (0 ecliptic, 1 Laplace plane, 2 planet equator), pole_RA_deg, pole_Dec_deg, epoch_JD, radius_km, half_ulp_of_P]
parent is the index of the planet in app.js's primaries list (Mars 5 ... Pluto 10). Earth's Moon is not
included; the page computes it from astronomy-engine.

Run from website/:  python3 tools/fetch_moons.py
"""
import html, json, re, sys, urllib.request

ELEM = "https://ssd.jpl.nasa.gov/sats/elem/"
PHYS = "https://ssd.jpl.nasa.gov/sats/phys_par/"
PARENT = {"Mars": 5, "Jupiter": 6, "Saturn": 7, "Uranus": 8, "Neptune": 9, "Pluto": 10}
FRAME = {"ecliptic": 0, "Laplace": 1, "equatorial": 2}
PLANETS = set(PARENT) | {"Earth"}
# JPL's table cuts names at 12 characters (and has one typo).
FIX = {"Philophrosyn": "Philophrosyne", "Magaclite": "Megaclite"}


def provisional(name):
    """Unnamed moons carry discovery designations like S2004_S_12 or S2023_U1. Skipped: they are
    mostly 2-4 km rocks known only by number, and they would bury the named moons (Saturn alone has ~230)."""
    return re.match(r"^S\d{4}_", name) is not None


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (ethanyanghq.com solar page build)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def rows(page, min_cols):
    out = []
    for tr in re.findall(r"<tr>(.*?)</tr>", page, re.S):
        tds = [re.sub(r"\s+", " ", html.unescape(re.sub("<[^>]+>", "", td))).strip()
               for td in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
        if len(tds) >= min_cols and tds[0] in PLANETS or (len(tds) >= min_cols and tds[1] in PLANETS):
            out.append(tds)
    return out


def jd_of(epoch):
    """'2000-01-01.5' -> JD. Dates are TDB; the page treats them as UTC (69 s, irrelevant here)."""
    y, m, d = epoch.split("-")
    y, m, d = int(y), int(m), float(d)
    a = (14 - m) // 12
    yy, mm = y + 4800 - a, m + 12 * a - 3
    jdn = int(d) + (153 * mm + 2) // 5 + 365 * yy + yy // 4 - yy // 100 + yy // 400 - 32045
    return jdn - 0.5 + (d - int(d))


def num(x):
    try:
        return float(x)
    except ValueError:
        return 0.0


def main():
    elem = rows(fetch(ELEM), 18)
    phys = rows(fetch(PHYS), 5)
    radius = {}
    for p in phys:
        try:
            radius[(p[0], p[1])] = float(p[4].split()[0])
        except (ValueError, IndexError):
            pass
    out, seen = [], set()
    for r in elem:
        # columns: id, planet, name, code, ephemeris, frame, epoch, a, e, w, M, i, node, P, P_apsis, P_node, RA, Dec, tilt, ref
        planet, name, frame, epoch, P = r[1], r[2], r[5], r[6], r[13]
        if planet == "Earth" or provisional(name) or (planet, name) in seen:
            continue
        seen.add((planet, name))
        name = FIX.get(name, name)
        decimals = len(P.split(".")[1]) if "." in P else 0
        out.append([PARENT[planet], name, num(r[7]), num(r[8]), num(r[9]), num(r[10]), num(r[11]), num(r[12]),
                    num(P), num(r[14]), num(r[15]), FRAME[frame], num(r[16]), num(r[17]), jd_of(epoch),
                    radius.get((planet, r[2]), 2.0), 0.5 * 10 ** -decimals])
    with open("data/moons.json", "w") as f:
        f.write(json.dumps(out, separators=(",", ":")))
    print(f"{len(out)} moons, {sum(1 for o in out if o[15] > 2.0)} with measured radii -> data/moons.json", file=sys.stderr)


if __name__ == "__main__":
    main()
