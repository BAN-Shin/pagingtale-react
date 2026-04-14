import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teachers } from "@/db/schema";
import {
  getAdminSession,
  makeTeacherPasswordHash,
  verifyTeacherPassword,
} from "@/lib/admin-auth";

type ChangePasswordBody = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export async function POST(req: Request) {
  try {
    const adminSession = await getAdminSession();

    if (
      !adminSession ||
      (adminSession.role !== "teacher" && adminSession.role !== "admin")
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "管理者ログインが必要です。",
        },
        { status: 401 }
      );
    }

    const body = (await req.json()) as ChangePasswordBody;

    const currentPassword = String(body.currentPassword ?? "").trim();
    const newPassword = String(body.newPassword ?? "").trim();
    const confirmPassword = String(body.confirmPassword ?? "").trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        {
          ok: false,
          message: "現在のパスワード・新しいパスワード・確認用パスワードを入力してください。",
        },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        {
          ok: false,
          message: "新しいパスワードは8文字以上で入力してください。",
        },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        {
          ok: false,
          message: "新しいパスワードと確認用パスワードが一致しません。",
        },
        { status: 400 }
      );
    }

    const [teacher] = await db
      .select({
        id: teachers.id,
        passwordHash: teachers.passwordHash,
        isActive: teachers.isActive,
      })
      .from(teachers)
      .where(eq(teachers.id, adminSession.teacherId))
      .limit(1);

    if (!teacher || !teacher.isActive) {
      return NextResponse.json(
        {
          ok: false,
          message: "教師アカウントが見つからないか、無効化されています。",
        },
        { status: 404 }
      );
    }

    if (!verifyTeacherPassword(currentPassword, teacher.passwordHash)) {
      return NextResponse.json(
        {
          ok: false,
          message: "現在のパスワードが正しくありません。",
        },
        { status: 400 }
      );
    }

    if (verifyTeacherPassword(newPassword, teacher.passwordHash)) {
      return NextResponse.json(
        {
          ok: false,
          message: "新しいパスワードは現在のパスワードと別のものにしてください。",
        },
        { status: 400 }
      );
    }

    const nextHash = makeTeacherPasswordHash(newPassword);

    await db
      .update(teachers)
      .set({
        passwordHash: nextHash,
        updatedAt: new Date(),
      })
      .where(eq(teachers.id, teacher.id));

    return NextResponse.json({
      ok: true,
      message: "パスワードを変更しました。",
    });
  } catch (error) {
    console.error("admin change-password route error:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? `パスワード変更処理エラー: ${error.message}`
            : "パスワード変更処理で不明なエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}