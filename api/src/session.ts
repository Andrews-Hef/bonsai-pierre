// Token de session anti-triche temps. GET /v1/daily émet un JWT HS256 figeant
// l'instant de départ (startedAt) côté serveur ; POST /submit le vérifie et
// calcule la durée depuis ce startedAt — le client n'est jamais cru sur le temps.
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";

const EXP_SECONDS = 6 * 60 * 60; // 6 h

export interface SessionClaims {
  userId: string; // UUID du joueur (doit == req.userId au submit)
  puzzleOn: string; // YYYY-MM-DD du puzzle ouvert
  startedAt: number; // ms epoch, figé serveur à l'émission
  jti: string; // identifiant unique du token
}

// Schéma des claims métier (en plus de iat/exp gérés par jwt).
const claimsSchema = z.object({
  userId: z.string().uuid(),
  puzzleOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startedAt: z.number().int().positive(),
  jti: z.string().min(1),
});

export function issueSessionToken(
  secret: string,
  params: { userId: string; puzzleOn: string },
): { token: string; startedAt: number } {
  const startedAt = Date.now();
  const token = jwt.sign(
    { userId: params.userId, puzzleOn: params.puzzleOn, startedAt, jti: randomUUID() },
    secret,
    { algorithm: "HS256", expiresIn: EXP_SECONDS },
  );
  return { token, startedAt };
}

// Lève si signature/exp invalide (jwt) ou claims malformés (zod).
// L'appelant mappe l'exception sur un 401.
export function verifySessionToken(secret: string, token: string): SessionClaims {
  const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
  return claimsSchema.parse(decoded);
}
