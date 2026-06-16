// Stockage objet sur disque (dev/test). Les clés peuvent contenir des
// sous-dossiers (ex. "2026-06-20/target.b64") ; on bloque toute remontée
// hors du répertoire de base (anti path-traversal).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { StorageClient } from "./types.js";

const KEY_RE = /^[A-Za-z0-9._/-]+$/;

function safeResolve(baseDir: string, key: string): string {
  if (!key || !KEY_RE.test(key) || key.includes("..")) {
    throw new Error(`clé de stockage invalide: ${JSON.stringify(key)}`);
  }
  const root = resolve(baseDir);
  const full = resolve(root, key);
  if (full !== root && !full.startsWith(root + sep)) {
    throw new Error(`clé de stockage hors périmètre: ${JSON.stringify(key)}`);
  }
  return full;
}

export function createFsStorage(baseDir: string): StorageClient {
  return {
    async get(key) {
      return readFile(safeResolve(baseDir, key));
    },
    async put(key, bytes) {
      const full = safeResolve(baseDir, key);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, bytes);
    },
    publicUrl(key) {
      // Validé pour la cohérence avec get/put.
      safeResolve(baseDir, key);
      return `/v1/grids/${key}`;
    },
  };
}
