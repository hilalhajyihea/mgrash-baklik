import { prisma } from "@/lib/prisma";
import { generateConfirmToken } from "@/lib/tokens";
import {
  combineDateAndTime,
  dateKeyToDbDate,
  endOfJerusalemDay,
  getJerusalemDayOfWeek,
  minutesToTime,
  parseTimeToMinutes,
  startOfJerusalemDay,
} from "@/lib/time";

export async function expireHolds(now = new Date()) {
  const result = await prisma.booking.updateMany({
    where: {
      status: "HOLD",
      holdExpiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });
  return result.count;
}

function blockingStatuses() {
  return ["HOLD", "CONFIRMED"] as const;
}

function buildSlotsFromWindow(input: {
  dateKey: string;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  bookings: { startsAt: Date; endsAt: Date }[];
}) {
  const startMin = parseTimeToMinutes(input.startTime);
  const endMin = parseTimeToMinutes(input.endTime);
  const now = new Date();
  const slots: string[] = [];

  for (let t = startMin; t + input.slotMinutes <= endMin; t += input.slotMinutes) {
    const time = minutesToTime(t);
    const startsAt = combineDateAndTime(input.dateKey, time);
    const endsAt = new Date(startsAt.getTime() + input.slotMinutes * 60_000);

    if (startsAt <= now) continue;

    const conflict = input.bookings.some(
      (a) => startsAt < a.endsAt && endsAt > a.startsAt,
    );
    if (!conflict) slots.push(time);
  }

  return slots;
}

export async function getAvailableSlots(fieldId: string, dateKey: string) {
  await expireHolds();

  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    include: { workingHours: true },
  });
  if (!field || !field.isActive) return [];

  const dayOfWeek = getJerusalemDayOfWeek(combineDateAndTime(dateKey, "12:00"));
  const hours = field.workingHours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!hours) return [];

  const dayOff = await prisma.dayOff.findUnique({
    where: {
      fieldId_date: { fieldId, date: dateKeyToDbDate(dateKey) },
    },
  });
  if (dayOff) return [];

  const dayStart = startOfJerusalemDay(dateKey);
  const dayEnd = endOfJerusalemDay(dateKey);

  const bookings = await prisma.booking.findMany({
    where: {
      fieldId,
      status: { in: [...blockingStatuses()] },
      startsAt: { gte: dayStart, lt: dayEnd },
    },
  });

  return buildSlotsFromWindow({
    dateKey,
    startTime: hours.startTime,
    endTime: hours.endTime,
    slotMinutes: field.slotMinutes,
    bookings,
  });
}

export async function createPublicHold(input: {
  fieldId: string;
  dateKey: string;
  time: string;
  customerName: string;
  customerPhone: string;
}) {
  const field = await prisma.field.findUnique({
    where: { id: input.fieldId },
  });
  if (!field || !field.isActive) {
    throw new Error("המגרש לא פעיל");
  }

  const slots = await getAvailableSlots(input.fieldId, input.dateKey);
  if (!slots.includes(input.time)) {
    throw new Error("השעה אינה פנויה");
  }

  const startsAt = combineDateAndTime(input.dateKey, input.time);
  const endsAt = new Date(startsAt.getTime() + field.slotMinutes * 60_000);
  const holdExpiresAt = new Date(Date.now() + field.holdMinutes * 60_000);

  return prisma.$transaction(async (tx) => {
    const overlapping = await tx.booking.findFirst({
      where: {
        fieldId: input.fieldId,
        status: { in: [...blockingStatuses()] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (overlapping) {
      throw new Error("השעה נתפסה בינתיים");
    }

    return tx.booking.create({
      data: {
        fieldId: input.fieldId,
        startsAt,
        endsAt,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone.trim(),
        status: "HOLD",
        source: "PUBLIC",
        confirmToken: generateConfirmToken(),
        holdExpiresAt,
      },
    });
  });
}

export async function createAdminBooking(input: {
  fieldId: string;
  dateKey: string;
  time: string;
  customerName: string;
  customerPhone: string;
}) {
  const field = await prisma.field.findUnique({
    where: { id: input.fieldId },
  });
  if (!field || !field.isActive) {
    throw new Error("המגרש לא פעיל");
  }

  const slots = await getAvailableSlots(input.fieldId, input.dateKey);
  if (!slots.includes(input.time)) {
    throw new Error("השעה אינה פנויה");
  }

  const startsAt = combineDateAndTime(input.dateKey, input.time);
  const endsAt = new Date(startsAt.getTime() + field.slotMinutes * 60_000);

  return prisma.$transaction(async (tx) => {
    const overlapping = await tx.booking.findFirst({
      where: {
        fieldId: input.fieldId,
        status: { in: [...blockingStatuses()] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (overlapping) {
      throw new Error("השעה נתפסה בינתיים");
    }

    return tx.booking.create({
      data: {
        fieldId: input.fieldId,
        startsAt,
        endsAt,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone.trim(),
        status: "CONFIRMED",
        source: "ADMIN",
        confirmToken: generateConfirmToken(),
        confirmedAt: new Date(),
      },
    });
  });
}

export type ConfirmResult =
  | { ok: true; status: "CONFIRMED"; already: boolean; fieldName: string; startsAt: Date }
  | { ok: false; reason: "missing" | "expired" | "cancelled" };

export async function confirmHold(rawToken: string): Promise<ConfirmResult> {
  await expireHolds();

  const booking = await prisma.booking.findUnique({
    where: { confirmToken: rawToken },
    include: { field: { select: { displayName: true } } },
  });

  if (!booking) return { ok: false, reason: "missing" };
  if (booking.status === "CONFIRMED") {
    return {
      ok: true,
      status: "CONFIRMED",
      already: true,
      fieldName: booking.field.displayName,
      startsAt: booking.startsAt,
    };
  }
  if (booking.status === "CANCELLED") return { ok: false, reason: "cancelled" };
  if (booking.status !== "HOLD") return { ok: false, reason: "expired" };

  if (booking.holdExpiresAt && booking.holdExpiresAt < new Date()) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "EXPIRED" },
    });
    return { ok: false, reason: "expired" };
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });

  return {
    ok: true,
    status: "CONFIRMED",
    already: false,
    fieldName: booking.field.displayName,
    startsAt: updated.startsAt,
  };
}
