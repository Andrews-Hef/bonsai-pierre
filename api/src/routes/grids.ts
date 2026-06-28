// GET /v1/grids/:key — sert les octets bruts d'une grille depuis le storage
// (mode fs en dev/test ; en prod les URLs pointent directement vers le CDN/S3).
// Assets immuables -> Cache-Control long + immutable. Clé invalide/absente -> 404.
import type { FastifyInstance } from "fastify";

export async function gridsRoutes(app: FastifyInstance): Promise<void> {
  // Le wildcard capture les clés contenant des "/" (ex. "2026-06-28/target.b64").
  app.get<{ Params: { "*": string } }>("/v1/grids/*", async (req, reply) => {
    const key = req.params["*"];
    let bytes: Buffer;
    try {
      bytes = await app.storage.get(key);
    } catch {
      return reply.code(404).send({ error: "not_found", message: "grille introuvable" });
    }
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    reply.header("Content-Type", "application/octet-stream");
    return reply.send(bytes);
  });
}
