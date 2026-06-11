import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#16a34a",
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
import { ChatUnreadProvider } from '@/components/providers/ChatUnreadProvider';
import Image from 'next/image';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { InstallPrompt } from '@/components/ui/InstallPrompt';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" href="/icons/logo-mini.png?v=1" type="image/png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/logo.png" />
      </head>
      <body className="font-sans antialiased bg-slate-50 text-neutral-900 relative">
        <div className="fixed inset-0 z-[-1] pointer-events-none opacity-[0.05] mix-blend-multiply">
          <Image
            src="/images/bg-stadium.png"
            alt="Stadium Background"
            fill
            className="object-cover"
            priority
          />
        </div>
        <TopLoaderProvider>
          <ChatUnreadProvider>
            {children}
          </ChatUnreadProvider>
        </TopLoaderProvider>
        <InstallPrompt />
        <SpeedInsights />
      </body>
    </html>
  );
}
