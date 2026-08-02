// Runs `prisma migrate deploy` through DIRECT_DATABASE_URL when one is set,
// rather than DATABASE_URL. Prisma's config file only exposes a single
// `datasource.url` (no `directUrl` field in this Prisma version, and
// `migrate deploy` has no CLI flag to override it — verified against the
// installed `@prisma/config` types and `prisma migrate deploy --help`), so
// routing migrations through a different connection string than the app
// uses means swapping DATABASE_URL just for this child process.
//
// This matters against a pooled connection (e.g. Neon's default,
// PgBouncer-backed URL): Prisma Migrate's advisory locks don't reliably
// survive transaction-mode pooling. The app itself always uses the real
// DATABASE_URL (the pooled one) — this override never touches it, since
// it's only applied to the env passed to this one subprocess.
import "dotenv/config";
import { execSync } from "node:child_process";

const env = {
  ...process.env,
  DATABASE_URL: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
};

execSync("npx prisma migrate deploy", { stdio: "inherit", env });
