# Stone Daily — Front

Atelier de taille de pierre **3D voxel** (react-three-fiber). React 18 + Vite 5,
TailwindCSS, branché sur l'API Fastify `/v1`. Le front **estime** la ressemblance
en temps réel pour guider la taille, mais **le score officiel vient toujours du
serveur** — le client n'est jamais cru sur son score.

## Prérequis
- Node ≥ 20
- **Le backend `api/` doit tourner et être semé** (Postgres + Redis + puzzle du
  jour + utilisateur de dev). Sans lui, le front affiche un écran d'erreur.
  Voir `../api/README.md` (quickstart : `docker compose … up`, `db:migrate`,
  `seed:puzzle`, `seed:user`, `npm run dev`).

Le front utilise par défaut l'UUID de dev `00000000-0000-4000-8000-000000000001`
(en-tête `x-user-id`) — le **même** que `seed:user` dans le README de l'API.

## Lancer le front (dev)
Depuis `client/` :
```bash
npm install
npm run dev
```
Vite sert sur **http://localhost:5173** et **proxifie `/v1` → http://localhost:8080**
(même origine, donc aucun CORS). Ouvre l'URL affichée : la pierre du jour se charge,
on taille avec les outils, puis on valide.

> Ordre de démarrage : d'abord l'API (`api/ → npm run dev`, sur `:8080`), ensuite
> le front. Si le front affiche « L'API ne répond pas », c'est que le backend n'est
> pas lancé (ou pas sur `:8080`).

## Variables d'environnement (optionnelles)
Tout est préconfiguré pour le dev local ; ces variables ne servent qu'à pointer
ailleurs. À définir dans un `.env` à la racine de `client/` (préfixe `VITE_` obligatoire).

| Variable | Rôle | Défaut |
|---|---|---|
| `VITE_API_URL` | Base de l'API si le backend n'est **pas** en local (preview/prod). En dev, laisser vide → le proxy Vite s'en charge. | `''` (proxy `/v1` → `:8080`) |
| `VITE_DEV_USER_ID` | UUID envoyé en `x-user-id` (auth de dev simulée). | `00000000-0000-4000-8000-000000000001` |

## Build & preview
```bash
npm run build      # bundle de prod dans dist/
npm run preview    # sert dist/ localement pour vérifier le build
```
La scène three (lourde) est **lazy-loadée** : le bundle initial reste léger
(~160 kB) et le chunk `SculptScene` ne charge qu'à l'entrée dans l'atelier.
En `preview`/prod, définis `VITE_API_URL` pour joindre un backend distant (pas de
proxy hors du dev server Vite).

## Tests
```bash
npm test           # Vitest (jsdom) : flux de soumission + accord du codec voxel
```
Le test d'accord du codec vérifie que l'encodage voxel du navigateur reste
identique à celui du backend (invariant : une grille encodée ici doit être
décodée à l'identique côté serveur).

## Repères de code
- `src/three/` — scène R3F. **Vérité = un seul `Uint8Array` de voxels 24³** ; le
  raycast de taille mute cette grille, c'est elle qu'on encode pour `/submit`.
  L'`InstancedMesh` est une pure projection, jamais une source d'état. Caméras
  fixes (face / profil / dessus), pas d'orbite libre.
- `src/voxel/codec.js` — encode/décode base64(gzip) via Web Streams, doit rester
  d'accord avec le backend (cf. test ci-dessus).
- `src/api/` — appels `/v1` (`client.js` = seul endroit qui connaît l'auth) et
  configuration (`config.js`).
- `src/components/` — `Sculptor` (atelier + validation), `ResultScreen` /
  `Leaderboard` (affichent le **score serveur**, jamais l'estimation locale),
  `ToolPalette`, `HelpModal`.
