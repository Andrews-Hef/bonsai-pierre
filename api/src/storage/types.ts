// Abstraction du stockage objet des grilles (start/target).
// En base on ne garde que les clés ; les octets vivent ici.
// Impl fs en dev/test, S3/R2 en prod.
export interface StorageClient {
  /** Récupère les octets bruts d'une clé. Rejette si absente. */
  get(key: string): Promise<Buffer>;
  /** Écrit/écrase les octets d'une clé (assets immuables en pratique). */
  put(key: string, bytes: Buffer): Promise<void>;
  /**
   * URL publique servant la grille.
   * - fs (dev) : chemin relatif `/v1/grids/:key` (route de stream locale).
   * - s3/r2 (prod) : URL CDN/bucket public.
   * Pas de presigning : assets publics immuables.
   */
  publicUrl(key: string): string;
}
