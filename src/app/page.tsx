import Link from "next/link";
import {
  SITE_ADMIN_EMAIL,
  SITE_ADMIN_PHONE,
  SITE_ADMIN_WHATSAPP,
} from "@/lib/site";
import { BrandMark } from "@/components/BrandGraphics";

const features = [
  "כתובת ייחודית לכל מגרש על אותו דומיין",
  "לוח שעות ציבורי — הלקוח בוחר תאריך ושעה פנויה",
  "שריון נסגר רק אחרי לחיצה על קישור ב-SMS",
  "פאנל ניהול לשעות השכרה, ימים סגורים ושריונים",
  "הוספת שריון ידני מאושר מיד, בלי SMS",
];

export default function HomePage() {
  return (
    <main className="shop-shell flex-1">
      <div className="mx-auto flex min-h-[100svh] max-w-5xl flex-col px-4 py-6 sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <BrandMark tone="light" />
          <Link
            href="/platform/login"
            className="rounded-xl border border-white/25 bg-black/35 px-4 py-2 text-sm font-semibold backdrop-blur-sm"
          >
            כניסת מנהל
          </Link>
        </header>

        <section className="animate-fade-up mt-16 max-w-2xl sm:mt-24">
          <p className="text-xs font-semibold tracking-[0.22em] text-[var(--lime)]">
            שריון מגרש כדורגל
          </p>
          <h1 className="font-display mt-4 text-5xl leading-[1.05] text-[var(--cream)] sm:text-7xl">
            מגרש בקליק
          </h1>
          <p className="mt-5 max-w-lg text-lg text-[rgba(244,248,238,0.78)]">
            הלקוחות שלכם שומרים שעה מהטלפון. השריון נסגר רק אחרי אישור ב-SMS —
            בלי תפיסת שעות סתם.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/ramat-gan"
              className="btn-primary rounded-xl px-6 py-3 font-semibold"
            >
              לצפייה במגרש דמו
            </Link>
            <a
              href={SITE_ADMIN_WHATSAPP}
              className="rounded-xl border border-white/25 px-6 py-3 font-semibold"
            >
              דברו איתי בוואטסאפ
            </a>
          </div>
        </section>

        <ul className="mt-16 grid gap-3 sm:grid-cols-2">
          {features.map((item) => (
            <li
              key={item}
              className="surface-dark rounded-2xl px-4 py-4 text-sm leading-relaxed"
            >
              {item}
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
