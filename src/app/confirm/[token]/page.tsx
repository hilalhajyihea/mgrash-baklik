import Link from "next/link";
import { confirmHold } from "@/lib/availability";
import { sanitizeToken } from "@/lib/tokens";
import { formatDateHe, formatTime } from "@/lib/time";
import { BrandMark } from "@/components/BrandGraphics";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export default async function ConfirmPage({ params }: Props) {
  const { token: raw } = await params;
  const token = sanitizeToken(raw);
  const result = token
    ? await confirmHold(token)
    : { ok: false as const, reason: "missing" as const };

  return (
    <main className="shop-shell flex flex-1 items-center justify-center px-4 py-12">
      <div className="surface-dark w-full max-w-md rounded-2xl p-8 text-center">
        <BrandMark tone="light" className="mb-6 justify-center" />
        {result.ok ? (
          <>
            <h1 className="font-display text-3xl text-[var(--cream)]">
              {result.already ? "השריון כבר אושר" : "השריון אושר"}
            </h1>
            <p className="mt-3 text-[rgba(244,248,238,0.78)]">
              {result.fieldName}
              <br />
              {formatDateHe(result.startsAt)} בשעה {formatTime(result.startsAt)}
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl text-[var(--cream)]">
              לא ניתן לאשר
            </h1>
            <p className="mt-3 text-[rgba(244,248,238,0.78)]">
              {result.reason === "expired"
                ? "חלף הזמן לאישור. השעה שוחררה — אפשר לשריין מחדש."
                : result.reason === "cancelled"
                  ? "השריון בוטל."
                  : "הקישור אינו תקין."}
            </p>
          </>
        )}
        <Link href="/" className="btn-primary mt-8 inline-block rounded-xl px-6 py-3 font-semibold">
          חזרה למגרש בקליק
        </Link>
      </div>
    </main>
  );
}
