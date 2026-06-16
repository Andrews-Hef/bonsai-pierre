// Schéma Drizzle — REPRODUIT migrations/0001_init_stone_daily.sql (source de vérité).
// Sert au typage des requêtes ORM ; la parité (CHECK / ON DELETE / unique / index
// ordonné) est vérifiée contre le SQL fourni via drizzle-kit (npm run db:parity).
import { sql } from "drizzle-orm";
import {
  bigint, check, date, index, integer, pgTable, real, text, timestamp, unique, uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    displayName: text("display_name").notNull(),
    currentStreak: integer("current_streak").notNull().default(0),
    longestStreak: integer("longest_streak").notNull().default(0),
    lastPlayedOn: date("last_played_on"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("users_display_name_len", sql`char_length(${t.displayName}) between 1 and 50`),
    check("users_current_streak_nonneg", sql`${t.currentStreak} >= 0`),
    check("users_longest_streak_nonneg", sql`${t.longestStreak} >= 0`),
  ],
);

export const dailyPuzzles = pgTable(
  "daily_puzzles",
  {
    puzzleOn: date("puzzle_on").primaryKey(),
    gridSize: integer("grid_size").notNull(),
    shapeName: text("shape_name").notNull(),
    startKey: text("start_key").notNull(),
    targetKey: text("target_key").notNull(),
    targetVoxels: integer("target_voxels").notNull(),
    seed: bigint("seed", { mode: "bigint" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("daily_puzzles_grid_size_range", sql`${t.gridSize} between 8 and 128`),
    check("daily_puzzles_target_voxels_pos", sql`${t.targetVoxels} > 0`),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    puzzleOn: date("puzzle_on")
      .notNull()
      .references(() => dailyPuzzles.puzzleOn, { onDelete: "restrict" }),
    resemblance: real("resemblance").notNull(),
    durationMs: integer("duration_ms").notNull(),
    score: integer("score").notNull(),
    gridKey: text("grid_key"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("submissions_resemblance_range", sql`${t.resemblance} >= 0 and ${t.resemblance} <= 1`),
    check("submissions_duration_nonneg", sql`${t.durationMs} >= 0`),
    check("submissions_score_nonneg", sql`${t.score} >= 0`),
    unique("uq_submissions_one_per_day").on(t.userId, t.puzzleOn),
    // Classement du jour : score décroissant, puis temps croissant.
    index("idx_submissions_leaderboard").on(t.puzzleOn, t.score.desc(), t.durationMs.asc()),
  ],
);
