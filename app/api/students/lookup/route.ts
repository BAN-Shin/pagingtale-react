import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, students } from "@/db/schema";

function parseOptionalPositiveInt(value: string | null): number | null {
  if (!value) return null;
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentNumber = (searchParams.get("studentNumber") ?? "").trim();
    const classId = parseOptionalPositiveInt(searchParams.get("classId"));

    if (!studentNumber) {
      return NextResponse.json(
        {
          ok: false,
          error: "student_number_required",
          message: "studentNumber を指定してください。",
        },
        { status: 400 }
      );
    }

    const conditions = [eq(students.studentNumber, studentNumber)];

    if (classId) {
      conditions.push(eq(students.classId, classId));
    }

    const rows = await db
      .select({
        id: students.id,
        classId: students.classId,
        className: classes.name,
        studentNumber: students.studentNumber,
        studentName: students.studentName,
      })
      .from(students)
      .innerJoin(classes, eq(students.classId, classes.id))
      .where(and(...conditions))
      .limit(10);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "student_not_found",
          message: "該当する生徒が見つかりません。",
        },
        { status: 404 }
      );
    }

    if (!classId && rows.length > 1) {
      return NextResponse.json(
        {
          ok: false,
          error: "multiple_students_found",
          message:
            "同じ学籍番号の生徒が複数のクラスに存在します。classId を指定してください。",
          candidates: rows,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      student: rows[0],
    });
  } catch (error) {
    console.error("students lookup GET error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_server_error",
        message: "生徒検索中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}