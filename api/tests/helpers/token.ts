// Forge des tokens de session pour les tests (cas que GET /v1/daily ne produit
// pas : autre user, startedAt arbitraire, token expiré).
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { TEST_JWT_SECRET } from "./app.js";

export function signSession(params: {
  userId: string;
  puzzleOn: string;
  startedAt?: number;
  expiresIn?: number | string; // négatif/"-1s" => déjà expiré
}): string {
  const startedAt = params.startedAt ?? Date.now();
  return jwt.sign(
    { userId: params.userId, puzzleOn: params.puzzleOn, startedAt, jti: randomUUID() },
    TEST_JWT_SECRET,
    { algorithm: "HS256", expiresIn: params.expiresIn ?? 6 * 60 * 60 },
  );
}
