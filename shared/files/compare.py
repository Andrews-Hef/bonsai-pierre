"""
Comparaison d'une sculpture joueur vs une cible, + ingestion d'une forme
voxel venant d'une AUTRE source (résolution/position/orientation différentes).

Deux idées clés :
  1) On NORMALISE la forme externe une seule fois, à l'ingestion (canonicalize).
  2) Au moment du score, les deux grilles sont déjà dans le même espace
     -> la comparaison est triviale et rapide (IoU, Dice, precision/recall).
"""
import numpy as np, gzip, base64, json
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Patch

N = 24

def decode(b64, n=N):
    raw = gzip.decompress(base64.b64decode(b64))
    bits = np.unpackbits(np.frombuffer(raw, np.uint8), count=n*n*n)
    return bits.reshape((n, n, n)).astype(bool)

# ---------- métriques (les deux grilles DOIVENT être dans le même espace) ----------
def iou(a, b):
    inter = np.logical_and(a, b).sum()
    union = np.logical_or(a, b).sum()
    return inter / union if union else 1.0

def dice(a, b):
    inter = np.logical_and(a, b).sum()
    return 2*inter / (a.sum() + b.sum()) if (a.sum()+b.sum()) else 1.0

def precision_recall(sub, target):
    # precision : parmi ce que le joueur a GARDÉ, quelle part est correcte
    # recall    : parmi la cible, quelle part le joueur a bien gardée
    tp = np.logical_and(sub, target).sum()
    prec = tp / sub.sum() if sub.sum() else 1.0
    rec  = tp / target.sum() if target.sum() else 1.0
    return prec, rec

def best_shift_iou(a, b, r=1):
    """IoU maximal en tolérant un recalage de +/- r voxels (anti-bruit de quantif)."""
    best = 0.0
    for dx in range(-r, r+1):
        for dy in range(-r, r+1):
            for dz in range(-r, r+1):
                best = max(best, iou(a, np.roll(b, (dx, dy, dz), axis=(0, 1, 2))))
    return best

def game_score(resemblance, duration_ms, par_ms=180_000):
    base = round(resemblance * 1000)
    bonus = round(200 * max(0, 1 - duration_ms/par_ms)) if resemblance >= 0.8 else 0
    return base + bonus

# ---------- normalisation d'une forme de source externe ----------
def resize_auto(a, out_shape):
    """Nearest si on agrandit ; scatter-OR si on réduit (préserve la forme)."""
    out_shape = tuple(int(x) for x in out_shape)
    if all(o >= s for o, s in zip(out_shape, a.shape)):
        idx = [np.clip((np.arange(o) * (s/o)).astype(int), 0, s-1)
               for o, s in zip(out_shape, a.shape)]
        return a[np.ix_(*idx)]
    occ = np.argwhere(a)
    if len(occ) == 0:
        return np.zeros(out_shape, bool)
    scale = np.array(out_shape) / np.array(a.shape)
    oi = np.clip(np.floor(occ * scale).astype(int), 0, np.array(out_shape)-1)
    out = np.zeros(out_shape, bool)
    out[oi[:, 0], oi[:, 1], oi[:, 2]] = True
    return out

def canonicalize(grid, n=N, margin=2, axes=None):
    """Ramène n'importe quelle grille dans l'espace du jeu : recadrée sur la
    matière, mise à l'échelle pour tenir dans n^3, recentrée. `axes` permet de
    corriger une convention d'axes (ex. Blender Z-up -> Y-up)."""
    if axes is not None:
        grid = np.transpose(grid, axes)
    occ = np.argwhere(grid)
    if len(occ) == 0:
        return np.zeros((n, n, n), bool)
    lo, hi = occ.min(0), occ.max(0) + 1
    sub = grid[lo[0]:hi[0], lo[1]:hi[1], lo[2]:hi[2]]   # recadrage sur la matière
    target_extent = n - 2*margin
    scale = target_extent / max(sub.shape)              # tient dans la boîte, ratio préservé
    out = np.maximum((np.array(sub.shape) * scale).round().astype(int), 1)
    resized = resize_auto(sub, out)
    canon = np.zeros((n, n, n), bool)
    off = ((n - np.array(resized.shape)) // 2)          # recentrage
    canon[off[0]:off[0]+resized.shape[0],
          off[1]:off[1]+resized.shape[1],
          off[2]:off[2]+resized.shape[2]] = resized
    return canon

# ============================================================
# DÉMO 1 — scorer une sculpture joueur (imparfaite) vs la cible
# ============================================================
data = {d["shape_name"]: d for d in json.load(open("/home/claude/shapes.json"))}
target = decode(data["Oiseau"]["target_b64"])
start  = decode(data["Oiseau"]["start_b64"])

rng = np.random.default_rng(7)
excess = np.logical_and(start, ~target)         # matière à retirer
leftover = excess & (rng.random(excess.shape) < 0.13)   # le joueur en laisse ~13%
over_carve = target & (rng.random(target.shape) < 0.06) # et entame ~6% de la cible
submission = (target & ~over_carve) | leftover

res = iou(submission, target)
d   = dice(submission, target)
p, r = precision_recall(submission, target)
score = game_score(res, duration_ms=132_000)

print("=== DÉMO 1 : sculpture joueur vs cible ===")
print(f"  IoU         : {res:.3f}   (ressemblance officielle -> {round(res*100)} %)")
print(f"  Dice        : {d:.3f}   (variante plus indulgente)")
print(f"  Precision   : {p:.3f}   (a-t-il laissé de la matière en trop ? {round((1-p)*100)} % oui)")
print(f"  Recall      : {r:.3f}   (a-t-il trop entamé la cible ? {round((1-r)*100)} % oui)")
print(f"  Score jeu   : {score}  (en 2 min 12, par = 3 min)")

correct = np.logical_and(submission, target)    # gardé à raison
extra   = np.logical_and(submission, ~target)    # laissé en trop (sous-taillé)
missing = np.logical_and(~submission, target)    # trop taillé (manque)

def diff_panel(ax):
    filled = correct | extra | missing
    colors = np.empty(filled.shape, dtype=object)
    colors[correct] = "#7d9a6c"   # vert : correct
    colors[extra]   = "#cf5b4e"   # rouge : matière en trop
    colors[missing] = "#5b8bc2"   # bleu : trop enlevé
    ax.voxels(np.transpose(filled, (0,2,1)),
              facecolors=np.transpose(colors, (0,2,1)),
              edgecolors="#6b5f54", linewidth=0.15)

fig = plt.figure(figsize=(14, 5)); fig.patch.set_facecolor("#f1e7d9")
panels = [("Cible", target, "#c2693f"),
          ("Sculpture joueur", submission, "#a89b8d"),
          ("Diff (vert=ok, rouge=en trop, bleu=manque)", None, None)]
for i, (lab, g, col) in enumerate(panels):
    ax = fig.add_subplot(1, 3, i+1, projection="3d")
    if g is not None:
        ax.voxels(np.transpose(g, (0,2,1)), facecolors=col,
                  edgecolors="#6b5f54", linewidth=0.15)
    else:
        diff_panel(ax)
    ax.set_title(lab, fontsize=12, color="#3a2c22", fontweight="bold")
    ax.set_box_aspect((1,1,1)); ax.view_init(elev=18, azim=-58); ax.set_axis_off()
fig.suptitle(f"Ressemblance (IoU) = {round(res*100)} %   •   Score = {score}",
             fontsize=15, color="#3a2c22", fontweight="bold", y=0.99)
fig.legend(handles=[Patch(facecolor="#7d9a6c", label="Correct"),
                    Patch(facecolor="#cf5b4e", label="Matière en trop"),
                    Patch(facecolor="#5b8bc2", label="Trop enlevé")],
           loc="lower center", ncol=3, frameon=False, fontsize=11)
plt.tight_layout(rect=[0, 0.05, 1, 0.96])
plt.savefig("/home/claude/compare_score.png", dpi=110, facecolor="#f1e7d9", bbox_inches="tight")
print("  -> compare_score.png")

# ============================================================
# DÉMO 2 — forme d'une AUTRE source : mauvaise résolution + axes
# ============================================================
# On fabrique une "forme externe" réaliste : la cible en 48^3 (agrandie sans
# perte par réplication), posée dans un canevas 60^3 avec un décalage, et avec
# les axes permutés (façon export Blender Z-up).
hi_res = np.repeat(np.repeat(np.repeat(target, 2, 0), 2, 1), 2, 2)  # 48^3 exact
hi_res = np.transpose(hi_res, (0, 2, 1))           # axes différents (Y/Z inversés)
ext_shifted = np.zeros((60, 60, 60), bool)
ext_shifted[8:8+48, 8:8+48, 4:4+48] = hi_res       # décalée dans le canevas

# Ingestion : on la ramène dans l'espace du jeu (24^3, centrée, à l'échelle),
# en corrigeant les axes. On compare à la CIBLE CANONIQUE (ce que le jeu stocke),
# pas à la brute -> c'est ça l'apples-to-apples.
canon = canonicalize(ext_shifted, n=N, margin=2, axes=(0, 2, 1))
target_canon = canonicalize(target, n=N, margin=2)

print("\n=== DÉMO 2 : ingestion d'une forme externe ===")
print(f"  source externe : grille {ext_shifted.shape}, décalée, axes permutés")
print(f"  après canonicalize : grille {canon.shape}")
print(f"  IoU brut (externe normalisé vs cible canonique) = {iou(canon, target_canon):.3f}")
print(f"  IoU avec recalage +/-1 voxel                     = {best_shift_iou(canon, target_canon):.3f}"
      f"  -> c'est bien la même forme")

fig2 = plt.figure(figsize=(13, 5)); fig2.patch.set_facecolor("#f1e7d9")
for i, (lab, g) in enumerate([
        (f"Source externe {ext_shifted.shape}\n(décalée, axes inversés)", ext_shifted),
        ("Externe après normalisation\n(espace du jeu 24³)", canon),
        ("Cible stockée\n(forme canonique)", target_canon)]):
    ax = fig2.add_subplot(1, 3, i+1, projection="3d")
    ax.voxels(np.transpose(g, (0,2,1)), facecolors="#a89b8d",
              edgecolors="#7d7064", linewidth=0.2)
    ax.set_title(lab, fontsize=12, color="#3a2c22", fontweight="bold")
    ax.set_box_aspect((1,1,1)); ax.view_init(elev=18, azim=-58); ax.set_axis_off()
fig2.suptitle(f"Après normalisation : IoU brut {round(iou(canon, target_canon)*100)} %  •  "
              f"recalé ±1 vox {round(best_shift_iou(canon, target_canon)*100)} %  (même forme)",
              fontsize=13, color="#3a2c22", fontweight="bold")
plt.tight_layout()
plt.savefig("/home/claude/compare_ingest.png", dpi=110, facecolor="#f1e7d9", bbox_inches="tight")
print("  -> compare_ingest.png")
