import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Geist, Newsreader, Space_Grotesk } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SparkField } from "@/components/spark-field";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const AGENCY_URL = "https://nexiorastudio.com";

const FOOTER_LINK_CLASS =
  "text-sm text-neutral-400 transition hover:text-orange-400";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

// Loaded with italics because the roast's sign-off is set in them — without
// the real italic face the browser would synthesise a slanted roman, which
// looks noticeably wrong at the size that line is set.
const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "NexRoast — Find out what's holding your website back",
    template: "%s",
  },
  description:
    "A free AI website audit: your site scored across conversion, messaging, trust, UX, SEO, performance and mobile — with specific, actionable fixes.",
  openGraph: {
    siteName: "NexRoast",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${spaceGrotesk.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SparkField />
        <SiteHeader />
        {children}
        <footer className="border-t border-white/10 bg-neutral-950 px-5 py-10 sm:px-6">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/NexRoast-Logo.png"
                  alt=""
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-full"
                />
                <span className="flex flex-col">
                  <span className="font-display text-base font-bold tracking-tight text-white">
                    NexRoast
                  </span>
                  <span className="text-xs text-neutral-500">
                    Free AI website audits.
                  </span>
                </span>
              </Link>

              <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <a
                  href={AGENCY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={FOOTER_LINK_CLASS}
                >
                  Nexiora Studio ↗
                </a>
                <Link href="/privacy" className={FOOTER_LINK_CLASS}>
                  Privacy Policy
                </Link>
                <Link href="/terms" className={FOOTER_LINK_CLASS}>
                  Terms &amp; Conditions
                </Link>
              </nav>
            </div>

            <p className="text-xs text-neutral-600">
              © {new Date().getFullYear()} NexRoast — a{" "}
              <a
                href={AGENCY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 transition hover:text-neutral-400"
              >
                Nexiora Studio
              </a>{" "}
              project. All rights reserved.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
