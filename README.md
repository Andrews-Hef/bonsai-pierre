# Stone Daily

Jeu Web solo inspiré de Wordle. Chaque jour, tous les joueurs reçoivent la **même pierre** générée procéduralement et la **même silhouette cible**. Le but : sculpter la pierre pour qu'elle épouse la silhouette, en utilisant trois ciseaux de tailles différentes.

Un score de similarité est calculé en comparant pixel par pixel la pierre sculptée à la cible.

---

## Stack

**Frontend**
- React 18 + Vite
- Tailwind CSS (dark mode `class`)
- Canvas API (rendu impératif, manipulation directe d'`ImageData`)

**Backend**
- Node.js + Express
- Sert l'API `/api/daily` et les silhouettes statiques `/targets/*.svg`

**Partagé**
- `shared/seedUtils.js` — génération déterministe (PRNG `mulberry32` + bruit value-noise multi-octave, domain warping, heightfield)

**Persistance**
- `localStorage` côté navigateur (stats, streak, historique, préférence de thème)
- Pas de base de données, pas d'auth en V1

---

## Ce que le jeu fait

### Génération de la pierre
- Seed = date du jour (`YYYYMMDD`) — même seed = même pierre pour tout le monde
- Forme du rocher : rayon polaire avec 4 harmoniques sinusoïdales (boulder irrégulier)
- Texture procédurale par pixel :
  - **Luminance** : 4 octaves de bruit (macro / patch warpées + grain + fine) + craquelures + mouchetures minérales
  - **Teinte chaud/froid** : 2 octaves basse fréquence pour des variations de gris
  - **Heightfield** : 3 octaves lissées → bump shading + ambient occlusion au rendu
- Domain warping (déplacement basse fréquence des coordonnées) pour éviter l'aspect "vagues diagonales"

### Sélection de la cible
- 50 silhouettes SVG (animaux, objets, nature, formes)
- Sélection seedée par modulo sur la date — déterministe

### Sculpture
- 3 outils :
  - 🪨 **Petit ciseau** — rayon 5px
  - ⛏️ **Burin** — rayon 13px
  - 🔨 **Massette** — rayon 28px
- Drag + clic pour creuser
- Interpolation de la trajectoire entre deux samples souris → pas de trous sur les drags rapides
- Curseur custom qui prévisualise le diamètre exact de l'outil

### Score
- Canvas caché qui redessine la pierre sculptée et la cible en noir uni sur blanc
- Comparaison pixel par pixel via `getImageData()`
- `score = coverage × (1 − overflow × 0.5)` — récompense la couverture, pénalise le débordement

### UX
- Bouton **"Voir la cible"** → panneau latéral avec la silhouette à reproduire
- Overlay rouge transparent (0.3) en superposition pour aider à viser
- Bouton **"Valider ma sculpture"** → calcul du score
- Jeu **verrouillé** jusqu'au lendemain après validation
- Partage à la Wordle (copie dans le presse-papier)
- Streak, score moyen 7 jours, total de parties, graphe 14 jours, historique avec nom des cibles
- Dark mode (préférence sauvegardée, respecte `prefers-color-scheme` au premier chargement)

---

## Lancer en local

```bash
npm install
npm run dev
```

- Client : http://localhost:5173
- API : http://localhost:3001

Le client dev tourne via Vite avec HMR, le serveur via `node --watch`.

---

## Structure

```
bonsai_io/
├── client/                   # React + Vite
│   └── src/
│       ├── components/       # GameCanvas, ToolPalette, ScoreResult, StatsModal, …
│       ├── game/             # stoneRenderer, solidRenderer, scoreCalculator
│       └── hooks/            # useStone, useDailyChallenge, usePlayerStats
├── server/                   # Express
│   ├── routes/daily.js       # GET /api/daily
│   ├── services/             # targetSelector, dailyGenerator
│   ├── scripts/              # generateTargets.js (one-shot, déjà exécuté)
│   └── public/targets/       # 50 SVG silhouettes
└── shared/
    └── seedUtils.js          # PRNG + génération pierre + texture (pure, sans DOM)
```
