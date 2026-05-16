import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  date: z.string().min(1).optional(),
  time: z.string().min(1).optional(),
  instructor: z.string().optional(),
  examCenter: z.string().optional(),
  notes: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.schoolId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    const data = patchSchema.parse(body);
    const placement = await prisma.examPlacement.findFirst({
      where: { id, schoolId: session.user.schoolId },
    });
    if (!placement) return NextResponse.json({ error: "Placement introuvable" }, { status: 404 });
    const updated = await prisma.examPlacement.update({
      where: { id },
      data: { ...data, date: data.date ? new Date(data.date) : undefined },
      include: { student: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;

  const placement = await prisma.examPlacement.findFirst({
    where: { id, schoolId: session.user.schoolId },
  });
  if (!placement) return NextResponse.json({ error: "Placement introuvable" }, { status: 404 });

  const year = placement.date.getFullYear();
  const month = placement.date.getMonth() + 1;

  await prisma.$transaction([
    prisma.examPlacement.delete({ where: { id } }),
    prisma.examMonth.updateMany({
      where: { schoolId: session.user.schoolId, year, month, usedSlots: { gt: 0 } },
      data: { usedSlots: { decrement: 1 } },
    }),
  ]);

  return NextResponse.json({ success: true });
}
