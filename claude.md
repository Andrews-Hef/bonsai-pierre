# 🌳 Bonsaï Daily — Instructions pour Claude Code

## Concept
Jeu Web solo inspiré de Wordle. Chaque jour, tous les joueurs reçoivent le même bonsaï généré procéduralement. Le joueur taille des branches en cliquant dessus pour reproduire une silhouette cible. Un score de similarité est calculé à la fin.

---

## Stack technique

- **Frontend** : React + Vite
- **Rendu** : Canvas API (deux canvas : gameplay + score)
- **Backend** : Node.js + Express
- **Base de données** : PostgreSQL
- **Styling** : Tailwind CSS

---

## Architecture des fichiers

```
bonsai-daily/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── GameCanvas.jsx        # Canvas principal gameplay
│   │   │   ├── ScoreCanvas.jsx       # Canvas caché pour le calcul du score
│   │   │   ├── TargetOverlay.jsx     # Silhouette cible affichée en transparence
│   │   │   └── ScoreResult.jsx       # Affichage du score final
│   │   ├── game/
│   │   │   ├── treeGenerator.js      # Génération procédurale de l'arbre (L-System)
│   │   │   ├── branchRenderer.js     # Rendu filaire gameplay
│   │   │   ├── solidRenderer.js      # Rendu 2D plein pour le calcul du score
│   │   │   └── scoreCalculator.js    # Pixel matching entre bonsaï et cible
│   │   ├── hooks/
│   │   │   ├── useTree.js            # State de l'arbre et des branches coupées
│   │   │   ├── useDailyChallenge.js  # Fetch du seed et de la cible du jour
│   │   │   └── usePlayerStats.js     # Lecture/écriture localStorage stats & streak
│   │   └── App.jsx
├── server/
│   ├── public/
│   │   └── targets/                  # PNG des silhouettes (400x400, noir sur transparent)
│   ├── routes/
│   │   └── daily.js                  # GET /api/daily → seed + target du jour
│   ├── services/
│   │   ├── targetSelector.js         # Sélection seedée de la silhouette du jour
│   │   └── dailyGenerator.js         # Génère et stocke le challenge du jour (cron)
│   └── index.js
└── shared/
    └── seedUtils.js                  # Fonctions partagées seed → arbre (même algo client/serveur)
```

---

# Engineering Philosophy

This project follows a "caveman engineering" philosophy.

Priorities:
1. Simplicity
2. Readability
3. Determinism
4. Fast iteration
5. Minimal abstraction

The codebase should feel:
- direct
- understandable
- procedural
- pragmatic

Avoid enterprise patterns.

---

# Important Rules

- Prefer straightforward code over clever abstractions
- Prefer duplication over premature abstraction
- Avoid generic systems unless clearly necessary
- Avoid factories, service locators, dependency injection
- Avoid overusing custom hooks
- Avoid deeply nested component trees
- Avoid premature optimization
- Avoid “smart” architecture

---

# Rendering Philosophy

Canvas rendering should stay:
- simple
- imperative
- predictable

It is acceptable to:
- use loops directly
- keep rendering code procedural
- duplicate small rendering helpers
- keep logic close to usage

Do NOT try to create a generic rendering engine.

---

# React Philosophy

React is only used as:
- UI orchestration
- state container
- screen management

Gameplay logic should remain outside React.

Avoid:
- global state libraries
- excessive contexts
- reducer hell
- abstract component systems

---

# File Philosophy

Prefer:
- small focused files
- explicit names
- local helpers

Avoid:
- giant utility folders
- over-shared abstractions
- generic helper functions used once

---

# Procedural Generation Philosophy

Procedural generation code should remain:
- explicit
- mathematical
- easy to debug

Avoid:
- meta-programming
- config-driven generation systems
- plugin architectures

---

# Decision Rule

When several implementations are possible:
choose the simplest working solution.
---

## Naming

- Components: PascalCase
- Hooks: camelCase starting with `use`
- Utility files: camelCase
- Constants: UPPER_SNAKE_CASE

---
## Fonctionnalités à implémenter (dans cet ordre)

### 1. Génération de l'arbre (treeGenerator.js)
- Utiliser un **L-System récursif** ou une **récursion fractale**
- L'arbre est généré à partir d'un **seed numérique** (date du jour → `YYYYMMDD` en int)
- Même seed = même arbre pour tout le monde
- Structure de données d'une branche :
```js
{
  id: string,
  x1: number, y1: number,   // point de départ
  x2: number, y2: number,   // point d'arrivée
  depth: number,             // profondeur dans l'arbre
  parentId: string | null,
  children: Branch[],
  cut: boolean               // true si le joueur a coupé cette branche
}
```
- Quand une branche est coupée, **toutes ses branches enfants** sont aussi supprimées

### 2. Rendu gameplay (branchRenderer.js)
- Rendu **filaire** sur Canvas
- Tronc épais, branches de plus en plus fines selon la profondeur
- Couleur brun/beige pour les branches
- **Nuages de feuilles** (cercles verts) aux extrémités des branches terminales (depth max)
- Highlight au hover sur une branche cliquable

### 3. Détection de clic sur une branche
- Au clic sur le Canvas, calculer la **distance point-segment** entre le clic et chaque branche
- Si distance < threshold (ex: 8px), la branche est considérée cliquée
- Marquer la branche et ses enfants comme `cut: true`
- Re-render du canvas

### 4. Silhouette cible (TargetOverlay)
- La cible est une **image PNG** servie par le backend
- Affichée en transparence sur le canvas gameplay (opacity 0.3, couleur rouge)
- Le joueur voit la cible pendant qu'il taille
- Afficher le nom de la cible en haut de l'écran : "Taillez ce bonsaï en forme de 🐱 Chat"

### 5. Calcul du score (scoreCalculator.js)
- Sur un **canvas caché** (hors DOM ou `visibility: hidden`), redessiner le bonsaï taillé en **2D plein** :
  - Branches épaisses (strokeWidth proportionnel à la profondeur)
  - Feuillage plein (disques verts remplis)
  - Tout en **noir uni** sur fond blanc
- Faire pareil pour la silhouette cible → **noir uni** sur fond blanc
- Comparer pixel par pixel avec `getImageData()`
- Score :
```js
// Pixels noirs en commun / total pixels noirs de la cible
const score = (intersection / targetPixels) * 100;
```

### 6. Pool de silhouettes et sélection (targetSelector.js)

#### Source des images
- Utiliser des SVG libres de droits provenant de **SVGrepo** (https://www.svgrepo.com)
- Convertir en PNG noir sur fond transparent (taille 400x400px)
- Stocker dans `server/public/targets/`

#### Pool recommandé (50 silhouettes de départ)
Catégories à couvrir pour la variété :
- Animaux : chat, chien, lapin, oiseau, poisson, papillon, éléphant...
- Objets : cœur, étoile, maison, voiture, avion, clé, tasse...
- Nature : feuille, montagne, soleil, nuage, arbre, fleur...
- Formes géométriques : flèche, éclair, croissant, diamant...

#### Logique de sélection seedée
```js
// server/services/targetSelector.js
const TARGETS = [
  { id: "cat",   name: "Chat",   file: "cat.png" },
  { id: "heart", name: "Coeur",  file: "heart.png" },
  { id: "star",  name: "Etoile", file: "star.png" },
  // ... 50 entrées au total
];

export function getTargetForDate(dateString) {
  // dateString = "2025-05-07"
  const seed = parseInt(dateString.replace(/-/g, ""));
  const index = seed % TARGETS.length;
  return TARGETS[index];
}
// Même date → même index → même silhouette pour tout le monde
// Le modulo sur la date suffit, pas besoin de PRNG ici
```

### 7. API Backend (server/)

**GET /api/daily**
```json
{
  "seed": 20250507,
  "targetImage": "/targets/heart.png",
  "targetName": "Coeur",
  "date": "2025-05-07"
}
```

- Le seed est la date du jour au format `YYYYMMDD`
- La target est sélectionnée via `getTargetForDate()` — déterministe
- `targetName` est affiché au joueur dans l'UI
- Stocker en DB les scores des joueurs (optionnel pour V1)

### 8. UI / UX
- Design **épuré, zen** — cohérent avec l'univers bonsaï (tons beige, vert sauge, brun)
- En haut de l'écran : "Taillez ce bonsaï en forme de ❤️ Coeur"
- Bouton **"Valider ma taille"** → déclenche le calcul du score
- Affichage du score avec animation (ex: compteur qui monte)
- Partage du score à la Wordle :
```
🌳 Bonsaï Daily — 07/05/2025
Cible : ❤️ Coeur
Score : 87/100 ✂️🔥 x4
```
- Le jeu est **bloqué après validation** jusqu'au lendemain (localStorage)

---

## Règles importantes

- Le **même seed doit produire exactement le même arbre** sur tous les navigateurs → pas de `Math.random()` natif, utiliser un **PRNG seedable** (ex: `mulberry32` ou `xoshiro128`)
- La **sélection de la cible** utilise un simple modulo sur la date, pas de PRNG
- Le canvas de score est **invisible** pour le joueur, uniquement utilisé pour le pixel matching
- Séparer clairement la logique de **génération** (pure, sans DOM) du **rendu** (Canvas)
- La génération de l'arbre doit être dans `shared/` pour pouvoir être réutilisée côté serveur si besoin

---

## 9. Persistance locale — Stats et Streak (localStorage)

Toutes les données joueur sont stockées **uniquement dans le localStorage** du navigateur, pas de compte utilisateur en V1.

### Structure de données

```js
// clé localStorage : "bonsai_daily_data"
{
  "history": [
    {
      "date": "2025-05-07",   // format YYYY-MM-DD
      "score": 87,             // 0-100
      "target": "Coeur",       // nom de la cible du jour
      "validated": true
    }
  ],
  "streak": 4,                 // nombre de jours consécutifs joués
  "bestStreak": 7,             // meilleur streak historique
  "lastPlayed": "2025-05-07"   // pour détecter la rupture de streak
}
```

### Hook à créer : usePlayerStats.js

```js
// client/src/hooks/usePlayerStats.js
// Responsabilités :
// - lire / écrire dans le localStorage
// - calculer le streak au chargement
// - exposer saveResult(date, score, targetName) appelé après validation
// - exposer getStats() → { streak, bestStreak, avgScore, totalGames, history }
```

### Logique de streak

```js
// Au chargement du jeu :
const today = getTodayDate();          // YYYY-MM-DD
const yesterday = getYesterdayDate();

if (lastPlayed === yesterday) {
  // streak continue → streak + 1
} else if (lastPlayed === today) {
  // déjà joué aujourd'hui → streak inchangé
} else {
  // streak cassé → reset à 1 après la partie du jour
}
```

### Composant StatsModal.jsx

Afficher une modale/panel avec :
- 🔥 Streak actuel + meilleur streak
- 📊 Score moyen sur les 7 derniers jours
- 🎮 Nombre total de parties jouées
- 📅 Mini graphe en barres (bar chart CSS simple, pas de lib) des scores des 14 derniers jours
- 🎯 Historique avec le nom de la cible de chaque jour

### Intégration dans le flow

1. Le joueur valide sa taille → score calculé
2. `saveResult(today, score, targetName)` est appelé → localStorage mis à jour
3. Le jeu est **verrouillé** jusqu'au lendemain (vérifier `lastPlayed === today` au chargement)
4. Si verrouillé, afficher le score de la veille + les stats + message "Revenez demain 🌱"

### Message après validation

```
🔥 Streak : 4 jours
Revenez demain pour continuer votre série !
[Partager mon score]  [Voir mes stats]
```

---

## Ce qui n'est PAS dans le scope V1

- Authentification / comptes utilisateurs
- Leaderboard
- Multijoueur
- Arbre animé (croissance en temps réel)
- Éditeur de silhouettes cibles

---

## Livrables attendus

1. Arbre généré et rendu sur Canvas ✓
2. Clic sur une branche la coupe avec ses enfants ✓
3. Silhouette cible visible en transparence + nom affiché ✓
4. Score calculé par pixel matching ✓
5. Pool de 50 silhouettes PNG dans `server/public/targets/` ✓
6. Sélection seedée de la cible via `getTargetForDate()` ✓
7. API backend retournant le challenge du jour ✓
8. UI complète avec bouton valider + affichage score ✓
9. localStorage : sauvegarde du score + nom cible après chaque partie ✓
10. Streak calculé et affiché correctement ✓
11. StatsModal avec historique des 14 derniers jours ✓
12. Jeu verrouillé après validation avec message de retour ✓
