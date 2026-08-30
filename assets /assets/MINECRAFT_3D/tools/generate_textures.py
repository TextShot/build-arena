#!/usr/bin/env python3
# Generate deterministic hand-drawn pixel textures (16x16 PNG) — Minecraft pixel style, clean and crisp
import os, random
from PIL import Image

S = 16
OUT = os.path.join(os.path.dirname(__file__), '..', '..')  # assets /assets (parent of this clone)
os.makedirs(OUT, exist_ok=True)

def img(): return Image.new('RGBA', (S, S), (0, 0, 0, 0))
def vary(c, n, rng):
    d = rng.randint(-n, n)
    return tuple(max(0, min(255, v + d)) for v in c)

def noise(im, base, amt, seed):
    rng = random.Random(seed)
    px = im.load()
    for y in range(S):
        for x in range(S):
            px[x, y] = vary(base, amt, rng) + (255,)
    return im

def bevel(im):
    px = im.load()
    for i in range(S):
        for (x, y, a) in [(i, 0, 28), (0, i, 28)]:
            r, g, b, al = px[x, y]
            px[x, y] = (min(255, r+a), min(255, g+a), min(255, b+a), al)
        for (x, y, a) in [(i, S-1, 36), (S-1, i, 36)]:
            r, g, b, al = px[x, y]
            px[x, y] = (max(0, r-a), max(0, g-a), max(0, b-a), al)

def rect(im, x, y, w, h, c):
    px = im.load()
    for j in range(y, y+h):
        for i in range(x, x+w):
            if 0 <= i < S and 0 <= j < S:
                px[i, j] = c if len(c) == 4 else c + (255,)

def dot(im, x, y, c):
    if 0 <= x < S and 0 <= y < S:
        im.load()[x, y] = c if len(c) == 4 else c + (255,)

def save(im, name):
    im.save(os.path.join(OUT, name + '.png'))
    print('  ', name + '.png')

# ---------- Block types ----------
def stone():
    im = noise(img(), (128, 128, 128), 10, 1)
    rng = random.Random(2)
    for _ in range(7):               # cracks
        x, y = rng.randint(1, 14), rng.randint(1, 14)
        for dx, dy in [(0,0),(1,0),(0,1)]:
            dot(im, x+dx, y+dy, (104,104,104))
    for _ in range(8):
        dot(im, rng.randint(0,15), rng.randint(0,15), (156,156,156))
    bevel(im); return im

def grass_top():
    im = noise(img(), (94, 156, 54), 8, 3)
    rng = random.Random(4)
    for _ in range(48):
        x, y = rng.randint(0,15), rng.randint(0,15)
        dot(im, x, y, rng.choice([(90,148,50),(120,186,80),(104,164,60)]))
    bevel(im); return im

def dirt():
    im = noise(img(), (140, 100, 64), 12, 5)
    rng = random.Random(6)
    for _ in range(12): dot(im, rng.randint(0,15), rng.randint(0,15), (118,84,52))
    for _ in range(6):  dot(im, rng.randint(0,15), rng.randint(0,15), (160,122,76))
    bevel(im); return im

def grass_side():
    im = noise(img(), (140, 100, 64), 12, 7)
    rng = random.Random(8)
    for _ in range(12): dot(im, rng.randint(0,15), rng.randint(3,15), (118,84,52))
    rect(im, 0, 0, S, 3, (94,156,54))         # grass top strip
    rect(im, 0, 0, S, 1, (112,178,72))
    for x in range(S):                        # jagged lower edge
        if rng.random() < 0.5: dot(im, x, 3, (94,156,54))
        if rng.random() < 0.25: dot(im, x, 4, (104,164,60))
    return im

def redstone_block():
    im = noise(img(), (134, 18, 18), 12, 9)
    for y in range(1, S, 4):
        for x in range(1, S, 4):
            rect(im, x, y, 2, 2, (255, 74, 74))
            dot(im, x, y, (255, 170, 170))
            dot(im, x+2, y+2, (150, 24, 24))
    bevel(im); return im

def piston_side():
    im = noise(img(), (166, 132, 80), 8, 11)
    rect(im, 0, 0, S, 1, (110, 83, 40)); rect(im, 0, S-1, S, 1, (110, 83, 40))
    rect(im, 0, 7, S, 1, (124, 95, 48))
    for x in range(0, S, 8): rect(im, x, 0, 1, S, (110, 83, 40))
    rng = random.Random(12)
    for _ in range(10): dot(im, rng.randint(0,15), rng.randint(0,15), (138,106,56))
    bevel(im); return im

def piston_top():
    im = noise(img(), (182, 150, 94), 6, 13)
    rect(im, 1, 1, S-2, 1, (90,70,34)); rect(im, 1, S-2, S-2, 1, (90,70,34))
    rect(im, 1, 1, 1, S-2, (90,70,34)); rect(im, S-2, 1, 1, S-2, (90,70,34))
    rect(im, 4, 4, S-8, S-8, (125, 95, 48))
    rect(im, 6, 6, S-12, S-12, (154, 122, 66))
    return im

def lamp(on):
    base = (255, 214, 120) if on else (98, 76, 38)
    grid = (199, 154, 58) if on else (63, 47, 22)
    cell = (255, 246, 204) if on else (122, 94, 42)
    im = noise(img(), base, 6 if on else 9, 14 if on else 15)
    for i in range(0, S, 4):
        rect(im, i, 0, 1, S, grid); rect(im, 0, i, S, 1, grid)
    for y in range(1, S, 4):
        for x in range(1, S, 4): rect(im, x, y, 2, 2, cell)
    if not on: bevel(im)
    return im

def repeater_top():
    im = noise(img(), (192, 192, 192), 6, 16)
    rect(im, 0, 7, S, 2, (158, 158, 158))
    def torch(y):
        rect(im, 7, y+2, 2, 3, (107, 74, 37))
        rect(im, 6, y, 4, 3, (122, 0, 0)); rect(im, 7, y, 2, 2, (255, 84, 84))
    torch(1); torch(11)
    bevel(im); return im

def repeater_side():
    im = noise(img(), (156, 156, 156), 8, 17); bevel(im); return im

print('Generating textures to assets/ :')
save(stone(), 'stone')
save(grass_top(), 'grass_top')
save(grass_side(), 'grass_side')
save(dirt(), 'dirt')
save(redstone_block(), 'redstone_block')
save(piston_side(), 'piston_side')
save(piston_top(), 'piston_top')
save(lamp(False), 'lamp_off')
save(lamp(True), 'lamp_on')
save(repeater_top(), 'repeater_top')
save(repeater_side(), 'repeater_side')
print('Done.')
