# legacy/ — prototype 2D archivé (ne plus modifier)

Ancien jeu **2D canvas** (silhouettes SVG, score calculé côté client) + son serveur Express.
Remplacé par la reconstruction **3D voxel** dans `client/`, branchée sur l'API `/v1`.

- `server/` — vieux serveur Express (port 3001) : `/api/daily` + `/targets/*.svg`.
- `client-2d/` — modules 2D retirés de `client/` (rendu canvas, score pixel, hooks).
  `App.2d.jsx` = copie de l'ancien `App.jsx` pour référence du câblage.
- `shared/seedUtils.js` — générateur de masque 2D (mulberry32, carveDisc, TOOLS).

**Filet de sécurité** : la branche git `archive/2d-prototype` pointe sur le dernier
commit où ce jeu 2D était complet et lançable. À supprimer seulement une fois la
boucle 3D jouable de bout en bout.
