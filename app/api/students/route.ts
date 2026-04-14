import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { classes, students } from "@/db/schema";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseOptionalPositiveInt(value: string | null): number | null {
  if (!value) return null;
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const classId = parseOptionalPositiveInt(searchParams.get("classId"));
    const q = (searchParams.get("q") ?? "").trim();

    const filters = [];

    if (classId) {
      filters.push(eq(students.classId, classId));
    }

    if (q) {
      filters.push(
        sql`(${students.studentNumber} ILIKE ${`%${q}%`} OR ${students.studentName} ILIKE ${`%${q}%`})`
      );
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const rows = await db
      .select({
        id: students.id,
        classId: students.classId,
        className: classes.name,
        studentNumber: students.studentNumber,
        studentName: students.studentName,
        createdAt: students.createdAt,
      })
      .from(students)
      .innerJoin(classes, eq(students.classId, classes.id))
      .where(whereClause)
      .orderBy(
        asc(classes.name),
        asc(students.studentNumber),
        asc(students.id)
      );

    return NextResponse.json({
      ok: true,
      students: rows,
    });
  } catch (error) {
    console.error("students GET error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_server_error",
        message: "生徒一覧の取得中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
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

    const classId =
      typeof payload.classId === "number" && Number.isInteger(payload.classId)
        ? payload.classId
        : null;

    const studentNumber = isNonEmptyString(payload.studentNumber)
      ? payload.studentNumber.trim()
      : "";

    const studentName = isNonEmptyString(payload.studentName)
      ? payload.studentName.trim()
      : "";

    if (!classId || classId <= 0) {
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
      return NextResponse.json(
        {
          ok: false,
          error: "student_number_required",
          message: "学籍番号を入力してください。",
        },
        { status: 400 }
      );
    }

    if (!studentName) {
      return NextResponse.json(
        {
          ok: false,
          error: "student_name_required",
          message: "氏名を入力してください。",
        },
        { status: 400 }
      );
    }

    const [classRow] = await db
      .select({
        id: classes.id,
        name: classes.name,
      })
      .from(classes)
      .where(eq(classes.id, classId))
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

    const [duplicate] = await db
      .select({
        id: students.id,
      })
      .from(students)
      .where(
        and(
          eq(students.classId, classId),
          eq(students.studentNumber, studentNumber)
        )
      )
      .limit(1);

    if (duplicate) {
      return NextResponse.json(
        {
          ok: false,
          error: "student_number_already_exists",
          message: "このクラスには同じ学籍番号の生徒がすでに登録されています。",
        },
        { status: 409 }
      );
    }

    const [created] = await db
      .insert(students)
      .values({
        classId,
        studentNumber,
        studentName,
      })
      .returning({
        id: students.id,
        classId: students.classId,
        studentNumber: students.studentNumber,
        studentName: students.studentName,
        createdAt: students.createdAt,
      });

    return NextResponse.json({
      ok: true,
      student: {
        ...created,
        className: classRow.name,
      },
    });
  } catch (error) {
    console.error("students POST error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_server_error",
        message: "生徒登録中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}