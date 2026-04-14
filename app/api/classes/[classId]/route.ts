import { NextRequest, NextResponse } from "next/server";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { classes, students } from "@/db/schema";

function parseClassId(value: string): number | null {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await context.params;
    const id = parseClassId(classId);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_class_id",
          message: "classId が不正です。",
        },
        { status: 400 }
      );
    }

    const [classRow] = await db
      .select({
        id: classes.id,
        name: classes.name,
        createdAt: classes.createdAt,
      })
      .from(classes)
      .where(eq(classes.id, id))
      .limit(1);

    if (!classRow) {
      return NextResponse.json(
        {
          ok: false,
          error: "class_not_found",
          message: "クラスが見つかりません。",
        },
        { status: 404 }
      );
    }

    const studentRows = await db
      .select({
        id: students.id,
        classId: students.classId,
        studentNumber: students.studentNumber,
        studentName: students.studentName,
        createdAt: students.createdAt,
      })
      .from(students)
      .where(eq(students.classId, id))
      .orderBy(asc(students.studentNumber), asc(students.id));

    return NextResponse.json({
      ok: true,
      classItem: {
        ...classRow,
        studentCount: studentRows.length,
      },
      students: studentRows,
    });
  } catch (error) {
    console.error("class detail GET error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_server_error",
        message: "クラス詳細の取得中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await context.params;
    const id = parseClassId(classId);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_class_id",
          message: "classId が不正です。",
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
      name?: unknown;
    };

    const name = isNonEmptyString(payload.name) ? payload.name.trim() : "";

    if (!name) {
      return NextResponse.json(
        {
          ok: false,
          error: "name_required",
          message: "クラス名を入力してください。",
        },
        { status: 400 }
      );
    }

    const [current] = await db
      .select({
        id: classes.id,
      })
      .from(classes)
      .where(eq(classes.id, id))
      .limit(1);

    if (!current) {
      return NextResponse.json(
        {
          ok: false,
          error: "class_not_found",
          message: "クラスが見つかりません。",
        },
        { status: 404 }
      );
    }

    const [duplicate] = await db
      .select({
        id: classes.id,
      })
      .from(classes)
      .where(
        and(
          sql`lower(${classes.name}) = lower(${name})`,
          sql`${classes.id} <> ${id}`
        )
      )
      .limit(1);

    if (duplicate) {
      return NextResponse.json(
        {
          ok: false,
          error: "class_name_already_exists",
          message: "同じクラス名がすでに存在します。",
        },
        { status: 409 }
      );
    }

    const [updated] = await db
      .update(classes)
      .set({
        name,
      })
      .where(eq(classes.id, id))
      .returning({
        id: classes.id,
        name: classes.name,
        createdAt: classes.createdAt,
      });

    const [studentCountRow] = await db
      .select({
        count: count(students.id),
      })
      .from(students)
      .where(eq(students.classId, id));

    return NextResponse.json({
      ok: true,
      classItem: {
        ...updated,
        studentCount: Number(studentCountRow?.count ?? 0),
      },
    });
  } catch (error) {
    console.error("class PATCH error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_server_error",
        message: "クラス更新中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await context.params;
    const id = parseClassId(classId);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_class_id",
          message: "classId が不正です。",
        },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .delete(classes)
      .where(eq(classes.id, id))
      .returning({
        id: classes.id,
        name: classes.name,
      });

    if (!deleted) {
      return NextResponse.json(
        {
          ok: false,
          error: "class_not_found",
          message: "クラスが見つかりません。",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      deletedClassId: deleted.id,
      deletedClassName: deleted.name,
    });
  } catch (error) {
    console.error("class DELETE error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_server_error",
        message: "クラス削除中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}