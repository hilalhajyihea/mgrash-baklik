import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shop-shell flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="font-display text-4xl">الصفحة غير موجودة</h1>
      <p className="mt-3 text-[rgba(244,248,238,0.62)]">
        ربما العنوان غير صحيح أو أن الملعب غير فعّال.
      </p>
      <Link
        href="/"
        className="btn-primary mt-8 rounded-xl px-6 py-3 font-semibold"
      >
        العودة إلى ملعب بكليك
      </Link>
    </main>
  );
}
