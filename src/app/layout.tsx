import type { Metadata } from "next";
import { Cairo, Rubik } from "next/font/google";
import { homeMetadata } from "@/lib/seo";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

const cairo = Cairo({
  variable: "--font-frank",
  subsets: ["arabic", "latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = homeMetadata();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${rubik.variable} ${cairo.variable} h-full`}>
      <body className="flex min-h-full flex-col antialiased">{children}</body>
    </html>
  );
}
