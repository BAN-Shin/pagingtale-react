import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, students } from "@/db/schema";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const classId = Number(searchParams.get("classId") ?? 0);
    const studentNumber = (searchParams.get("studentNumber") ?? "").trim();

    if (!Number.isInteger(classId) || classId <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "class_id_invalid",
          message: "classId が不正です。",
        },
        { status: 400 }
      );
    }

    if (!studentNumber) {
      return NextResponse.json({
        ok: true,
        student: null,
      });
    }

    const [matchedClass] = await db
      .select({
        id: classes.id,
        deletedAt: classes.deletedAt,
      })
      .from(classes)
      .where(eq(classes.id, classId))
      .limit(1);

    if (!matchedClass || matchedClass.deletedAt) {
      return NextResponse.json(
        {
          ok: false,
          error: "class_not_found",
          message: "指定されたクラスが見つかりません。",
        },
        { status: 404 }
      );
    }

    const [matchedStudent] = await db
      .select({
        id: students.id,
        classId: students.classId,
        studentNumber: students.studentNumber,
        studentName: students.studentName,
      })
      .from(students)
      .where(
        and(
          eq(students.classId, classId),
          eq(students.studentNumber, studentNumber)
        )
      )
      .limit(1);

    return NextResponse.json({
      ok: true,
      student: matchedStudent ?? null,
    });
  } catch (error) {
    console.error("students lookup GET error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_server_error",
        message: "生徒照合中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}