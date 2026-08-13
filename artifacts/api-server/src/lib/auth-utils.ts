import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "zp_sampark_secret_2026_key";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) return false;
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    return hash === verifyHash;
  } catch {
    return false;
  }
}

export interface JWTPayload {
  id: number;
  username: string;
  role: string;
  fullName: string;
  exp: number;
}

export function generateToken(user: { id: number; username: string; role: string; fullName: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest("base64url");

    if (signature !== expectedSignature) return null;

    const decodedPayload = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as JWTPayload;
    if (decodedPayload.exp < Math.floor(Date.now() / 1000)) return null; // Expired

    return decodedPayload;
  } catch {
    return null;
  }
}
