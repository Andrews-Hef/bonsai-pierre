// Reconstruction 3D voxel en cours — branchée sur l'API /v1.
// Le prototype 2D vit dans ../../legacy (branche d'archive : archive/2d-prototype).
// Étapes : codec navigateur -> client API -> scène de sculptage R3F -> soumission -> polish.

export default function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-beige-50 dark:bg-bark-900 text-bark-700 dark:text-beige-100 px-6 text-center">
      <h1 className="text-3xl font-zen">🪨 Stone Daily</h1>
      <p className="text-bark-500 dark:text-beige-200/80 max-w-md">
        Reconstruction de la boucle 3D voxel en cours…
      </p>
    </div>
  );
}
