"""
Générateur de formes-cibles en voxels pour Stone Daily.
Compose des objets reconnaissables à partir de primitives analytiques,
dans une grille N^3. Prévisualise (QA lisibilité) et exporte au format du jeu.

Convention d'indexation : index = x*N*N + y*N + z   (Y = vertical / "haut").
Encodage : grille booléenne -> bits (packbits, big-endian) -> gzip -> base64.
"""
import numpy as np, gzip, base64, json

N = 24                      # résolution de la grille (contrainte de lisibilité du jeu)
c = (N - 1) / 2             # centre
X, Y, Z = np.indices((N, N, N)).astype(float)   # Y = haut

# ---------- primitives (renvoient des masques booléens) ----------
def ellipsoid(cx, cy, cz, rx, ry, rz):
    return ((X-cx)/rx)**2 + ((Y-cy)/ry)**2 + ((Z-cz)/rz)**2 <= 1.0

def sphere(cx, cy, cz, r):
    return ellipsoid(cx, cy, cz, r, r, r)

def box(x0, x1, y0, y1, z0, z1):
    return (X>=x0)&(X<=x1)&(Y>=y0)&(Y<=y1)&(Z>=z0)&(Z<=z1)

def cyl_y(cx, cz, y0, y1, r):                    # cylindre vertical
    return ((X-cx)**2 + (Z-cz)**2 <= r**2) & (Y>=y0) & (Y<=y1)

def cone_y(cx, cz, y_apex, y_base, r_base):      # cône (apex -> base)
    t = (Y - y_apex) / (y_base - y_apex)
    return (t>=0) & (t<=1) & (((X-cx)**2 + (Z-cz)**2) <= (r_base*t)**2)

def octa(cx, cy, cz, ax, ay, az):                # octaèdre (gemme)
    return np.abs(X-cx)/ax + np.abs(Y-cy)/ay + np.abs(Z-cz)/az <= 1.0

def torus_z(cx, cy, cz, R, r):                   # tore dans le plan XY
    q = np.sqrt((X-cx)**2 + (Y-cy)**2) - R
    return q**2 + (Z-cz)**2 <= r**2

# ---------- objets ----------
def bird():
    body = ellipsoid(c, c-1, c, 5, 5.5, 6)
    head = sphere(c, c+5.5, c+3, 3.6)
    beak = box(c-1, c+1, c+4.5, c+6.5, c+6, c+9)
    tail = ellipsoid(c, c+3, c-7, 2.2, 1.5, 3.4)
    return body | head | beak | tail

def fish():
    body = ellipsoid(c, c, c, 8, 4.8, 3)
    tx0, tx1 = c-12, c-6                       # éventail triangulaire à l'arrière
    t = (X - tx1) / (tx0 - tx1)
    tail = (X>=tx0)&(X<=tx1)&(t>=0)&(t<=1) & (np.abs(Y-c) <= 1 + 5.5*t) & (np.abs(Z-c) <= 1)
    finT = box(c-2, c+2, c+4, c+7, c-1, c+1)   # nageoire dorsale
    return body | tail | finT

def mug():
    outer = cyl_y(c, c, c-7, c+7, 6)
    inner = cyl_y(c, c, c-3, c+9, 4)         # creux par le haut
    handle = torus_z(c+6, c, c, 3, 1.5)
    return (outer & ~inner) | handle

def heart():
    l = sphere(c-3, c+3, c, 4.2)
    r = sphere(c+3, c+3, c, 4.2)
    pt = cone_y(c, c, c-9, c+4, 7.5)         # pointe vers le bas
    return l | r | pt

def mushroom():
    stem = cyl_y(c, c, c-8, c+1, 2.6)
    cap = sphere(c, c+1, c, 6.2) & (Y >= c+0.5)
    return stem | cap

def tree():
    trunk = cyl_y(c, c, c-9, c-1, 1.9)
    f1 = sphere(c, c+2.5, c, 6.2)
    f2 = sphere(c-3, c, c-1, 4)
    f3 = sphere(c+3, c+0.5, c+1, 4.2)
    return trunk | f1 | f2 | f3

def gem():
    return octa(c, c, c, 6, 8.5, 6)

SHAPES = {
    "Oiseau":     bird(),
    "Poisson":    fish(),
    "Tasse":      mug(),
    "Coeur":      heart(),
    "Champignon": mushroom(),
    "Arbre":      tree(),
    "Gemme":      gem(),
}

# ---------- pierre brute de départ (auto, enveloppe la cible) ----------
def make_start_stone(target, margin=2, seed=0):
    rng = np.random.default_rng(seed)
    xs, ys, zs = np.where(target)
    cx, cy, cz = xs.mean(), ys.mean(), zs.mean()
    rx = (xs.max()-xs.min())/2 + margin
    ry = (ys.max()-ys.min())/2 + margin
    rz = (zs.max()-zs.min())/2 + margin
    base = ellipsoid(cx, cy, cz, rx, ry, rz)
    # quelques entailles aléatoires pour un aspect "rocher brut"
    dents = np.zeros_like(base)
    surf = np.argwhere(base)
    for _ in range(10):
        px, py, pz = surf[rng.integers(len(surf))]
        dents |= sphere(px, py, pz, rng.uniform(1.5, 2.5))
    return (base & ~dents) | target   # garantit que la cible reste atteignable

# ---------- encodage format jeu ----------
def encode(grid):
    bits = np.packbits(grid.astype(np.uint8).ravel(order="C"))  # x*N*N + y*N + z
    return base64.b64encode(gzip.compress(bits.tobytes())).decode()

def decode(b64, n=N):
    raw = gzip.decompress(base64.b64decode(b64))
    bits = np.unpackbits(np.frombuffer(raw, np.uint8), count=n*n*n)
    return bits.reshape((n, n, n)).astype(bool)

# round-trip de sécurité
assert np.array_equal(SHAPES["Oiseau"], decode(encode(SHAPES["Oiseau"]))), "round-trip KO"

# ---------- export manifeste ----------
manifest = []
for name, g in SHAPES.items():
    start = make_start_stone(g)
    manifest.append({
        "shape_name":    name,
        "grid_size":     N,
        "target_voxels": int(g.sum()),
        "start_voxels":  int(start.sum()),
        "target_b64":    encode(g),
        "start_b64":     encode(start),
    })
with open("/home/claude/shapes.json", "w") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

print(f"{len(SHAPES)} formes générées à {N}^3 :")
for m in manifest:
    print(f"  - {m['shape_name']:<11} cible={m['target_voxels']:>5} vox   "
          f"pierre={m['start_voxels']:>5} vox   "
          f"(taille encodée cible: {len(m['target_b64'])} o base64)")

# ---------- prévisualisation (QA lisibilité) ----------
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

fig = plt.figure(figsize=(15, 8))
fig.patch.set_facecolor("#f1e7d9")
for i, (name, g) in enumerate(SHAPES.items()):
    ax = fig.add_subplot(2, 4, i+1, projection="3d")
    gd = np.transpose(g, (0, 2, 1))   # mpl: (x, z, y) pour avoir Y en hauteur visuelle
    ax.voxels(gd, facecolors="#a89b8d", edgecolors="#7d7064", linewidth=0.25)
    ax.set_title(name, fontsize=14, color="#3a2c22", fontweight="bold", pad=2)
    ax.set_box_aspect((1, 1, 1)); ax.view_init(elev=18, azim=-58)
    ax.set_axis_off(); ax.set_facecolor("#f1e7d9")
plt.tight_layout()
plt.savefig("/home/claude/preview_targets.png", dpi=110, facecolor="#f1e7d9", bbox_inches="tight")
print("\nPreview -> preview_targets.png")

# aperçu d'une paire pierre brute -> cible
fig2 = plt.figure(figsize=(8, 4)); fig2.patch.set_facecolor("#f1e7d9")
pair = make_start_stone(SHAPES["Oiseau"])
for j, (lab, g) in enumerate([("Pierre brute (jour J)", pair), ("Cible : Oiseau", SHAPES["Oiseau"])]):
    ax = fig2.add_subplot(1, 2, j+1, projection="3d")
    gd = np.transpose(g, (0, 2, 1))
    col = "#9b8e80" if j == 0 else "#c2693f"
    ax.voxels(gd, facecolors=col, edgecolors="#7d7064", linewidth=0.2)
    ax.set_title(lab, fontsize=12, color="#3a2c22", fontweight="bold")
    ax.set_box_aspect((1, 1, 1)); ax.view_init(elev=18, azim=-58); ax.set_axis_off()
plt.tight_layout()
plt.savefig("/home/claude/preview_pair.png", dpi=110, facecolor="#f1e7d9", bbox_inches="tight")
print("Preview paire -> preview_pair.png")
