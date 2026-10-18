#!/usr/bin/env python3
"""
Structure-aware image -> ASCII converter (glyph matching + error diffusion).

Idea: treat the 95 printable ASCII glyphs as a dictionary of tiny shapes.
For every grid cell, compare the (slightly blurred) image patch against every
(equally blurred) glyph rendered in the *target* monospace font, and pick the
glyph with the smallest perceptual distance. A tone term + Floyd-Steinberg
error diffusion on the cell's mean ink recovers smooth gradients.

Outputs: text file, optional rendered PNG (mono or per-cell colour).
"""
import argparse, json, math, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

PRINTABLE = [chr(c) for c in range(32, 127)]
RAMP70 = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. "


# ----------------------------------------------------------------------------
# Glyph bank
# ----------------------------------------------------------------------------
def font_at_cell_width(font_path, cell_w_px):
    """Find the font size whose advance width of 'M' is ~cell_w_px."""
    lo, hi = 4, 400
    best = None
    while lo <= hi:
        mid = (lo + hi) // 2
        f = ImageFont.truetype(font_path, mid)
        adv = f.getlength("M")
        if adv < cell_w_px:
            lo = mid + 1
        else:
            hi = mid - 1
        if best is None or abs(adv - cell_w_px) < abs(best[1] - cell_w_px):
            best = (mid, adv)
    return ImageFont.truetype(font_path, best[0]), best[1]


def build_glyph_bank(font_path, chars, fw, fh, oversample=8, sigma=0.9):
    """Render each glyph into a (fw*os x fh*os) cell, blur, box-downsample to fw x fh.
    Returns features G (n, fw*fh) in [0,1] (ink coverage) and means (n,)."""
    bw, bh = fw * oversample, fh * oversample
    font, adv = font_at_cell_width(font_path, bw)
    ascent, descent = font.getmetrics()
    y0 = (bh - (ascent + descent)) / 2.0
    feats = []
    for ch in chars:
        im = Image.new("L", (bw, bh), 0)
        d = ImageDraw.Draw(im)
        d.text(((bw - adv) / 2.0, y0), ch, font=font, fill=255)
        im = im.filter(ImageFilter.GaussianBlur(sigma * oversample))
        im = im.resize((fw, fh), Image.BOX)
        feats.append(np.asarray(im, dtype=np.float32).ravel() / 255.0)
    G = np.stack(feats)
    return G, G.mean(axis=1)


# ----------------------------------------------------------------------------
# Image -> cell features
# ----------------------------------------------------------------------------
def srgb_to_linear(x):
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def image_to_patches(img, cols, fw, fh, cell_aspect, sigma, gamma, lo_pct, hi_pct, invert, local=0.0):
    """Resample the image to the feature grid and cut it into cells.
    Returns P (rows*cols, fw*fh) target ink in [0,1], plus mean colour per cell (rows*cols,3)."""
    W, H = img.size
    s = W / cols                      # source px per cell (horizontal)
    rows = max(1, round(H / (s * cell_aspect)))
    big = img.resize((cols * fw, rows * fh), Image.LANCZOS)
    if sigma > 0:
        big = big.filter(ImageFilter.GaussianBlur(sigma))
    rgb = np.asarray(big, dtype=np.float32) / 255.0
    lin = srgb_to_linear(rgb)
    lum = 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]
    if invert:                        # dark glyphs on light background
        lum = 1.0 - lum
    if local > 0:                     # local tone mapping: lift detail relative to surroundings
        from scipy.ndimage import gaussian_filter
        base = gaussian_filter(lum, sigma=max(fw, fh) * 4)
        lum = np.clip(lum + local * (lum - base), 0, 1)
    # contrast stretch on percentiles, then output gamma (1 = linear, ~2.2 = perceptual)
    lo, hi = np.percentile(lum, lo_pct), np.percentile(lum, hi_pct)
    lum = np.clip((lum - lo) / max(hi - lo, 1e-6), 0, 1) ** (1.0 / gamma)
    P = lum.reshape(rows, fh, cols, fw).transpose(0, 2, 1, 3).reshape(rows * cols, fh * fw)
    col = rgb.reshape(rows, fh, cols, fw, 3).mean(axis=(1, 3)).reshape(rows * cols, 3)
    return P, col, rows


# ----------------------------------------------------------------------------
# Matching
# ----------------------------------------------------------------------------
TONAL = set(" `.,'-:~^;!*+=cvxsnoe%aO#8W@")   # evenly textured glyphs allowed in flat areas
# curated set: the tonal glyphs plus true line/edge glyphs; drops letter-soup capitals
CURATED = sorted(TONAL | set("/\\|()[]{}<>_\"jlrtf7?L"))


def blue_noise(rows, cols, seed=1):
    """Cheap blue-noise approximation: high-passed white noise, zero mean, unit std."""
    from scipy.ndimage import gaussian_filter
    rng = np.random.default_rng(seed)
    w = rng.standard_normal((rows, cols)).astype(np.float32)
    b = w - gaussian_filter(w, 1.0)
    return (b / b.std()).ravel()


def match(P, G, Gmean, rows, cols, tone_weight, diffuse, ink_scale, err_clip=0.25,
          flat_ref=0.06, aniso_weight=6.0, charset=None, flat_mode="aniso", dither=0.0):
    """Pick a glyph per cell.
    distance = ||patch - glyph||^2 * k + tone_weight*(mean diff)^2 + (1-k)*aniso_weight*u_g
    where k in [0,1] is the cell's local contrast (so flat areas are matched on tone
    and prefer evenly-textured glyphs; edges use full shape matching) and u_g is the
    glyph's own non-uniformity. diffuse enables serpentine Floyd-Steinberg diffusion
    of the mean-ink residual."""
    nfeat = G.shape[1]
    T = P * ink_scale                 # bring image into the glyph ink range
    Tmean = T.mean(axis=1)
    G2 = (G * G).sum(axis=1)
    lam = tone_weight * nfeat
    # local contrast -> structure weight k
    k_cell = np.clip(P.std(axis=1) / flat_ref, 0, 1).astype(np.float32)
    # glyph non-uniformity (relative std of blurred coverage), scaled like a feature distance
    u = (G.std(axis=1) / (Gmean + 1e-3)) * nfeat * 1e-3 * aniso_weight
    if flat_mode == "tonal" and charset is not None:
        # hard preference: flat cells may only use the curated tonal set
        u = np.array([0.0 if ch in TONAL else 1e3 for ch in charset], dtype=np.float32)
    if dither > 0:
        # per-cell blue-noise offset on tone (stateless; replaces error diffusion)
        n = blue_noise(rows, cols) * dither * ink_scale
        T = np.clip(T + n[:, None], 0, None)
        Tmean = T.mean(axis=1)
    if not diffuse:
        S = (T * T).sum(axis=1)[:, None] - 2 * T @ G.T + G2[None, :]
        D = S * k_cell[:, None] + lam * (Tmean[:, None] - Gmean[None, :]) ** 2 + (1 - k_cell)[:, None] * u[None, :]
        return D.argmin(axis=1)

    choice = np.zeros(rows * cols, dtype=np.int32)
    err = np.zeros((rows + 1, cols + 2), dtype=np.float32)
    for r in range(rows):
        rng = range(cols) if r % 2 == 0 else range(cols - 1, -1, -1)
        step = 1 if r % 2 == 0 else -1
        for c in rng:
            i = r * cols + c
            e = float(np.clip(err[r, c + 1], -err_clip, err_clip))
            t = T[i] + e
            tm = Tmean[i] + e
            kc = k_cell[i]
            d = ((t * t).sum() - 2 * (G @ t) + G2) * kc + lam * (tm - Gmean) ** 2 + (1 - kc) * u
            k = int(d.argmin())
            choice[i] = k
            q = tm - Gmean[k]
            err[r, c + 1 + step] += q * 7 / 16
            err[r + 1, c + 1 - step] += q * 3 / 16
            err[r + 1, c + 1] += q * 5 / 16
            err[r + 1, c + 1 + step] += q * 1 / 16
    return choice


def ramp_convert(P, rows, cols, ramp=RAMP70):
    """Naive baseline: mean tone -> character ramp (no structure, no diffusion)."""
    m = P.mean(axis=1)
    idx = np.clip(((1 - m) * (len(ramp) - 1)).round().astype(int), 0, len(ramp) - 1)
    return np.array([ramp[i] for i in idx])


# ----------------------------------------------------------------------------
# Rendering (for previews only — the website renders its own glyph atlas)
# ----------------------------------------------------------------------------
def render(chars_grid, font_path, cell_w, cell_h, fg=(232, 217, 181), bg=(20, 16, 10),
           colors=None, pad=0):
    rows, cols = chars_grid.shape
    font, adv = font_at_cell_width(font_path, cell_w)
    ascent, descent = font.getmetrics()
    y0 = (cell_h - (ascent + descent)) / 2.0
    im = Image.new("RGB", (cols * cell_w + 2 * pad, rows * cell_h + 2 * pad), bg)
    d = ImageDraw.Draw(im)
    for r in range(rows):
        for c in range(cols):
            ch = chars_grid[r, c]
            if ch == " ":
                continue
            fill = fg if colors is None else tuple(int(v) for v in colors[r, c])
            d.text((pad + c * cell_w + (cell_w - adv) / 2.0, pad + r * cell_h + y0), ch, font=font, fill=fill)
    return im


def tint_colors(col, strength=0.55, floor=0.35):
    """Per-cell colour for glyphs: desaturate toward warm parchment and lift the floor."""
    lum = (0.2126 * col[..., 0] + 0.7152 * col[..., 1] + 0.0722 * col[..., 2])[..., None]
    parch = np.array([0.91, 0.85, 0.71], dtype=np.float32)
    c = col * strength + lum * parch * (1 - strength)
    c = np.maximum(c, 0)
    # normalise so glyph colour carries hue, not tone (tone is carried by glyph density)
    mx = c.max(axis=-1, keepdims=True) + 1e-6
    c = c / mx
    c = floor + (1 - floor) * c
    return (c * 255).astype(np.uint8)


# ----------------------------------------------------------------------------
def convert(img, font_path, cols, fw=6, fh=12, cell_aspect=2.0, sigma=1.0, gamma=1.5,
            lo_pct=0.5, hi_pct=99.5, tone_weight=4.0, diffuse=True, invert=False,
            charset=PRINTABLE, ink_mult=1.0, local=0.0, flat_ref=0.06, aniso=6.0,
            flat_mode="aniso", dither=0.0):
    G, Gmean = build_glyph_bank(font_path, charset, fw, fh, sigma=sigma * 0.9)
    P, col, rows = image_to_patches(img, cols, fw, fh, cell_aspect, sigma, gamma, lo_pct, hi_pct, invert, local)
    ink_scale = Gmean.max() * ink_mult
    choice = match(P, G, Gmean, rows, cols, tone_weight, diffuse, ink_scale,
                   flat_ref=flat_ref, aniso_weight=aniso, charset=charset,
                   flat_mode=flat_mode, dither=dither)
    grid = np.array([charset[k] for k in choice]).reshape(rows, cols)
    return grid, P, col.reshape(rows, cols, 3), rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--font", default="/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf")
    ap.add_argument("--cols", type=int, default=240)
    ap.add_argument("--aspect", type=float, default=2.0, help="cell height / cell width")
    ap.add_argument("--sigma", type=float, default=1.0, help="viewing blur in feature px")
    ap.add_argument("--gamma", type=float, default=1.5)
    ap.add_argument("--tone", type=float, default=4.0, help="weight of mean-ink term")
    ap.add_argument("--no-diffuse", action="store_true")
    ap.add_argument("--invert", action="store_true", help="dark ink on light bg")
    ap.add_argument("--local", type=float, default=0.0, help="local contrast boost (0.3-1)")
    ap.add_argument("--flat", type=float, default=0.06, help="contrast at which shape matching is fully on")
    ap.add_argument("--aniso", type=float, default=6.0, help="penalty on streaky glyphs in flat areas")
    ap.add_argument("--ink", type=float, default=1.0, help="ink multiplier (>1 = denser)")
    ap.add_argument("--flat-mode", choices=["aniso", "tonal"], default="aniso")
    ap.add_argument("--dither", type=float, default=0.0, help="blue-noise amplitude (0.3-0.6); use with --no-diffuse")
    ap.add_argument("--charset", choices=["printable", "curated"], default="printable",
                    help="glyph alphabet: all 95 printable, or the curated tonal+line set")
    ap.add_argument("--out", default="ascii")
    ap.add_argument("--png", action="store_true")
    ap.add_argument("--color", action="store_true")
    ap.add_argument("--cell", type=int, default=12, help="preview cell width px")
    a = ap.parse_args()

    img = Image.open(a.image).convert("RGB")
    grid, P, col, rows = convert(img, a.font, a.cols, cell_aspect=a.aspect, sigma=a.sigma,
                                  gamma=a.gamma, tone_weight=a.tone, diffuse=not a.no_diffuse,
                                  invert=a.invert, local=a.local, flat_ref=a.flat, aniso=a.aniso,
                                  ink_mult=a.ink, flat_mode=a.flat_mode, dither=a.dither,
                                  charset=CURATED if a.charset == "curated" else PRINTABLE)
    with open(a.out + ".txt", "w") as f:
        f.write("\n".join("".join(r) for r in grid) + "\n")
    print(f"{a.cols}x{rows} cells -> {a.out}.txt")
    if a.png:
        cw, ch = a.cell, int(a.cell * a.aspect)
        colors = tint_colors(col) if a.color else None
        if a.invert:
            im = render(grid, a.font, cw, ch, fg=(58, 42, 26), bg=(236, 224, 196), colors=colors)
        else:
            im = render(grid, a.font, cw, ch, colors=colors)
        im.save(a.out + ".png")
        print(f"preview -> {a.out}.png ({im.size[0]}x{im.size[1]})")


if __name__ == "__main__":
    main()
