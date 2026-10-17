import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./theme-dark.css";
import { fontVars } from "@/lib/fonts";
import { themeScript } from "@/components/theme/themeScript";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f4f6f1",
};

export const metadata: Metadata = {
  title: "KhelaHobe — Football Match Manager",
  description:
    "Organize matches, track stats, and manage your football groups. KhelaHobe is the ultimate tool for recreational football players.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KhelaHobe",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

import { TopLoaderProvider } from '@/components/providers/TopLoaderProvider';
import Image from 'next/image';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { InstallPrompt } from '@/components/ui/InstallPrompt';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="icon" href="/icons/logo-mini.png?v=1" type="image/png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/logo.png" />
      </head>
      <body className="font-sans antialiased bg-app-bg text-app-ink relative">
        <div className="fixed inset-0 z-[-1] pointer-events-none opacity-[0.05] mix-blend-multiply dark:opacity-[0.06] dark:mix-blend-screen">
          <Image
            src="/images/bg-stadium.png"
            alt="Stadium Background"
            fill
            className="object-cover"
            sizes="100vw"
          />
        </div>
        <ThemeProvider>
          <TopLoaderProvider>
            {children}
          </TopLoaderProvider>
        </ThemeProvider>
        <InstallPrompt />
        <SpeedInsights />
      </body>
    </html>
  );
}
