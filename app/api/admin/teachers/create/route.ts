import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teachers } from "@/db/schema";
import { getAdminSession, makeTeacherPasswordHash } from "@/lib/admin-auth";

type CreateTeacherBody = {
  loginId?: string;
  teacherName?: string;
  password?: string;
};

function normalizeLoginId(value: string): string {
  return value.trim();
}

function isStrongEnoughPassword(password: string): boolean {
  if (password.length < 8) return false;

  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /\d/.test(password);

  return hasLetter && hasDigit;
}

export async function POST(req: Request) {
  try {
    const adminSession = await getAdminSession();

    if (!adminSession || adminSession.role !== "admin") {
      return NextResponse.json(
        { ok: false, message: "権限がありません。" },
        { status: 403 }
      );
    }

    const body = (await req.json()) as CreateTeacherBody;

    const loginId = normalizeLoginId(String(body.loginId ?? ""));
    const teacherName = String(body.teacherName ?? "").trim();
    const password = String(body.password ?? "").trim();

    if (!loginId || !teacherName || !password) {
      return NextResponse.json(
        { ok: false, message: "ログインID・名前・パスワードを入力してください。" },
        { status: 400 }
      );
    }

    if (!/^[A-Za-z0-9._-]+$/.test(loginId)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "ログインIDは英数字と . _ - のみ使用できます。",
        },
        { status: 400 }
      );
    }

    if (!isStrongEnoughPassword(password)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "パスワードは8文字以上で、英字と数字を両方含めてください。",
        },
        { status: 400 }
      );
    }

    const [existingTeacher] = await db
      .select({
        id: teachers.id,
      })
      .from(teachers)
      .where(eq(teachers.loginId, loginId))
      .limit(1);

    if (existingTeacher) {
      return NextResponse.json(
        {
          ok: false,
          message: "そのログインIDはすでに使われています。",
        },
        { status: 409 }
      );
    }

    const passwordHash = makeTeacherPasswordHash(password);

    const [createdTeacher] = await db
      .insert(teachers)
      .values({
        loginId,
        teacherName,
        passwordHash,
        role: "teacher",
        isActive: true,
      })
      .returning({
        id: teachers.id,
        loginId: teachers.loginId,
        teacherName: teachers.teacherName,
        role: teachers.role,
        isActive: teachers.isActive,
      });

    return NextResponse.json({
      ok: true,
      message: "教師アカウントを追加しました。",
      teacher: createdTeacher,
    });
  } catch (e) {
    console.error("create teacher route error:", e);
    return NextResponse.json(
      {
        ok: false,
        message: "教師アカウントの作成中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}