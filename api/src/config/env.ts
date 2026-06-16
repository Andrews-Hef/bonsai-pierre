// Configuration centrale, validée au démarrage (fail-fast).
// Charge un .env local s'il existe (Node 22+, sans dépendance dotenv),
// puis valide process.env avec zod. Le stockage S3 n'est exigé que si
// STORAGE_DRIVER=s3 (sinon on tourne en fs, pour le dev et les tests).
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile)) {
  // Disponible en Node >= 20.12 / 22 ; n'écrase pas les variables déjà définies.
  process.loadEnvFile(envFile);
}

const base = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default("0.0.0.0"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  // Secret JWT HS256 du token de session anti-triche.
  JWT_SECRET: z.string().min(16, "JWT_SECRET doit faire >= 16 caractères"),

  STORAGE_DRIVER: z.enum(["fs", "s3"]).default("fs"),
  // Répertoire des grilles en mode fs (dev/test).
  STORAGE_FS_DIR: z.string().default("./.data/grids"),

  // Présents seulement si STORAGE_DRIVER=s3 (validés conditionnellement plus bas).
  STORAGE_S3_BUCKET: z.string().optional(),
  STORAGE_S3_PUBLIC_BASE: z.string().url().optional(),
  STORAGE_S3_REGION: z.string().optional(),
  STORAGE_S3_ENDPOINT: z.string().url().optional(),
});

const schema = base.superRefine((v, ctx) => {
  if (v.STORAGE_DRIVER === "s3") {
    if (!v.STORAGE_S3_BUCKET)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["STORAGE_S3_BUCKET"], message: "requis si STORAGE_DRIVER=s3" });
    if (!v.STORAGE_S3_PUBLIC_BASE)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["STORAGE_S3_PUBLIC_BASE"], message: "requis si STORAGE_DRIVER=s3" });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Configuration d'environnement invalide :\n${issues}`);
}

export type Env = z.infer<typeof base>;
export const env: Env = parsed.data;
