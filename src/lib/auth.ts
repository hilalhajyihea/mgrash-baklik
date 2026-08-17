import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "mbk_session";

export type FieldSession = {
  kind: "field";
  fieldId: string;
  username: string;
  displayName: string;
  slug: string;
};

export type PlatformSession = {
  kind: "platform";
  username: string;
};

export type SessionPayload = FieldSession | PlatformSession;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.kind === "field") {
      if (
        typeof payload.fieldId !== "string" ||
        typeof payload.username !== "string" ||
        typeof payload.displayName !== "string" ||
        typeof payload.slug !== "string"
      ) {
        return null;
      }
      return {
        kind: "field",
        fieldId: payload.fieldId,
        username: payload.username,
        displayName: payload.displayName,
        slug: payload.slug,
      };
    }
    if (payload.kind === "platform") {
      if (typeof payload.username !== "string") return null;
      return { kind: "platform", username: payload.username };
    }
    return null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireFieldSession(slug?: string) {
  const session = await getSession();
  if (!session || session.kind !== "field") return null;
  if (slug && session.slug !== slug) return null;
  return session;
}

export async function requirePlatformSession() {
  const session = await getSession();
  if (!session || session.kind !== "platform") return null;
  return session;
}

export function verifyPlatformCredentials(username: string, password: string) {
  const expectedUser = process.env.PLATFORM_USERNAME || "admin";
  const expectedPass = process.env.PLATFORM_PASSWORD;
  if (!expectedPass) return false;
  return username === expectedUser && password === expectedPass;
}
