import { NextResponse } from "next/server";
import { db } from "@/db";
import { teachers } from "@/db/schema";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET() {
  try {
    const adminSession = await getAdminSession();

    if (!adminSession || adminSession.role !== "admin") {
      return NextResponse.json(
        { ok: false, message: "権限がありません。" },
        { status: 403 }
      );
    }

    const list = await db
      .select({
        id: teachers.id,
        loginId: teachers.loginId,
        teacherName: teachers.teacherName,
        role: teachers.role,
        isActive: teachers.isActive,
      })
      .from(teachers);

    return NextResponse.json({
      ok: true,
      teachers: list,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, message: "取得エラー" },
      { status: 500 }
    );
  }
}