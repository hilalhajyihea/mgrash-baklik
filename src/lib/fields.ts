import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

const RESERVED_SLUGS = new Set([
  "platform",
  "api",
  "admin",
  "login",
  "confirm",
  "_next",
  "favicon.ico",
]);

export function isValidSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !RESERVED_SLUGS.has(slug);
}

export async function authenticateField(username: string, password: string) {
  const field = await prisma.field.findUnique({ where: { username } });
  if (!field || !field.isActive) return null;
  const ok = await compare(password, field.passwordHash);
  if (!ok) return null;
  return field;
}

export async function createField(input: {
  slug: string;
  displayName: string;
  username: string;
  password: string;
  slotMinutes?: number;
}) {
  if (!isValidSlug(input.slug)) {
    throw new Error("عنوان غير صالح (أحرف إنجليزية صغيرة وأرقام وشرطة فقط)");
  }

  const passwordHash = await hash(input.password, 12);

  return prisma.field.create({
    data: {
      slug: input.slug,
      displayName: input.displayName.trim(),
      username: input.username.trim(),
      passwordHash,
      slotMinutes: input.slotMinutes ?? 60,
      holdMinutes: 15,
      smsPlanEnabled: true,
    },
  });
}

export async function resetFieldPassword(fieldId: string, password: string) {
  const passwordHash = await hash(password, 12);
  return prisma.field.update({
    where: { id: fieldId },
    data: { passwordHash },
  });
}
