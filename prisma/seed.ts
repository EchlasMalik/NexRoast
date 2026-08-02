import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.event.deleteMany();
  await prisma.leadCapture.deleteMany();
  await prisma.roast.deleteMany();

  await prisma.roast.create({
    data: {
      url: "https://example.com",
      // Points at the r2.dev wildcard allowed in next.config.ts so
      // next/image accepts the domain in dev; the file itself doesn't
      // exist, so this renders as a broken image until real R2 data
      // replaces it — that's expected for seed data.
      screenshotUrl: "https://pub-seed-demo.r2.dev/roasts/example.png",
      status: "complete",
      score: 42,
      critique: {
        score: 42,
        roastPoints: [
          {
            category: "design",
            critique:
              "Three fonts in one hero section? Pick a lane — this isn't a ransom note.",
          },
          {
            category: "ux",
            critique:
              "The headline just restates the company name in bigger letters. Bold strategy, zero information.",
          },
          {
            category: "conversion",
            critique:
              "Your CTA button is the same gray as everything else. It's not hiding from taxes, it's hiding from clicks.",
          },
          {
            category: "speed",
            critique:
              "A 4MB uncompressed hero image is why your bounce rate has its own bounce rate.",
          },
        ],
        biggestWin:
          "Compress that hero image and give the CTA a color that isn't 'default gray' — that alone could meaningfully lift conversions.",
      },
      createdAt: new Date("2026-07-20T10:00:00Z"),
      unlockedAt: new Date("2026-07-20T10:05:00Z"),
      leadCaptures: {
        create: {
          name: "Jordan Reyes",
          email: "jordan@example.com",
          message: "Yeah, roast confirmed. Can someone actually fix this?",
        },
      },
    },
  });

  await prisma.roast.create({
    data: {
      url: "https://another-example.com",
      status: "pending",
      createdAt: new Date("2026-07-31T09:30:00Z"),
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
