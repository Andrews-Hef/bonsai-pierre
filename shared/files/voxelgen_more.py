"""Deuxième série de formes-cibles (variété) pour Stone Daily, à N^3."""
import numpy as np, gzip, base64, json

N = 24
c = (N - 1) / 2
X, Y, Z = np.indices((N, N, N)).astype(float)

def ellipsoid(cx, cy, cz, rx, ry, rz):
    return ((X-cx)/rx)**2 + ((Y-cy)/ry)**2 + ((Z-cz)/rz)**2 <= 1.0
def sphere(cx, cy, cz, r): return ellipsoid(cx, cy, cz, r, r, r)
def box(x0, x1, y0, y1, z0, z1):
    return (X>=x0)&(X<=x1)&(Y>=y0)&(Y<=y1)&(Z>=z0)&(Z<=z1)
def cyl_y(cx, cz, y0, y1, r):
    return ((X-cx)**2 + (Z-cz)**2 <= r**2) & (Y>=y0) & (Y<=y1)
def cone_y(cx, cz, y_apex, y_base, r_base):
    t = (Y - y_apex) / (y_base - y_apex)
    return (t>=0)&(t<=1) & (((X-cx)**2 + (Z-cz)**2) <= (r_base*t)**2)

def cat():
    body = ellipsoid(c, c-2, c, 4.5, 5.5, 4)
    head = sphere(c, c+4.5, c+0.5, 3.6)
    earL = cone_y(c-2, c, c+10, c+6, 1.7)
    earR = cone_y(c+2, c, c+10, c+6, 1.7)
    tail = ellipsoid(c+4.2, c-0.5, c-3.5, 1.4, 3.6, 1.4)
    return body | head | earL | earR | tail

def rabbit():
    body = ellipsoid(c, c-3, c, 4, 4.5, 4)
    head = sphere(c, c+2.5, c+1, 3.3)
    earL = box(c-2.2, c-0.6, c+5, c+11, c-0.2, c+1.6)
    earR = box(c+0.6, c+2.2, c+5, c+11, c-0.2, c+1.6)
    tail = sphere(c, c-6.5, c-3.5, 1.6)
    return body | head | earL | earR | tail

def duck():
    body = ellipsoid(c, c, c, 5.5, 4, 4)
    head = sphere(c, c+5, c+3, 3)
    bill = box(c-1.6, c+1.6, c+4, c+5.6, c+5, c+8.5)
    tail = ellipsoid(c, c+2, c-5.5, 1.7, 1.7, 2.2)
    return body | head | bill | tail

def apple():
    body = ellipsoid(c, c-0.5, c, 5.6, 5, 5.6) & ~sphere(c, c+6.5, c, 2.2)
    stem = cyl_y(c, c, c+4, c+7.5, 0.9)
    leaf = ellipsoid(c+2.8, c+6.2, c, 2.2, 0.9, 1.3)
    return body | stem | leaf

def rocket():
    body = cyl_y(c, c, c-7, c+5, 3)
    nose = cone_y(c, c, c+10, c+5, 3)
    finL = box(c-5.5, c-2.5, c-8, c-2.5, c-0.6, c+0.6)
    finR = box(c+2.5, c+5.5, c-8, c-2.5, c-0.6, c+0.6)
    finB = box(c-0.6, c+0.6, c-8, c-2.5, c+2.5, c+5.5)
    return body | nose | finL | finR | finB

def house():
    base = box(c-5, c+5, c-6, c+2, c-5, c+5)
    half = 5.5 * (1 - (Y - (c+2)) / 6.5)
    roof = (Y>=c+2) & (Y<=c+8.5) & (np.abs(X-c) <= half) & (np.abs(Z-c) <= half)
    chimney = box(c+2, c+3.5, c+5, c+8, c-2, c-0.5)
    return base | roof | chimney

def bottle():
    body = cyl_y(c, c, c-9, c+2, 4)
    shoulder = cone_y(c, c, c+6, c+1, 4) & (Y >= c+2)
    neck = cyl_y(c, c, c+4, c+9, 1.6)
    return body | shoulder | neck

def cactus():
    trunk = cyl_y(c, c, c-9, c+8, 2.5)
    armLh = box(c-6, c-2.4, c+0.5, c+2.6, c-1, c+1)
    armLv = box(c-6, c-3.4, c+2.6, c+6, c-1, c+1)
    armRh = box(c+2.4, c+6, c-1.5, c+0.6, c-1, c+1)
    armRv = box(c+3.4, c+6, c+0.6, c+5, c-1, c+1)
    return trunk | armLh | armLv | armRh | armRv

def crescent():
    return sphere(c, c, c, 7.2) & ~sphere(c+5, c+1.2, c, 6.6)

SHAPES = {
    "Chat": cat(), "Lapin": rabbit(), "Canard": duck(),
    "Pomme": apple(), "Fusée": rocket(), "Maison": house(),
    "Bouteille": bottle(), "Cactus": cactus(), "Lune": crescent(),
}

def encode(grid):
    bits = np.packbits(grid.astype(np.uint8).ravel(order="C"))
    return base64.b64encode(gzip.compress(bits.tobytes())).decode()

manifest = [{"shape_name": n, "grid_size": N, "target_voxels": int(g.sum()),
             "target_b64": encode(g)} for n, g in SHAPES.items()]
with open("/home/claude/shapes_more.json", "w") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

print(f"{len(SHAPES)} nouvelles formes à {N}^3 :")
for m in manifest:
    print(f"  - {m['shape_name']:<10} {m['target_voxels']:>5} vox")

import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
fig = plt.figure(figsize=(13, 12)); fig.patch.set_facecolor("#f1e7d9")
for i, (name, g) in enumerate(SHAPES.items()):
    ax = fig.add_subplot(3, 3, i+1, projection="3d")
    ax.voxels(np.transpose(g, (0, 2, 1)), facecolors="#a89b8d",
              edgecolors="#7d7064", linewidth=0.25)
    ax.set_title(name, fontsize=15, color="#3a2c22", fontweight="bold", pad=2)
    ax.set_box_aspect((1, 1, 1)); ax.view_init(elev=18, azim=-58); ax.set_axis_off()
plt.tight_layout()
plt.savefig("/home/claude/preview_more.png", dpi=108, facecolor="#f1e7d9", bbox_inches="tight")
print("Preview -> preview_more.png")
