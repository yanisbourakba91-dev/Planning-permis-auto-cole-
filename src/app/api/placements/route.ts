import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const placementSchema = z.object({
  studentId: z.string().min(1, "Élève requis"),
  date: z.string().min(1, "Date requise"),
  time: z.string().min(1, "Heure requise"),
  instructor: z.string().min(1, "Moniteur requis"),
  examCenter: z.string().min(1, "Centre d'examen requis"),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const where: Record<string, unknown> = { schoolId: session.user.schoolId };
  if (year && month) {
    const start = new Date(parseInt(year), parseInt(month) - 1, 1);
    const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
    where.date = { gte: start, lte: end };
  }

  const placements = await prisma.examPlacement.findMany({
    where,
    include: { student: true },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(placements);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = placementSchema.parse(body);

    const student = await prisma.student.findFirst({
      where: { id: data.studentId, schoolId: session.user.schoolId },
    });
    if (!student) return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });

    const placementDate = new Date(data.date);
    const year = placementDate.getFullYear();
    const month = placementDate.getMonth() + 1;

    const placement = await prisma.$transaction(async (tx) => {
      const created = await tx.examPlacement.create({
        data: {
          ...data,
          date: placementDate,
          schoolId: session.user.schoolId!,
        },
        include: { student: true },
      });

      await tx.examMonth.upsert({
        where: { schoolId_year_month: { schoolId: session.user.schoolId!, year, month } },
        create: { schoolId: session.user.schoolId!, year, month, totalSlots: 0, usedSlots: 1 },
        update: { usedSlots: { increment: 1 } },
      });

      return created;
    });

    return NextResponse.json(placement, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Create placement error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
