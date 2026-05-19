import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  drivingHours: z.number().min(0).optional(),
  lastDrivingDate: z.string().optional().nullable(),
  licenseType: z.string().optional(),
  sousMandat: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

async function getStudentAndVerify(id: string, schoolId: string) {
  return prisma.student.findFirst({
    where: { id, schoolId },
    include: {
      placements: { orderBy: { date: "asc" } },
      _count: { select: { placements: true } },
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;
  const student = await getStudentAndVerify(id, session.user.schoolId);
  if (!student) return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
  return NextResponse.json(student);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.student.findFirst({
      where: { id, schoolId: session.user.schoolId },
    });
    if (!existing) return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });

    const student = await prisma.student.update({
      where: { id },
      data: {
        ...data,
        lastDrivingDate: data.lastDrivingDate ? new Date(data.lastDrivingDate) : null,
      },
    });

    return NextResponse.json(student);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.student.findFirst({
    where: { id, schoolId: session.user.schoolId },
  });
  if (!existing) return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });

  await prisma.student.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
