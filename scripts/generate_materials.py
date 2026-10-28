"""Generates INTERIO's original, seamless material textures (512x512 JPG).

Every texture is built from periodic noise and integer-period patterns, so tiles
repeat without seams. Output is deterministic (fixed seeds).

    python scripts/generate_materials.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

SIZE = 512
OUT = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'materials'


def rgb(hex_color):
    h = hex_color.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def noise(seed, fx, fy=None):
    """Periodic noise in [0, 1]; fx/fy are feature counts per tile along x/y."""
    fy = fx if fy is None else fy
    rng = np.random.default_rng(seed)
    spec = np.fft.fft2(rng.standard_normal((SIZE, SIZE)))
    kx = np.fft.fftfreq(SIZE) * SIZE
    ky = np.fft.fftfreq(SIZE) * SIZE
    kxx, kyy = np.meshgrid(kx, ky)
    falloff = np.exp(-((kxx / max(fx, 0.5)) ** 2 + (kyy / max(fy, 0.5)) ** 2))
    out = np.real(np.fft.ifft2(spec * falloff))
    out -= out.min()
    return out / max(out.max(), 1e-6)


def grid():
    y, x = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    return x, y


def ramp(t, colors):
    """Maps t in [0, 1] through a list of hex colours."""
    stops = [rgb(c) for c in colors]
    t = np.clip(t, 0, 1) * (len(stops) - 1)
    i = np.minimum(t.astype(int), len(stops) - 2)
    f = (t - i)[..., None]
    arr = np.stack(stops)
    return arr[i] * (1 - f) + arr[i + 1] * f


def save(name, img):
    arr = np.clip(img, 0, 255).astype(np.uint8)
    Image.fromarray(arr, 'RGB').save(OUT / name, 'JPEG', quality=84, optimize=True)
    print(f'{name}: {(OUT / name).stat().st_size // 1024} KB')


# ── wood ─────────────────────────────────────────────────────────────────────
def wood(name, colors, planks=4, seed=1, contrast=1.0):
    x, y = grid()
    grain = noise(seed, 6, 80) * 0.6 + noise(seed + 1, 20, 160) * 0.4  # stretched along x
    plank = (y // (SIZE / planks)).astype(int)
    shade = np.random.default_rng(seed).uniform(-0.12, 0.12, planks)[plank]
    t = 0.5 + (grain - 0.5) * contrast + shade
    img = ramp(t, colors)
    # Staggered butt joints and plank gaps.
    gap = (y % (SIZE / planks)) < 2.0
    joint_x = (np.random.default_rng(seed + 2).integers(0, SIZE, planks))[plank]
    joint = np.abs(((x - joint_x + SIZE / 2) % SIZE) - SIZE / 2) < 1.0
    img[gap | joint] *= 0.45
    save(name, img)


# ── tile ─────────────────────────────────────────────────────────────────────
def tile(name, base, grout, n=4, seed=10, variation=0.05):
    x, y = grid()
    cell = SIZE / n
    ix, iy = (x // cell).astype(int), (y // cell).astype(int)
    tone = np.random.default_rng(seed).uniform(-variation, variation, (n, n))[iy, ix]
    fine = noise(seed + 1, 90) - 0.5
    img = rgb(base)[None, None, :] * (1 + tone[..., None] + fine[..., None] * 0.08)
    edge = np.minimum(x % cell, y % cell) < 3.0
    img[edge] = rgb(grout)
    save(name, img)


# ── stone ────────────────────────────────────────────────────────────────────
def marble(name, colors, vein, seed=20, veins=3, sharp=14.0, vein_strength=0.9):
    x, y = grid()
    warp = noise(seed, 4) * 2 - 1
    detail = noise(seed + 1, 18) * 2 - 1
    phase = (x / SIZE * veins + y / SIZE * (veins - 1)) * 2 * np.pi + warp * 5 + detail * 1.2
    line = np.exp(-sharp * np.abs(np.sin(phase / 2)))
    base = ramp(noise(seed + 2, 6), colors)
    img = base * (1 - line[..., None] * vein_strength) + rgb(vein) * line[..., None] * vein_strength
    save(name, img)


def granite(name, colors, speck, seed=30):
    base = ramp(noise(seed, 12) * 0.5 + noise(seed + 1, 60) * 0.5, colors)
    s = noise(seed + 2, 150)
    mask = (s > 0.72)[..., None]
    img = np.where(mask, rgb(speck)[None, None, :], base)
    save(name, img)


def concrete(name, colors, seed=40):
    t = noise(seed, 5) * 0.55 + noise(seed + 1, 30) * 0.3 + noise(seed + 2, 140) * 0.15
    img = ramp(t, colors)
    pits = (noise(seed + 3, 200) > 0.86)[..., None]
    img = np.where(pits, img * 0.8, img)
    save(name, img)


def plaster(name, colors, seed=50):
    t = noise(seed, 7) * 0.7 + noise(seed + 1, 60) * 0.3
    save(name, ramp(t, colors))


# ── masonry ──────────────────────────────────────────────────────────────────
def brick(name, brick_colors, mortar, seed=60, rows=8, per_row=4):
    x, y = grid()
    row_h = SIZE / rows
    col_w = SIZE / per_row
    row = (y // row_h).astype(int)
    xs = x + (row % 2) * col_w / 2
    col = ((xs % SIZE) // col_w).astype(int)
    rng = np.random.default_rng(seed)
    tone = rng.uniform(0, 1, (rows, per_row))[row, col]
    surface = noise(seed + 1, 60)
    img = ramp(tone * 0.7 + surface * 0.3, brick_colors)
    mortar_mask = ((y % row_h) < 4.0) | ((xs % col_w) < 4.0)
    img[mortar_mask] = rgb(mortar) * (0.92 + 0.08 * noise(seed + 2, 80)[mortar_mask][:, None])
    save(name, img)


def stacked_stone(name, colors, mortar, seed=70, rows=8):
    x, y = grid()
    row_h = SIZE / rows
    row = (y // row_h).astype(int)
    rng = np.random.default_rng(seed)
    tone = np.zeros((SIZE, SIZE), dtype=np.float32)
    edge = (y % row_h) < 4.0
    for r in range(rows):
        cuts, pos = [], 0
        while pos < SIZE:
            w = int(rng.integers(70, 170))
            cuts.append(min(pos + w, SIZE))
            pos += w
        cuts[-1] = SIZE  # last stone closes the row so the tile stays seamless
        start = 0
        for c in cuts:
            sel = (row == r) & (x >= start) & (x < c)
            tone[sel] = rng.uniform(0, 1)
            edge |= sel & ((x - start) < 3.0)
            start = c
    img = ramp(tone * 0.65 + noise(seed + 1, 50) * 0.35, colors)
    img[edge] = rgb(mortar)
    save(name, img)


# ── wallpaper ────────────────────────────────────────────────────────────────
def wallpaper_stripe(name, a, b, seed=80, stripes=8):
    x, _ = grid()
    band = ((x / SIZE * stripes * 2) % 2 < 1)
    paper = noise(seed, 120) * 0.06
    img = np.where(band[..., None], rgb(a), rgb(b)) * (1 + paper[..., None] - 0.03)
    save(name, img)


def wallpaper_geometric(name, a, b, seed=81, n=4):
    x, y = grid()
    cell = SIZE / n
    u = (x % cell) / cell - 0.5
    v = (y % cell) / cell - 0.5
    diamond = (np.abs(u) + np.abs(v)) < 0.34
    ring = np.abs((np.abs(u) + np.abs(v)) - 0.5) < 0.025
    mask = diamond | ring
    paper = noise(seed, 120) * 0.06
    img = np.where(mask[..., None], rgb(b), rgb(a)) * (1 + paper[..., None] - 0.03)
    save(name, img)


def wallpaper_damask(name, a, b, seed=82, n=2):
    x, y = grid()
    cell = SIZE / n
    u = ((x % cell) / cell - 0.5) * 2
    v = ((y % cell) / cell - 0.5) * 2
    r = np.sqrt(u * u + v * v)
    theta = np.arctan2(v, u)
    petals = r < (0.55 + 0.28 * np.cos(6 * theta)) * 0.8
    core = r < 0.12
    scroll = np.abs(np.sin(6 * np.pi * np.abs(u)) * 0.25 - v * np.sign(v) * 0.9) < 0.04
    mask = (petals & ~core) | scroll
    paper = noise(seed, 120) * 0.05
    img = np.where(mask[..., None], rgb(b), rgb(a)) * (1 + paper[..., None] - 0.025)
    save(name, img)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    # Floors — wood
    wood('walnut.jpg', ['#4a2e1c', '#6b4429', '#8a5c3a'], seed=101)
    wood('dark-walnut.jpg', ['#21140d', '#33201a', '#4a3024'], seed=102)
    wood('grey-oak.jpg', ['#7d7a74', '#a19d95', '#c3beb5'], seed=103, contrast=0.9)
    wood('maple.jpg', ['#c99b5f', '#dcb77f', '#ecd3a4'], seed=104)
    # Floors — tile
    tile('grey-tile.jpg', '#9a9c9d', '#6f7173', seed=111)
    tile('beige-tile.jpg', '#d8c8a8', '#a99d84', seed=112)
    tile('black-tile.jpg', '#26272a', '#101113', seed=113, variation=0.04)
    tile('terracotta-tile.jpg', '#b5683f', '#7d4a30', n=3, seed=114, variation=0.09)
    # Floors — marble, granite, concrete
    marble('calacatta-marble.jpg', ['#f4f2ee', '#fbfaf8', '#e8e4dc'], '#b79b6c', seed=121, veins=2, sharp=9.0)
    marble('nero-marquina.jpg', ['#16171a', '#1f2024', '#101113'], '#f1f0ec', seed=122, veins=3, sharp=24.0, vein_strength=0.85)
    granite('black-granite.jpg', ['#1b1c1f', '#2a2b2f', '#3a3b40'], '#8d8f95', seed=131)
    granite('grey-granite.jpg', ['#7a7c80', '#9a9ca0', '#b6b8bb'], '#3b3c3f', seed=132)
    concrete('polished-concrete.jpg', ['#8f8e8a', '#a9a8a3', '#bfbeb9'], seed=141)
    # Walls
    brick('red-brick.jpg', ['#7a2f22', '#a2452f', '#c0613f'], '#b9b2a6', seed=151)
    brick('whitewashed-brick.jpg', ['#d7d1c7', '#e6e1d8', '#f2eee7'], '#c9c3b8', seed=152)
    stacked_stone('stacked-stone.jpg', ['#6b665d', '#8c867a', '#aaa396'], '#4a463f', seed=161)
    wallpaper_stripe('wallpaper-stripe.jpg', '#e9e2d3', '#c9d3c0', seed=171)
    wallpaper_geometric('wallpaper-geometric.jpg', '#e4e0d6', '#9fb0b8', seed=172)
    wallpaper_damask('wallpaper-damask.jpg', '#d9d1bd', '#b79a63', seed=173)
    plaster('venetian-plaster.jpg', ['#c9bfae', '#d9d0c1', '#e6dfd2'], seed=181)
    wood('slat-panel.jpg', ['#6d4a2f', '#8a6240', '#a47c56'], planks=8, seed=191, contrast=0.8)


if __name__ == '__main__':
    main()
