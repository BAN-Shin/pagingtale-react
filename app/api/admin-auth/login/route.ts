import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teachers } from "@/db/schema";
import { setAdminSession, verifyTeacherPassword } from "@/lib/admin-auth";

type LoginBody = {
  loginId?: string;
  password?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LoginBody;

    const loginId = String(body.loginId ?? "").trim();
    const password = String(body.password ?? "").trim();

    if (!loginId || !password) {
      return NextResponse.json(
        {
          ok: false,
          message: "ログインIDとパスワードを入力してください。",
        },
        { status: 400 }
      );
    }

    const matchedTeachers = await db
      .select({
        id: teachers.id,
        loginId: teachers.loginId,
        teacherName: teachers.teacherName,
        passwordHash: teachers.passwordHash,
        role: teachers.role,
        isActive: teachers.isActive,
      })
      .from(teachers)
      .where(eq(teachers.loginId, loginId))
      .limit(2);

    if (matchedTeachers.length !== 1) {
      return NextResponse.json(
        {
          ok: false,
          message: "ログインIDまたはパスワードが正しくありません。",
        },
        { status: 400 }
      );
    }

    const teacher = matchedTeachers[0];

    if (!teacher.isActive) {
      return NextResponse.json(
        {
          ok: false,
          message: "この教師アカウントは無効化されています。",
        },
        { status: 403 }
      );
    }

    if (
      teacher.role !== "teacher" &&
      teacher.role !== "admin"
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "このアカウントでは管理画面にアクセスできません。",
        },
        { status: 403 }
      );
    }

    if (!verifyTeacherPassword(password, teacher.passwordHash)) {
      return NextResponse.json(
        {
          ok: false,
          message: "ログインIDまたはパスワードが正しくありません。",
        },
        { status: 400 }
      );
    }

    await setAdminSession({
      teacherId: teacher.id,
      loginId: teacher.loginId,
      teacherName: teacher.teacherName,
      role: teacher.role === "admin" ? "admin" : "teacher",
    });

    return NextResponse.json({
      ok: true,
      teacher: {
        id: teacher.id,
        loginId: teacher.loginId,
        teacherName: teacher.teacherName,
        role: teacher.role,
      },
    });
  } catch (error) {
    console.error("admin login route error:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? `教師ログイン処理エラー: ${error.message}`
            : "教師ログイン処理で不明なエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}