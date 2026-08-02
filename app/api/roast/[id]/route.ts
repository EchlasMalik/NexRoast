import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const roast = await prisma.roast.findUnique({ where: { id } });
  if (!roast) {
    return NextResponse.json({ error: "Roast not found." }, { status: 404 });
  }

  return NextResponse.json({ roast });
}
