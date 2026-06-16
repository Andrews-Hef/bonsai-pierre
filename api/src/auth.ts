// Stand-in du middleware d'auth supposé : valide l'en-tête x-user-id (UUID)
// et remplit req.userId, sinon 401. En prod un vrai middleware le remplacerait ;
// en test on passe simplement l'en-tête. Utilisé en preHandler des routes /v1.
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const userId = z.string().uuid();

export async function requireUser(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const raw = req.headers["x-user-id"];
  const val = Array.isArray(raw) ? raw[0] : raw;
  const parsed = userId.safeParse(val);
  if (!parsed.success) {
    await reply.code(401).send({ error: "unauthorized", message: "x-user-id manquant ou invalide (UUID requis)" });
    return;
  }
  req.userId = parsed.data;
}
