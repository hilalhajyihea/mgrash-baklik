import type { Metadata } from "next";
import Link from "next/link";
import { peekHold } from "@/lib/availability";
import { sanitizeToken } from "@/lib/tokens";
import { formatDateHe, formatTime } from "@/lib/time";
import { BrandMark } from "@/components/BrandGraphics";
import { ConfirmHoldButton } from "@/components/ConfirmHoldButton";
import { CancelHoldButton } from "@/components/CancelHoldButton";

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

  const fieldHref =
    preview.kind === "hold" || preview.kind === "confirmed"
      ? `/${preview.fieldSlug}`
      : preview.kind !== "missing" && preview.fieldSlug
        ? `/${preview.fieldSlug}`
        : "/";

  return (
    <main className="shop-shell flex flex-1 items-center justify-center px-4 py-12">
      <div className="surface-dark w-full max-w-md rounded-2xl p-8 text-center">
        <BrandMark tone="light" className="mb-6 justify-center" />
        {preview.kind === "hold" ? (
          <>
            <h1 className="font-display text-3xl text-[var(--cream)]">
              تأكيد الحجز
            </h1>
            <p className="mt-3 text-[rgba(244,248,238,0.78)]">
              {preview.fieldName}
              <br />
              {formatDateHe(preview.startsAt)} الساعة {formatTime(preview.startsAt)}
              <br />
              باسم {preview.customerName}
            </p>
            <p className="mt-4 text-sm text-[rgba(244,248,238,0.62)]">
              تُحفظ الساعة فقط بعد الضغط على الزر.
            </p>
            <ConfirmHoldButton token={token} />
          </>
        ) : preview.kind === "confirmed" ? (
          <>
            <h1 className="font-display text-3xl text-[var(--cream)]">
              تم تأكيد الحجز
            </h1>
            <p className="mt-3 text-[rgba(244,248,238,0.78)]">
              {preview.fieldName}
              <br />
              {formatDateHe(preview.startsAt)} الساعة {formatTime(preview.startsAt)}
            </p>
            <CancelHoldButton token={token} />
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl text-[var(--cream)]">
              تعذّر التأكيد
            </h1>
            <p className="mt-3 text-[rgba(244,248,238,0.78)]">
              {preview.kind === "expired"
                ? "انتهى وقت التأكيد. أُفرجت الساعة — يمكن الحجز من جديد."
                : preview.kind === "cancelled"
                  ? "أُلغي الحجز."
                  : "الرابط غير صالح."}
            </p>
          </>
        )}
        <Link
          href={fieldHref}
          className="mt-8 inline-block rounded-xl border border-white/20 px-6 py-3 font-semibold"
        >
          العودة إلى الملعب
        </Link>
      </div>
    </main>
  );
}
