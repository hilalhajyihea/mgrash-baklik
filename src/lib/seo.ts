import type { Metadata } from "next";

const SITE_NAME = "מגרש בקליק";
const HOME_DESCRIPTION = "שריון מגרש כדורגל בלחיצה — בחרו שעה, אשרו ב-SMS, וזה שלכם.";

function normalizeSiteUrl(raw: string) {
  let url = raw.trim().replace(/\/$/, "");
  while (/^https?:\/\/https?:\/\//i.test(url)) {
    url = url.replace(/^https?:\/\//i, "");
  }
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

export function getSiteUrl() {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "";
  if (fromEnv) return normalizeSiteUrl(fromEnv);
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  return "https://mgrash-baklik.onrender.com";
}

export function homeMetadata(): Metadata {
  const title = `${SITE_NAME} · שריון מגרש כדורגל`;
  const url = getSiteUrl();

  return {
    title: {
      default: title,
      template: `%s · ${SITE_NAME}`,
    },
    description: HOME_DESCRIPTION,
    metadataBase: new URL(url),
    openGraph: {
      type: "website",
      locale: "he_IL",
      siteName: SITE_NAME,
      title,
      description: HOME_DESCRIPTION,
      url,
    },
  };
}

export function fieldShareMetadata(displayName: string, slug: string): Metadata {
  const title = `${SITE_NAME} · ${displayName}`;
  const description = `שריון שעה ב${displayName} — דרך ${SITE_NAME}`;
  const url = `${getSiteUrl()}/${slug}`;

  return {
    title,
    description,
    openGraph: {
      type: "website",
      locale: "he_IL",
      siteName: SITE_NAME,
      title,
      description,
      url,
    },
  };
}
