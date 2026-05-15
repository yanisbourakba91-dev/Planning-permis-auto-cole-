import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") || new Date().getFullYear().toString();

  const months = await prisma.examMonth.findMany({
    where: { schoolId: session.user.schoolId, year: parseInt(year) },
    orderBy: { month: "asc" },
  });

  return NextResponse.json(months);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const schema = z.object({
      year: z.number().int().min(2020).max(2100),
      month: z.number().int().min(1).max(12),
      totalSlots: z.number().int().min(0),
    });
    const { year, month, totalSlots } = schema.parse(body);

    const examMonth = await prisma.examMonth.upsert({
      where: { schoolId_year_month: { schoolId: session.user.schoolId, year, month } },
      create: { schoolId: session.user.schoolId, year, month, totalSlots },
      update: { totalSlots },
    });

    return NextResponse.json(examMonth);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
