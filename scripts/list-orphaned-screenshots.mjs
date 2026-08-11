// Lists R2 objects that no longer belong to any audit, so they can be purged
// deliberately rather than accumulating cost forever. Nothing has ever deleted
// a screenshot, so after the migration every object under the old `roasts/`
// prefix is orphaned.
//
//   node scripts/list-orphaned-screenshots.mjs           # report only
//   node scripts/list-orphaned-screenshots.mjs --delete  # actually delete
//
// Read-only by default on purpose: deleting an object that a live, indexed
// public audit still references would break that page's screenshot.
import "dotenv/config";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import pg from "pg";

const shouldDelete = process.argv.includes("--delete");
const bucket = process.env.R2_BUCKET;
const accountId = process.env.R2_ACCOUNT_ID;

if (!bucket || !accountId) {
  console.error("Set R2_BUCKET and R2_ACCOUNT_ID before running.");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});

// Every key still referenced by a live audit. Anything else is fair game.
const db = new pg.Client({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
});
await db.connect();

const live = new Set();
try {
  const { rows } = await db.query(
    `SELECT "screenshotUrl" FROM "Audit" WHERE "screenshotUrl" IS NOT NULL`,
  );
  for (const row of rows) {
    // Store the key, not the URL — the public base can change independently.
    live.add(new URL(row.screenshotUrl).pathname.replace(/^\//, ""));
  }
} catch {
  console.warn('No "Audit" table yet — treating every object as orphaned.');
}
await db.end();

const orphans = [];
let token;
do {
  const page = await s3.send(
    new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
  );
  for (const object of page.Contents ?? []) {
    if (!live.has(object.Key)) orphans.push(object.Key);
  }
  token = page.NextContinuationToken;
} while (token);

const bytes = orphans.length;
console.log(`\n${live.size} object(s) still referenced by a live audit.`);
console.log(`${bytes} orphaned object(s) in "${bucket}".`);

if (!orphans.length) process.exit(0);

console.log(
  orphans
    .slice(0, 20)
    .map((k) => `  ${k}`)
    .join("\n"),
);
if (orphans.length > 20) console.log(`  … and ${orphans.length - 20} more`);

if (!shouldDelete) {
  console.log("\nRe-run with --delete to remove them.");
  process.exit(0);
}

// DeleteObjects caps at 1000 keys per call.
for (let i = 0; i < orphans.length; i += 1000) {
  const chunk = orphans.slice(i, i + 1000);
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: chunk.map((Key) => ({ Key })) },
    }),
  );
  console.log(
    `Deleted ${Math.min(i + 1000, orphans.length)}/${orphans.length}`,
  );
}
