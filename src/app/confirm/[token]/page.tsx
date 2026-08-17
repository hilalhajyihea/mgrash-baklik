import type { Metadata } from "next";
import Link from "next/link";
import { peekHold } from "@/lib/availability";
import { sanitizeToken } from "@/lib/tokens";
import { formatDateHe, formatTime } from "@/lib/time";
import { BrandMark } from "@/components/BrandGraphics";
import { ConfirmHoldButton } from "@/components/ConfirmHoldButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

export default async function ConfirmPage({ params }: Props) {
  const { token: raw } = await params;
  const token = sanitizeToken(raw);
  const preview = token
    ? await peekHold(token)
    : { kind: "missing" as const };

  return (
    <main className="shop-shell flex flex-1 items-center justify-center px-4 py-12">
      <div className="surface-dark w-full max-w-md rounded-2xl p-8 text-center">
        <BrandMark tone="light" className="mb-6 justify-center" />
        {preview.kind === "hold" ? (
          <>
            <h1 className="font-display text-3xl text-[var(--cream)]">
              אישור שריון
            </h1>
            <p className="mt-3 text-[rgba(244,248,238,0.78)]">
              {preview.fieldName}
              <br />
              {formatDateHe(preview.startsAt)} בשעה {formatTime(preview.startsAt)}
              <br />
              על שם {preview.customerName}
            </p>
            <p className="mt-4 text-sm text-[rgba(244,248,238,0.62)]">
              השעה תישמר רק אחרי שתלחצו על הכפתור.
            </p>
            <ConfirmHoldButton token={token} />
          </>
        ) : preview.kind === "confirmed" ? (
          <>
            <h1 className="font-display text-3xl text-[var(--cream)]">
              השריון אושר
            </h1>
            <p className="mt-3 text-[rgba(244,248,238,0.78)]">
              {preview.fieldName}
              <br />
              {formatDateHe(preview.startsAt)} בשעה {formatTime(preview.startsAt)}
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl text-[var(--cream)]">
              לא ניתן לאשר
            </h1>
            <p className="mt-3 text-[rgba(244,248,238,0.78)]">
              {preview.kind === "expired"
                ? "חלף הזמן לאישור. השעה שוחררה — אפשר לשריין מחדש."
                : preview.kind === "cancelled"
                  ? "השריון בוטל."
                  : "הקישור אינו תקין."}
            </p>
          </>
        )}
        <Link
          href="/"
          className="mt-8 inline-block rounded-xl border border-white/20 px-6 py-3 font-semibold"
        >
          חזרה למגרש בקליק
        </Link>
      </div>
    </main>
  );
}
