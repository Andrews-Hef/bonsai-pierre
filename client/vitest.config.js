import { defineConfig } from 'vitest/config';

// Config dédiée aux tests (prioritaire sur vite.config.js). On évite le plugin
// React : les tests de logique pure (codec) n'en ont pas besoin.
export default defineConfig({
  // Le test d'accord importe shared/voxel.ts, hors de la racine client/.
  server: { fs: { allow: ['..'] } },
  test: {
    environment: 'node',
    include: ['test/**/*.test.js', 'src/**/*.test.js'],
  },
});
