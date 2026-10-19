#!/usr/bin/env python3
"""Blue-noise threshold mask by void-and-cluster (Ulichney 1993).
Writes src/bluenoise64.png: 64x64 tileable ranks scaled to 0..255."""
import pathlib
import numpy as np
from PIL import Image

N, SIGMA, SEED = 64, 1.5, 7

# toroidal Gaussian centred on (0, 0); rolling it puts it anywhere
d = np.minimum(np.arange(N), N - np.arange(N))
K = np.exp(-(d[:, None] ** 2 + d[None, :] ** 2) / (2 * SIGMA ** 2))


def energy(b):
    return np.real(np.fft.ifft2(np.fft.fft2(b) * np.fft.fft2(K)))


def bump(e, i, sign):
    e += sign * np.roll(K, divmod(i, N), axis=(0, 1)).ravel()


def cluster(b, e):          # tightest cluster: the one with the most energy
    return int(np.where(b, e, -np.inf).argmax())


def void(b, e):             # largest void: the zero with the least energy
    return int(np.where(b, np.inf, e).argmin())


rng = np.random.default_rng(SEED)
proto = (rng.random(N * N) < 0.1)
e = energy(proto.reshape(N, N).astype(float)).ravel()
while True:                 # relax the random seed pattern into an even one
    c = cluster(proto, e); proto[c] = False; bump(e, c, -1)
    v = void(proto, e); proto[v] = True; bump(e, v, +1)
    if v == c:
        break

rank = np.zeros(N * N, dtype=np.int32)
ones = int(proto.sum())

b, eb = proto.copy(), e.copy()           # phase 1: peel clusters off the seed
for r in range(ones - 1, -1, -1):
    c = cluster(b, eb); b[c] = False; bump(eb, c, -1); rank[c] = r

b, eb = proto.copy(), e.copy()           # phase 2: fill voids up to half
r = ones
while r < N * N // 2:
    v = void(b, eb); b[v] = True; bump(eb, v, +1); rank[v] = r; r += 1

ez = energy((~b).reshape(N, N).astype(float)).ravel()   # phase 3: zeros are now the minority
while r < N * N:
    c = cluster(~b, ez); b[c] = True; bump(ez, c, -1); rank[c] = r; r += 1

assert sorted(rank) == list(range(N * N))
img = (rank.reshape(N, N) * 255.0 / (N * N - 1)).round().astype(np.uint8)
out = pathlib.Path(__file__).with_name("src") / "bluenoise64.png"
Image.fromarray(img).save(out)

# sanity: blue noise has little energy at low frequencies
f = np.abs(np.fft.fftshift(np.fft.fft2(img / 255.0 - 0.5)))
yy, xx = np.indices(f.shape) - N // 2
rad = np.hypot(yy, xx)
low, high = f[(rad > 0) & (rad < 8)].mean(), f[rad > 20].mean()
print(f"{out}: low-freq {low:.2f} vs high-freq {high:.2f} (want low << high)")
