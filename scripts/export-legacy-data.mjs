// One-shot safety net for the audit-platform migration, which drops the
// Roast, LeadCapture and Event tables. Dumps everything to a timestamped JSON
// file in the repo root BEFORE any schema change runs.
//
// This is the only copy of records that were paid for (`unlockedAt` set), so
// run it first and keep the output somewhere safe:
//
//   node scripts/export-legacy-data.mjs
//
// It reads the tables with raw SQL rather than the Prisma client, so it keeps
// working after the schema has already been edited in the working tree.
import "dotenv/config";
import { writeFileSync } from "node:fs";
import pg from "pg";

const connectionString =
  process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Set DATABASE_URL (or DIRECT_DATABASE_URL) before running.");
  process.exit(1);
}

const client = new pg.Client({ connectionString });

/** Returns [] for a table that doesn't exist, so a partial DB doesn't abort the dump. */
async function dump(table) {
  try {
    const { rows } = await client.query(`SELECT * FROM "${table}"`);
    return rows;
  } catch (error) {
    console.warn(`  ${table}: skipped (${error.message.split("\n")[0]})`);
    return [];
  }
}

await client.connect();

const data = {
  exportedAt: new Date().toISOString(),
  note: "Pre-migration dump taken before the roast -> audit refactor dropped these tables.",
  roasts: await dump("Roast"),
  leadCaptures: await dump("LeadCapture"),
  events: await dump("Event"),
};

await client.end();

const stamp = data.exportedAt.replace(/[:.]/g, "-");
const file = `nexroast-export-${stamp}.json`;
writeFileSync(file, JSON.stringify(data, null, 2));

const paid = data.roasts.filter((r) => r.unlockedAt).length;

console.log(`\nWrote ${file}`);
console.log(`  roasts:        ${data.roasts.length}  (${paid} paid)`);
console.log(`  leadCaptures:  ${data.leadCaptures.length}`);
console.log(`  events:        ${data.events.length}`);

if (paid > 0) {
  console.log(
    `\n  ${paid} record(s) were paid for. Their screenshots and Stripe charges` +
      `\n  are identifiable from this file if you decide to refund.`,
  );
}
