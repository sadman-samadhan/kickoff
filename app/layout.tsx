import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { InstallPrompt } from "@/components/ui/InstallPrompt";

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
  title: "KickOff — Football Match Manager",
  description:
    "Organize matches, track stats, and manage your football groups. KickOff is the ultimate tool for recreational football players.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KickOff",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" href="/icons/logo-mini.png" type="image/png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/logo.png" />
      </head>
      <body className="font-sans antialiased bg-slate-50 text-neutral-900">
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
