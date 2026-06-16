// Sélection de l'impl de stockage selon la config.
// S3/R2 sera ajouté avec l'étape "servir les grilles" ; en dev/test on tourne en fs.
import { env } from "../config/env.js";
import { createFsStorage } from "./fsStorage.js";
import type { StorageClient } from "./types.js";

export type { StorageClient } from "./types.js";

export function createStorage(): StorageClient {
  switch (env.STORAGE_DRIVER) {
    case "fs":
      return createFsStorage(env.STORAGE_FS_DIR);
    case "s3":
      throw new Error("StorageClient S3/R2 pas encore implémenté (étape 'servir les grilles')");
  }
}
