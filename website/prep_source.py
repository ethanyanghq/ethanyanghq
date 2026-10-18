#!/usr/bin/env python3
"""Prepare the source image for conversion: inset-crop the borders and crop to a
target aspect ratio, taking the excess mostly from the bottom (floor) so heads survive.
Usage: python3 prep_source.py IN.png OUT.png [--aspect 1.6] [--inset 12] [--top-share 0.15]"""
import argparse
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("out")
ap.add_argument("--aspect", type=float, default=1.6, help="target width/height")
ap.add_argument("--inset", type=int, default=12, help="pixels trimmed from every edge first")
ap.add_argument("--top-share", type=float, default=0.15, help="share of the vertical excess removed from the top")
a = ap.parse_args()

im = Image.open(a.src).convert("RGB")
W, H = im.size
im = im.crop((a.inset, a.inset, W - a.inset, H - a.inset))
W, H = im.size
target_h = round(W / a.aspect)
if target_h < H:
    excess = H - target_h
    top = round(excess * a.top_share)
    im = im.crop((0, top, W, top + target_h))
else:
    target_w = round(H * a.aspect)
    left = (W - target_w) // 2
    im = im.crop((left, 0, left + target_w, H))
im.save(a.out)
print(f"{a.src} {W}x{H} -> {a.out} {im.size[0]}x{im.size[1]} (aspect {im.size[0]/im.size[1]:.3f})")
