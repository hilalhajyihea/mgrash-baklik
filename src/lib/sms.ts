import { formatDateHe, formatTime, formatTimeRange } from "@/lib/time";
import { BRAND } from "@/lib/site";

/** Normalize Israeli / international phones to E.164 (+972...). */
export function normalizePhoneE164(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    digits = "+" + digits.slice(1).replace(/\D/g, "");
  } else {
    digits = digits.replace(/\D/g, "");
  }

  if (digits.startsWith("+972")) {
    const rest = digits.slice(4);
    if (rest.length < 8 || rest.length > 10) return null;
    return `+972${rest.replace(/^0+/, "")}`;
  }

  if (digits.startsWith("972")) {
    const rest = digits.slice(3).replace(/^0+/, "");
    if (rest.length < 8 || rest.length > 9) return null;
    return `+972${rest}`;
  }

  if (digits.startsWith("0")) {
    const rest = digits.slice(1);
    if (rest.length < 8 || rest.length > 9) return null;
    return `+972${rest}`;
  }

  if (/^5\d{8}$/.test(digits)) {
    return `+972${digits}`;
  }

  return null;
}

/** 019 expects 05xxxxxxxx or 5xxxxxxxx (not +972). */
export function normalizePhoneIlLocal(raw: string): string | null {
  const e164 = normalizePhoneE164(raw);
  if (!e164 || !e164.startsWith("+972")) return null;
  const national = e164.slice(4);
  if (!national) return null;
  return `0${national}`;
}

function cleanEnv(value: string | undefined) {
  if (!value) return "";
  return value.trim().replace(/^["']|["']$/g, "");
}

function getSms019Config() {
  return {
    username: cleanEnv(process.env.SMS_019_USERNAME),
    token: cleanEnv(process.env.SMS_019_TOKEN),
    source: cleanEnv(process.env.SMS_019_SOURCE),
  };
}

export function sms019Configured() {
  const { username, token, source } = getSms019Config();
  return Boolean(username && token && source);
}

export async function sendSms(
  toRaw: string,
  body: string,
): Promise<{
  ok: boolean;
  skipped?: boolean;
  error?: string;
  sid?: string;
  to?: string;
}> {
  const { username, token, source } = getSms019Config();

  if (!username || !token || !source) {
    console.warn("[sms] 019 not configured — skipping send", {
      hasUsername: Boolean(username),
      hasToken: Boolean(token),
      hasSource: Boolean(source),
    });
    return {
      ok: false,
      skipped: true,
      error: "خدمة 019 SMS غير مُعدّة على الخادم (USERNAME/TOKEN/SOURCE ناقص)",
    };
  }

  const to = normalizePhoneIlLocal(toRaw);
  if (!to) {
    return { ok: false, error: "رقم الهاتف غير صالح لإرسال SMS" };
  }

  const payload = {
    sms: {
      user: { username },
      source,
      destinations: { phone: to },
      message: body,
    },
  };

  try {
    const res = await fetch("https://019sms.co.il/api", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    const { status, message } = parse019Status(data);

    if (!res.ok || (status !== null && status !== 0)) {
      console.error("[sms] 019 error", { to, source, status, message, data });
      return {
        ok: false,
        error:
          message ||
          `فشل إرسال SMS (019 status ${status ?? res.status})`,
        to,
      };
    }

    const sid =
      data && typeof data === "object"
        ? String(
            (data as Record<string, unknown>).shipment_id ??
              (data as Record<string, unknown>).id ??
              "",
          ) || undefined
        : undefined;

    console.info("[sms] sent via 019", { to, source, status, sid });
    return { ok: true, sid, to };
  } catch (error) {
    console.error("[sms] send failed", error);
    return { ok: false, error: "خطأ في الشبكة أثناء إرسال SMS", to };
  }
}

function parse019Status(data: unknown): { status: number | null; message: string } {
  if (!data || typeof data !== "object") {
    return { status: null, message: "" };
  }
  const root = data as Record<string, unknown>;
  const nested =
    root.sms && typeof root.sms === "object"
      ? (root.sms as Record<string, unknown>)
      : root;
  const raw = nested.status ?? root.status;
  const status =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== "" && !Number.isNaN(Number(raw))
        ? Number(raw)
        : null;
  const message = String(nested.message ?? root.message ?? "");
  return { status, message };
}

export function buildHoldConfirmSms(input: {
  customerName: string;
  fieldName: string;
  startsAt: Date;
  confirmUrl: string;
  holdMinutes: number;
}): string {
  return [
    `مرحباً ${input.customerName},`,
    `لتأكيد الحجز في ${input.fieldName}`,
    `${formatDateHe(input.startsAt)} الساعة ${formatTime(input.startsAt)}`,
    `اضغطوا على الرابط خلال ${input.holdMinutes} دقيقة للتأكيد.`,
    `بعد التأكيد يمكنكم إلغاء الحجز من نفس الرابط.`,
    input.confirmUrl,
    BRAND,
  ].join("\n");
}

export function buildOwnerCancelSms(input: {
  customerName: string;
  fieldName: string;
  startsAt: Date;
}): string {
  return [
    `إلغاء حجز في ${input.fieldName}`,
    `${formatDateHe(input.startsAt)} الساعة ${formatTime(input.startsAt)}`,
    `الزبون: ${input.customerName}`,
    BRAND,
  ].join("\n");
}

export function buildOwnerNewBookingSms(input: {
  customerName: string;
  fieldName: string;
  startsAt: Date;
}): string {
  return [
    `حجز جديد في ${input.fieldName}`,
    `${formatDateHe(input.startsAt)} الساعة ${formatTime(input.startsAt)}`,
    `الزبون: ${input.customerName}`,
    BRAND,
  ].join("\n");
}

export function buildCustomerCancelledByOwnerSms(input: {
  customerName: string;
  fieldName: string;
  startsAt: Date;
}): string {
  return [
    `مرحباً ${input.customerName},`,
    `أُلغي حجزكم في ${input.fieldName} من قِبل إدارة الملعب.`,
    `${formatDateHe(input.startsAt)} الساعة ${formatTime(input.startsAt)}`,
    BRAND,
  ].join("\n");
}

export function buildConfirmedSms(input: {
  customerName: string;
  fieldName: string;
  startsAt: Date;
}): string {
  return [
    `مرحباً ${input.customerName},`,
    `تم تأكيد الحجز في ${input.fieldName}`,
    `${formatDateHe(input.startsAt)} الساعة ${formatTime(input.startsAt)}`,
    BRAND,
  ].join("\n");
}

export function buildBookingReminderSms(input: {
  customerName: string;
  fieldName: string;
  startsAt: Date;
  endsAt: Date;
}): string {
  const range = formatTimeRange(formatTime(input.startsAt), formatTime(input.endsAt));
  return [
    `مرحباً ${input.customerName},`,
    `تذكير: حجزكم في ${input.fieldName}`,
    `اليوم ${formatDateHe(input.startsAt)} الساعة ${range}`,
    `نراكم قريبًا.`,
    BRAND,
  ].join("\n");
}

export function buildCompetitionPrizeSms(input: {
  winnerName: string;
  fieldName: string;
  competitionTitle: string;
  prizeText: string;
}): string {
  return [
    `مبروك ${input.winnerName}!`,
    `فزتم في مسابقة «${input.competitionTitle}» في ${input.fieldName}.`,
    `جائزتكم: ${input.prizeText}`,
    `سيتواصل معكم مدير الملعب قريبًا.`,
    BRAND,
  ].join("\n");
}
