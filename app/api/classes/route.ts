import { NextRequest, NextResponse } from "next/server";
import { and, asc, count, eq, ilike, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { classes, students } from "@/db/schema";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();

    const rows = await db
      .select({
        id: classes.id,
        name: classes.name,
        createdAt: classes.createdAt,
        studentCount: count(students.id),
      })
      .from(classes)
      .leftJoin(students, eq(students.classId, classes.id))
      .where(
        q
          ? and(isNull(classes.deletedAt), ilike(classes.name, `%${q}%`))
          : isNull(classes.deletedAt)
      )
      .groupBy(classes.id, classes.name, classes.createdAt)
      .orderBy(asc(classes.name), asc(classes.id));

    return NextResponse.json({
      ok: true,
      classes: rows,
    });
  } catch (error) {
    console.error("classes GET error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_server_error",
        message: "クラス一覧の取得中にエラーが発生しました。",
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

    const [duplicate] = await db
      .select({
        id: classes.id,
      })
      .from(classes)
      .where(sql`lower(${classes.name}) = lower(${name})`)
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

    const [created] = await db
      .insert(classes)
      .values({
        name,
      })
      .returning({
        id: classes.id,
        name: classes.name,
        createdAt: classes.createdAt,
      });

    return NextResponse.json({
      ok: true,
      classItem: {
        ...created,
        studentCount: 0,
      },
    });
  } catch (error) {
    console.error("classes POST error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_server_error",
        message: "クラス作成中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}