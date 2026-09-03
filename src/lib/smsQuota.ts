import { prisma } from "@/lib/prisma";
import { TIMEZONE } from "@/lib/time";

export type SmsQuotaResult =
  | { ok: true; monthKey: string; limit: number; usedCount: number }
  | { ok: false; monthKey: string; limit: number; error: string };

function getMonthKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";

  return `${year}-${month}`;
}

export async function consumeFieldSmsQuota(fieldId: string) {
  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    select: { smsPlanEnabled: true, smsMonthlyLimit: true },
  });

  const limit = field?.smsMonthlyLimit ?? 0;
  const monthKey = getMonthKey();

  // Unlimited quota (0) or missing field: allow sending.
  if (!field || !field.smsPlanEnabled || limit <= 0) {
    return { ok: true as const, monthKey, limit: limit || 0, usedCount: 0 };
  }

  // Ensure usage row exists.
  await prisma.smsMonthlyUsage.upsert({
    where: { fieldId_monthKey: { fieldId, monthKey } },
    update: {},
    create: { fieldId, monthKey, usedCount: 0 },
  });

  // Atomic conditional increment: only succeeds if usedCount < limit.
  const updated = await prisma.smsMonthlyUsage.updateMany({
    where: {
      fieldId,
      monthKey,
      usedCount: { lt: limit },
    },
    data: { usedCount: { increment: 1 } },
  });

  if (updated.count === 0) {
    return {
      ok: false as const,
      monthKey,
      limit,
      error: "تجاوز حد SMS الشهري. يرجى المحاولة في بداية الشهر القادم.",
    };
  }

  const usage = await prisma.smsMonthlyUsage.findUnique({
    where: { fieldId_monthKey: { fieldId, monthKey } },
    select: { usedCount: true },
  });

  return {
    ok: true as const,
    monthKey,
    limit,
    usedCount: usage?.usedCount ?? limit,
  };
}

export async function refundFieldSmsQuota(fieldId: string, monthKey?: string) {
  const key = monthKey ?? getMonthKey();

  await prisma.smsMonthlyUsage.updateMany({
    where: {
      fieldId,
      monthKey: key,
      usedCount: { gt: 0 },
    },
    data: { usedCount: { decrement: 1 } },
  });
}

export type SmsQuotaStatus = {
  monthKey: string;
  limit: number; // 0 = unlimited
  usedCount: number;
  remaining: number | null; // null = unlimited
};

export async function getFieldSmsQuotaStatus(
  fieldId: string,
): Promise<SmsQuotaStatus> {
  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    select: { smsMonthlyLimit: true },
  });

  const limit = field?.smsMonthlyLimit ?? 0;
  const monthKey = getMonthKey();

  if (limit <= 0) {
    return { monthKey, limit, usedCount: 0, remaining: null };
  }

  const usage = await prisma.smsMonthlyUsage.findUnique({
    where: { fieldId_monthKey: { fieldId, monthKey } },
    select: { usedCount: true },
  });

  const usedCount = usage?.usedCount ?? 0;
  const remaining = Math.max(limit - usedCount, 0);

  return { monthKey, limit, usedCount, remaining };
}

