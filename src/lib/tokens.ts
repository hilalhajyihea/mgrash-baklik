import { randomBytes } from "crypto";
import { getSiteUrl } from "@/lib/seo";

export function generateConfirmToken() {
  return randomBytes(12).toString("base64url");
}

export function buildConfirmUrl(token: string) {
  return `${getSiteUrl()}/confirm/${token}`;
}

export function sanitizeToken(raw: string): string {
  let token = raw || "";
  try {
    token = decodeURIComponent(token);
  } catch {
    // keep raw
  }
  return token
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .trim();
}
