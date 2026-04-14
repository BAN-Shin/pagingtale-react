import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { students } from "@/db/schema";
import { makeStudentPasswordHash } from "@/lib/student-auth";

function loadEnvFile() {
  const envLocalPath = path.join(process.cwd(), ".env.local");
  const envPath = path.join(process.cwd(), ".env");

  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
    return;
  }

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

async function main() {
  loadEnvFile();

  const studentNumber = process.argv[2]?.trim();
  const studentName = process.argv[3]?.trim();
  const plainPassword = process.argv[4]?.trim();

  if (!studentNumber || !studentName || !plainPassword) {
    console.error(
      '使い方: npx tsx scripts\\set-student-password.ts "<学籍番号>" "<氏名>" "<初期パスワード>"'
    );
    process.exit(1);
  }

  if (!process.env.POSTGRES_URL?.trim()) {
    console.error("POSTGRES_URL が読み込めていません。");
    console.error(
      `確認してください: ${path.join(process.cwd(), ".env.local")}`
    );
    process.exit(1);
  }

  const matched = await db
    .select({
      id: students.id,
      classId: students.classId,
      studentNumber: students.studentNumber,
      studentName: students.studentName,
      passwordHash: students.passwordHash,
    })
    .from(students)
    .where(
      and(
        eq(students.studentNumber, studentNumber),
        eq(students.studentName, studentName)
      )
    );

  if (matched.length === 0) {
    console.error("対象の生徒が見つかりません。");
    process.exit(1);
  }

  if (matched.length > 1) {
    console.error(
      "同じ学籍番号・氏名の生徒が複数います。classId などで絞れるようにしてから実行してください。"
    );
    process.exit(1);
  }

  const target = matched[0];
  const passwordHash = makeStudentPasswordHash(plainPassword);

  await db
    .update(students)
    .set({
      passwordHash,
    })
    .where(eq(students.id, target.id));

  console.log("初期パスワードを設定しました。");
  console.log(`studentNumber: ${target.studentNumber}`);
  console.log(`studentName: ${target.studentName}`);
  console.log(`classId: ${target.classId}`);
}

main().catch((error) => {
  console.error("set-student-password エラー:", error);
  process.exit(1);
});