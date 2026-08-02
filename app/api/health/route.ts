import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Uses the pg driver adapter, same as the rest of the app's Prisma calls.
export const runtime = "nodejs";

/**
 * Liveness/readiness check for uptime monitors and Vercel deployment
 * checks. Verifies the database is actually reachable rather than just
 * confirming the process is up — a 200 here means the app can serve real
 * requests, not just that the function booted.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed", error);
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
