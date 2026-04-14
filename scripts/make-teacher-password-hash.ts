import { randomBytes, scryptSync } from "crypto";

const password = process.argv[2];

if (!password) {
  console.error("使い方: pnpm tsx scripts\\make-teacher-password-hash.ts test1234");
  process.exit(1);
}

const normalized = password.trim();
const salt = randomBytes(16).toString("hex");
const hash = scryptSync(normalized, salt, 64).toString("hex");

console.log(`t1$${salt}$${hash}`);