import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap',
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
  preload: false, // 只在需要時載入
});

export const metadata: Metadata = {
  title: "羽球庫存共享小幫手 Shuttlecock Tracker.",
  description: "Shuttlecock Tracker - 羽球庫存共享小幫手",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://shuttlecock-tracker.vercel.app'),
  openGraph: {
    title: "羽球庫存共享小幫手",
    description: "Shuttlecock Tracker - 羽球庫存共享小幫手",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
