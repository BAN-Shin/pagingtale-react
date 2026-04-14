import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export const STUDENT_SESSION_COOKIE_NAME = "pagingtale_student_session";

const SESSION_SECRET = process.env.STUDENT_SESSION_SECRET?.trim() || "";

if (process.env.NODE_ENV === "production" && !SESSION_SECRET) {
  throw new Error(
    "STUDENT_SESSION_SECRET が未設定です。.env.local などに十分長い秘密鍵を設定してください。"
  );
}

const EFFECTIVE_SESSION_SECRET =
  SESSION_SECRET || "change-this-secret-in-env";

if (process.env.NODE_ENV !== "production") {
  console.log("SESSION_SECRET length:", EFFECTIVE_SESSION_SECRET.length);
}  

export type StudentSession = {
  studentId: number;
  classId: number;
  studentNumber: string;
  studentName: string;
};

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf-8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf-8");
}

function signPayload(payload: string): string {
  return createHmac("sha256", EFFECTIVE_SESSION_SECRET)
    .update(payload)
    .digest("base64url");
}

function safeEqualText(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);

  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function encodeStudentSession(session: StudentSession): string {
  const payload = encodeBase64Url(JSON.stringify(session));
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

function decodeStudentSession(token: string): StudentSession | null {
  const [payload, signature] = token.split(".");

  if (!payload || !signature) return null;
  if (!safeEqualText(signPayload(payload), signature)) return null;

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as Partial<StudentSession>;

    if (
      typeof parsed.studentId !== "number" ||
      !Number.isInteger(parsed.studentId) ||
      parsed.studentId <= 0 ||
      typeof parsed.classId !== "number" ||
      !Number.isInteger(parsed.classId) ||
      parsed.classId <= 0 ||
      typeof parsed.studentNumber !== "string" ||
      !parsed.studentNumber.trim() ||
      typeof parsed.studentName !== "string" ||
      !parsed.studentName.trim()
    ) {
      return null;
    }

    return {
      studentId: parsed.studentId,
      classId: parsed.classId,
      studentNumber: parsed.studentNumber.trim(),
      studentName: parsed.studentName.trim(),
    };
  } catch {
    return null;
  }
}

export function verifyStudentSessionToken(token: string): boolean {
  return decodeStudentSession(token) !== null;
}

export function makeStudentPasswordHash(password: string): string {
  const normalized = password.trim();
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(normalized, salt, 64).toString("hex");
  return `s1$${salt}$${hash}`;
}

export function verifyStudentPassword(
  password: string,
  passwordHash: string
): boolean {
  const normalized = password.trim();
  const parts = passwordHash.split("$");

  if (parts.length !== 3 || parts[0] !== "s1") {
    return false;
  }

  const salt = parts[1];
  const stored = parts[2];
  const calculated = scryptSync(normalized, salt, 64).toString("hex");

  return safeEqualText(calculated, stored);
}

export async function getStudentSession(): Promise<StudentSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_SESSION_COOKIE_NAME)?.value;

  if (!token) return null;
  return decodeStudentSession(token);
}

export async function setStudentSession(session: StudentSession): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(STUDENT_SESSION_COOKIE_NAME, encodeStudentSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearStudentSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(STUDENT_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}