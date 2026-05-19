import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function weekStartDate(raw: string): Date {
  const d = new Date(raw + "T00:00:00.000Z");
  if (isNaN(d.getTime())) throw new Error("Invalid weekStart");
  return d;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.schoolId)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const weekStart = req.nextUrl.searchParams.get("weekStart");
  if (!weekStart)
    return NextResponse.json({ error: "weekStart requis" }, { status: 400 });

  const entries = await prisma.weekQueue.findMany({
    where: { schoolId: session.user.schoolId, weekStart: weekStartDate(weekStart) },
    select: { id: true, studentId: true },
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.schoolId)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { studentId, weekStart } = await req.json();
  if (!studentId || !weekStart)
    return NextResponse.json({ error: "studentId et weekStart requis" }, { status: 400 });

  const entry = await prisma.weekQueue.upsert({
    where: {
      schoolId_weekStart_studentId: {
        schoolId: session.user.schoolId,
        weekStart: weekStartDate(weekStart),
        studentId,
      },
    },
    update: {},
    create: {
      schoolId: session.user.schoolId,
      weekStart: weekStartDate(weekStart),
      studentId,
    },
    select: { id: true, studentId: true },
  });

  return NextResponse.json(entry, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.schoolId)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "id requis" }, { status: 400 });

  await prisma.weekQueue.deleteMany({
    where: { id, schoolId: session.user.schoolId },
  });

  return NextResponse.json({ ok: true });
}
