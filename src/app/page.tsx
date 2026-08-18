import Link from "next/link";
import {
  SITE_ADMIN_EMAIL,
  SITE_ADMIN_PHONE,
  SITE_ADMIN_WHATSAPP,
} from "@/lib/site";
import { BrandMark } from "@/components/BrandGraphics";

const features = [
  {
    title: "رابط خاص للملعب",
    text: "كل ملعب يحصل على صفحة خاصة على نفس النطاق — الزبائن يدخلون ويحجزون ساعة.",
  },
  {
    title: "جدول حي",
    text: "الزبون يختار التاريخ والساعة المتاحة من الهاتف، بدون اتصال وبدون واتساب.",
  },
  {
    title: "تأكيد برسالة SMS",
    text: "الحجز يُغلق فقط بعد الضغط على الرابط في الرسالة — بدون حجز ساعات سدى.",
  },
  {
    title: "إدارة للملعب",
    text: "ساعات التأجير، أيام الإغلاق، الحجوزات، وإضافة يدوية تُعتمد فورًا.",
  },
];

export default function HomePage() {
  return (
    <main className="shop-shell flex-1">
      <div className="mx-auto flex min-h-[100svh] max-w-5xl flex-col px-4 py-5 sm:px-8">
        <header className="glass-nav flex items-center justify-between gap-4 rounded-2xl px-4 py-3">
          <BrandMark tone="light" />
          <Link
            href="/platform/login"
            className="rounded-xl border border-white/20 bg-black/25 px-4 py-2 text-sm font-semibold backdrop-blur-sm transition hover:bg-black/40"
          >
            دخول الإدارة
          </Link>
        </header>

        <section className="animate-fade-up mt-16 max-w-2xl sm:mt-24">
          <p className="text-xs font-semibold tracking-[0.28em] text-[var(--lime)]">
            ليلة في الملعب · حجز بضغطة
          </p>
          <h1 className="font-display mt-4 text-5xl leading-[1.04] text-[var(--cream)] sm:text-7xl">
            ملعب بكبسة زر
          </h1>
          <div className="flood-line mt-5" />
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-[rgba(244,248,238,0.82)]">
            الزبائن يحجزون ساعة من الهاتف. الملعب يبقى مرتّبًا — الحجز يكون نهائي بعد الضغط على الرابط الذي سيصلكم عبر SMS.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/ramat-gan"
              className="btn-primary rounded-xl px-6 py-3 font-semibold"
            >
              مشاهدة ملعب تجريبي
            </Link>
            <a
              href={SITE_ADMIN_WHATSAPP}
              className="rounded-xl border border-white/25 bg-black/25 px-6 py-3 font-semibold backdrop-blur-sm transition hover:bg-black/40"
            >
              تواصلوا معي عبر واتساب
            </a>
          </div>
        </section>

        <ul className="mt-16 grid gap-3 sm:grid-cols-2">
          {features.map((item) => (
            <li
              key={item.title}
              className="surface-dark rounded-2xl px-5 py-5"
            >
              <p className="text-sm font-semibold tracking-wide text-[var(--lime)]">
                {item.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[rgba(244,248,238,0.78)]">
                {item.text}
              </p>
            </li>
          ))}
        </ul>

        <footer className="mt-auto py-10 text-sm text-[rgba(244,248,238,0.62)]">
          <p>
            {SITE_ADMIN_PHONE} · {SITE_ADMIN_EMAIL}
          </p>
        </footer>
      </div>
    </main>
  );
}
