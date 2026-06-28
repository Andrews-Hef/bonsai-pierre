import { defineConfig } from 'vitest/config';

// Config dédiée aux tests (prioritaire sur vite.config.js). On évite le plugin
// React : les tests de logique pure (codec) n'en ont pas besoin.
export default defineConfig({
  // Le test d'accord importe shared/voxel.ts, hors de la racine client/.
  server: { fs: { allow: ['..'] } },
  // JSX runtime automatique (pas de React plugin ici) -> pas d'import React requis
  // dans les composants/tests .jsx.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['test/**/*.test.{js,jsx}', 'src/**/*.test.{js,jsx}'],
  },
});
