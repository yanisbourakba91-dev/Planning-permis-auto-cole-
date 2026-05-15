import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
