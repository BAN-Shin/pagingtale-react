import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, students } from "@/db/schema";

function parseStudentId(value: string): number | null {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function isOptionalNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await context.params;
    const id = parseStudentId(studentId);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_student_id",
          message: "studentId が不正です。",
        },
        { status: 400 }
      );
    }

    const body = (await req.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          ok: false,
          error: "payload_invalid",
          message: "送信データの形式が不正です。",
        },
        { status: 400 }
      );
    }

    const payload = body as {
      classId?: unknown;
      studentNumber?: unknown;
      studentName?: unknown;
    };

    const updateData: {
      classId?: number;
      studentNumber?: string;
      studentName?: string;
    } = {};

    if (typeof payload.classId === "number" && Number.isInteger(payload.classId)) {
      const [classRow] = await db
        .select({ id: classes.id })
        .from(classes)
        .where(eq(classes.id, payload.classId))
        .limit(1);

      if (!classRow) {
        return NextResponse.json(
          {
            ok: false,
            error: "class_not_found",
            message: "指定されたクラスが見つかりません。",
          },
          { status: 404 }
        );
      }

      updateData.classId = payload.classId;
    }

    if (isOptionalNonEmptyString(payload.studentNumber)) {
      updateData.studentNumber = payload.studentNumber.trim();
    }

    if (isOptionalNonEmptyString(payload.studentName)) {
      updateData.studentName = payload.studentName.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "no_update_fields",
          message: "更新対象の項目がありません。",
        },
        { status: 400 }
      );
    }

    const [current] = await db
      .select({
        id: students.id,
        classId: students.classId,
        studentNumber: students.studentNumber,
      })
      .from(students)
      .where(eq(students.id, id))
      .limit(1);

    if (!current) {
      return NextResponse.json(
        {
          ok: false,
          error: "student_not_found",
          message: "生徒が見つかりません。",
        },
        { status: 404 }
      );
    }

    const nextClassId = updateData.classId ?? current.classId;
    const nextStudentNumber = updateData.studentNumber ?? current.studentNumber;

    const [duplicate] = await db
      .select({
        id: students.id,
      })
      .from(students)
      .where(
        and(
          eq(students.classId, nextClassId),
          eq(students.studentNumber, nextStudentNumber)
        )
      )
      .limit(10);

    if (duplicate && duplicate.id !== id) {
      return NextResponse.json(
        {
          ok: false,
          error: "student_number_already_exists",
          message: "このクラスには同じ学籍番号の生徒がすでに登録されています。",
        },
        { status: 409 }
      );
    }

    const [updated] = await db
      .update(students)
      .set(updateData)
      .where(eq(students.id, id))
      .returning({
        id: students.id,
        classId: students.classId,
        studentNumber: students.studentNumber,
        studentName: students.studentName,
        createdAt: students.createdAt,
      });

    return NextResponse.json({
      ok: true,
      student: updated,
    });
  } catch (error) {
    console.error("students PATCH error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_server_error",
        message: "生徒更新中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await context.params;
    const id = parseStudentId(studentId);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_student_id",
          message: "studentId が不正です。",
        },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .delete(students)
      .where(eq(students.id, id))
      .returning({
        id: students.id,
      });

    if (!deleted) {
      return NextResponse.json(
        {
          ok: false,
          error: "student_not_found",
          message: "生徒が見つかりません。",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      deletedStudentId: deleted.id,
    });
  } catch (error) {
    console.error("students DELETE error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_server_error",
        message: "生徒削除中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}