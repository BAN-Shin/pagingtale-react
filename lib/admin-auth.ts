import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export const ADMIN_SESSION_COOKIE_NAME = "pagingtale_admin_session";

const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET?.trim() || "";

if (process.env.NODE_ENV === "production" && !SESSION_SECRET) {
  throw new Error(
    "ADMIN_SESSION_SECRET が未設定です。.env.local などに十分長い秘密鍵を設定してください。"
  );
}

const EFFECTIVE_SESSION_SECRET =
  SESSION_SECRET || "change-this-admin-secret-in-env";

export type AdminRole = "teacher" | "admin";

export type AdminSession = {
  teacherId: number;
  loginId: string;
  teacherName: string;
  role: AdminRole;
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

function encodeAdminSession(session: AdminSession): string {
  const payload = encodeBase64Url(JSON.stringify(session));
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

function decodeAdminSession(token: string): AdminSession | null {
  const [payload, signature] = token.split(".");

  if (!payload || !signature) return null;
  if (!safeEqualText(signPayload(payload), signature)) return null;

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as Partial<AdminSession>;

    if (
      typeof parsed.teacherId !== "number" ||
      !Number.isInteger(parsed.teacherId) ||
      parsed.teacherId <= 0 ||
      typeof parsed.loginId !== "string" ||
      !parsed.loginId.trim() ||
      typeof parsed.teacherName !== "string" ||
      !parsed.teacherName.trim() ||
      (parsed.role !== "teacher" && parsed.role !== "admin")
    ) {
      return null;
    }

    return {
      teacherId: parsed.teacherId,
      loginId: parsed.loginId.trim(),
      teacherName: parsed.teacherName.trim(),
      role: parsed.role,
    };
  } catch {
    return null;
  }
}

export function verifyAdminSessionToken(token: string): boolean {
  return decodeAdminSession(token) !== null;
}

export function makeTeacherPasswordHash(password: string): string {
  const normalized = password.trim();
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(normalized, salt, 64).toString("hex");
  return `t1$${salt}$${hash}`;
}

export function verifyTeacherPassword(
  password: string,
  passwordHash: string
): boolean {
  const normalized = password.trim();
  const parts = passwordHash.split("$");

  if (parts.length !== 3 || parts[0] !== "t1") {
    return false;
  }

  const salt = parts[1];
  const stored = parts[2];
  const calculated = scryptSync(normalized, salt, 64).toString("hex");

  return safeEqualText(calculated, stored);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

  if (!token) return null;
  return decodeAdminSession(token);
}

export async function setAdminSession(session: AdminSession): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, encodeAdminSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}