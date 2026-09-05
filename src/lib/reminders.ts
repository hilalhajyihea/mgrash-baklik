import { prisma } from "@/lib/prisma";
import { buildBookingReminderSms, sendSms, sms019Configured } from "@/lib/sms";
import { consumeFieldSmsQuota, refundFieldSmsQuota } from "@/lib/smsQuota";

/**
 * Send reminder SMS for confirmed bookings starting within the next 2 hours.
 * Safe to run every few minutes; uses reminderSentAt to avoid duplicates.
 */
export async function sendDueBookingReminders(now = new Date()) {
  if (!sms019Configured()) {
    return { sent: 0, skipped: 0, failed: 0 };
  }

  const windowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      reminderSentAt: null,
      startsAt: { gt: now, lte: windowEnd },
      customerPhone: { not: "" },
      field: { smsPlanEnabled: true, isActive: true },
    },
    include: {
      field: {
        select: {
          id: true,
          displayName: true,
          slotMinutes: true,
        },
      },
    },
    orderBy: { startsAt: "asc" },
    take: 100,
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const booking of bookings) {
    const quota = await consumeFieldSmsQuota(booking.field.id);
    if (!quota.ok) {
      skipped += 1;
      continue;
    }

    const slotMinutes =
      booking.field.slotMinutes > 0 ? booking.field.slotMinutes : 90;
    const body = buildBookingReminderSms({
      customerName: booking.customerName,
      fieldName: booking.field.displayName,
      startsAt: booking.startsAt,
      slotMinutes,
    });

    const sms = await sendSms(booking.customerPhone, body);
    if (!sms.ok) {
      await refundFieldSmsQuota(booking.field.id, quota.monthKey);
      failed += 1;
      continue;
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { reminderSentAt: new Date() },
    });
    sent += 1;
  }

  return { sent, skipped, failed };
}
