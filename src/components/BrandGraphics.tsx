export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="32" cy="32" r="30" fill="#0d331c" />
      <circle cx="32" cy="32" r="28.5" stroke="#c8e64e" strokeWidth="1.5" opacity="0.7" />
      <rect
        x="14"
        y="16"
        width="36"
        height="32"
        rx="3"
        stroke="#f4f8ee"
        strokeWidth="2"
      />
      <circle cx="32" cy="32" r="6" stroke="#f4f8ee" strokeWidth="1.6" />
      <path d="M32 16 V48" stroke="#f4f8ee" strokeWidth="1.4" />
      <path d="M14 32 H50" stroke="#f4f8ee" strokeWidth="1.4" opacity="0.5" />
      <circle cx="48" cy="18" r="4.5" fill="#c8e64e" />
    </svg>
  );
}

type BrandMarkProps = {
  className?: string;
  tone?: "dark" | "light";
  label?: string;
};

export function BrandMark({
  className = "",
  tone = "dark",
  label = "ملعب بكليك",
}: BrandMarkProps) {
  const text =
    tone === "light" ? "text-[var(--cream)]" : "text-[var(--ink)]";
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-10 w-10 shrink-0 drop-shadow-md" />
      <span className={`font-display text-xl leading-none ${text}`}>
        {label}
      </span>
    </div>
  );
}
